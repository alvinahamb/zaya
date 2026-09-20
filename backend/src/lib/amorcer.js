import bcrypt from 'bcrypt';
import { prisma } from './prisma.js';

/** Crée le premier compte admin si la table est vide. */
export async function amorcerAdmin() {
  if ((await prisma.utilisateur.count()) > 0) return;
  const email = process.env.ADMIN_EMAIL || 'admin@zaya.local';
  const motDePasse = process.env.ADMIN_MOT_DE_PASSE || 'admin1234';
  await prisma.utilisateur.create({
    data: { nom: 'Admin', email, motDePasse: await bcrypt.hash(motDePasse, 10), role: 'admin' },
  });
  console.log(`Compte admin créé : ${email} (mot de passe : ${motDePasse})`);
}
