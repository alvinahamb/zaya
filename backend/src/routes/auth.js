import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger } from '../lib/erreurs.js';
import { signer, authentifier } from '../middleware/auth.js';

export const routeurAuth = Router();

export function utilisateurPublic(u) {
  const { motDePasse, jetonRappels, ...reste } = u;
  return reste;
}

routeurAuth.post('/connexion', async (req, res) => {
  const { email, motDePasse } = req.body ?? {};
  exiger(email && motDePasse, 'Email et mot de passe requis');

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });
  const valide = utilisateur && (await bcrypt.compare(String(motDePasse), utilisateur.motDePasse));
  if (!valide) throw new ErreurHttp(401, 'Email ou mot de passe incorrect');
  if (!utilisateur.actif) throw new ErreurHttp(403, 'Ce compte est désactivé');

  res.json({ token: signer(utilisateur), utilisateur: utilisateurPublic(utilisateur) });
});

routeurAuth.get('/moi', authentifier, (req, res) => {
  res.json(utilisateurPublic(req.utilisateur));
});
