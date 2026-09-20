import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger, entierId } from '../lib/erreurs.js';

/**
 * CRUD générique pour les tables de référence (Categorie, Reseau) :
 * un nom unique obligatoire et quelques champs optionnels.
 */
function routeurReference({ modele, champsOptionnels = [], compte }) {
  const routeur = Router();
  const table = prisma[modele];

  const lireCorps = (corps = {}) => {
    const donnees = { nom: String(corps.nom ?? '').trim() };
    exiger(donnees.nom, 'Le nom est obligatoire');
    for (const champ of champsOptionnels) {
      if (champ in corps) donnees[champ] = corps[champ] ? String(corps[champ]).trim() : null;
    }
    return donnees;
  };

  routeur.get('/', async (req, res) => {
    const liste = await table.findMany({
      orderBy: { nom: 'asc' },
      include: compte ? { _count: { select: compte } } : undefined,
    });
    res.json(liste);
  });

  routeur.post('/', async (req, res) => {
    res.status(201).json(await table.create({ data: lireCorps(req.body) }));
  });

  routeur.put('/:id', async (req, res) => {
    const id = entierId(req.params.id);
    res.json(await table.update({ where: { id }, data: lireCorps(req.body) }));
  });

  routeur.delete('/:id', async (req, res) => {
    const id = entierId(req.params.id);
    await table.delete({ where: { id } });
    res.status(204).end();
  });

  return routeur;
}

export const routeurCategories = routeurReference({
  modele: 'categorie',
  compte: { Produit: true },
});

export const routeurReseaux = routeurReference({
  modele: 'reseau',
  champsOptionnels: ['lienCompte'],
  compte: { Vente: true, Boost: true, Publication: true },
});
