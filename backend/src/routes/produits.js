import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre } from '../lib/erreurs.js';
import { stockRestant } from '../lib/calculs.js';

export const routeurProduits = Router();

const DOSSIER_IMAGES = path.resolve('uploads');

const televersement = multer({
  storage: multer.diskStorage({
    destination: DOSSIER_IMAGES,
    filename: (req, fichier, cb) => {
      const ext = path.extname(fichier.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, fichier, cb) => {
    if (fichier.mimetype.startsWith('image/')) cb(null, true);
    else cb(new ErreurHttp(400, 'Seules les images sont acceptées'));
  },
});

const inclusionProduit = {
  Categorie: true,
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
  const { DetailAchat, Categorie, ...reste } = produit;
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

routeurProduits.post('/image', televersement.single('image'), (req, res) => {
  exiger(req.file, 'Aucune image reçue');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
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
  const produit = await prisma.produit.create({
    data: lireCorps(req.body),
    include: inclusionProduit,
  });
  res.status(201).json(enrichirProduit(produit));
});

routeurProduits.put('/:id', async (req, res) => {
  const produit = await prisma.produit.update({
    where: { id: entierId(req.params.id) },
    data: lireCorps(req.body),
    include: inclusionProduit,
  });
  res.json(enrichirProduit(produit));
});

routeurProduits.delete('/:id', async (req, res) => {
  await prisma.produit.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
