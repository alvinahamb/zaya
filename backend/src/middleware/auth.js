import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp } from '../lib/erreurs.js';

const SECRET = process.env.JWT_SECRET || 'change_moi';
const DUREE = process.env.JWT_DUREE || '7d';

export function signer(utilisateur) {
  return jwt.sign({ sub: utilisateur.id, email: utilisateur.email, role: utilisateur.role }, SECRET, {
    expiresIn: DUREE,
  });
}

/** Vérifie le jeton Bearer et attache `req.utilisateur`. */
export async function authentifier(req, res, next) {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
  if (!jeton) return next(new ErreurHttp(401, 'Connexion requise'));

  let charge;
  try {
    charge = jwt.verify(jeton, SECRET);
  } catch {
    return next(new ErreurHttp(401, 'Session expirée, reconnectez-vous'));
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: Number(charge.sub) } });
  if (!utilisateur || !utilisateur.actif) return next(new ErreurHttp(401, 'Compte inactif'));

  req.utilisateur = utilisateur;
  next();
}
