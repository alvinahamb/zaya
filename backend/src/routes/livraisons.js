import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre, date } from '../lib/erreurs.js';
import { arrondir } from '../lib/calculs.js';

export const routeurLivraisons = Router();

/** a_programmer → programmee (livreur appelé) → en_cours → livree ; annulee à tout moment. */
export const STATUTS_LIVRAISON = ['a_programmer', 'programmee', 'en_cours', 'livree', 'annulee'];

export const inclusionLivraison = {
  Client: { select: { id: true, nom: true, telephone: true } },
  Vente: { select: { id: true, nom: true, dateVente: true, sommeAr: true } },
};

function lireStatut(valeur) {
  const statut = valeur ?? 'a_programmer';
  exiger(STATUTS_LIVRAISON.includes(statut), 'Statut de livraison inconnu');
  return statut;
}

/** Ajuste l'horodatage de livraison réelle selon le statut. */
function horodatage(statut, existant) {
  if (statut === 'livree') return existant ?? new Date();
  return null;
}

async function lireCorps(corps = {}, { creation = false } = {}) {
  const texte = (v) => (v ? String(v).trim() : null);
  const donnees = {
    libelle: texte(corps.libelle),
    adresse: texte(corps.adresse),
    telephone: texte(corps.telephone),
    livreur: texte(corps.livreur),
    fraisAr: arrondir(nombre(corps.fraisAr, { min: 0, nom: 'Frais de livraison' }) ?? 0),
    statut: lireStatut(corps.statut),
    dateHeureAppelLivreur: date(corps.dateHeureAppelLivreur, "Date d'appel du livreur"),
    dateHeureLivraison: date(corps.dateHeureLivraison, 'Date de livraison'),
    note: texte(corps.note),
    idClient: corps.idClient ? entierId(corps.idClient, 'Client') : null,
  };
  if (creation) {
    donnees.idVente = entierId(corps.idVente, 'Vente');
    const vente = await prisma.vente.findUnique({ where: { id: donnees.idVente }, include: { Client: true, Livraison: true } });
    if (!vente) throw new ErreurHttp(404, 'Vente introuvable');
    if (vente.Livraison) throw new ErreurHttp(409, 'Cette vente a déjà une livraison');
    // Par défaut, la livraison hérite du client de la vente et de ses coordonnées
    donnees.idClient ??= vente.idClient;
    if (vente.Client) {
      donnees.adresse ??= vente.Client.adresse;
      donnees.telephone ??= vente.Client.telephone;
    }
  }
  return donnees;
}

async function charger(id) {
  const l = await prisma.livraison.findUnique({ where: { id }, include: inclusionLivraison });
  if (!l) throw new ErreurHttp(404, 'Livraison introuvable');
  return l;
}

routeurLivraisons.get('/', async (req, res) => {
  const { statut, du, au, client } = req.query;
  const where = {};
  if (statut) where.statut = lireStatut(String(statut));
  if (client) where.idClient = entierId(client, 'Client');
  if (du || au) {
    where.dateHeureLivraison = {};
    if (du) where.dateHeureLivraison.gte = date(du, 'Date de début');
    if (au) where.dateHeureLivraison.lte = date(au, 'Date de fin');
  }
  const livraisons = await prisma.livraison.findMany({
    where,
    include: inclusionLivraison,
    orderBy: [{ dateHeureLivraison: 'asc' }, { id: 'desc' }],
  });
  res.json(livraisons);
});

routeurLivraisons.get('/:id', async (req, res) => {
  res.json(await charger(entierId(req.params.id)));
});

routeurLivraisons.post('/', async (req, res) => {
  const donnees = await lireCorps(req.body, { creation: true });
  const cree = await prisma.livraison.create({
    data: { ...donnees, dateHeureLivree: horodatage(donnees.statut, null) },
  });
  res.status(201).json(await charger(cree.id));
});

routeurLivraisons.put('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const existante = await charger(id);
  const donnees = await lireCorps(req.body);
  await prisma.livraison.update({
    where: { id },
    data: { ...donnees, dateHeureLivree: horodatage(donnees.statut, existante.dateHeureLivree) },
  });
  res.json(await charger(id));
});

routeurLivraisons.patch('/:id/statut', async (req, res) => {
  const id = entierId(req.params.id);
  const existante = await charger(id);
  const statut = lireStatut(req.body?.statut);
  await prisma.livraison.update({
    where: { id },
    data: { statut, dateHeureLivree: horodatage(statut, existante.dateHeureLivree) },
  });
  res.json(await charger(id));
});

routeurLivraisons.delete('/:id', async (req, res) => {
  await prisma.livraison.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
