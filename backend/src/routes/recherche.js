import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const routeurRecherche = Router();

const LIMITE = 5;

/** Recherche globale : produits, commandes, ventes et publications. */
routeurRecherche.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ produits: [], achats: [], ventes: [], publications: [] });

  const contient = { contains: q, mode: 'insensitive' };
  const idNumerique = /^\d+$/.test(q) ? Number(q) : null;

  const [produits, achats, ventes, publications] = await Promise.all([
    prisma.produit.findMany({
      where: { OR: [{ nom: contient }, { codeShein: contient }] },
      select: { id: true, nom: true, image: true, codeShein: true, Categorie: { select: { nom: true } } },
      take: LIMITE,
      orderBy: { nom: 'asc' },
    }),
    prisma.achat.findMany({
      where: { OR: [{ nom: contient }, ...(idNumerique ? [{ id: idNumerique }] : [])] },
      select: { id: true, nom: true, dateCommande: true },
      take: LIMITE,
      orderBy: { id: 'desc' },
    }),
    prisma.vente.findMany({
      where: { OR: [{ nom: contient }, ...(idNumerique ? [{ id: idNumerique }] : [])] },
      select: { id: true, nom: true, dateVente: true, sommeAr: true, Reseau: { select: { nom: true } } },
      take: LIMITE,
      orderBy: { id: 'desc' },
    }),
    prisma.publication.findMany({
      where: { nom: contient },
      select: { id: true, nom: true, statut: true, dateHeurePublication: true },
      take: LIMITE,
      orderBy: { dateHeurePublication: 'desc' },
    }),
  ]);

  res.json({ produits, achats, ventes, publications });
});
