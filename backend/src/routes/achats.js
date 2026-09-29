import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre, date } from '../lib/erreurs.js';
import { aujourdhui } from '../lib/dates.js';
import { enrichirPublication } from './publications.js';
import {
  arrondir, recapAchat, statutAchat, stockRestant, sommeLignes,
  prixAchatAr, margeDepuisPrixVente, venteNette, tauxEuro,
} from '../lib/calculs.js';

export const routeurAchats = Router();

const inclusionAchat = {
  DetailAchat: {
    include: {
      Produit: { include: { Categorie: true } },
      DetailVente: {
        include: {
          Vente: { include: { DetailVente: true, VenteReseau: { include: { Reseau: true } } } },
        },
      },
    },
    orderBy: { id: 'asc' },
  },
  Frais: { orderBy: { id: 'asc' } },
  Budget: { orderBy: { id: 'asc' } },
  // Les boosts se rattachent aux publications de la commande (corbeille exclue)
  Publication: {
    where: { statut: { not: 'supprimee' } },
    include: {
      PublicationReseau: { include: { Reseau: true } },
      Boost: { include: { BoostReseau: { include: { Reseau: true } }, Frais: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } },
    },
    orderBy: { dateHeurePublication: 'asc' },
  },
};

/** Vue complète d'une commande : lignes calculées, récapitulatif, ventes liées. */
function enrichirAchat(achat, { complet = true } = {}) {
  const { DetailAchat, Frais, Budget, Publication, ...reste } = achat;
  const publications = (Publication ?? []).map(enrichirPublication);
  const boosts = publications.flatMap((p) =>
    p.boosts.map((b) => ({ ...b, publication: { id: p.id, nom: p.nom } })),
  );
  const sommeEffective = achat.sommeTotale === null ? Number(achat.somme) : Number(achat.sommeTotale);
  const recap = recapAchat({ ...achat, somme: sommeEffective, Boost: boosts });
  const taux = recap.tauxEuro;

  // Budget de communication : alloué, consommé par les boosts (et leurs frais), reste
  const budgetAr = (Budget ?? []).reduce((s, b) => s + Number(b.montantAr), 0);
  const budget = { budgetAr, depenseAr: recap.sommeBoosts, resteAr: budgetAr - recap.sommeBoosts };

  const base = {
    ...reste,
    statut: statutAchat(achat, aujourdhui()),
    nbProduits: DetailAchat.length,
    // Contenu de la commande pour l'export CSV de la liste : articles tarifés, frais et budgets
    articles: DetailAchat.map((l) => ({
      idProduit: l.idProduit,
      image: l.Produit.image,
      produit: l.Produit.nom,
      codeShein: l.Produit.codeShein,
      quantite: l.quantite,
      prix: l.prix,
      prixVenteAr: l.prixVenteAr,
      margePct: l.margePct,
    })),
    frais: Frais ?? [],
    budgets: Budget ?? [],
    nbPublications: publications.length,
    sommeEffective,
    taux,
    recap,
    budget,
  };
  if (!complet) return base;

  const lignes = DetailAchat.map((l) => {
    const restant = stockRestant(l);
    return {
      id: l.id,
      idProduit: l.idProduit,
      produit: l.Produit,
      quantite: l.quantite,
      prix: l.prix,
      margePct: l.margePct,
      prixVenteAr: l.prixVenteAr,
      prixAchatAr: prixAchatAr(l.prix, taux),
      stockRestant: restant,
      quantiteVendue: l.quantite - restant,
    };
  });

  const ventesParId = new Map();
  for (const l of DetailAchat) {
    for (const dv of l.DetailVente) {
      const v = dv.Vente;
      if (!ventesParId.has(v.id)) {
        ventesParId.set(v.id, {
          id: v.id,
          nom: v.nom,
          dateVente: v.dateVente,
          reseaux: (v.VenteReseau ?? []).map((x) => x.Reseau.nom),
          lignes: [],
          totalAr: 0,
        });
      }
      const entree = ventesParId.get(v.id);
      const net = venteNette(dv, v);
      entree.lignes.push({
        produit: l.Produit.nom,
        quantite: dv.quantite,
        prixVenteAr: dv.prixVenteAr,
        netAr: net,
      });
      entree.totalAr += net;
    }
  }
  const ventes = [...ventesParId.values()].sort((a, b) => (a.dateVente < b.dateVente ? 1 : -1));

  return { ...base, lignes, frais: Frais, budgets: Budget, boosts, publications, ventes };
}

async function chargerAchat(id, tx = prisma) {
  const achat = await tx.achat.findUnique({ where: { id }, include: inclusionAchat });
  if (!achat) throw new ErreurHttp(404, 'Commande introuvable');
  return achat;
}

/** Quantité déjà vendue d'une ligne de commande : on ne peut pas descendre en dessous. */
const quantiteVendue = (ligne) => ligne.quantite - stockRestant(ligne);

/** Recalcule Achat.somme (€) à partir des lignes. */
async function recalculerSomme(tx, idAchat) {
  const lignes = await tx.detailAchat.findMany({ where: { idAchat } });
  await tx.achat.update({ where: { id: idAchat }, data: { somme: arrondir(sommeLignes(lignes)) } });
}

