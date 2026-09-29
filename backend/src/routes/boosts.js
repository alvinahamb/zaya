import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger, entierId, nombre, date, listeIds } from '../lib/erreurs.js';
import { arrondir } from '../lib/calculs.js';

export const routeurBoosts = Router();

const inclusionBoost = {
  BoostReseau: { include: { Reseau: true } },
  Frais: { orderBy: { id: 'asc' } },
  Publication: { select: { id: true, nom: true, idAchat: true } },
};

function enrichirBoost({ BoostReseau, ...b }) {
  return { ...b, reseaux: BoostReseau.map((x) => x.Reseau), idReseaux: BoostReseau.map((x) => x.idReseau) };
}

function lireCorps(corps = {}, { creation = false } = {}) {
  const montantAr = nombre(corps.montantAr, { min: 0, nom: 'Montant' });
  exiger(montantAr !== null, 'Le montant est obligatoire');
  const donnees = {
    nom: corps.nom ? String(corps.nom).trim() : null,
    dateBoost: date(corps.dateBoost, 'Date'),
    montantAr: arrondir(montantAr),
    raison: corps.raison ? String(corps.raison).trim() : null,
  };
  // Un boost promeut une publication, fixée à la création
  if (creation) donnees.idPublication = entierId(corps.idPublication, 'Contenu');
  return { donnees, idReseaux: listeIds(corps.idReseaux, { nom: 'Réseau', minimum: 1 }) };
}

routeurBoosts.get('/', async (req, res) => {
  const where = req.query.publication ? { idPublication: entierId(req.query.publication, 'Publication') } : {};
  const boosts = await prisma.boost.findMany({
    where,
    include: inclusionBoost,
    orderBy: [{ dateBoost: 'desc' }, { id: 'desc' }],
  });
  res.json(boosts.map(enrichirBoost));
});

routeurBoosts.post('/', async (req, res) => {
  const { donnees, idReseaux } = lireCorps(req.body, { creation: true });
  const boost = await prisma.boost.create({
    data: { ...donnees, BoostReseau: { create: idReseaux.map((idReseau) => ({ idReseau })) } },
    include: inclusionBoost,
  });
  res.status(201).json(enrichirBoost(boost));
});

routeurBoosts.put('/:id', async (req, res) => {
  const { donnees, idReseaux } = lireCorps(req.body);
  const boost = await prisma.boost.update({
    where: { id: entierId(req.params.id) },
    data: { ...donnees, BoostReseau: { deleteMany: {}, create: idReseaux.map((idReseau) => ({ idReseau })) } },
    include: inclusionBoost,
  });
  res.json(enrichirBoost(boost));
});

routeurBoosts.delete('/:id', async (req, res) => {
  // Les frais du boost partent avec lui (ON DELETE CASCADE)
  await prisma.boost.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
