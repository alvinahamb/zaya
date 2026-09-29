import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, date } from '../lib/erreurs.js';

export const routeurPublications = Router();

/** « supprimee » est une corbeille : le contenu reste restaurable. */
export const STATUTS_PUBLICATION = ['a_faire', 'creee', 'publiee', 'supprimee'];

/** Types de contenu (une publication « Contenus » dans l'interface). Ajouter un type ici suffit. */
export const TYPES_CONTENU = ['publication', 'story'];

function lireType(valeur) {
  const type = valeur ? String(valeur) : 'publication';
  exiger(TYPES_CONTENU.includes(type), 'Type de contenu inconnu');
  return type;
}

export const inclusionPublication = {
  PublicationReseau: { include: { Reseau: true } },
  Achat: { select: { id: true, nom: true } },
  PublicationProduit: { include: { Produit: { select: { id: true, nom: true, image: true, codeShein: true } } }, orderBy: { Produit: { nom: 'asc' } } },
  Boost: { include: { BoostReseau: { include: { Reseau: true } }, Frais: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } },
};

/** Aplatit les relations : réseaux, commande, boosts et leur total (montant + frais). */
export function enrichirPublication(p) {
  const { PublicationReseau, PublicationProduit, Achat, Boost, ...reste } = p;
  const boosts = (Boost ?? []).map(({ BoostReseau, ...b }) => ({
    ...b,
    reseaux: (BoostReseau ?? []).map((x) => x.Reseau),
    idReseaux: (BoostReseau ?? []).map((x) => x.idReseau),
    totalAr: Number(b.montantAr) + (b.Frais ?? []).reduce((s, f) => s + Number(f.montantAr), 0),
  }));
  return {
    ...reste,
    achat: Achat ?? null,
    // Chaque réseau expose sa date effective (la sienne, sinon celle de la publication) et sa date propre
    reseaux: (PublicationReseau ?? []).map((x) => ({
      ...x.Reseau,
      dateHeurePublication: x.dateHeurePublication ?? reste.dateHeurePublication ?? null,
      dateHeurePropre: x.dateHeurePublication ?? null,
    })),
    idReseaux: (PublicationReseau ?? []).map((x) => x.idReseau),
    // Bijoux présentés dans la publication
    produits: (PublicationProduit ?? []).map((x) => x.Produit),
    idProduits: (PublicationProduit ?? []).map((x) => x.idProduit),
    boosts,
    totalBoostsAr: boosts.reduce((s, b) => s + b.totalAr, 0),
  };
}

function lireStatut(valeur) {
  const statut = valeur ?? 'a_faire';
  exiger(STATUTS_PUBLICATION.includes(statut), 'Statut inconnu');
  return statut;
}

/**
 * Réseaux de la publication : `reseaux: [{ idReseau, dateHeurePublication? }]`
 * (chaque réseau peut avoir sa propre heure), ou l'ancien `idReseaux: [id]`.
 */
function lireReseaux(corps) {
  if (Array.isArray(corps.reseaux)) {
    const parId = new Map();
    for (const r of corps.reseaux) {
      const idReseau = entierId(r?.idReseau ?? r, 'Réseau');
      parId.set(idReseau, { idReseau, dateHeurePublication: date(r?.dateHeurePublication, 'Date de publication du réseau') });
    }
    return [...parId.values()];
  }
  if (corps.idReseaux === undefined) return [];
  exiger(Array.isArray(corps.idReseaux), 'Réseaux invalides');
  return [...new Set(corps.idReseaux.map((id) => entierId(id, 'Réseau')))].map((idReseau) => ({ idReseau, dateHeurePublication: null }));
}

function lireCorps(corps = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const texte = (v) => (v ? String(v).trim() : null);
  const reseaux = lireReseaux(corps);
  // Sans date principale, la première heure des réseaux fait foi
  let dateHeurePublication = date(corps.dateHeurePublication, 'Date de publication');
  if (!dateHeurePublication) {
    const dates = reseaux.map((r) => r.dateHeurePublication).filter(Boolean);
    if (dates.length) dateHeurePublication = new Date(Math.min(...dates.map((d) => d.getTime())));
  }
  return {
    donnees: {
      nom,
      description: texte(corps.description),
      statut: lireStatut(corps.statut),
      type: lireType(corps.type),
      dateHeurePublication,
      lienPinterest: texte(corps.lienPinterest),
      lienContenu: texte(corps.lienContenu),
      idAchat: corps.idAchat ? entierId(corps.idAchat, 'Commande') : null,
    },
    reseaux,
  };
}

/**
 * Bijoux de la publication (`idProduits`), qui doivent faire partie de la
 * commande liée. `undefined` si le corps n'en parle pas (liaison inchangée).
 */
async function lireProduits(corps, idAchat) {
  if (corps.idProduits === undefined) return undefined;
  exiger(Array.isArray(corps.idProduits), 'Bijoux : liste attendue');
  const ids = [...new Set(corps.idProduits.map((id) => entierId(id, 'Bijou')))];
  if (!ids.length) return [];
  exiger(idAchat, "Choisissez d'abord la commande dont viennent les bijoux");
  const lignes = await prisma.detailAchat.findMany({ where: { idAchat, idProduit: { in: ids } }, select: { idProduit: true } });
  exiger(lignes.length === ids.length, 'Certains bijoux ne font pas partie de la commande choisie');
  return ids.map((idProduit) => ({ idProduit }));
}

async function charger(id) {
  const p = await prisma.publication.findUnique({ where: { id }, include: inclusionPublication });
  if (!p) throw new ErreurHttp(404, 'Contenu introuvable');
  return enrichirPublication(p);
}

routeurPublications.get('/', async (req, res) => {
  const { du, au, statut, reseau, achat, type } = req.query;
  const where = {};
  if (du || au) {
    const plage = {};
    if (du) plage.gte = date(du, 'Date de début');
    if (au) plage.lte = date(au, 'Date de fin');
    // La publication ou l'un de ses réseaux tombe dans la plage
    where.OR = [{ dateHeurePublication: plage }, { PublicationReseau: { some: { dateHeurePublication: plage } } }];
  }
  // Sans filtre explicite, la corbeille est exclue
  where.statut = statut ? lireStatut(String(statut)) : { not: 'supprimee' };
  if (reseau) where.PublicationReseau = { some: { idReseau: entierId(reseau, 'Réseau') } };
  if (achat) where.idAchat = entierId(achat, 'Commande');
  if (type) where.type = lireType(type);
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
  const { donnees, reseaux } = lireCorps(req.body);
  const produits = await lireProduits(req.body, donnees.idAchat);
  const cree = await prisma.publication.create({
    data: { ...donnees, PublicationReseau: { create: reseaux }, ...(produits ? { PublicationProduit: { create: produits } } : {}) },
  });
  res.status(201).json(await charger(cree.id));
});

routeurPublications.put('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const { donnees, reseaux } = lireCorps(req.body);
  let produits = await lireProduits(req.body, donnees.idAchat);
  // Sans commande liée, plus aucun bijou ne peut rester rattaché
  if (produits === undefined && !donnees.idAchat) produits = [];
  await prisma.publication.update({
    where: { id },
    data: {
      ...donnees,
      PublicationReseau: { deleteMany: {}, create: reseaux },
      ...(produits ? { PublicationProduit: { deleteMany: {}, create: produits } } : {}),
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
