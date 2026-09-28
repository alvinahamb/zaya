import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { prisma } from './lib/prisma.js';
import { serialiser } from './lib/serialiser.js';
import { amorcerAdmin, amorcerSchema } from './lib/amorcer.js';
import { authentifier } from './middleware/auth.js';
import { gererErreurs } from './middleware/erreurs.js';

import { routeurAuth } from './routes/auth.js';
import { routeurCategories, routeurReseaux } from './routes/references.js';
import { routeurUtilisateurs } from './routes/utilisateurs.js';
import { routeurProduits } from './routes/produits.js';
import { routeurAchats } from './routes/achats.js';
import { routeurFrais } from './routes/frais.js';
import { routeurBoosts } from './routes/boosts.js';
import { routeurBudgets } from './routes/budgets.js';
import { routeurClients } from './routes/clients.js';
import { routeurLivraisons } from './routes/livraisons.js';
import { routeurVentes } from './routes/ventes.js';
import { routeurPublications } from './routes/publications.js';
import { routeurStats } from './routes/stats.js';
import { routeurAccueil } from './routes/accueil.js';
import { routeurRecherche } from './routes/recherche.js';
import { routeurApercu } from './routes/apercu.js';
import { routeurObjectifs } from './routes/objectifs.js';

const app = express();
// En production, seul le front déployé peut appeler l'API ; en local, tout est ouvert
const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/+$/, '');
app.use(cors(FRONTEND_URL ? { origin: FRONTEND_URL } : undefined));
app.use(express.json({ limit: '1mb' }));

// Les Decimal Prisma partent en nombres, les Date en ISO
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (donnees) => json(serialiser(donnees));
  next();
});

app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '7d' }));

// Touche aussi la base : un ping régulier garde l'API et Supabase éveillés
app.get('/api/health', async (req, res) => {
  const [{ now }] = await prisma.$queryRaw`select now()`;
  res.json({ status: 'ok', base: now });
});
app.use('/api/auth', routeurAuth);

// Tout le reste exige une session
app.use('/api', authentifier);
app.use('/api/accueil', routeurAccueil);
app.use('/api/recherche', routeurRecherche);
app.use('/api/apercu', routeurApercu);
app.use('/api/categories', routeurCategories);
app.use('/api/reseaux', routeurReseaux);
app.use('/api/utilisateurs', routeurUtilisateurs);
app.use('/api/produits', routeurProduits);
app.use('/api/achats', routeurAchats);
app.use('/api/frais', routeurFrais);
app.use('/api/boosts', routeurBoosts);
app.use('/api/budgets', routeurBudgets);
app.use('/api/ventes', routeurVentes);
app.use('/api/clients', routeurClients);
app.use('/api/livraisons', routeurLivraisons);
app.use('/api/publications', routeurPublications);
app.use('/api/stats', routeurStats);
app.use('/api/objectifs', routeurObjectifs);

app.use('/api', (req, res) => res.status(404).json({ message: 'Route inconnue' }));
app.use(gererErreurs);

await amorcerSchema();
await amorcerAdmin();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
