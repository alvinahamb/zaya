import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { exiger } from '../lib/erreurs.js';

export const routeurNotifications = Router();

/** Au-delà, les marques « vu » ne servent plus (échéances passées) : on les purge. */
const CONSERVATION_JOURS = 60;

/** Clé d'une notification : son id et son échéance relative (demain, jour, retard). */
export const cleNotification = (n) => `${n.id}|${n.quand ?? ''}`;

/** Clés vues par l'utilisateur, pour filtrer les notifications calculées. */
export async function clesVues(idUtilisateur) {
  const vues = await prisma.notificationVue.findMany({ where: { idUtilisateur }, select: { cle: true } });
  return new Set(vues.map((v) => v.cle));
}

/** Marque une ou plusieurs notifications comme vues : `{ cles: [cle, …] }`. */
routeurNotifications.post('/vues', async (req, res) => {
  const cles = req.body?.cles;
  exiger(Array.isArray(cles) && cles.length > 0, 'Aucune notification à marquer');
  const valides = [...new Set(cles.map((c) => String(c ?? '').trim()).filter((c) => c && c.length <= 200))];
  exiger(valides.length, 'Notifications invalides');

  const idUtilisateur = req.utilisateur.id;
  const limite = new Date(Date.now() - CONSERVATION_JOURS * 86_400_000);
  await prisma.$transaction([
    prisma.notificationVue.deleteMany({ where: { idUtilisateur, dateVue: { lt: limite } } }),
    prisma.notificationVue.createMany({ data: valides.map((cle) => ({ idUtilisateur, cle })), skipDuplicates: true }),
  ]);
  res.status(204).end();
});
