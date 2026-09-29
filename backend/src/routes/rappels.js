import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp } from '../lib/erreurs.js';
import { aujourdhui, dateHeureLocale, jour } from '../lib/dates.js';
import { calculerAccueil } from './accueil.js';

/** Routes appelées par le raccourci iOS : authentifiées par le jeton Rappels, pas par la session. */
export const routeurRappelsPublic = Router();
/** Gestion du jeton depuis l'application (session requise). */
export const routeurRappels = Router();

const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/+$/, '') ?? '';

/** Tâches à échéance à la journée (sans heure significative). */
const TYPES_A_LA_JOURNEE = new Set(['achat', 'objectif']);

const empreinte = (jeton) => crypto.createHash('sha256').update(jeton).digest('hex');

/**
 * Tâches du jour et en retard, au format attendu par le raccourci :
 * `titre` sert de clé anti-doublon, `echeance` vaut « YYYY-MM-DD HH:MM »
 * (ou « YYYY-MM-DD » pour une échéance à la journée), heure de Madagascar.
 * Jeton en `Authorization: Bearer …` ou en `?jeton=…`.
 */
routeurRappelsPublic.get('/aujourdhui', async (req, res) => {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : String(req.query.jeton ?? '').trim();
  if (!jeton) throw new ErreurHttp(401, 'Jeton Rappels requis');

  const utilisateur = await prisma.utilisateur.findUnique({ where: { jetonRappels: empreinte(jeton) } });
  if (!utilisateur || !utilisateur.actif) throw new ErreurHttp(401, 'Jeton Rappels invalide ou révoqué');

  const { date, taches } = await calculerAccueil(utilisateur.id);
  const duJour = taches
    .filter((t) => t.quand === 'jour' || t.quand === 'retard')
    .map((t) => ({
      id: t.id,
      titre: t.libelle,
      notes: [t.module, t.detail].filter(Boolean).join(' · '),
      echeance: !t.echeance ? aujourdhui() : TYPES_A_LA_JOURNEE.has(t.type) ? jour(t.echeance) : dateHeureLocale(t.echeance),
      enRetard: t.enRetard,
      url: FRONTEND_URL ? `${FRONTEND_URL}${t.lien}` : null,
    }));
  res.json({ date, nombre: duJour.length, taches: duJour });
});

routeurRappels.get('/jeton', (req, res) => {
  res.json({ actif: Boolean(req.utilisateur.jetonRappels) });
});

/** Crée (ou remplace) le jeton : renvoyé en clair une seule fois, l'ancien cesse de fonctionner. */
routeurRappels.post('/jeton', async (req, res) => {
  const jeton = crypto.randomBytes(24).toString('base64url');
  await prisma.utilisateur.update({ where: { id: req.utilisateur.id }, data: { jetonRappels: empreinte(jeton) } });
  res.status(201).json({ actif: true, jeton });
});

routeurRappels.delete('/jeton', async (req, res) => {
  await prisma.utilisateur.update({ where: { id: req.utilisateur.id }, data: { jetonRappels: null } });
  res.status(204).end();
});
