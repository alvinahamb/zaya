import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './prisma.js';

/**
 * Migrations additives (prisma/sql/*.sql), écrites en CREATE ... IF NOT
 * EXISTS : rejouables à chaque démarrage sans toucher aux tables ni aux
 * données existantes. Les instructions sont séparées par « ; » en fin de ligne.
 */
export async function amorcerSchema() {
  const dossier = path.resolve('prisma', 'sql');
  let fichiers;
  try {
    fichiers = (await fs.readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return; // pas de dossier de migrations (déploiement sans le dépôt complet)
  }
  for (const fichier of fichiers) {
    const sql = await fs.readFile(path.join(dossier, fichier), 'utf8');
    const instructions = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((i) => i.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);
    for (const instruction of instructions) await prisma.$executeRawUnsafe(instruction);
  }
}

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
