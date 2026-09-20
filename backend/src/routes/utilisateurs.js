import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { ErreurHttp, exiger, entierId } from '../lib/erreurs.js';
import { utilisateurPublic } from './auth.js';

export const routeurUtilisateurs = Router();

const LONGUEUR_MIN = 8;

function validerMotDePasse(motDePasse) {
  exiger(
    typeof motDePasse === 'string' && motDePasse.length >= LONGUEUR_MIN,
    `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères`,
  );
}

routeurUtilisateurs.get('/', async (req, res) => {
  const liste = await prisma.utilisateur.findMany({ orderBy: { id: 'asc' } });
  res.json(liste.map(utilisateurPublic));
});

routeurUtilisateurs.post('/', async (req, res) => {
  const { nom, email, motDePasse } = req.body ?? {};
  exiger(email && /\S+@\S+\.\S+/.test(email), 'Email invalide');
  validerMotDePasse(motDePasse);

  const utilisateur = await prisma.utilisateur.create({
    data: {
      nom: nom ? String(nom).trim() : null,
      email: String(email).trim().toLowerCase(),
      motDePasse: await bcrypt.hash(motDePasse, 10),
      role: 'admin',
    },
  });
  res.status(201).json(utilisateurPublic(utilisateur));
});

routeurUtilisateurs.patch('/:id', async (req, res) => {
  const id = entierId(req.params.id);
  const { nom, actif, motDePasse } = req.body ?? {};
  const donnees = {};

  if (nom !== undefined) donnees.nom = nom ? String(nom).trim() : null;
  if (actif !== undefined) {
    if (id === req.utilisateur.id && !actif) {
      throw new ErreurHttp(400, 'Vous ne pouvez pas désactiver votre propre compte');
    }
    donnees.actif = Boolean(actif);
  }
  if (motDePasse !== undefined) {
    validerMotDePasse(motDePasse);
    donnees.motDePasse = await bcrypt.hash(motDePasse, 10);
  }

  const utilisateur = await prisma.utilisateur.update({ where: { id }, data: donnees });
  res.json(utilisateurPublic(utilisateur));
});
