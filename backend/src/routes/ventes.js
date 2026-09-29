import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre, date, listeIds } from '../lib/erreurs.js';
import { arrondir, stockRestant, venteNette } from '../lib/calculs.js';

export const routeurVentes = Router();

const inclusionVente = {
  VenteReseau: { include: { Reseau: true } },
  Client: { select: { id: true, nom: true, telephone: true, adresse: true } },
  Livraison: true,
  DetailVente: {
    include: {
      DetailAchat: {
        include: {
          Produit: { include: { Categorie: true } },
          Achat: { select: { id: true, nom: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  },
};

function enrichirVente(vente) {
  const { DetailVente, VenteReseau, Client, Livraison, ...reste } = vente;
  const lignes = DetailVente.map((dv) => ({
    id: dv.id,
    idDetailAchat: dv.idDetailAchat,
    quantite: dv.quantite,
    prixVenteAr: dv.prixVenteAr,
    totalAr: Number(dv.quantite) * Number(dv.prixVenteAr),
    netAr: venteNette(dv, vente),
    produit: dv.DetailAchat.Produit,
    achat: dv.DetailAchat.Achat,
  }));
  return {
    ...reste,
    reseaux: (VenteReseau ?? []).map((x) => x.Reseau),
    idReseaux: (VenteReseau ?? []).map((x) => x.idReseau),
    client: Client ?? null,
    livraison: Livraison ?? null,
    nbArticles: lignes.reduce((s, l) => s + l.quantite, 0),
    brutAr: lignes.reduce((s, l) => s + l.totalAr, 0),
    lignes,
  };
}

function lireEntete(corps = {}) {
  const dateVente = date(corps.dateVente, 'Date de vente');
  exiger(dateVente, 'La date de vente est obligatoire');
  return {
    donnees: {
      nom: corps.nom ? String(corps.nom).trim() : null,
      idClient: corps.idClient ? entierId(corps.idClient, 'Client') : null,
      dateVente,
      reductionAr: arrondir(nombre(corps.reductionAr, { min: 0, nom: 'Réduction' }) ?? 0),
    },
    idReseaux: listeIds(corps.idReseaux, { nom: 'Réseau', minimum: 1 }),
  };
}

/**
 * Valide les lignes et vérifie le stock restant, en excluant les lignes de la
 * vente en cours de modification (idVenteExclue).
 */
async function lireLignes(corps = [], tx, idVenteExclue = null) {
  exiger(Array.isArray(corps) && corps.length > 0, 'Ajoutez au moins un article');
  const lignes = corps.map((c) => {
    const quantite = nombre(c.quantite, { min: 1, entier: true, nom: 'Quantité' });
    const prixVenteAr = nombre(c.prixVenteAr, { min: 0, nom: 'Prix de vente' });
    exiger(quantite, 'La quantité est obligatoire');
    exiger(prixVenteAr !== null, 'Le prix de vente est obligatoire');
    return { idDetailAchat: entierId(c.idDetailAchat, 'Ligne de commande'), quantite, prixVenteAr: arrondir(prixVenteAr) };
  });

  // Plusieurs lignes peuvent viser la même ligne de commande : on cumule
  const demandeParLigne = new Map();
  for (const l of lignes) demandeParLigne.set(l.idDetailAchat, (demandeParLigne.get(l.idDetailAchat) ?? 0) + l.quantite);

  const detailsAchat = await tx.detailAchat.findMany({
    where: { id: { in: [...demandeParLigne.keys()] } },
    include: {
      Produit: { select: { nom: true } },
      DetailVente: idVenteExclue ? { where: { idVente: { not: idVenteExclue } } } : true,
    },
  });
  for (const [id, demande] of demandeParLigne) {
    const detail = detailsAchat.find((d) => d.id === id);
    if (!detail) throw new ErreurHttp(404, 'Ligne de commande introuvable');
    const restant = stockRestant(detail);
    if (demande > restant) {
      throw new ErreurHttp(400, `Quantité supérieure au stock restant pour « ${detail.Produit.nom} » (reste ${restant})`);
    }
  }
  return lignes;
}

function calculerSomme(lignes, reductionAr) {
  const brut = lignes.reduce((s, l) => s + l.quantite * l.prixVenteAr, 0);
  exiger(reductionAr <= brut, 'La réduction dépasse le total de la vente');
  return arrondir(brut - reductionAr);
}

async function chargerVente(id) {
  const vente = await prisma.vente.findUnique({ where: { id }, include: inclusionVente });
  if (!vente) throw new ErreurHttp(404, 'Vente introuvable');
  return vente;
}

routeurVentes.get('/', async (req, res) => {
  const { du, au, reseau, client } = req.query;
  const where = {};
  if (client) where.idClient = entierId(client, 'Client');
  if (du || au) {
    where.dateVente = {};
    if (du) where.dateVente.gte = date(du, 'Date de début');
    if (au) where.dateVente.lte = date(au, 'Date de fin');
  }
  if (reseau) where.VenteReseau = { some: { idReseau: entierId(reseau, 'Réseau') } };
  const ventes = await prisma.vente.findMany({
    where,
    include: inclusionVente,
    orderBy: [{ dateVente: 'desc' }, { id: 'desc' }],
  });
  res.json(ventes.map(enrichirVente));
});

routeurVentes.get('/:id', async (req, res) => {
  res.json(enrichirVente(await chargerVente(entierId(req.params.id))));
});

routeurVentes.post('/', async (req, res) => {
  const { donnees: entete, idReseaux } = lireEntete(req.body);
  const id = await prisma.$transaction(async (tx) => {
    const lignes = await lireLignes(req.body?.lignes, tx);
    const vente = await tx.vente.create({
      data: {
        ...entete,
        sommeAr: calculerSomme(lignes, entete.reductionAr),
        DetailVente: { create: lignes },
        VenteReseau: { create: idReseaux.map((idReseau) => ({ idReseau })) },
      },
    });
    return vente.id;
  });
  res.status(201).json(enrichirVente(await chargerVente(id)));
});

routeurVentes.put('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  await chargerVente(id);
  const { donnees: entete, idReseaux } = lireEntete(req.body);
  await prisma.$transaction(async (tx) => {
    const lignes = await lireLignes(req.body?.lignes, tx, id);
    await tx.detailVente.deleteMany({ where: { idVente: id } });
    await tx.vente.update({
      where: { id },
      data: {
        ...entete,
        sommeAr: calculerSomme(lignes, entete.reductionAr),
        DetailVente: { create: lignes },
        VenteReseau: { deleteMany: {}, create: idReseaux.map((idReseau) => ({ idReseau })) },
      },
    });
  });
  res.json(enrichirVente(await chargerVente(id)));
});

routeurVentes.delete('/:id', async (req, res) => {
  await prisma.vente.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