function lireEntete(corps = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const donnees = {
    nom,
    description: corps.description ? String(corps.description).trim() : null,
    dateCommande: date(corps.dateCommande, 'Date de commande'),
    dateArriveeEstimee: date(corps.dateArriveeEstimee, "Date d'arrivée estimée"),
    dateArrivee: date(corps.dateArrivee, "Date d'arrivée"),
    sommeAr: nombre(corps.sommeAr, { min: 0, nom: 'Somme payée' }) ?? 0,
    sommeTotale: nombre(corps.sommeTotale, { min: 0, nom: 'Total de la commande' }),
  };
  return donnees;
}

async function lireLigne(corps = {}, tx = prisma) {
  const idProduit = entierId(corps.idProduit, 'Produit');
  const produit = await tx.produit.findUnique({ where: { id: idProduit } });
  if (!produit) throw new ErreurHttp(404, 'Produit introuvable');
  const quantite = nombre(corps.quantite, { min: 1, entier: true, nom: 'Quantité' });
  exiger(quantite, 'La quantité est obligatoire');
  // Le prix du catalogue sert de valeur par défaut, modifiable ensuite
  const prix = nombre(corps.prix, { min: 0, nom: "Prix d'achat" }) ?? Number(produit.prix ?? 0);
  return { idProduit, quantite, prix: arrondir(prix) };
}

// ---------------------------------------------------------------------------
//  Lignes disponibles à la vente (toutes les commandes, avec stock restant)
// ---------------------------------------------------------------------------
routeurAchats.get('/lignes-disponibles', async (req, res) => {
  const where = {};
  if (req.query.produit) where.idProduit = entierId(req.query.produit, 'Produit');
  if (req.query.q) {
    where.Produit = { nom: { contains: String(req.query.q), mode: 'insensitive' } };
  }
  const lignes = await prisma.detailAchat.findMany({
    where,
    include: {
      Produit: { include: { Categorie: true } },
      Achat: { select: { id: true, nom: true, dateCommande: true, dateArrivee: true } },
      DetailVente: { select: { quantite: true } },
    },
    orderBy: [{ Produit: { nom: 'asc' } }, { id: 'desc' }],
  });
  const disponibles = lignes
    .map((l) => ({
      id: l.id,
      idProduit: l.idProduit,
      produit: l.Produit,
      achat: l.Achat,
      prixVenteAr: l.prixVenteAr,
      stockRestant: stockRestant(l),
    }))
    .filter((l) => l.stockRestant > 0);
  res.json(disponibles);
});

// ---------------------------------------------------------------------------
//  Commandes
// ---------------------------------------------------------------------------
routeurAchats.get('/', async (req, res) => {
  const achats = await prisma.achat.findMany({
    include: inclusionAchat,
    orderBy: [{ dateCommande: 'desc' }, { id: 'desc' }],
  });
  res.json(achats.map((a) => enrichirAchat(a, { complet: false })));
});

routeurAchats.get('/:id', async (req, res) => {
  res.json(enrichirAchat(await chargerAchat(entierId(req.params.id))));
});

routeurAchats.post('/', async (req, res) => {
  const entete = lireEntete(req.body);
  const lignesCorps = Array.isArray(req.body?.lignes) ? req.body.lignes : [];

  const id = await prisma.$transaction(async (tx) => {
    const lignes = [];
    for (const corps of lignesCorps) lignes.push(await lireLigne(corps, tx));
    const produitsVus = new Set(lignes.map((l) => l.idProduit));
    exiger(produitsVus.size === lignes.length, 'Un produit ne peut apparaître que sur une seule ligne');

    const achat = await tx.achat.create({
      data: { ...entete, somme: arrondir(sommeLignes(lignes)), DetailAchat: { create: lignes } },
    });
    return achat.id;
  });

  res.status(201).json(enrichirAchat(await chargerAchat(id)));
});

routeurAchats.put('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  await chargerAchat(id);
  await prisma.achat.update({ where: { id }, data: lireEntete(req.body) });
  res.json(enrichirAchat(await chargerAchat(id)));
});

