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

/** Heure retenue pour une échéance à la journée (heure de Madagascar, TZ du serveur). */
const HEURE_A_LA_JOURNEE = '09:00';
/** Jours d'avance de l'alerte par défaut (`?avance=` pour changer, 0 à 14). */
const AVANCE_JOURS = 2;

/**
 * Tâches en retard et des deux prochaines semaines (horizon du tableau de bord),
 * au format attendu par le raccourci, heures de Madagascar « YYYY-MM-DD HH:MM » :
 * `titre` sert de clé anti-doublon ; `echeance` est l'échéance réelle (rappelée
 * dans `notes`) ; `alerte` la précède de `avance` jours, ou vaut l'échéance quand
 * ce moment est déjà passé. Jeton en `Authorization: Bearer …` ou en `?jeton=…`.
 */
routeurRappelsPublic.get('/aujourdhui', async (req, res) => {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : String(req.query.jeton ?? '').trim();
  if (!jeton) throw new ErreurHttp(401, 'Jeton Rappels requis');

  const utilisateur = await prisma.utilisateur.findUnique({ where: { jetonRappels: empreinte(jeton) } });
  if (!utilisateur || !utilisateur.actif) throw new ErreurHttp(401, 'Jeton Rappels invalide ou révoqué');

  const avance = req.query.avance === undefined ? AVANCE_JOURS : Number(req.query.avance);
  if (!Number.isInteger(avance) || avance < 0 || avance > 14) throw new ErreurHttp(400, 'avance : nombre de jours entre 0 et 14');

  const { date, taches } = await calculerAccueil(utilisateur.id);
  const maintenant = new Date();
  const aVenir = taches.map((t) => {
    const moment = !t.echeance
      ? new Date(`${aujourdhui()}T${HEURE_A_LA_JOURNEE}`)
      : TYPES_A_LA_JOURNEE.has(t.type)
        ? new Date(`${jour(t.echeance)}T${HEURE_A_LA_JOURNEE}`)
        : new Date(t.echeance);
    const avantEcheance = new Date(moment.getTime() - avance * 86_400_000);
    const echeance = dateHeureLocale(moment);
    return {
      id: t.id,
      titre: t.libelle,
      notes: [`Échéance : ${echeance}`, t.module, t.detail].filter(Boolean).join(' · '),
      echeance,
      alerte: dateHeureLocale(avantEcheance > maintenant ? avantEcheance : moment),
      enRetard: t.enRetard,
      url: FRONTEND_URL ? `${FRONTEND_URL}${t.lien}` : null,
    };
  });
  res.json({ date, avanceJours: avance, nombre: aVenir.length, taches: aVenir });
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
