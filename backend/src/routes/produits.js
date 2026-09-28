import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre } from '../lib/erreurs.js';
import { stockRestant } from '../lib/calculs.js';

export const routeurProduits = Router();

const DOSSIER_IMAGES = path.resolve('uploads');

// Avec Supabase configuré, les images partent dans Storage (le disque de
// l'hébergeur est éphémère) ; sinon, dossier local servi sous /uploads.
const BUCKET = process.env.SUPABASE_BUCKET || 'produits';
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

function nomFichier(fichier) {
  const ext = path.extname(fichier.originalname).toLowerCase() || '.jpg';
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
}

const televersement = multer({
  storage: supabase
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: DOSSIER_IMAGES,
        filename: (req, fichier, cb) => cb(null, nomFichier(fichier)),
      }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, fichier, cb) => {
    if (fichier.mimetype.startsWith('image/')) cb(null, true);
    else cb(new ErreurHttp(400, 'Seules les images sont acceptées'));
  },
});

const MAX_IMAGES = 8;

const inclusionProduit = {
  Categorie: true,
  ProduitImage: { orderBy: [{ ordre: 'asc' }, { id: 'asc' }] },
  DetailAchat: {
    include: {
      Achat: { select: { id: true, nom: true, dateFigement: true, dateCommande: true } },
      DetailVente: { select: { quantite: true } },
    },
    orderBy: { id: 'desc' },
  },
};

/** Ajoute le stock restant (Σ lignes de commande − Σ ventes) et aplatit les relations. */
function enrichirProduit(produit) {
  const { DetailAchat, Categorie, ProduitImage, ...reste } = produit;
  const lignes = DetailAchat.map((l) => ({
    id: l.id,
    quantite: l.quantite,
    prix: l.prix,
    prixVenteAr: l.prixVenteAr,
    margePct: l.margePct,
    stockRestant: stockRestant(l),
    achat: l.Achat,
  }));
  return {
    ...reste,
    categorie: Categorie,
    // Photos secondaires, affichées à côté de la principale (Produit.image)
    images: (ProduitImage ?? []).map((i) => i.url),
    stockRestant: lignes.reduce((s, l) => s + l.stockRestant, 0),
    quantiteAchetee: lignes.reduce((s, l) => s + l.quantite, 0),
    lignes,
  };
}

function lireCorps(corps = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const idCategorie = corps.idCategorie ? entierId(corps.idCategorie, 'Catégorie') : null;
  exiger(idCategorie, 'La catégorie est obligatoire');
  const texte = (v) => (v ? String(v).trim() : null);
  return {
    nom,
    idCategorie,
    description: texte(corps.description),
    materiel: texte(corps.materiel),
    codeShein: texte(corps.codeShein),
    image: texte(corps.image),
    prix: nombre(corps.prix, { min: 0, nom: "Prix d'achat" }),
    prixVenteAr: nombre(corps.prixVenteAr, { min: 0, nom: 'Prix de vente' }),
  };
}

/**
 * Photos secondaires : liste d'URL dans l'ordre d'affichage, ou `undefined`
 * si le corps n'en parle pas (les photos existantes sont alors conservées).
 */
function lireImages(corps = {}) {
  if (corps.images === undefined) return undefined;
  exiger(Array.isArray(corps.images), 'Images : liste attendue');
  const urls = [...new Set(corps.images.map((u) => String(u ?? '').trim()).filter(Boolean))];
  exiger(urls.length <= MAX_IMAGES, `${MAX_IMAGES} photos supplémentaires maximum`);
  exiger(urls.every((u) => u.length <= 255), "Adresse d'image trop longue");
  return urls.map((url, ordre) => ({ url, ordre }));
}

routeurProduits.get('/', async (req, res) => {
  const { categorie, q } = req.query;
  const where = {};
  if (categorie) where.idCategorie = entierId(categorie, 'Catégorie');
  if (q) {
    where.OR = [
      { nom: { contains: String(q), mode: 'insensitive' } },
      { codeShein: { contains: String(q), mode: 'insensitive' } },
    ];
  }
  const produits = await prisma.produit.findMany({
    where,
    include: inclusionProduit,
    orderBy: { nom: 'asc' },
  });
  res.json(produits.map(enrichirProduit));
});

routeurProduits.post('/image', televersement.single('image'), async (req, res) => {
  exiger(req.file, 'Aucune image reçue');
  if (!supabase) return res.status(201).json({ url: `/uploads/${req.file.filename}` });

  const chemin = nomFichier(req.file);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(chemin, req.file.buffer, { contentType: req.file.mimetype, cacheControl: '604800' });
  if (error) throw new ErreurHttp(502, `Envoi de l'image impossible : ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  res.status(201).json({ url: data.publicUrl });
});

routeurProduits.get('/:id', async (req, res) => {
  const produit = await prisma.produit.findUnique({
    where: { id: entierId(req.params.id) },
    include: inclusionProduit,
  });
  if (!produit) throw new ErreurHttp(404, 'Produit introuvable');
  res.json(enrichirProduit(produit));
});

routeurProduits.post('/', async (req, res) => {
  const images = lireImages(req.body);
  const produit = await prisma.produit.create({
    data: { ...lireCorps(req.body), ...(images ? { ProduitImage: { create: images } } : {}) },
    include: inclusionProduit,
  });
  res.status(201).json(enrichirProduit(produit));
});

routeurProduits.put('/:id', async (req, res) => {
  const images = lireImages(req.body);
  // Liste envoyée = liste complète : on remplace les photos secondaires
  const produit = await prisma.produit.update({
    where: { id: entierId(req.params.id) },
    data: { ...lireCorps(req.body), ...(images ? { ProduitImage: { deleteMany: {}, create: images } } : {}) },
    include: inclusionProduit,
  });
  res.json(enrichirProduit(produit));
});

routeurProduits.delete('/:id', async (req, res) => {
  await prisma.produit.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