routeurAchats.delete('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const achat = await chargerAchat(id);
  const vendue = achat.DetailAchat.some((l) => l.DetailVente.length > 0);
  if (vendue) throw new ErreurHttp(409, 'Des ventes sont rattachées à cette commande, suppression impossible');
  // Lignes, frais et budgets partent en cascade ; les publications sont simplement détachées
  await prisma.achat.delete({ where: { id } });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
//  Lignes de commande (modifiables à tout moment)
// ---------------------------------------------------------------------------
routeurAchats.post('/:id/lignes', async (req, res) => {
  const id = entierId(req.params.id);
  const achat = await chargerAchat(id);
  const ligne = await lireLigne(req.body);
  if (achat.DetailAchat.some((l) => l.idProduit === ligne.idProduit)) {
    throw new ErreurHttp(409, 'Ce produit est déjà sur la commande');
  }
  await prisma.$transaction(async (tx) => {
    await tx.detailAchat.create({ data: { idAchat: id, ...ligne } });
    await recalculerSomme(tx, id);
  });
  res.status(201).json(enrichirAchat(await chargerAchat(id)));
});

routeurAchats.put('/:id/lignes/:idLigne', async (req, res) => {
  const id = entierId(req.params.id);
  const idLigne = entierId(req.params.idLigne);
  const achat = await chargerAchat(id);
  const existante = achat.DetailAchat.find((l) => l.id === idLigne);
  if (!existante) throw new ErreurHttp(404, 'Ligne introuvable');

  const quantite = nombre(req.body?.quantite, { min: 1, entier: true, nom: 'Quantité' }) ?? existante.quantite;
  const vendus = quantiteVendue(existante);
  exiger(quantite >= vendus, `« ${existante.Produit.nom} » : ${vendus} déjà vendu${vendus > 1 ? 's' : ''}, la quantité ne peut pas être inférieure`);
  const prix = nombre(req.body?.prix, { min: 0, nom: "Prix d'achat" }) ?? Number(existante.prix);

  await prisma.$transaction(async (tx) => {
    await tx.detailAchat.update({ where: { id: idLigne }, data: { quantite, prix: arrondir(prix) } });
    await recalculerSomme(tx, id);
  });
  res.json(enrichirAchat(await chargerAchat(id)));
});

routeurAchats.delete('/:id/lignes/:idLigne', async (req, res) => {
  const id = entierId(req.params.id);
  const idLigne = entierId(req.params.idLigne);
  const achat = await chargerAchat(id);
  const ligne = achat.DetailAchat.find((l) => l.id === idLigne);
  if (!ligne) throw new ErreurHttp(404, 'Ligne introuvable');
  if (ligne.DetailVente.length) throw new ErreurHttp(409, `« ${ligne.Produit.nom} » a déjà été vendu : il ne peut pas être retiré de la commande`);
  await prisma.$transaction(async (tx) => {
    await tx.detailAchat.delete({ where: { id: idLigne } });
    await recalculerSomme(tx, id);
  });
  res.json(enrichirAchat(await chargerAchat(id)));
});

// ---------------------------------------------------------------------------
//  Tarification : enregistre quantités, prix d'achat, somme payée et prix de
//  vente. Toujours modifiable : la marge est recalculée à chaque enregistrement.
// ---------------------------------------------------------------------------
routeurAchats.put('/:id/tarification', async (req, res) => {
  const id = entierId(req.params.id);
  const achat = await chargerAchat(id);

  const lignesCorps = Array.isArray(req.body?.lignes) ? req.body.lignes : [];
  const sommeAr = nombre(req.body?.sommeAr, { min: 0, nom: 'Somme payée' }) ?? Number(achat.sommeAr);
  const sommeTotale =
    'sommeTotale' in (req.body ?? {})
      ? nombre(req.body.sommeTotale, { min: 0, nom: 'Total de la commande' })
      : achat.sommeTotale === null ? null : Number(achat.sommeTotale);

  // Étape 1 : quantités et prix d'achat, qui déterminent la somme et le taux
  const lignes = achat.DetailAchat.map((existante) => {
    const corps = lignesCorps.find((c) => Number(c.id) === existante.id) ?? {};
    const quantite = nombre(corps.quantite, { min: 1, entier: true, nom: 'Quantité' }) ?? existante.quantite;
    const prix = arrondir(nombre(corps.prix, { min: 0, nom: "Prix d'achat" }) ?? Number(existante.prix));
    const vendus = quantiteVendue(existante);
    exiger(quantite >= vendus, `« ${existante.Produit.nom} » : ${vendus} déjà vendu${vendus > 1 ? 's' : ''}, la quantité ne peut pas être inférieure`);
    let prixVenteAr = nombre(corps.prixVenteAr, { min: 0, nom: 'Prix de vente' });
    if (prixVenteAr !== null) prixVenteAr = arrondir(prixVenteAr);
    return { id: existante.id, idProduit: existante.idProduit, quantite, prix, prixVenteAr };
  });

  const somme = arrondir(sommeLignes(lignes));
  const taux = tauxEuro(sommeTotale ?? somme, sommeAr);

  // Étape 2 : le prix de vente saisi fait foi, la marge en découle
  await prisma.$transaction(async (tx) => {
    for (const l of lignes) {
      const margePct =
        taux && l.prixVenteAr !== null
          ? arrondir(margeDepuisPrixVente(prixAchatAr(l.prix, taux), l.prixVenteAr))
          : null;
      await tx.detailAchat.update({
        where: { id: l.id },
        data: { quantite: l.quantite, prix: l.prix, prixVenteAr: l.prixVenteAr, margePct },
      });
      // Dernier prix de vente posé, indicatif sur la fiche produit
      if (l.prixVenteAr !== null) await tx.produit.update({ where: { id: l.idProduit }, data: { prixVenteAr: l.prixVenteAr } });
    }
    await tx.achat.update({
      where: { id },
      data: { somme, sommeTotale, sommeAr },
    });
  });

  res.json(enrichirAchat(await chargerAchat(id)));
});
