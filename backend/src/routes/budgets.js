import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger, entierId, nombre, date } from '../lib/erreurs.js';
import { arrondir } from '../lib/calculs.js';

export const routeurBudgets = Router();

/** Budget de communication alloué à une commande, consommé par les boosts de ses publications. */
function lireCorps(corps = {}, { creation = false } = {}) {
  const montantAr = nombre(corps.montantAr, { min: 0, nom: 'Montant' });
  exiger(montantAr !== null, 'Le montant est obligatoire');
  const donnees = {
    libelle: corps.libelle ? String(corps.libelle).trim() : null,
    montantAr: arrondir(montantAr),
    dateBudget: date(corps.dateBudget, 'Date'),
  };
  if (creation) donnees.idAchat = entierId(corps.idAchat, 'Commande');
  return donnees;
}

routeurBudgets.get('/', async (req, res) => {
  const where = req.query.achat ? { idAchat: entierId(req.query.achat, 'Commande') } : {};
  res.json(await prisma.budget.findMany({ where, orderBy: { id: 'asc' } }));
});

routeurBudgets.post('/', async (req, res) => {
  res.status(201).json(await prisma.budget.create({ data: lireCorps(req.body, { creation: true }) }));
});

routeurBudgets.put('/:id', async (req, res) => {
  res.json(await prisma.budget.update({ where: { id: entierId(req.params.id) }, data: lireCorps(req.body) }));
});

routeurBudgets.delete('/:id', async (req, res) => {
  await prisma.budget.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
