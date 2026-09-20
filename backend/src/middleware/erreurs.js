import { ErreurHttp } from '../lib/erreurs.js';

/** Traduit les erreurs Prisma et métier en réponses JSON lisibles. */
// eslint-disable-next-line no-unused-vars
export function gererErreurs(erreur, req, res, next) {
  if (erreur instanceof ErreurHttp) {
    return res.status(erreur.statut).json({ message: erreur.message, details: erreur.details });
  }

  if (erreur?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corps de requête JSON invalide' });
  }

  if (erreur?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Image trop lourde (5 Mo maximum)' });
  }

  switch (erreur?.code) {
    case 'P2002':
      return res.status(409).json({ message: 'Cette valeur existe déjà' });
    case 'P2003':
      return res.status(409).json({ message: 'Élément utilisé ailleurs, suppression impossible' });
    case 'P2025':
      return res.status(404).json({ message: 'Élément introuvable' });
  }

  // Erreurs SQL remontées par les triggers (ex. stock insuffisant, ERRCODE check_violation)
  const messageSql = erreur?.meta?.message || erreur?.message || '';
  if (/Stock insuffisant/.test(messageSql)) {
    const m = messageSql.match(/Stock insuffisant[^\n"]*/);
    return res.status(400).json({ message: m ? m[0] : 'Quantité supérieure au stock restant' });
  }
  if (/violates check constraint/.test(messageSql)) {
    return res.status(400).json({ message: 'Valeur refusée par une règle de la base de données' });
  }

  console.error(erreur);
  res.status(500).json({ message: 'Erreur interne' });
}
