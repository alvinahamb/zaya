# Déploiement de ZAYA — Render + Supabase + UptimeRobot

Ce document décrit comment l'application est mise en ligne gratuitement,
pourquoi chaque choix a été fait, comment la faire évoluer et quoi faire en
cas de problème.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Pourquoi ces outils](#2-pourquoi-ces-outils)
3. [Ce qui a été adapté dans le code](#3-ce-qui-a-été-adapté-dans-le-code)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [Mise en place pas à pas](#5-mise-en-place-pas-à-pas)
6. [Tests de validation](#6-tests-de-validation)
7. [Mettre à jour l'application](#7-mettre-à-jour-lapplication)
8. [Limites du plan gratuit](#8-limites-du-plan-gratuit)
9. [Dépannage](#9-dépannage)
10. [Sécurité](#10-sécurité)
11. [Développement en local](#11-développement-en-local)

---

## 1. Vue d'ensemble

```text
                    Navigateur
                        │
          ┌─────────────┴──────────────┐
          │ HTML / JS / CSS            │ appels /api (JSON + jeton JWT)
          ▼                            ▼
 ┌──────────────────┐        ┌──────────────────────┐
 │ Render           │        │ Render               │
 │ Static Site      │        │ Web Service (Node)   │
 │ zaya-front       │        │ zaya-api             │
 │ React (Vite)     │        │ Express + Prisma     │
 └──────────────────┘        └──────────┬───────────┘
                                        │
                       ┌────────────────┴────────────────┐
                       │ SQL (Session pooler, SSL)       │ images (API Storage)
                       ▼                                 ▼
              ┌──────────────────┐             ┌──────────────────┐
              │ Supabase         │             │ Supabase Storage │
              │ PostgreSQL       │             │ bucket `produits`│
              └──────────────────┘             └──────────────────┘

 UptimeRobot ──(toutes les 5 min)──▶ zaya-api /api/health ──▶ select now()
```

| Élément        | Hébergeur   | Adresse                                         |
| -------------- | ----------- | ----------------------------------------------- |
| Front (React)  | Render      | https://zaya-front.onrender.com                 |
| API (Express)  | Render      | https://zaya-api-1h1n.onrender.com              |
| Santé de l'API | Render      | https://zaya-api-1h1n.onrender.com/api/health   |
| Base de données| Supabase    | projet en région **Central EU (Frankfurt)**     |
| Images         | Supabase    | bucket public `produits`                        |
| Surveillance   | UptimeRobot | moniteur HTTP sur `/api/health`, toutes les 5 min |

Le code source est sur GitHub (`alvinahamb/zaya`). Render lit la branche
**`main`** et redéploie automatiquement à chaque nouveau commit sur cette
branche.

---

## 2. Pourquoi ces outils

### Supabase pour la base de données

- **PostgreSQL managé et gratuit** : c'est le même moteur qu'en local (Docker),
  donc `bdd/table.sql`, le trigger de stock et les contraintes fonctionnent
  sans adaptation.
- **Sauvegardes, mises à jour et sécurité** gérées par Supabase : aucun serveur
  de base à administrer.
- **Supabase Storage** inclus : il sert à stocker les images de produits (voir
  ci-dessous), avec le même compte.
- **SQL Editor** dans le dashboard : on peut exécuter un script ou consulter
  les données sans installer d'outil.

### Render pour l'API et le front

- **Déploiement depuis GitHub** : un push sur `main` suffit, Render construit
  et publie tout seul.
- **Plan gratuit** pour un service Node (l'API) et pour un site statique (le
  front), avec HTTPS automatique.
- **Blueprint (`render.yaml`)** : toute la configuration (commandes de build,
  dossiers, variables, règle de réécriture) est décrite dans un fichier du
  dépôt. On peut recréer l'infrastructure à l'identique en quelques clics, et
  chaque modification est versionnée avec le code.
- **Site statique séparé** : le front n'est qu'un ensemble de fichiers HTML/JS
  générés par Vite. Servi en statique, il est rapide, gratuit et **ne se met
  jamais en veille**.

### UptimeRobot pour garder l'ensemble éveillé

- Sur le plan gratuit, l'API Render s'endort après 15 minutes sans requête et
  le projet Supabase se met en pause après 7 jours sans activité.
- UptimeRobot appelle `/api/health` toutes les 5 minutes. Cette route exécute
  une requête (`select now()`) sur la base : un seul ping garde **à la fois**
  l'API et Supabase actifs.
- En bonus, il envoie un e-mail si l'API ne répond plus : on est prévenu d'une
  panne avant les utilisateurs.

### Les choix techniques et leur raison

| Choix | Pourquoi |
| --- | --- |
| **Session pooler** Supabase (port 5432) plutôt que la connexion directe | La connexion directe de Supabase n'est accessible qu'en **IPv6**, que Render ne sait pas joindre. Le pooler est en IPv4. Le mode *Session* se comporte comme une connexion Postgres classique, ce qui convient à une seule API. |
| Pas de `?pgbouncer=true` dans l'URL | Ce paramètre ne sert qu'à l'ancien moteur de Prisma. Le projet utilise Prisma 7 avec l'adaptateur `@prisma/adapter-pg` (driver `pg`), qui l'ignore. |
| Pas de `?sslmode=require` dans l'URL | Le driver `pg` donne la priorité à ce paramètre et exigerait alors un certificat reconnu par Node, ce qui n'est pas le cas de celui de Supabase. Le SSL est réglé dans le code à la place. |
| SSL avec `rejectUnauthorized: false`, seulement si `NODE_ENV=production` | Supabase impose une connexion chiffrée ; le Postgres local de Docker, lui, refuse SSL. |
| Pas de `prisma migrate deploy` | Le projet n'a pas de migrations Prisma : le schéma vient de `bdd/table.sql`, et les ajouts de scripts SQL idempotents dans `backend/prisma/sql/`, rejoués par l'API à chaque démarrage. |
| Images dans **Supabase Storage** | Le disque d'un service Render gratuit est **effacé à chaque redéploiement et à chaque mise en veille** : des images enregistrées dans `uploads/` disparaîtraient. |
| **RLS activée** sur toutes les tables | Supabase expose automatiquement les tables du schéma `public` via son API REST. Sans RLS, elles (y compris les mots de passe hashés) seraient lisibles avec la clé publique du projet. L'API Node n'est pas concernée : elle se connecte en propriétaire des tables, qui ne sont pas soumises à la RLS. |
| Région **Frankfurt** pour Render et Supabase | Les deux dans le même centre de données : chaque requête SQL fait un aller-retour de quelques millisecondes au lieu de plusieurs dizaines. C'est aussi la région proposée la plus proche de Madagascar. |
| `JWT_SECRET` en `generateValue: true` | Render génère lui-même une longue chaîne aléatoire : pas de secret à inventer ni à recopier. L'API refuse de démarrer en production sans ce secret, car la valeur de repli (`change_moi`) est visible dans le dépôt. |
| `NODE_VERSION=22` et `engines.node >= 22.18` | Le client Prisma généré est en TypeScript (`.ts`) ; Node ne sait l'importer directement qu'à partir de la 22.18. |
| `npm ci --include=dev` pour l'API | Avec `NODE_ENV=production`, npm ignore les devDependencies, dont le CLI `prisma` nécessaire à `prisma generate`. |
| Réécriture `/*` → `/index.html` sur le front | React Router gère les URL côté navigateur. Sans cette règle, recharger `/produits` demanderait au serveur un fichier `produits` qui n'existe pas (erreur 404). |

---

## 3. Ce qui a été adapté dans le code

| Fichier | Modification |
| --- | --- |
| `render.yaml` | Blueprint : description des deux services Render. |
| `backend/prisma/schema.prisma` | Retrait de `url` / `directUrl`, refusés par Prisma 7 (l'URL est lue dans `prisma.config.ts`). |
| `backend/prisma.config.ts` | Renommé depuis `prisma7.config.ts` pour être trouvé par le CLI Prisma. |
| `backend/src/lib/prisma.js` | SSL activé en production. |
| `backend/src/index.js` | CORS limité à `FRONTEND_URL` ; `/api/health` interroge la base. |
| `backend/src/middleware/auth.js` | Arrêt au démarrage si `JWT_SECRET` manque en production. |
| `backend/src/lib/amorcer.js` | Le mot de passe admin n'est plus écrit dans les logs. |
| `backend/src/routes/produits.js` | Upload des images vers Supabase Storage si `SUPABASE_URL` est défini, sinon dossier local `uploads/`. |
| `backend/package.json` | Dépendance `@supabase/supabase-js`, version de Node minimale. |
| `frontend/src/services/api.js` | Adresse de l'API lue dans `VITE_API_URL` ; helper `urlFichier()` pour les images locales. |
| `frontend/src/components/ui/Divers.jsx` | Les images de produits passent par `urlFichier()`. |
| `backend/.env.example`, `frontend/.env.example` | Liste des variables, sans aucun secret. |
| `frontend/.gitignore` | Ajout de `.env`. |

Toutes ces adaptations gardent le fonctionnement local inchangé : sans les
variables de production, l'API se comporte comme avant.

---

## 4. Variables d'environnement

Elles se gèrent dans Render → service → **Environment**. Aucune ne doit être
écrite dans le code ni commitée.

### API (`zaya-api`)

| Variable | Valeur | Rôle |
| --- | --- | --- |
| `NODE_ENV` | `production` | Active le SSL vers la base et l'obligation de `JWT_SECRET`. |
| `NODE_VERSION` | `22` | Version de Node utilisée par Render. |
| `TZ` | `Indian/Antananarivo` | Fuseau horaire des dates (tâches, alertes, statistiques). |
| `DATABASE_URL` | `postgresql://postgres.<ref>:<mot-de-passe>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` | Connexion à la base via le Session pooler. **Secret.** |
| `JWT_SECRET` | générée par Render | Signature des jetons de session. **Secret.** La changer déconnecte tout le monde. |
| `ADMIN_EMAIL` | e-mail de l'admin | Premier compte, créé uniquement si la table `Utilisateur` est vide. |
| `ADMIN_MOT_DE_PASSE` | mot de passe solide | Mot de passe de ce premier compte. **Secret.** |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Adresse du projet, pour Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `sb_secret_…` ou `service_role` | Autorise l'API à écrire dans le bucket. **Secret, jamais côté front.** |
| `SUPABASE_BUCKET` | `produits` | Nom du bucket des images. |
| `FRONTEND_URL` | `https://zaya-front.onrender.com` | Seule origine autorisée par CORS. **Sans slash final.** |

### Front (`zaya-front`)

| Variable | Valeur | Rôle |
| --- | --- | --- |
| `NODE_VERSION` | `22` | Version de Node pour le build Vite. |
| `VITE_API_URL` | `https://zaya-api-1h1n.onrender.com` | Adresse de l'API, **sans slash final ni `/api`**. |

`VITE_API_URL` est **intégrée dans les fichiers JavaScript au moment du
build** : après l'avoir modifiée, il faut reconstruire le front (*Manual
Deploy*). Elle est visible par n'importe quel visiteur : on n'y met donc
jamais de secret.

---

## 5. Mise en place pas à pas

Cette section sert à refaire le déploiement de zéro (nouveau compte, nouvel
environnement…).

### 5.1 Supabase

1. Sur supabase.com : **New project**.
   - Région : **Central EU (Frankfurt)**.
   - Mot de passe de la base : long, **uniquement lettres et chiffres** (les
     caractères spéciaux devraient être encodés dans l'URL). Le conserver dans
     un gestionnaire de mots de passe.
2. **SQL Editor → New query** : coller tout `bdd/table.sql`, puis **Run**.
3. Nouvelle requête : coller les scripts de `backend/prisma/sql/` qui créent
   des tables (aujourd'hui `2026-09-22_monthly_achievements.sql`), puis
   **Run**. L'API rejoue de toute façon **tous** ces scripts à chaque
   démarrage, mais les tables doivent exister pour l'étape suivante (RLS).
   Les scripts qui ajoutent une colonne déjà présente dans `bdd/table.sql`
   (comme `2026-09-22_publication_reseau_date.sql`) n'ont aucun effet sur une
   base neuve : ils servent aux bases créées avant l'ajout de la colonne.
4. Nouvelle requête : activer la RLS sur toutes les tables.

   ```sql
   do $$ declare t record; begin
     for t in select tablename from pg_tables where schemaname = 'public' loop
       execute format('alter table public.%I enable row level security', t.tablename);
     end loop;
   end $$;
   ```

5. Chaîne de connexion : bouton **Connect** (en haut) → **Session pooler** →
   copier l'URI et remplacer `[YOUR-PASSWORD]`. Ne rien ajouter à la fin.
6. **Storage → New bucket** : nom `produits`, cocher **Public bucket**.
7. **Project Settings → API Keys** : noter l'URL du projet
   (`https://<ref>.supabase.co`) et la **secret key** (`sb_secret_…`, ou
   `service_role` dans *Legacy API Keys*). Ne **pas** utiliser la
   *publishable key* ni `anon` : elles ne peuvent pas écrire dans le bucket.

### 5.2 Render

1. Vérifier que `render.yaml` est bien sur la branche `main`.
2. Dashboard Render → **New → Blueprint** → connecter GitHub → dépôt `zaya`,
   branche `main`, chemin `render.yaml`.
3. Remplir les champs demandés (voir [section 4](#4-variables-denvironnement)).
   Pour les deux URL, mettre une première estimation :
   `FRONTEND_URL=https://zaya-front.onrender.com`,
   `VITE_API_URL=https://zaya-api.onrender.com`.
4. **Deploy Blueprint**.

Réglages équivalents si l'on crée les services à la main :

| | API (Web Service) | Front (Static Site) |
| --- | --- | --- |
| Branche | `main` | `main` |
| Root Directory | `backend` | `frontend` |
| Build Command | `npm ci --include=dev && npx prisma generate` | `npm ci && npm run build` |
| Start Command / Publish Directory | `npm start` | `dist` |
| Plan | Free | — |
| Health Check Path | `/api/health` | — |
| Redirects / Rewrites | — | `/*` → `/index.html`, action **Rewrite** |

### 5.3 Ordre à respecter

Les deux services dépendent de l'adresse de l'autre, qu'on ne connaît qu'une
fois créés (Render ajoute un suffixe si le nom est déjà pris, par exemple
`zaya-api-1h1n`).

1. Attendre que **zaya-api** soit *Live* et relever son URL exacte.
2. Si elle diffère : **zaya-front → Environment**, corriger `VITE_API_URL`,
   **Save**, puis **Manual Deploy → Deploy latest commit**.
3. Relever l'URL exacte de **zaya-front**. Si elle diffère :
   **zaya-api → Environment**, corriger `FRONTEND_URL`, **Save, rebuild and deploy**.

### 5.4 UptimeRobot

1. Créer un compte gratuit sur uptimerobot.com et confirmer l'e-mail.
2. **+ New monitor** :
   - Monitor type : **HTTP / website monitoring**
   - URL : `https://zaya-api-1h1n.onrender.com/api/health`
   - Interval : **5 minutes**
   - Friendly name : `ZAYA API`
   - Alertes : laisser l'e-mail coché
3. **Create monitor**. Il doit passer au vert (**Up**) en quelques minutes.

Alternative : cron-job.org, même URL, toutes les 10 minutes au plus.

---

## 6. Tests de validation

À refaire après chaque déploiement important.

1. **Santé** : ouvrir `https://zaya-api-1h1n.onrender.com/api/health`.
   Réponse attendue : `{"status":"ok","base":"<date>"}`. La date prouve que la
   base répond.
2. **Connexion** : ouvrir https://zaya-front.onrender.com et se connecter.
3. **Appels et CORS** : outils du navigateur (F12) → onglet **Network**. Les
   requêtes doivent partir vers `https://zaya-api-1h1n.onrender.com/api/…` et
   répondre 200. Aucune erreur *CORS policy* dans l'onglet **Console**.
4. **Réécriture** : recharger la page sur `/produits` → pas de 404.
5. **Images** : créer un produit avec une image téléversée. Son adresse doit
   commencer par `https://<ref>.supabase.co/storage/v1/object/public/produits/…`.

---

## 7. Mettre à jour l'application

### Le principe

Render ne déploie **que ce qui arrive sur `main`** dans GitHub.

| Action | Effet |
| --- | --- |
| `git commit` | Le changement reste sur le PC. Rien ne se passe en ligne. |
| `git push` sur `sprint1` | Le changement est sur GitHub, Render l'ignore. |
| Fusion dans `main` (PR *Merge*, ou push direct) | Render reconstruit et redéploie l'API **et** le front (2 à 5 min). |

### Le workflow habituel

```bash
git add .
git commit -m "Description du changement"
git push                      # sur sprint1
```

Puis sur GitHub : **Pull request** `sprint1` → `main` → **Merge**.

Suivi du déploiement : Render → service → onglet **Events** (et **Logs**).
Si le build échoue, **l'ancienne version reste en ligne** : on corrige, on
repousse, rien n'est cassé entre-temps.

### Les cas particuliers

| Modification | Ce qu'il faut faire |
| --- | --- |
| Code front ou back | Rien de plus : déploiement automatique. |
| **Nouvelle table** | Créer un script `CREATE TABLE IF NOT EXISTS …` daté dans `backend/prisma/sql/` et déclarer le modèle dans `backend/prisma/schema.prisma`. L'API joue le script au démarrage. Ensuite, dans le SQL Editor Supabase : `alter table public.<table> enable row level security;` |
| **Table existante** (colonne, contrainte, type…) | La base n'est **pas** migrée automatiquement. Exécuter l'`ALTER TABLE` dans le SQL Editor Supabase **avant** de fusionner dans `main`, sinon le nouveau code tournera sur l'ancien schéma. Mettre aussi à jour `bdd/table.sql` et `schema.prisma`. Préférer des changements compatibles (colonne ajoutée nullable ou avec valeur par défaut). |
| Variable d'environnement de l'API | Render → zaya-api → **Environment** → **Save, rebuild and deploy**. |
| `VITE_API_URL` | Render → zaya-front → **Environment** → **Save**, puis **Manual Deploy**. |
| Nouvelle dépendance (`npm install …`) | Commiter aussi `package-lock.json`, sinon `npm ci` échoue sur Render. En local avec Docker : `docker compose up --build -V <service>`. |
| `render.yaml` | Synchronisé automatiquement par le Blueprint lors de la fusion dans `main`. Les nouvelles variables en `sync: false` sont à remplir dans le dashboard. |
| Revenir à une version précédente | Render → service → **Events** → sur un ancien déploiement réussi, **Rollback**. Penser à corriger `main` ensuite, sinon le prochain push redéploiera la version fautive. |

**Rappel :** la base de production est Supabase, pas le Postgres de Docker.
Les données saisies en local ne sont jamais copiées en ligne, et inversement.

---

## 8. Limites du plan gratuit

| Service | Limite | Conséquence | Parade |
| --- | --- | --- | --- |
| Render (API) | Mise en veille après **15 min** sans requête | Premier appel suivant lent (**~1 min**) | Ping UptimeRobot toutes les 5 min |
| Render (API) | **750 h/mois** d'instance, tous services web gratuits confondus | Une API allumée en continu consomme ~744 h : pas de place pour un 2ᵉ service gratuit toujours éveillé | Un seul service gardé éveillé |
| Render (API) | 512 Mo de RAM, CPU partagé | Traitements lourds lents | Suffisant pour l'usage actuel |
| Render (API) | Disque effacé à chaque redémarrage | Tout fichier écrit localement est perdu | Images dans Supabase Storage |
| Render (front) | Aucune mise en veille | — | — |
| Supabase | **Pause après 7 jours** sans activité | Base inaccessible jusqu'à la relance manuelle (dashboard → **Restore project**) | Le ping de `/api/health` interroge la base |
| Supabase | 500 Mo de base, 1 Go de Storage | Surveiller le volume (Dashboard → **Reports** / **Storage**) | Compresser les images avant envoi |
| Supabase | Pas de sauvegarde restaurable à la demande en gratuit | Une erreur de manipulation est définitive | Exporter régulièrement (voir [section 10](#10-sécurité)) |

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Le site met ~1 min à répondre | L'API dormait | Vérifier que le moniteur UptimeRobot est actif et **Up**. |
| `/api/health` renvoie une erreur 500 | Base injoignable | Vérifier `DATABASE_URL` (mot de passe, port 5432, hôte `pooler`) ; vérifier que le projet Supabase n'est pas en pause. |
| Logs : `self-signed certificate in certificate chain` | `?sslmode=…` ajouté à `DATABASE_URL`, ou `NODE_ENV` absent | Retirer le paramètre ; vérifier `NODE_ENV=production`. |
| Logs : `ENETUNREACH` ou adresse IPv6 | URL de connexion **directe** utilisée | Prendre l'URL du **Session pooler**. |
| Logs : `JWT_SECRET doit être défini en production` | Variable supprimée | La recréer (chaîne longue et aléatoire). |
| Build : `Unknown file extension ".ts"` | Node trop ancien | Vérifier `NODE_VERSION=22`. |
| Build : `prisma: not found` | devDependencies non installées | Build Command : `npm ci --include=dev && npx prisma generate`. |
| Console : erreur *CORS policy* | `FRONTEND_URL` ne correspond pas exactement | Même URL que le front, `https://`, sans slash final. |
| Network : appels vers une mauvaise adresse | `VITE_API_URL` erronée ou front pas reconstruit | Corriger puis **Manual Deploy** du front. |
| 404 en rechargeant une page | Règle de réécriture absente | Static site → **Redirects/Rewrites** : `/*` → `/index.html`, **Rewrite**. |
| Upload d'image : erreur 502 | Mauvaise clé, bucket absent ou privé | Clé `sb_secret_…`/`service_role`, bucket `produits` en **Public**. |
| Impossible de se connecter à l'app | Compte admin non créé ou mot de passe inconnu | Le compte n'est créé que si la table `Utilisateur` est vide : vérifier dans Supabase **Table Editor**. |

---

## 10. Sécurité

- **Aucun secret dans le dépôt** : ils vivent uniquement dans Render
  (Environment) et Supabase. `.env` est ignoré par Git à la racine, dans
  `backend/` et dans `frontend/`. Les fichiers `.env.example` ne contiennent
  que des valeurs d'exemple.
- **Le dépôt est public** : tout ce qui est commité (code, historique,
  `.env.example`, `docker-compose.yml`) est lisible par tous. Ne jamais y
  laisser un vrai mot de passe, même temporairement : il resterait dans
  l'historique.
- **Changer un secret compromis** :
  - mot de passe de la base : Supabase → **Project Settings → Database →
    Reset database password**, puis mettre à jour `DATABASE_URL` sur Render ;
  - clé Storage : Supabase → **API Keys** → créer une nouvelle secret key,
    la mettre dans Render, puis révoquer l'ancienne ;
  - `JWT_SECRET` : en générer une nouvelle dans Render (tous les utilisateurs
    devront se reconnecter).
- **Mot de passe admin** : le changer depuis l'application (*Paramètres →
  Comptes utilisateurs*). Modifier `ADMIN_MOT_DE_PASSE` sur Render n'a plus
  d'effet une fois le compte créé.
- **Sauvegarde manuelle** de la base (depuis un poste avec PostgreSQL
  installé, ou via Docker) :

  ```bash
  pg_dump "<DATABASE_URL>" --no-owner --format=custom -f zaya-AAAA-MM-JJ.dump
  ```

  Garder ces fichiers hors du dépôt.

---

## 11. Développement en local

Le déploiement ne change rien au travail en local :

```bash
docker compose up --build      # -V en plus après l'ajout d'une dépendance
```

Sans `NODE_ENV=production`, `FRONTEND_URL` ni variables Supabase, l'API se
connecte au Postgres de Docker sans SSL, accepte toutes les origines et
enregistre les images dans `backend/uploads/`. Le front, sans `VITE_API_URL`,
passe par le proxy Vite comme avant.
