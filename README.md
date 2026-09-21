# zaya

Backoffice de gestion de la vente en ligne ZAYA : achats en euro (codes Shein),
tarification en Ariary, ventes sur les réseaux sociaux, planning de publications
et statistiques.

- `backend/` — API Express 5 (Node 22, ESM) + Prisma 7 / PostgreSQL
- `frontend/` — SPA React 19 (Vite), interface en français, responsive
- `bdd/table.sql` — schéma PostgreSQL de référence
- `doc/` — cahier des charges (`Zaya_Backoffice_V1_Modelisation.docx`, extrait en
  `cahier_des_charges.md`) et brief de design (`DESIGN.md`)

## Démarrage

Prérequis : Docker Desktop (ou Docker Engine + plugin Compose).

```bash
cp .env.example .env   # ajuster les mots de passe si besoin
docker compose up --build
```

| Service  | URL                              |
| -------- | -------------------------------- |
| Frontend | http://localhost:5173            |
| API      | http://localhost:4000/api/health |
| Postgres | `localhost:5432` (base `zaya`)   |

**Première connexion** : un compte admin est créé au démarrage si la table
`Utilisateur` est vide, avec `ADMIN_EMAIL` / `ADMIN_MOT_DE_PASSE` du `.env`
(par défaut `admin@zaya.local` / `admin1234`). Changez ce mot de passe depuis
*Paramètres → Comptes utilisateurs*.

Le code de `backend/` et `frontend/` est monté dans les conteneurs : les
modifications sont rechargées à chaud (polling, seul mode fiable sur un bind
mount Windows/macOS), sans reconstruire les images.

Le front appelle l'API via le chemin relatif `/api`, relayé par le proxy Vite
vers le conteneur `backend` — aucune URL absolue à configurer côté React.

### Base de données

`bdd/table.sql` est joué automatiquement à la **première** création du volume
`pgdata`. Pour rejouer le schéma après modification du fichier :

```bash
docker compose down -v && docker compose up --build
docker compose exec backend npx prisma db pull   # puis régénérer le client Prisma
```

`down -v` supprime le volume, donc **toutes les données**.

Accès psql :

```bash
docker compose exec db psql -U zaya -d zaya
```

### Commandes utiles

```bash
docker compose logs -f backend          # suivre les logs de l'API
docker compose exec backend sh          # shell dans le conteneur API
docker compose exec backend npm test    # tests des formules (taux, marge, récap…)
docker compose exec frontend npm run lint
docker compose down                     # arrêter (les données sont conservées)
```

Après l'ajout d'une dépendance dans un `package.json`, reconstruire l'image
concernée : `docker compose up --build <service>`.

## Fonctionnel

Les règles de calcul suivent le cahier des charges (§3.6) et vivent dans
`backend/src/lib/calculs.js` (testé) avec un miroir côté front pour les
recalculs en direct :

- **Taux d'un euro** = somme payée (Ar) / somme de la commande (€), jamais stocké.
- **Tarification** : marge et prix de vente liés ; le prix de vente saisi fait
  foi, la marge en découle. *Enregistrer le brouillon* garde les valeurs
  modifiables ; *Enregistrer et figer* pose `Achat.dateFigement`, après quoi
  lignes, prix, marges et somme payée ne bougent plus et les articles deviennent
  vendables.
- **Stock restant** = quantité achetée − quantité vendue, par ligne de commande
  (contrôlé côté API et par le trigger SQL).
- **Récapitulatif** d'une commande : achat avec frais, estimation de vente,
  boosts (et leurs frais), vente actuelle nette de réduction (répartie au
  prorata), marges estimée et réelle.
- **Tâches du jour** et **alertes** dérivées des données : publications à faire,
  commandes attendues ou en retard, ruptures et stocks bas.

Écarts au schéma d'origine (tous dans `bdd/table.sql`) :

- `Achat.dateFigement` (TIMESTAMP, nullable) porte l'état « brouillon / figée ».
- `Achat.sommeTotale` (NUMERIC, nullable) : total de la commande saisi en euro
  (frais inclus). S'il est renseigné, il fait foi pour le taux d'un euro et le
  récapitulatif ; sinon la somme calculée des lignes (`Achat.somme`) est
  utilisée. Figé avec la tarification.
