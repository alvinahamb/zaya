import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, listeIds } from '../lib/erreurs.js';

export const routeurClients = Router();

const inclusionClient = {
  ClientReseau: { include: { Reseau: true } },
  _count: { select: { Vente: true, Livraison: true } },
};

function enrichirClient({ ClientReseau, Vente, ...c }) {
  const client = { ...c, reseaux: ClientReseau.map((x) => x.Reseau), idReseaux: ClientReseau.map((x) => x.idReseau) };
  if (Vente) client.ventes = Vente.map(({ VenteReseau, ...v }) => ({ ...v, reseaux: (VenteReseau ?? []).map((x) => x.Reseau) }));
  return client;
}

function lireCorps(corps = {}) {
  const nom = String(corps.nom ?? '').trim();
  exiger(nom, 'Le nom est obligatoire');
  const texte = (v) => (v ? String(v).trim() : null);
  return {
    donnees: {
      nom,
      telephone: texte(corps.telephone),
      adresse: texte(corps.adresse),
      note: texte(corps.note),
    },
    idReseaux: listeIds(corps.idReseaux, { nom: 'Réseau' }),
  };
}

routeurClients.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const where = q
    ? { OR: [{ nom: { contains: q, mode: 'insensitive' } }, { telephone: { contains: q } }] }
    : {};
  const clients = await prisma.client.findMany({ where, include: inclusionClient, orderBy: { nom: 'asc' } });
  res.json(clients.map(enrichirClient));
});

routeurClients.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: entierId(req.params.id) },
    include: {
      ...inclusionClient,
      Vente: { include: { VenteReseau: { include: { Reseau: true } }, Livraison: true }, orderBy: [{ dateVente: 'desc' }, { id: 'desc' }] },
    },
  });
  if (!client) throw new ErreurHttp(404, 'Client introuvable');
  res.json(enrichirClient(client));
});

routeurClients.post('/', async (req, res) => {
  const { donnees, idReseaux } = lireCorps(req.body);
  const client = await prisma.client.create({
    data: { ...donnees, ClientReseau: { create: idReseaux.map((idReseau) => ({ idReseau })) } },
    include: inclusionClient,
  });
  res.status(201).json(enrichirClient(client));
});

routeurClients.put('/:id', async (req, res) => {
  const { donnees, idReseaux } = lireCorps(req.body);
  const client = await prisma.client.update({
    where: { id: entierId(req.params.id) },
    data: { ...donnees, ClientReseau: { deleteMany: {}, create: idReseaux.map((idReseau) => ({ idReseau })) } },
    include: inclusionClient,
  });
  res.json(enrichirClient(client));
});

routeurClients.delete('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const nb = await prisma.vente.count({ where: { idClient: id } });
  if (nb > 0) throw new ErreurHttp(409, `Ce client a ${nb} vente${nb > 1 ? 's' : ''} : suppression impossible`);
  await prisma.client.delete({ where: { id } });
  res.status(204).end();
});
