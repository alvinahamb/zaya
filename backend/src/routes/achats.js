import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre, date } from '../lib/erreurs.js';
import { aujourdhui } from '../lib/dates.js';
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
          Vente: { include: { DetailVente: true, Reseau: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  },
  Frais: { orderBy: { id: 'asc' } },
  Boost: { include: { Reseau: true, Frais: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } },
  Publication: { include: { Reseau: true }, orderBy: { dateHeurePublication: 'asc' } },
};

/** Vue complète d'une commande : lignes calculées, récapitulatif, ventes liées. */
function enrichirAchat(achat, { complet = true } = {}) {
  const recap = recapAchat(achat);
  const taux = recap.tauxEuro;
  const { DetailAchat, Frais, Boost, Publication, ...reste } = achat;

  const base = {
    ...reste,
    fige: Boolean(achat.dateFigement),
    statut: statutAchat(achat, aujourdhui()),
    nbProduits: DetailAchat.length,
    taux,
    recap,
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
          reseau: v.Reseau?.nom ?? null,
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

  return { ...base, lignes, frais: Frais, boosts: Boost, publications: Publication, ventes };
}

async function chargerAchat(id, tx = prisma) {
  const achat = await tx.achat.findUnique({ where: { id }, include: inclusionAchat });
  if (!achat) throw new ErreurHttp(404, 'Commande introuvable');
  return achat;
}

function exigerBrouillon(achat) {
  if (achat.dateFigement) {
    throw new ErreurHttp(409, 'La tarification de cette commande est figée : les lignes ne sont plus modifiables');
  }
}

/** Recalcule Achat.somme (€) à partir des lignes. */
async function recalculerSomme(tx, idAchat) {
  const lignes = await tx.detailAchat.findMany({ where: { idAchat } });
  await tx.achat.update({ where: { id: idAchat }, data: { somme: arrondir(sommeLignes(lignes)) } });
}

function lireEntete(corps = {}, { fige = false } = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const donnees = {
    nom,
    description: corps.description ? String(corps.description).trim() : null,
    dateCommande: date(corps.dateCommande, 'Date de commande'),
    dateArriveeEstimee: date(corps.dateArriveeEstimee, "Date d'arrivée estimée"),
    dateArrivee: date(corps.dateArrivee, "Date d'arrivée"),
  };
  if (!fige) donnees.sommeAr = nombre(corps.sommeAr, { min: 0, nom: 'Somme payée' }) ?? 0;
  return donnees;
}

async function lireLigne(corps = {}, tx = prisma) {
  const idProduit = entierId(corps.idProduit, 'Produit');
  const produit = await tx.produit.findUnique({ where: { id: idProduit } });
  if (!produit) throw new ErreurHttp(404, 'Produit introuvable');
  const quantite = nombre(corps.quantite, { min: 1, entier: true, nom: 'Quantité' });
  exiger(quantite, 'La quantité est obligatoire');
  // Le prix du catalogue sert de valeur par défaut, modifiable jusqu'au figement
  const prix = nombre(corps.prix, { min: 0, nom: "Prix d'achat" }) ?? Number(produit.prix ?? 0);
  return { idProduit, quantite, prix: arrondir(prix) };
}

// ---------------------------------------------------------------------------
//  Lignes disponibles à la vente (commandes figées avec stock restant)
// ---------------------------------------------------------------------------
routeurAchats.get('/lignes-disponibles', async (req, res) => {
  const where = { Achat: { dateFigement: { not: null } } };
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
  const existant = await chargerAchat(id);
  // Une fois figée, la somme payée ne bouge plus : elle détermine le taux
  await prisma.achat.update({ where: { id }, data: lireEntete(req.body, { fige: Boolean(existant.dateFigement) }) });
  res.json(enrichirAchat(await chargerAchat(id)));
});

routeurAchats.delete('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const achat = await chargerAchat(id);
  const vendue = achat.DetailAchat.some((l) => l.DetailVente.length > 0);
  if (vendue) throw new ErreurHttp(409, 'Des ventes sont rattachées à cette commande, suppression impossible');
  await prisma.$transaction([
    prisma.frais.deleteMany({ where: { Boost: { idAchat: id } } }),
    prisma.boost.deleteMany({ where: { idAchat: id } }),
    prisma.achat.delete({ where: { id } }),
  ]);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
//  Lignes de commande (avant figement)
// ---------------------------------------------------------------------------
routeurAchats.post('/:id/lignes', async (req, res) => {
  const id = entierId(req.params.id);
  const achat = await chargerAchat(id);
  exigerBrouillon(achat);
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
  exigerBrouillon(achat);
  const existante = achat.DetailAchat.find((l) => l.id === idLigne);
  if (!existante) throw new ErreurHttp(404, 'Ligne introuvable');

  const quantite = nombre(req.body?.quantite, { min: 1, entier: true, nom: 'Quantité' }) ?? existante.quantite;
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
  exigerBrouillon(achat);
  if (!achat.DetailAchat.some((l) => l.id === idLigne)) throw new ErreurHttp(404, 'Ligne introuvable');
  await prisma.$transaction(async (tx) => {
    await tx.detailAchat.delete({ where: { id: idLigne } });
    await recalculerSomme(tx, id);
  });
  res.json(enrichirAchat(await chargerAchat(id)));
});

// ---------------------------------------------------------------------------
//  Tarification : enregistre prix, quantités et prix de vente.
//  Avec `figer: true` (défaut), la commande est figée et plus rien n'est recalculé.
//  Avec `figer: false`, on sauvegarde un brouillon modifiable.
// ---------------------------------------------------------------------------
routeurAchats.put('/:id/tarification', async (req, res) => {
  const id = entierId(req.params.id);
  const achat = await chargerAchat(id);
  exigerBrouillon(achat);
  const figer = req.body?.figer !== false;

  const lignesCorps = Array.isArray(req.body?.lignes) ? req.body.lignes : [];
  const sommeAr = nombre(req.body?.sommeAr, { min: 0, nom: 'Somme payée' }) ?? Number(achat.sommeAr);
  if (figer) {
    exiger(achat.DetailAchat.length > 0, 'Ajoutez au moins un produit avant de figer la tarification');
    exiger(sommeAr > 0, 'Renseignez la somme payée en Ariary pour calculer le taux');
  }

  // Étape 1 : quantités et prix d'achat, qui déterminent la somme et le taux
  const lignes = achat.DetailAchat.map((existante) => {
    const corps = lignesCorps.find((c) => Number(c.id) === existante.id) ?? {};
    const quantite = nombre(corps.quantite, { min: 1, entier: true, nom: 'Quantité' }) ?? existante.quantite;
    const prix = arrondir(nombre(corps.prix, { min: 0, nom: "Prix d'achat" }) ?? Number(existante.prix));
    let prixVenteAr = nombre(corps.prixVenteAr, { min: 0, nom: 'Prix de vente' });
    if (figer) exiger(prixVenteAr !== null, `Prix de vente manquant pour « ${existante.Produit.nom} »`);
    if (prixVenteAr !== null) prixVenteAr = arrondir(prixVenteAr);
    return { id: existante.id, idProduit: existante.idProduit, quantite, prix, prixVenteAr };
  });

  const somme = arrondir(sommeLignes(lignes));
  const taux = tauxEuro(somme, sommeAr);
  if (figer) exiger(taux, 'La somme en euro doit être supérieure à zéro');

  // Étape 2 : le prix de vente saisi fait foi, la marge en découle
  const maintenant = new Date();
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
      if (figer) await tx.produit.update({ where: { id: l.idProduit }, data: { prixVenteAr: l.prixVenteAr } });
    }
    await tx.achat.update({
      where: { id },
      data: { somme, sommeAr, ...(figer ? { dateFigement: maintenant } : {}) },
    });
  });

  res.json(enrichirAchat(await chargerAchat(id)));
});
