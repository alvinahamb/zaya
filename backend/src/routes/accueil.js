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

  const [publications, achats, lignesStock, ventesMois, livraisons] = await Promise.all([
    prisma.publication.findMany({
      where: { statut: { notIn: ['publiee', 'supprimee'] }, dateHeurePublication: { lte: dansTroisJours } },
      include: { PublicationReseau: { include: { Reseau: true } } },
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
    prisma.livraison.findMany({
      where: { statut: { in: ['a_programmer', 'programmee', 'en_cours'] } },
      include: { Client: { select: { nom: true, telephone: true } }, Vente: { select: { id: true, nom: true, sommeAr: true } } },
      orderBy: [{ dateHeureLivraison: 'asc' }, { dateHeureAppelLivreur: 'asc' }],
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
      detail: p.PublicationReseau.map((x) => x.Reseau.nom).join(', ') || null,
      echeance,
      enRetard,
      lien: `/publications/${p.id}`,
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

  // Livraisons : appel du livreur à passer, puis livraison du jour ou en cours
  for (const l of livraisons) {
    const qui = l.Client?.nom || l.Vente.nom || `vente n° ${l.Vente.id}`;
    const base = { type: 'livraison', module: 'Ventes', lien: `/ventes/${l.Vente.id}`, cible: { idLivraison: l.id, statut: l.statut } };
    if (l.statut === 'a_programmer' && l.dateHeureAppelLivreur && l.dateHeureAppelLivreur <= finDuJour) {
      const enRetard = l.dateHeureAppelLivreur < new Date(`${ceJour}T00:00:00`);
      const entree = { ...base, id: `livraison-appel-${l.id}`, libelle: `Appeler le livreur pour ${qui}`, detail: l.adresse || null, echeance: l.dateHeureAppelLivreur, enRetard };
      taches.push(entree);
      notifications.push({ ...entree, niveau: enRetard ? 'danger' : 'attention' });
    } else if (l.statut === 'programmee' && l.dateHeureLivraison && l.dateHeureLivraison <= finDuJour) {
      const enRetard = l.dateHeureLivraison < new Date(`${ceJour}T00:00:00`);
      const entree = { ...base, id: `livraison-jour-${l.id}`, libelle: `Livraison prévue pour ${qui}`, detail: l.adresse || null, echeance: l.dateHeureLivraison, enRetard };
      taches.push(entree);
      notifications.push({ ...entree, niveau: enRetard ? 'danger' : 'info' });
    } else if (l.statut === 'en_cours') {
      const entree = { ...base, id: `livraison-cours-${l.id}`, libelle: `Livraison en cours pour ${qui}`, detail: l.livreur ? `Livreur : ${l.livreur}` : null, echeance: l.dateHeureLivraison, enRetard: false };
      taches.push(entree);
      notifications.push({ ...entree, niveau: 'info' });
    }
  }

  // Bloc « Livraisons du jour » : celles qui demandent une action aujourd'hui
  const livraisonsDuJour = livraisons
    .filter((l) =>
      l.statut === 'en_cours' ||
      (l.dateHeureLivraison && l.dateHeureLivraison <= finDuJour) ||
      (l.dateHeureAppelLivreur && l.dateHeureAppelLivreur <= finDuJour),
    )
    .map((l) => ({
      id: l.id,
      statut: l.statut,
      client: l.Client?.nom ?? null,
      telephone: l.telephone || l.Client?.telephone || null,
      adresse: l.adresse,
      livreur: l.livreur,
      dateHeureAppelLivreur: l.dateHeureAppelLivreur,
      dateHeureLivraison: l.dateHeureLivraison,
      enRetard: Boolean(
        (l.statut === 'a_programmer' && l.dateHeureAppelLivreur && l.dateHeureAppelLivreur < new Date(`${ceJour}T00:00:00`)) ||
        (l.statut !== 'a_programmer' && l.dateHeureLivraison && l.dateHeureLivraison < new Date(`${ceJour}T00:00:00`)),
      ),
      vente: { id: l.Vente.id, nom: l.Vente.nom, sommeAr: l.Vente.sommeAr },
    }));

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
    livraisonsDuJour,
    kpis: {
      caMoisAr: arrondir(caMois),
      nbVentesMois: ventesMois.length,
      achatsEnCours: achats.length,
      publicationsAVenir: publications.length,
      livraisonsEnCours: livraisons.length,
    },
  });
});
