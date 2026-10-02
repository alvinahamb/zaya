import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { aujourdhui, ajouterJours, jour } from '../lib/dates.js';
import { venteNette, arrondir } from '../lib/calculs.js';
import { cleNotification, clesVues } from './notifications.js';

export const routeurAccueil = Router();

/** Les tâches du tableau de bord couvrent les deux prochaines semaines. */
const HORIZON_JOURS = 14;

const NIVEAU = { retard: 'danger', jour: 'attention', demain: 'info' };

/** Nombre de jours entre deux dates YYYY-MM-DD (négatif si `cible` est passée). */
const joursEntre = (depuis, cible) =>
  Math.round((new Date(`${cible}T00:00:00Z`) - new Date(`${depuis}T00:00:00Z`)) / 86_400_000);

/**
 * Tâches à venir et alertes. Il n'y a pas de table Tâche : tout est dérivé
 * des publications, des commandes, des livraisons et des objectifs
 * du mois. Chaque tâche porte `quand` (retard | jour | demain | avenir) et
 * `jours` (écart au jour courant) ; la liste est triée par échéance.
 * Les alertes reprennent les tâches en retard, du jour et de la veille
 * (rappel la veille). `objectifsProches` : les 3 objectifs en cours qui se
 * terminent le plus tôt (puis qui commencent le plus tôt).
 */
routeurAccueil.get('/', async (req, res) => {
  res.json(await calculerAccueil(req.utilisateur.id));
});

