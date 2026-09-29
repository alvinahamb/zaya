import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp } from '../lib/erreurs.js';
import { ajouterJours, aujourdhui, dateHeureLocale, jour } from '../lib/dates.js';
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
/** Durée affichée des événements horodatés dans le calendrier. */
const DUREE_EVENEMENT_MS = 30 * 60_000;

/** Utilisateur du jeton Rappels (`Authorization: Bearer …` ou `?jeton=…`). */
async function utilisateurDuJeton(req) {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : String(req.query.jeton ?? '').trim();
  if (!jeton) throw new ErreurHttp(401, 'Jeton Rappels requis');

  const utilisateur = await prisma.utilisateur.findUnique({ where: { jetonRappels: empreinte(jeton) } });
  if (!utilisateur || !utilisateur.actif) throw new ErreurHttp(401, 'Jeton Rappels invalide ou révoqué');
  return utilisateur;
}

function lireAvance(req) {
  const avance = req.query.avance === undefined ? AVANCE_JOURS : Number(req.query.avance);
  if (!Number.isInteger(avance) || avance < 0 || avance > 14) throw new ErreurHttp(400, 'avance : nombre de jours entre 0 et 14');
  return avance;
}

/**
 * Tâches en retard et des deux prochaines semaines (horizon du tableau de bord).
 * `moment` : échéance horodatée ; `jour` : échéance à la journée (achats,
 * objectifs, livraison en cours sans date), placée à 9 h pour les rappels.
 */
async function tachesAVenir(idUtilisateur) {
  const { date, taches } = await calculerAccueil(idUtilisateur);
  return {
    date,
    taches: taches.map((t) => {
      const aLaJournee = !t.echeance || TYPES_A_LA_JOURNEE.has(t.type);
      const j = aLaJournee ? (t.echeance ? jour(t.echeance) : aujourdhui()) : null;
      return {
        ...t,
        jour: j,
        moment: aLaJournee ? new Date(`${j}T${HEURE_A_LA_JOURNEE}`) : new Date(t.echeance),
        url: FRONTEND_URL ? `${FRONTEND_URL}${t.lien}` : null,
      };
    }),
  };
}

/**
 * Format attendu par le raccourci Rappels, heures de Madagascar « YYYY-MM-DD HH:MM » :
 * `titre` sert de clé anti-doublon ; `echeance` est l'échéance réelle (rappelée
 * dans `notes`) ; `alerte` la précède de `avance` jours, ou vaut l'échéance quand
 * ce moment est déjà passé.
 */
routeurRappelsPublic.get('/aujourdhui', async (req, res) => {
  const utilisateur = await utilisateurDuJeton(req);
  const avance = lireAvance(req);
  const { date, taches } = await tachesAVenir(utilisateur.id);
  const maintenant = new Date();
  const aVenir = taches.map((t) => {
    const avantEcheance = new Date(t.moment.getTime() - avance * 86_400_000);
    const echeance = dateHeureLocale(t.moment);
    return {
      id: t.id,
      titre: t.libelle,
      notes: [`Échéance : ${echeance}`, t.module, t.detail].filter(Boolean).join(' · '),
      echeance,
      alerte: dateHeureLocale(avantEcheance > maintenant ? avantEcheance : t.moment),
      enRetard: t.enRetard,
      url: t.url,
    };
  });
  res.json({ date, avanceJours: avance, nombre: aVenir.length, taches: aVenir });
});

/** Échappe un texte iCalendar (RFC 5545 §3.3.11). */
const texteIcs = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
/** Date-heure UTC au format iCalendar (20260929T153000Z). */
const utcIcs = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Plie les lignes à 75 octets, comme l'exige la norme. */
function plier(ligne) {
  const morceaux = [];
  let courant = '';
  for (const c of ligne) {
    if (Buffer.byteLength(courant + c) > (morceaux.length ? 74 : 75)) {
      morceaux.push(courant);
      courant = '';
    }
    courant += c;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

/**
 * Calendrier auquel l'iPhone s'abonne (Réglages → Calendrier → Comptes → Ajouter
 * un calendrier avec abonnement) : les tâches y sont tenues à jour sans raccourci,
 * avec une alerte `avance` jours avant. Les tâches à la journée sont des
 * événements « toute la journée ».
 */
routeurRappelsPublic.get('/calendrier.ics', async (req, res) => {
  const utilisateur = await utilisateurDuJeton(req);
  const avance = lireAvance(req);
  const { taches } = await tachesAVenir(utilisateur.id);
  const horodatage = utcIcs(new Date());

  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zaya//Taches//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Zaya',
    'X-WR-TIMEZONE:Indian/Antananarivo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const t of taches) {
    const debut = t.jour
      ? [`DTSTART;VALUE=DATE:${t.jour.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${ajouterJours(t.jour, 1).replace(/-/g, '')}`]
      : [`DTSTART:${utcIcs(t.moment)}`, `DTEND:${utcIcs(new Date(t.moment.getTime() + DUREE_EVENEMENT_MS))}`];
    lignes.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@zaya`,
      `DTSTAMP:${horodatage}`,
      ...debut,
      `SUMMARY:${texteIcs(t.libelle)}`,
      `DESCRIPTION:${texteIcs([t.module, t.detail, t.url].filter(Boolean).join('\n'))}`,
      ...(t.url ? [`URL:${t.url}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${texteIcs(t.libelle)}`,
      `TRIGGER:${avance ? `-P${avance}D` : 'PT0S'}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lignes.push('END:VCALENDAR');

  res.type('text/calendar; charset=utf-8').send(lignes.map(plier).join('\r\n') + '\r\n');
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
