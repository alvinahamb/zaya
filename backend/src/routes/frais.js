import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId, nombre, date } from '../lib/erreurs.js';
import { arrondir } from '../lib/calculs.js';

export const routeurFrais = Router();

/** Un frais vise soit une commande, soit un boost, jamais les deux. */
function lireCorps(corps = {}, { cible = true } = {}) {
  const montantAr = nombre(corps.montantAr, { min: 0, nom: 'Montant' });
  exiger(montantAr !== null, 'Le montant est obligatoire');
  const donnees = {
    libelle: corps.libelle ? String(corps.libelle).trim() : null,
    montantAr: arrondir(montantAr),
    dateFrais: date(corps.dateFrais, 'Date'),
  };
  if (cible) {
    const idAchat = corps.idAchat ? entierId(corps.idAchat, 'Commande') : null;
    const idBoost = corps.idBoost ? entierId(corps.idBoost, 'Boost') : null;
    exiger((idAchat ? 1 : 0) + (idBoost ? 1 : 0) === 1, 'Un frais est rattaché à une commande ou à un boost');
    Object.assign(donnees, { idAchat, idBoost });
  }
  return donnees;
}

routeurFrais.post('/', async (req, res) => {
  res.status(201).json(await prisma.frais.create({ data: lireCorps(req.body) }));
});

routeurFrais.put('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const frais = await prisma.frais.update({ where: { id }, data: lireCorps(req.body, { cible: false }) });
  res.json(frais);
});

routeurFrais.delete('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const frais = await prisma.frais.findUnique({ where: { id } });
  if (!frais) throw new ErreurHttp(404, 'Frais introuvable');
  await prisma.frais.delete({ where: { id } });
  res.status(204).end();
});
