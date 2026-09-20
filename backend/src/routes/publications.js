import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger, entierId, date } from '../lib/erreurs.js';

export const routeurPublications = Router();

export const STATUTS_PUBLICATION = ['a_faire', 'creee', 'publiee'];

const inclusionPublication = {
  Reseau: true,
  Achat: { select: { id: true, nom: true } },
};

function lireStatut(valeur) {
  const statut = valeur ?? 'a_faire';
  exiger(STATUTS_PUBLICATION.includes(statut), 'Statut inconnu');
  return statut;
}

function lireCorps(corps = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const lien = (v) => (v ? String(v).trim() : null);
  return {
    nom,
    description: lien(corps.description),
    statut: lireStatut(corps.statut),
    dateHeurePublication: date(corps.dateHeurePublication, 'Date de publication'),
    lienPinterest: lien(corps.lienPinterest),
    lienContenu: lien(corps.lienContenu),
    idReseau: corps.idReseau ? entierId(corps.idReseau, 'Réseau') : null,
    idAchat: corps.idAchat ? entierId(corps.idAchat, 'Commande') : null,
  };
}

routeurPublications.get('/', async (req, res) => {
  const { du, au, statut, reseau, achat } = req.query;
  const where = {};
  if (du || au) {
    where.dateHeurePublication = {};
    if (du) where.dateHeurePublication.gte = date(du, 'Date de début');
    if (au) where.dateHeurePublication.lte = date(au, 'Date de fin');
  }
  if (statut) where.statut = lireStatut(String(statut));
  if (reseau) where.idReseau = entierId(reseau, 'Réseau');
  if (achat) where.idAchat = entierId(achat, 'Commande');
  const publications = await prisma.publication.findMany({
    where,
    include: inclusionPublication,
    orderBy: [{ dateHeurePublication: 'asc' }, { id: 'asc' }],
  });
  res.json(publications);
});

routeurPublications.post('/', async (req, res) => {
  const publication = await prisma.publication.create({ data: lireCorps(req.body), include: inclusionPublication });
  res.status(201).json(publication);
});

routeurPublications.put('/:id', async (req, res) => {
  const publication = await prisma.publication.update({
    where: { id: entierId(req.params.id) },
    data: lireCorps(req.body),
    include: inclusionPublication,
  });
  res.json(publication);
});

routeurPublications.patch('/:id/statut', async (req, res) => {
  const publication = await prisma.publication.update({
    where: { id: entierId(req.params.id) },
    data: { statut: lireStatut(req.body?.statut) },
    include: inclusionPublication,
  });
  res.json(publication);
});

routeurPublications.delete('/:id', async (req, res) => {
  await prisma.publication.delete({ where: { id: entierId(req.params.id) } });
  res.status(204).end();
});