- `Publication.statut` accepte `supprimee` : la suppression est une corbeille,
  restaurable ; `?definitif=1` supprime réellement.
- `PublicationReseau` (table de liaison) remplace `Publication.idReseau` : une
  publication paraît sur plusieurs réseaux.
- `Boost.idPublication` remplace `Boost.idAchat` : un boost promeut une
  publication, la commande se déduit de la publication (`Publication.idAchat`).
- `Budget` (par commande) : budget de communication, consommé par les boosts des
  publications de la commande et leurs frais (onglet *Budget* de la commande).
- Réseaux sociaux multiples partout : `VenteReseau`, `ClientReseau` et
  `BoostReseau` remplacent les anciens `idReseau` (l'API reçoit `idReseaux: []`,
  au moins un pour une vente ou un boost). Dans les statistiques par réseau, une
  vente sur plusieurs réseaux est répartie à parts égales entre eux.
- `Client` (nom, téléphone, adresse, réseaux, note) et `Vente.idClient` (nullable :
  la vente reste anonyme par défaut).
- `Livraison` (une au plus par vente) : adresse et téléphone recopiés du client,
  livreur, frais, `dateHeureAppelLivreur` (quand appeler les livreurs),
  `dateHeureLivraison` (prévue), `dateHeureLivree` (réelle, posée au passage à
  `livree`). Statuts : `a_programmer` → `programmee` → `en_cours` → `livree`, ou
  `annulee`. Les appels à passer et les livraisons du jour remontent dans les
  tâches.

## API

Toutes les routes sont sous `/api`, en JSON, protégées par un jeton JWT
(`Authorization: Bearer …`) sauf `POST /api/auth/connexion`.

| Ressource                        | Routes principales                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Auth                             | `POST /auth/connexion`, `GET /auth/moi`                                                            |
| Catégories, réseaux              | `GET/POST /categories`, `PUT/DELETE /categories/:id` (idem `/reseaux`)                             |
| Utilisateurs                     | `GET/POST /utilisateurs`, `PATCH /utilisateurs/:id` (`actif`, `nom`, `motDePasse`)                 |
| Produits                         | CRUD `/produits`, `POST /produits/image` (multipart, 5 Mo)                                         |
| Achats                           | CRUD `/achats`, lignes `/achats/:id/lignes[/:idLigne]`, `PUT /achats/:id/tarification` (`figer`)   |
| Lignes vendables                 | `GET /achats/lignes-disponibles`                                                                   |
| Frais, boosts, budgets           | `POST /frais`, `PUT/DELETE /frais/:id` ; `GET/POST /boosts` (`idPublication`), `PUT/DELETE /boosts/:id` ; `GET/POST /budgets` (`idAchat`), `PUT/DELETE /budgets/:id` |
| Ventes                           | CRUD `/ventes` (`?du=&au=&reseau=&client=`, `idClient` facultatif)                                 |
| Clients, livraisons              | CRUD `/clients` (`?q=`) ; CRUD `/livraisons` (`?statut=&du=&au=&client=`), `PATCH /livraisons/:id/statut` |
| Publications                     | CRUD `/publications` (`?du=&au=&statut=&reseau=&achat=`, corbeille exclue sauf `statut=supprimee`), `PATCH /publications/:id/statut`, `DELETE /publications/:id[?definitif=1]` |
| Statistiques, accueil, recherche | `GET /stats?du=&au=`, `GET /accueil`, `GET /recherche?q=`                                          |
| Aperçu de lien                   | `GET /apercu?url=` — image et titre Open Graph (repli sur l'image d'épingle Pinterest), cache 24 h |

## Démarrage sans Docker

```bash
cd backend  && npm install && npx prisma generate && npm run dev   # port 4000
cd frontend && npm install && npm run dev                          # port 5173
```

`backend/.env` doit alors pointer vers une instance PostgreSQL locale.
