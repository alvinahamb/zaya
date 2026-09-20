import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { date } from '../lib/erreurs.js';
import { aujourdhui, ajouterJours, jour } from '../lib/dates.js';
import { venteNette, coutLigneVente, arrondir } from '../lib/calculs.js';

export const routeurStats = Router();

/**
 * Statistiques de vente sur une période, par produit, catégorie et réseau.
 * Jointures : DetailVente → DetailAchat → Produit → Categorie, et Vente → Reseau.
 * Le CA est net de réduction (répartie au prorata), le coût est le prix d'achat
 * en Ariary de la ligne de commande d'origine (prix € × taux de sa commande).
 */
routeurStats.get('/', async (req, res) => {
  const au = req.query.au ? jour(date(req.query.au, 'Date de fin')) : aujourdhui();
  const du = req.query.du ? jour(date(req.query.du, 'Date de début')) : ajouterJours(au, -365);

  const lignes = await prisma.detailVente.findMany({
    where: { Vente: { dateVente: { gte: new Date(du), lte: new Date(au) } } },
    include: {
      Vente: { include: { DetailVente: true, Reseau: true } },
      DetailAchat: {
        include: {
          Achat: { select: { id: true, nom: true, somme: true, sommeAr: true } },
          Produit: { include: { Categorie: true } },
        },
      },
    },
  });

  const groupes = { parProduit: new Map(), parCategorie: new Map(), parReseau: new Map(), parPeriode: new Map() };
  const ventesVues = new Set();
  const total = { caAr: 0, coutAr: 0, quantite: 0 };

  // Au-delà de deux mois, la courbe se lit mieux par mois que par jour
  const longueur = (new Date(au) - new Date(du)) / 86_400_000;
  const clePeriode = (d) => (longueur > 62 ? jour(d).slice(0, 7) : jour(d));

  const ajouter = (carte, cle, libelle, ca, cout, quantite) => {
    const e = carte.get(cle) ?? { id: cle, libelle, caAr: 0, coutAr: 0, quantite: 0 };
    e.caAr += ca;
    e.coutAr += cout ?? 0;
    e.quantite += quantite;
    carte.set(cle, e);
  };

  for (const l of lignes) {
    const ca = venteNette(l, l.Vente);
    const cout = coutLigneVente(l, l.DetailAchat, l.DetailAchat.Achat);
    const produit = l.DetailAchat.Produit;
    ventesVues.add(l.idVente);
    total.caAr += ca;
    total.coutAr += cout ?? 0;
    total.quantite += l.quantite;

    ajouter(groupes.parProduit, produit.id, produit.nom, ca, cout, l.quantite);
    ajouter(groupes.parCategorie, produit.Categorie.id, produit.Categorie.nom, ca, cout, l.quantite);
    ajouter(groupes.parReseau, l.Vente.Reseau.id, l.Vente.Reseau.nom, ca, cout, l.quantite);
    ajouter(groupes.parPeriode, clePeriode(l.Vente.dateVente), clePeriode(l.Vente.dateVente), ca, cout, l.quantite);
  }

  const finaliser = (carte, tri = 'ca') =>
    [...carte.values()]
      .map((e) => ({
        ...e,
        caAr: arrondir(e.caAr),
        coutAr: arrondir(e.coutAr),
        margeAr: arrondir(e.caAr - e.coutAr),
        margePct: e.coutAr ? arrondir(((e.caAr - e.coutAr) / e.coutAr) * 100) : null,
      }))
      .sort((a, b) => (tri === 'ca' ? b.caAr - a.caAr : a.id < b.id ? -1 : 1));

  const margeAr = total.caAr - total.coutAr;
  res.json({
    periode: { du, au, granularite: longueur > 62 ? 'mois' : 'jour' },
    kpis: {
      caAr: arrondir(total.caAr),
      coutAr: arrondir(total.coutAr),
      margeAr: arrondir(margeAr),
      margePct: total.coutAr ? arrondir((margeAr / total.coutAr) * 100) : null,
      nbVentes: ventesVues.size,
      nbArticles: total.quantite,
      panierMoyenAr: ventesVues.size ? arrondir(total.caAr / ventesVues.size) : 0,
    },
    parProduit: finaliser(groupes.parProduit),
    parCategorie: finaliser(groupes.parCategorie),
    parReseau: finaliser(groupes.parReseau),
    parPeriode: finaliser(groupes.parPeriode, 'id'),
  });
});
