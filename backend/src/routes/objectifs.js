import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger, entierId, nombre, date, introuvable } from '../lib/erreurs.js';
import { arrondir } from '../lib/calculs.js';

export const routeurObjectifs = Router();

export const STATUTS_OBJECTIF = ['en_cours', 'atteint', 'abandonne'];
export const CATEGORIES_OBJECTIF = ['ventes', 'chiffre_affaires', 'clients', 'publications', 'stock', 'autre'];

/**
 * Objectifs du mois (table `monthly_achievements`) : chaque utilisateur ne
 * voit et ne modifie que les siens. Le statut « atteint » se déduit de la
 * progression, mais peut aussi être posé (ou retiré) à la main.
 */
function lireCorps(corps = {}) {
  const title = String(corps.title ?? '').trim();
  exiger(title, 'Le titre est obligatoire');
  exiger(title.length <= 150, 'Le titre ne doit pas dépasser 150 caractères');

  const targetValue = nombre(corps.targetValue, { min: 0, nom: 'Valeur cible' });
  exiger(targetValue !== null && targetValue > 0, 'La valeur cible est obligatoire');
  const currentValue = nombre(corps.currentValue, { min: 0, nom: 'Valeur actuelle' }) ?? 0;

  const startDate = date(corps.startDate, 'Date de début');
  const endDate = date(corps.endDate, 'Date de fin');
  exiger(startDate && endDate, 'Les dates de début et de fin sont obligatoires');
  exiger(endDate >= startDate, 'La date de fin doit être postérieure à la date de début');

  const category = corps.category ? String(corps.category).trim() : null;
  exiger(!category || CATEGORIES_OBJECTIF.includes(category), 'Catégorie inconnue');

  const status = corps.status ? String(corps.status) : 'en_cours';
  exiger(STATUTS_OBJECTIF.includes(status), 'Statut inconnu');

  return {
    title,
    description: corps.description ? String(corps.description).trim() || null : null,
    category,
    targetValue: arrondir(targetValue),
    currentValue: arrondir(currentValue),
    unit: corps.unit ? String(corps.unit).trim().slice(0, 30) || null : null,
    startDate,
    endDate,
    status,
  };
}

/** Statut et date d'achèvement cohérents avec la progression. */
function concilier(donnees, existant = null) {
  const cible = Number(donnees.targetValue ?? existant?.targetValue ?? 0);
  const actuel = Number(donnees.currentValue ?? existant?.currentValue ?? 0);
  let status = donnees.status ?? existant?.status ?? 'en_cours';
  const auto = donnees.status === undefined || donnees.status === existant?.status;

  // Sans changement de statut explicite, la progression décide
  if (auto && status !== 'abandonne') status = cible > 0 && actuel >= cible ? 'atteint' : 'en_cours';

  const completedAt = status === 'atteint' ? (existant?.status === 'atteint' && existant.completedAt) || new Date() : null;
  return { ...donnees, status, completedAt };
}

async function charger(req) {
  const objectif = await prisma.monthlyAchievement.findFirst({
    where: { id: entierId(req.params.id, 'Objectif'), userId: req.utilisateur.id },
  });
  if (!objectif) throw introuvable('Objectif');
  return objectif;
}

/** Liste des objectifs de l'utilisateur, filtrable par mois (`?mois=YYYY-MM`, période qui chevauche le mois). */
routeurObjectifs.get('/', async (req, res) => {
  const where = { userId: req.utilisateur.id };
  const mois = req.query.mois ? String(req.query.mois) : null;
  if (mois) {
    exiger(/^\d{4}-\d{2}$/.test(mois), 'Mois attendu au format AAAA-MM');
    const debut = new Date(`${mois}-01T00:00:00Z`);
    const fin = new Date(debut);
    fin.setUTCMonth(fin.getUTCMonth() + 1);
    fin.setUTCDate(0);
    where.startDate = { lte: fin };
    where.endDate = { gte: debut };
  }
  res.json(
    await prisma.monthlyAchievement.findMany({
      where,
      orderBy: [{ endDate: 'asc' }, { id: 'asc' }],
    }),
  );
});

routeurObjectifs.get('/:id', async (req, res) => {
  res.json(await charger(req));
});

routeurObjectifs.post('/', async (req, res) => {
  const donnees = concilier(lireCorps(req.body));
  res.status(201).json(await prisma.monthlyAchievement.create({ data: { ...donnees, userId: req.utilisateur.id } }));
});

routeurObjectifs.put('/:id', async (req, res) => {
  const existant = await charger(req);
  const donnees = concilier(lireCorps(req.body), existant);
  res.json(await prisma.monthlyAchievement.update({ where: { id: existant.id }, data: donnees }));
});

/** Mise à jour rapide de la progression : { currentValue } ou { delta }. */
routeurObjectifs.patch('/:id/progression', async (req, res) => {
  const existant = await charger(req);
  let valeur;
  if (req.body?.delta !== undefined) {
    const delta = nombre(req.body.delta, { nom: 'Variation' });
    exiger(delta !== null, 'Variation invalide');
    valeur = Math.max(0, Number(existant.currentValue) + delta);
  } else {
    valeur = nombre(req.body?.currentValue, { min: 0, nom: 'Valeur actuelle' });
    exiger(valeur !== null, 'La valeur actuelle est obligatoire');
  }
  const donnees = concilier({ currentValue: arrondir(valeur) }, existant);
  res.json(await prisma.monthlyAchievement.update({ where: { id: existant.id }, data: donnees }));
});

routeurObjectifs.patch('/:id/statut', async (req, res) => {
  const existant = await charger(req);
  const status = String(req.body?.status ?? '');
  exiger(STATUTS_OBJECTIF.includes(status), 'Statut inconnu');
  const donnees = concilier({ status }, existant);
  res.json(await prisma.monthlyAchievement.update({ where: { id: existant.id }, data: donnees }));
});

routeurObjectifs.delete('/:id', async (req, res) => {
  const existant = await charger(req);
  await prisma.monthlyAchievement.delete({ where: { id: existant.id } });
  res.status(204).end();
});