/** Données du tableau de bord de l'utilisateur (aussi lues par les Rappels iPhone). */
export async function calculerAccueil(idUtilisateur) {
  const ceJour = aujourdhui();
  const demain = ajouterJours(ceJour, 1);
  const horizon = ajouterJours(ceJour, HORIZON_JOURS);
  const debutJour = new Date(`${ceJour}T00:00:00`);
  const finDuJour = new Date(`${ceJour}T23:59:59.999`);
  const finDemain = new Date(`${demain}T23:59:59.999`);
  const finHorizon = new Date(`${horizon}T23:59:59.999`);
  const debutMois = new Date(`${ceJour.slice(0, 7)}-01`);

  const [publications, achats, ventesMois, livraisons, objectifs, objectifsProches] = await Promise.all([
    prisma.publication.findMany({
      where: {
        statut: { notIn: ['publiee', 'supprimee'] },
        OR: [{ dateHeurePublication: { lte: finHorizon } }, { PublicationReseau: { some: { dateHeurePublication: { lte: finHorizon } } } }],
      },
      include: { PublicationReseau: { include: { Reseau: true } } },
      orderBy: { dateHeurePublication: 'asc' },
    }),
    prisma.achat.findMany({
      where: { dateArrivee: null },
      orderBy: { dateArriveeEstimee: 'asc' },
    }),
    prisma.vente.findMany({
      where: { statut: 'payee', dateVente: { gte: debutMois } },
      include: { DetailVente: true },
    }),
    prisma.livraison.findMany({
      where: { statut: { in: ['a_programmer', 'programmee', 'en_cours'] } },
      include: { Client: { select: { nom: true, telephone: true } }, Vente: { select: { id: true, nom: true, sommeAr: true } } },
      orderBy: [{ dateHeureLivraison: 'asc' }, { dateHeureAppelLivreur: 'asc' }],
    }),
    prisma.monthlyAchievement.findMany({
      where: { userId: idUtilisateur, status: 'en_cours', endDate: { lte: finHorizon } },
      orderBy: { endDate: 'asc' },
    }),
    prisma.monthlyAchievement.findMany({
      where: { userId: idUtilisateur, status: 'en_cours', endDate: { gte: new Date(ceJour) } },
      orderBy: [{ endDate: 'asc' }, { startDate: 'asc' }],
      take: 3,
    }),
  ]);

  const taches = [];
  const notifications = [];

  /** Position d'une échéance horodatée par rapport au jour courant. */
  const quandHeure = (echeance) => {
    if (!echeance) return null;
    if (echeance < debutJour) return 'retard';
    if (echeance <= finDuJour) return 'jour';
    if (echeance <= finDemain) return 'demain';
    return 'avenir';
  };
  /** Idem pour une échéance à la journée (YYYY-MM-DD). */
  const quandJour = (j) => {
    if (!j) return null;
    if (j < ceJour) return 'retard';
    if (j === ceJour) return 'jour';
    if (j === demain) return 'demain';
    return 'avenir';
  };

  /** Ajoute une tâche et, si elle est en retard, du jour ou pour demain, l'alerte correspondante. */
  const ajouter = (entree, { quand, jours, cleTri }) => {
    const tache = { ...entree, quand, jours, enRetard: quand === 'retard', cleTri };
    taches.push(tache);
    if (quand && quand !== 'avenir') notifications.push({ ...tache, niveau: NIVEAU[quand] });
  };
  const ajouterHeure = (entree) => {
    const e = entree.echeance;
    ajouter(entree, { quand: quandHeure(e), jours: e ? joursEntre(ceJour, jour(e)) : null, cleTri: e ? e.toISOString() : null });
  };
  const ajouterJour = (entree, j) => {
    ajouter(entree, { quand: quandJour(j), jours: j ? joursEntre(ceJour, j) : null, cleTri: j ? `${j}T00:00:00.000Z` : null });
  };

  // Chaque réseau peut avoir son heure : une tâche par horaire distinct
  for (const p of publications) {
    const horaires = new Map(); // ISO → { echeance, reseaux }
    for (const x of p.PublicationReseau) {
      const e = x.dateHeurePublication ?? p.dateHeurePublication;
      if (!e) continue;
      const cle = e.toISOString();
      if (!horaires.has(cle)) horaires.set(cle, { echeance: e, reseaux: [] });
      horaires.get(cle).reseaux.push(x.Reseau.nom);
    }
    if (horaires.size === 0 && p.dateHeurePublication) horaires.set('', { echeance: p.dateHeurePublication, reseaux: [] });
    const plusieurs = horaires.size > 1;
    const verbe = p.statut === 'creee' ? 'Publier' : 'Créer';
    const quoi = p.type === 'story' ? 'la story' : 'la publication';
    for (const h of [...horaires.values()].sort((a, b) => a.echeance - b.echeance)) {
      if (h.echeance > finHorizon) continue;
      ajouterHeure({
        id: plusieurs ? `publication-${p.id}-${h.echeance.getTime()}` : `publication-${p.id}`,
        type: 'publication',
        module: 'Contenus',
        libelle: plusieurs && h.reseaux.length ? `${verbe} ${quoi} « ${p.nom} » sur ${h.reseaux.join(', ')}` : `${verbe} ${quoi} « ${p.nom} »`,
        detail: h.reseaux.join(', ') || null,
        echeance: h.echeance,
        lien: `/contenus/${p.id}`,
        cible: { idPublication: p.id, statut: p.statut },
      });
    }
  }

  for (const a of achats) {
    if (!a.dateArriveeEstimee) continue;
    const estimee = jour(a.dateArriveeEstimee);
    if (estimee > horizon) continue;
    const enRetard = estimee < ceJour;
    ajouterJour(
      {
        id: `achat-${a.id}`,
        type: 'achat',
        module: 'Achats',
        libelle: enRetard ? `Commande « ${a.nom} » en retard` : `Réception prévue de « ${a.nom} »`,
        detail: `Arrivée estimée le ${estimee}`,
        echeance: a.dateArriveeEstimee,
        lien: `/achats/${a.id}`,
        cible: { idAchat: a.id },
      },
      estimee,
    );
  }

  // Livraisons : appel du livreur à passer, puis livraison prévue ou en cours
  for (const l of livraisons) {
    const qui = l.Client?.nom || l.Vente.nom || `vente n° ${l.Vente.id}`;
    const base = { type: 'livraison', module: 'Ventes', lien: `/ventes/${l.Vente.id}`, cible: { idLivraison: l.id, statut: l.statut } };
    if (l.statut === 'a_programmer' && l.dateHeureAppelLivreur && l.dateHeureAppelLivreur <= finHorizon) {
      ajouterHeure({ ...base, id: `livraison-appel-${l.id}`, libelle: `Appeler le livreur pour ${qui}`, detail: l.adresse || null, echeance: l.dateHeureAppelLivreur });
    } else if (l.statut === 'programmee' && l.dateHeureLivraison && l.dateHeureLivraison <= finHorizon) {
      ajouterHeure({ ...base, id: `livraison-jour-${l.id}`, libelle: `Livraison prévue pour ${qui}`, detail: l.adresse || null, echeance: l.dateHeureLivraison });
    } else if (l.statut === 'en_cours') {
      // Toujours à traiter aujourd'hui, quelle que soit la date prévue
      ajouter(
        { ...base, id: `livraison-cours-${l.id}`, libelle: `Livraison en cours pour ${qui}`, detail: l.livreur ? `Livreur : ${l.livreur}` : null, echeance: l.dateHeureLivraison },
        { quand: 'jour', jours: 0, cleTri: `${ceJour}T00:00:00.000Z` },
      );
    }
  }

  // Objectifs du mois de l'utilisateur dont l'échéance approche
  for (const o of objectifs) {
    const fin = jour(o.endDate);
    const reste = Math.max(0, Number(o.targetValue) - Number(o.currentValue));
    const unite = o.unit ? ` ${o.unit}` : '';
    ajouterJour(
      {
        id: `objectif-${o.id}`,
        type: 'objectif',
        module: 'Objectifs',
        libelle: fin < ceJour ? `Objectif « ${o.title} » dépassé` : `Objectif « ${o.title} » se termine`,
        detail: `${Number(o.currentValue)} / ${Number(o.targetValue)}${unite} · reste ${reste}${unite}`,
        echeance: o.endDate,
        lien: `/objectifs?mois=${fin.slice(0, 7)}`,
        cible: { idObjectif: o.id },
      },
      fin,
    );
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
        (l.statut === 'a_programmer' && l.dateHeureAppelLivreur && l.dateHeureAppelLivreur < debutJour) ||
        (l.statut !== 'a_programmer' && l.dateHeureLivraison && l.dateHeureLivraison < debutJour),
      ),
      vente: { id: l.Vente.id, nom: l.Vente.nom, sommeAr: l.Vente.sommeAr },
    }));

  // Tri par échéance la plus proche ; les tâches sans échéance en fin de liste
  taches.sort((a, b) => {
    if (a.cleTri === b.cleTri) return 0;
    if (a.cleTri === null) return 1;
    if (b.cleTri === null) return -1;
    return a.cleTri < b.cleTri ? -1 : 1;
  });
  for (const t of taches) delete t.cleTri;
  for (const n of notifications) {
    delete n.cleTri;
    n.cle = cleNotification(n);
  }
  // Les notifications marquées vues (pour cette échéance) ne sont plus renvoyées
  const vues = await clesVues(idUtilisateur);
  const nonVues = notifications.filter((n) => !vues.has(n.cle));

  const caMois = ventesMois.reduce(
    (s, v) => s + v.DetailVente.reduce((t, dv) => t + venteNette(dv, v), 0),
    0,
  );

  return {
    date: ceJour,
    horizonJours: HORIZON_JOURS,
    taches,
    notifications: nonVues,
    livraisonsDuJour,
    objectifsProches,
    kpis: {
      caMoisAr: arrondir(caMois),
      nbVentesMois: ventesMois.length,
      achatsEnCours: achats.length,
      publicationsAVenir: publications.length,
      livraisonsEnCours: livraisons.length,
    },
  };
}
