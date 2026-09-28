import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

// En production (Supabase), SSL obligatoire ; le certificat du pooler n'est
// pas dans le magasin de Node, d'où rejectUnauthorized: false. Le Postgres
// local (Docker) n'accepte pas SSL.
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;

// Une seule instance par processus : chaque PrismaClient ouvre son propre pool.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl }),
});
