import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { aujourdhui, ajouterJours, jour } from '../lib/dates.js';
import { stockRestant, venteNette, arrondir } from '../lib/calculs.js';

export const routeurAccueil = Router();

const SEUIL_STOCK_BAS = 2;

/**
 * Tâches du jour et alertes. Il n'y a pas de table Tâche : tout est dérivé
 * des publications, des commandes et du stock.
 */
routeurAccueil.get('/', async (req, res) => {
  const ceJour = aujourdhui();
  const finDuJour = new Date(`${ceJour}T23:59:59.999`);
  const dansTroisJours = new Date(`${ajouterJours(ceJour, 3)}T23:59:59.999`);
  const debutMois = new Date(`${ceJour.slice(0, 7)}-01`);

  const [publications, achats, lignesStock, ventesMois] = await Promise.all([
    prisma.publication.findMany({
      where: { statut: { not: 'publiee' }, dateHeurePublication: { lte: dansTroisJours } },
      include: { Reseau: true },
      orderBy: { dateHeurePublication: 'asc' },
    }),
    prisma.achat.findMany({
      where: { dateArrivee: null },
      orderBy: { dateArriveeEstimee: 'asc' },
    }),
    prisma.detailAchat.findMany({
      where: { Achat: { dateFigement: { not: null } } },
      include: { Produit: { select: { id: true, nom: true, image: true } }, DetailVente: { select: { quantite: true } } },
    }),
    prisma.vente.findMany({
      where: { dateVente: { gte: debutMois } },
      include: { DetailVente: true },
    }),
  ]);

  const taches = [];
  const notifications = [];

  for (const p of publications) {
    const echeance = p.dateHeurePublication;
    const enRetard = echeance < new Date(`${ceJour}T00:00:00`);
    const duJour = echeance <= finDuJour;
    const entree = {
      id: `publication-${p.id}`,
      type: 'publication',
      module: 'Publications',
      libelle: p.statut === 'creee' ? `Publier « ${p.nom} »` : `Créer « ${p.nom} »`,
      detail: p.Reseau?.nom ?? null,
      echeance,
      enRetard,
      lien: `/publications?ouvrir=${p.id}`,
      cible: { idPublication: p.id, statut: p.statut },
    };
    if (duJour) taches.push(entree);
    notifications.push({ ...entree, niveau: enRetard ? 'danger' : 'attention' });
  }

  for (const a of achats) {
    if (!a.dateArriveeEstimee) continue;
    const estimee = jour(a.dateArriveeEstimee);
    if (estimee > ceJour) continue;
    const enRetard = estimee < ceJour;
    const entree = {
      id: `achat-${a.id}`,
      type: 'achat',
      module: 'Achats',
      libelle: enRetard ? `Commande « ${a.nom} » en retard` : `Réception prévue de « ${a.nom} »`,
      detail: `Arrivée estimée le ${estimee}`,
      echeance: a.dateArriveeEstimee,
      enRetard,
      lien: `/achats/${a.id}`,
      cible: { idAchat: a.id },
    };
    taches.push(entree);
    notifications.push({ ...entree, niveau: enRetard ? 'danger' : 'info' });
  }

  // Stock par produit sur les commandes figées
  const parProduit = new Map();
  for (const l of lignesStock) {
    const e = parProduit.get(l.idProduit) ?? { produit: l.Produit, achete: 0, restant: 0 };
    e.achete += l.quantite;
    e.restant += stockRestant(l);
    parProduit.set(l.idProduit, e);
  }
  for (const { produit, achete, restant } of parProduit.values()) {
    if (!achete) continue;
    const base = { type: 'stock', module: 'Produits', lien: `/produits/${produit.id}`, cible: { idProduit: produit.id } };
    if (restant <= 0) {
      const entree = { ...base, id: `rupture-${produit.id}`, libelle: `« ${produit.nom} » en rupture`, detail: 'Stock restant : 0', enRetard: false, echeance: null };
      taches.push(entree);
      notifications.push({ ...entree, niveau: 'danger' });
    } else if (restant <= SEUIL_STOCK_BAS) {
      notifications.push({ ...base, id: `stock-bas-${produit.id}`, libelle: `Stock bas pour « ${produit.nom} »`, detail: `Reste ${restant}`, niveau: 'attention', enRetard: false, echeance: null });
    }
  }

  const caMois = ventesMois.reduce(
    (s, v) => s + v.DetailVente.reduce((t, dv) => t + venteNette(dv, v), 0),
    0,
  );

  res.json({
    date: ceJour,
    taches,
    notifications,
    kpis: {
      caMoisAr: arrondir(caMois),
      nbVentesMois: ventesMois.length,
      achatsEnCours: achats.length,
      publicationsAVenir: publications.length,
    },
  });
});
