import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { serialiser } from './lib/serialiser.js';
import { amorcerAdmin } from './lib/amorcer.js';
import { authentifier } from './middleware/auth.js';
import { gererErreurs } from './middleware/erreurs.js';

import { routeurAuth } from './routes/auth.js';
import { routeurCategories, routeurReseaux } from './routes/references.js';
import { routeurUtilisateurs } from './routes/utilisateurs.js';
import { routeurProduits } from './routes/produits.js';
import { routeurAchats } from './routes/achats.js';
import { routeurFrais } from './routes/frais.js';
import { routeurBoosts } from './routes/boosts.js';
import { routeurVentes } from './routes/ventes.js';
import { routeurPublications } from './routes/publications.js';
import { routeurStats } from './routes/stats.js';
import { routeurAccueil } from './routes/accueil.js';
import { routeurRecherche } from './routes/recherche.js';
import { routeurApercu } from './routes/apercu.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Les Decimal Prisma partent en nombres, les Date en ISO
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (donnees) => json(serialiser(donnees));
  next();
});

app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
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
app.use('/api/ventes', routeurVentes);
app.use('/api/publications', routeurPublications);
app.use('/api/stats', routeurStats);

app.use('/api', (req, res) => res.status(404).json({ message: 'Route inconnue' }));
app.use(gererErreurs);

await amorcerAdmin();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
