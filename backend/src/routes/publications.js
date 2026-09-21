import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, date } from '../lib/erreurs.js';

export const routeurPublications = Router();

/** « supprimee » est une corbeille : la publication reste restaurable. */
export const STATUTS_PUBLICATION = ['a_faire', 'creee', 'publiee', 'supprimee'];

export const inclusionPublication = {
  PublicationReseau: { include: { Reseau: true } },
  Achat: { select: { id: true, nom: true } },
  Boost: { include: { BoostReseau: { include: { Reseau: true } }, Frais: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } },
};

/** Aplatit les relations : réseaux, commande, boosts et leur total (montant + frais). */
export function enrichirPublication(p) {
  const { PublicationReseau, Achat, Boost, ...reste } = p;
  const boosts = (Boost ?? []).map(({ BoostReseau, ...b }) => ({
    ...b,
    reseaux: (BoostReseau ?? []).map((x) => x.Reseau),
    idReseaux: (BoostReseau ?? []).map((x) => x.idReseau),
    totalAr: Number(b.montantAr) + (b.Frais ?? []).reduce((s, f) => s + Number(f.montantAr), 0),
  }));
  return {
    ...reste,
    achat: Achat ?? null,
    reseaux: (PublicationReseau ?? []).map((x) => x.Reseau),
    idReseaux: (PublicationReseau ?? []).map((x) => x.idReseau),
    boosts,
    totalBoostsAr: boosts.reduce((s, b) => s + b.totalAr, 0),
  };
}

function lireStatut(valeur) {
  const statut = valeur ?? 'a_faire';
  exiger(STATUTS_PUBLICATION.includes(statut), 'Statut inconnu');
  return statut;
}

function lireReseaux(valeur) {
  if (valeur === undefined) return undefined;
  exiger(Array.isArray(valeur), 'Réseaux invalides');
  return [...new Set(valeur.map((id) => entierId(id, 'Réseau')))];
}

function lireCorps(corps = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const texte = (v) => (v ? String(v).trim() : null);
  return {
    donnees: {
      nom,
      description: texte(corps.description),
      statut: lireStatut(corps.statut),
      dateHeurePublication: date(corps.dateHeurePublication, 'Date de publication'),
      lienPinterest: texte(corps.lienPinterest),
      lienContenu: texte(corps.lienContenu),
      idAchat: corps.idAchat ? entierId(corps.idAchat, 'Commande') : null,
    },
    idReseaux: lireReseaux(corps.idReseaux) ?? [],
  };
}

async function charger(id) {
  const p = await prisma.publication.findUnique({ where: { id }, include: inclusionPublication });
  if (!p) throw new ErreurHttp(404, 'Publication introuvable');
  return enrichirPublication(p);
}

routeurPublications.get('/', async (req, res) => {
  const { du, au, statut, reseau, achat } = req.query;
  const where = {};
  if (du || au) {
    where.dateHeurePublication = {};
    if (du) where.dateHeurePublication.gte = date(du, 'Date de début');
    if (au) where.dateHeurePublication.lte = date(au, 'Date de fin');
  }
  // Sans filtre explicite, la corbeille est exclue
  where.statut = statut ? lireStatut(String(statut)) : { not: 'supprimee' };
  if (reseau) where.PublicationReseau = { some: { idReseau: entierId(reseau, 'Réseau') } };
  if (achat) where.idAchat = entierId(achat, 'Commande');
  const publications = await prisma.publication.findMany({
    where,
    include: inclusionPublication,
    orderBy: [{ dateHeurePublication: 'asc' }, { id: 'asc' }],
  });
  res.json(publications.map(enrichirPublication));
});

routeurPublications.get('/:id', async (req, res) => {
  res.json(await charger(entierId(req.params.id)));
});

routeurPublications.post('/', async (req, res) => {
  const { donnees, idReseaux } = lireCorps(req.body);
  const cree = await prisma.publication.create({
    data: { ...donnees, PublicationReseau: { create: idReseaux.map((idReseau) => ({ idReseau })) } },
  });
  res.status(201).json(await charger(cree.id));
});

routeurPublications.put('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const { donnees, idReseaux } = lireCorps(req.body);
  await prisma.publication.update({
    where: { id },
    data: {
      ...donnees,
      PublicationReseau: { deleteMany: {}, create: idReseaux.map((idReseau) => ({ idReseau })) },
    },
  });
  res.json(await charger(id));
});

routeurPublications.patch('/:id/statut', async (req, res) => {
  const id = entierId(req.params.id);
  await prisma.publication.update({ where: { id }, data: { statut: lireStatut(req.body?.statut) } });
  res.json(await charger(id));
});

/** Suppression douce (corbeille) ; `?definitif=1` supprime réellement, boosts compris. */
routeurPublications.delete('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  if (req.query.definitif === '1') {
    await prisma.publication.delete({ where: { id } });
    return res.status(204).end();
  }
  await prisma.publication.update({ where: { id }, data: { statut: 'supprimee' } });
  res.json(await charger(id));
});
