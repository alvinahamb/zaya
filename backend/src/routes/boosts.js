import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger, entierId, nombre, date } from '../lib/erreurs.js';
import { arrondir } from '../lib/calculs.js';

export const routeurBoosts = Router();

const inclusionBoost = {
  Reseau: true,
  Frais: { orderBy: { id: 'asc' } },
  Achat: { select: { id: true, nom: true } },
};

function lireCorps(corps = {}, { creation = false } = {}) {
  const montantAr = nombre(corps.montantAr, { min: 0, nom: 'Montant' });
  exiger(montantAr !== null, 'Le montant est obligatoire');
  const donnees = {
    nom: corps.nom ? String(corps.nom).trim() : null,
    idReseau: entierId(corps.idReseau, 'Réseau'),
    dateBoost: date(corps.dateBoost, 'Date'),
    montantAr: arrondir(montantAr),
    raison: corps.raison ? String(corps.raison).trim() : null,
  };
  // Un boost est toujours rattaché à une commande, fixée à la création
  if (creation) donnees.idAchat = entierId(corps.idAchat, 'Commande');
  return donnees;
}

routeurBoosts.get('/', async (req, res) => {
  const where = req.query.achat ? { idAchat: entierId(req.query.achat, 'Commande') } : {};
  const boosts = await prisma.boost.findMany({
    where,
    include: inclusionBoost,
    orderBy: [{ dateBoost: 'desc' }, { id: 'desc' }],
  });
  res.json(boosts);
});

routeurBoosts.post('/', async (req, res) => {
  const boost = await prisma.boost.create({
    data: lireCorps(req.body, { creation: true }),
    include: inclusionBoost,
  });
  res.status(201).json(boost);
});

routeurBoosts.put('/:id', async (req, res) => {
  const boost = await prisma.boost.update({
    where: { id: entierId(req.params.id) },
    data: lireCorps(req.body),
    include: inclusionBoost,
  });
  res.json(boost);
});

routeurBoosts.delete('/:id', async (req, res) => {
  // Les frais du boost partent avec lui (ON DELETE CASCADE)
  await prisma.boost.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
