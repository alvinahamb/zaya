Backoffice Zaya
Analyse du besoin et modélisation de la base de données — Version 1
# 1. Contexte et objectifs
## 1.1 Objectifs
- Consistance dans la création de contenus.
- Meilleure analyse des prix et des produits.
- Gain de temps sur la détermination des prix de vente.
## 1.2 Rôles et permissions
- Admin : accès à toutes les fonctionnalités (rôle unique en V1).
# 2. Analyse du besoin
## 2.1 Besoins fonctionnels
### Achats (commandes)
- Un achat regroupe une liste de produits avec leur quantité et leur prix unitaire en euro.
- Informations : nom, date de commande, date d'arrivée estimée, date d'arrivée, nombre de produits, somme en euro, somme payée en Ariary, frais.
- À partir de la somme payée en Ariary et de la somme en euro, le système estime la valeur d'1 euro (taux de la commande).
### Produits et catégories
- Un produit est rattaché à une commande par ses lignes de détail.
- Informations : nom, catégorie, matériel, prix de vente, prix d'achat (en euro), code Shein, image.
- CRUD des catégories.
### Tarification d'une commande
- À l'ouverture d'une commande : liste des produits avec le prix d'achat en euro, le prix d'achat converti en Ariary et la quantité.
- Sur chaque ligne : prix d'achat (Ar), champ marge (%) et champ prix de vente (Ar). Les deux derniers champs sont liés : modifier l'un recalcule l'autre, et inversement.
- À la sauvegarde, tout se fige (prix, marges, prix de vente).
### Boosts et réseaux sociaux
- Un boost est toujours rattaché à une commande.
- Détails d'un boost : date, montant, frais, raison, réseau social.
- CRUD des réseaux sociaux.
### Ventes
- Client anonyme. Une vente comporte : réseau social, date, produits vendus et quantités.
### Récapitulatif d'une commande
- Somme d'achat avec frais.
- Estimation de vente.
- Somme des boosts.
- Marge % estimée (estimation de vente).
- Marge % réelle (vente actuelle − boosts).
- Vente actuelle.
### Statistiques
- Par produit, par catégorie et par réseau social.
### Social media manager
- Planification des publications à faire et à créer.
- Lien de l'idée d'origine (Pinterest).
- Une publication peut être rattachée à une commande.
## 2.2 Besoins non-fonctionnels
- Application hébergée et accessible depuis téléphone et PC.
# 3. Modélisation de la base de données
## 3.1 Conventions de nommage
Les mêmes règles s'appliquent à toutes les tables et à toutes les colonnes.

| Élément | Règle | Exemples |
| Tables | PascalCase, au singulier, sans accent | DetailAchat, Reseau |
| Colonnes | camelCase, sans accent | dateCommande, codeShein |
| Clé primaire | id | id |
| Clé étrangère | id + nom exact de la table référencée | idCategorie, idDetailAchat |
| Dates | date + événement. dateCreation sur chaque table | dateVente, dateBoost |
| Liens | lien + objet | lienCompte, lienPinterest |
| Montants en euro | Sans suffixe | prix, somme |
| Montants en Ariary | Suffixe Ar | sommeAr, prixVenteAr, montantAr |
| Pourcentages | Suffixe Pct | margePct |

## 3.2 Devises
Les prix d'achat sont en euro (produit et lignes de commande). La seule somme en Ariary côté achat est le montant réellement payé. Tout le reste est en Ariary.

| Donnée | Unité | Table.champ |
| Prix d'achat (catalogue et ligne de commande) | € | Produit.prix, DetailAchat.prix |
| Somme de la commande | € | Achat.somme |
| Somme payée pour la commande | Ar | Achat.sommeAr |
| Prix de vente | Ar | Produit.prixVenteAr, DetailAchat.prixVenteAr, DetailVente.prixVenteAr |
| Frais (commande et boost) | Ar | Frais.montantAr |
| Boost | Ar | Boost.montantAr |
| Ventes et réductions | Ar | Vente.sommeAr, Vente.reductionAr |

Le taux d'un euro et le prix d'achat en Ariary ne sont pas stockés : ils se calculent (voir 3.6).
## 3.3 Schéma des relations
Jaune : montants en euro. Vert : montants en Ariary.
## 3.4 Description des tables
Types indicatifs pour PostgreSQL. Les montants en Ariary sont en NUMERIC(14,2) pour éviter les écarts d'arrondi, l'affichage étant arrondi à l'unité. Chaque table possède une clé primaire id (SERIAL) et une date de création (dateCreation).
### Utilisateur
Comptes de connexion au backoffice.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(100) | — |  |
| email | VARCHAR(150) | — | UNIQUE, NOT NULL. |
| motDePasse | VARCHAR(255) | — | Hash (bcrypt ou argon2), jamais en clair. |
| role | VARCHAR(20) | — | Défaut « admin » (rôle unique en V1). |
| actif | BOOLEAN | — | Défaut true. Permet de désactiver un compte. |
| dateCreation | TIMESTAMP | — |  |

### Categorie
Catégories de produits (CRUD).

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(100) | — | UNIQUE, NOT NULL. |
| dateCreation | TIMESTAMP | — |  |

### Reseau
Réseaux sociaux sur lesquels on vend, on boost et on publie (CRUD).

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(100) | — | UNIQUE, NOT NULL. |
| lienCompte | VARCHAR(255) | — | Lien vers le compte. |
| dateCreation | TIMESTAMP | — |  |

### Produit
Catalogue de produits. Le prix en euro sert de valeur par défaut lors de l'ajout d'un produit à une commande.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| idCategorie | INT | — | FK → Categorie.id, NOT NULL. |
| nom | VARCHAR(150) | — | NOT NULL. |
| description | TEXT | — |  |
| materiel | VARCHAR(100) | — | Matière du produit. |
| codeShein | VARCHAR(50) | — | UNIQUE lorsque renseigné. |
| image | VARCHAR(255) | — | URL ou chemin de l'image. |
| prix | NUMERIC(10,2) | € | Prix d'achat. |
| prixVenteAr | NUMERIC(14,2) | Ar | Dernier prix de vente posé, mis à jour à la sauvegarde d'une commande. Indicatif. |
| dateCreation | TIMESTAMP | — |  |

### Achat
Une commande. Le nombre de produits n'est pas stocké : il se calcule à partir de DetailAchat.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(150) | — | NOT NULL. |
| description | TEXT | — |  |
| dateCommande | DATE | — |  |
| dateArriveeEstimee | DATE | — |  |
| dateArrivee | DATE | — | Renseignée à la réception. |
| somme | NUMERIC(12,2) | € | = Σ (quantité × prix) des lignes. |
| sommeAr | NUMERIC(14,2) | Ar | Montant réellement payé, saisi à la main. |
| dateCreation | TIMESTAMP | — |  |

### DetailAchat
Lignes d'une commande : un produit, une quantité, le prix d'achat en euro et le prix de vente posé.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| idAchat | INT | — | FK → Achat.id, ON DELETE CASCADE. |
| idProduit | INT | — | FK → Produit.id. UNIQUE avec idAchat. |
| quantite | INT | — | CHECK > 0. |
| prix | NUMERIC(10,2) | € | Prix d'achat unitaire. Copié depuis Produit.prix à l'ajout, modifiable avant la sauvegarde. |
| margePct | NUMERIC(6,2) | % | Marge appliquée sur le prix d'achat en Ar. Liée à prixVenteAr. |
| prixVenteAr | NUMERIC(14,2) | Ar | Prix de vente prévu. Lié à margePct. |
| dateCreation | TIMESTAMP | — |  |

### Frais
Frais rattachés soit à une commande, soit à un boost (jamais aux deux).

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| idAchat | INT | — | FK → Achat.id, nullable. |
| idBoost | INT | — | FK → Boost.id, nullable. |
| libelle | VARCHAR(150) | — | Nature du frais (transport, douane, commission…). |
| montantAr | NUMERIC(14,2) | Ar | CHECK >= 0. |
| dateFrais | DATE | — |  |
| dateCreation | TIMESTAMP | — |  |

Contrainte : exactement une des deux clés étrangères est renseignée. En SQL : CHECK ((idAchat IS NOT NULL)::int + (idBoost IS NOT NULL)::int = 1)
### Boost
Promotion payante d'une publication, toujours rattachée à une commande.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(150) | — |  |
| idAchat | INT | — | FK → Achat.id, NOT NULL. |
| idReseau | INT | — | FK → Reseau.id, NOT NULL. |
| dateBoost | DATE | — |  |
| montantAr | NUMERIC(14,2) | Ar | CHECK >= 0. Les frais du boost sont dans Frais. |
| raison | TEXT | — | Objectif du boost. |
| dateCreation | TIMESTAMP | — |  |

### Vente
Une vente à un client anonyme. Aucune table Client.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(150) | — | Libellé facultatif. |
| idReseau | INT | — | FK → Reseau.id, NOT NULL. |
| dateVente | DATE | — |  |
| reductionAr | NUMERIC(14,2) | Ar | Défaut 0. Réduction globale sur la vente. |
| sommeAr | NUMERIC(14,2) | Ar | = Σ (quantité × prixVenteAr) − reductionAr. |
| dateCreation | TIMESTAMP | — |  |

### DetailVente
Lignes d'une vente. Chaque ligne pointe vers la ligne de commande dont provient le produit. C'est ce qui permet de connaître le stock restant et la marge réelle par commande.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| idVente | INT | — | FK → Vente.id, ON DELETE CASCADE. |
| idDetailAchat | INT | — | FK → DetailAchat.id, NOT NULL. Le produit et la commande s'en déduisent. |
| quantite | INT | — | CHECK > 0. Ne peut pas dépasser le stock restant. |
| prixVenteAr | NUMERIC(14,2) | Ar | Prix réellement pratiqué. Pré-rempli avec DetailAchat.prixVenteAr. |
| dateCreation | TIMESTAMP | — |  |

### Publication
Planning de création de contenu pour le social media manager.

| Champ | Type | Unité | Description / contrainte |
| id | SERIAL | — | Clé primaire. |
| nom | VARCHAR(150) | — | NOT NULL. |
| description | TEXT | — |  |
| statut | VARCHAR(20) | — | a_faire, creee ou publiee. Défaut a_faire. |
| dateHeurePublication | TIMESTAMP | — | Date et heure prévues. |
| lienPinterest | VARCHAR(255) | — | Idée d'origine. |
| lienContenu | VARCHAR(255) | — | Contenu créé. |
| idReseau | INT | — | FK → Reseau.id, nullable. |
| idAchat | INT | — | FK → Achat.id, nullable. Commande concernée par la publication. |
| dateCreation | TIMESTAMP | — |  |

## 3.5 Relations

| Table parent | Cardinalité | Table enfant (clé étrangère) |
| Categorie | 1 — N | Produit (idCategorie) |
| Achat | 1 — N | DetailAchat (idAchat) |
| Produit | 1 — N | DetailAchat (idProduit) |
| Achat | 1 — N | Boost (idAchat) |
| Achat | 1 — N | Frais (idAchat) |
| Boost | 1 — N | Frais (idBoost) |
| Reseau | 1 — N | Boost, Vente, Publication (idReseau) |
| Vente | 1 — N | DetailVente (idVente) |
| DetailAchat | 1 — N | DetailVente (idDetailAchat) |
| Achat | 0..1 — N | Publication (idAchat) |

## 3.6 Règles de gestion et formules
### Calculs sur une commande

| Règle | Formule |
| Somme en euro | Achat.somme = Σ (DetailAchat.quantite × DetailAchat.prix) |
| Taux d'un euro (calculé) | sommeAr / somme |
| Prix d'achat en Ar (calculé) | prix × sommeAr / somme |
| Prix de vente selon la marge | prixVenteAr = prix d'achat en Ar × (1 + margePct / 100) |
| Marge selon le prix de vente | margePct = (prixVenteAr / prix d'achat en Ar − 1) × 100 |
| Figement | À la sauvegarde, l'application enregistre prix, margePct et prixVenteAr et ne les recalcule plus. Un changement ultérieur du prix du catalogue n'a aucun effet. Le taux et le prix d'achat en Ar restent stables car ils ne dépendent que de champs enregistrés (prix, somme, sommeAr). |

### Récapitulatif d'une commande

| Indicateur | Calcul |
| Somme d'achat avec frais | Achat.sommeAr + Σ Frais.montantAr (frais de la commande) |
| Estimation de vente | Σ (DetailAchat.quantite × DetailAchat.prixVenteAr) |
| Somme des boosts | Σ Boost.montantAr + Σ Frais.montantAr (frais des boosts de la commande) |
| Vente actuelle | Σ (DetailVente.quantite × DetailVente.prixVenteAr) pour les lignes liées à la commande |
| Marge % estimée | (estimation de vente − achat avec frais) / achat avec frais × 100 |
| Marge % réelle (vente − boost) | (vente actuelle − boosts − achat avec frais) / achat avec frais × 100 |
| Stock restant d'une ligne | DetailAchat.quantite − Σ DetailVente.quantite |

### Hypothèses de calcul
- La marge est calculée sur le prix d'achat (coût), pas sur le prix de vente.
- Les statistiques par produit, catégorie et réseau s'obtiennent par jointures : DetailVente → DetailAchat → Produit → Categorie, et Vente → Reseau.
- La réduction globale d'une vente est répartie au prorata des lignes lorsqu'on calcule la vente réelle d'une commande.
# 4. Architecture technique
## 4.1 Choix du stack

| Couche | Choix |
| Front-end | React, interface adaptée au téléphone et au PC |
| Back-end | Node.js |
| Base de données | PostgreSQL |
| Hébergement | Offre gratuite, accessible depuis téléphone et PC (à choisir) |

## 4.2 Authentification et sécurité
- Gestion des accès par JWT. OAuth / SSO uniquement si le besoin apparaît.
- Mots de passe hachés (bcrypt ou argon2) et politique de mots de passe. Connexion en HTTPS.
- Protection des données : les clients étant anonymes, peu de données personnelles. RGPD à approfondir si des données sensibles sont ajoutées.
## 4.3 Modules métier
- Développement itératif (méthode agile) avec revue de code régulière.
- Ordre suggéré : catégories, produits et réseaux → achats et tarification → ventes → boosts et récapitulatif → statistiques → publications.
## 4.4 Tableau de bord
- KPIs métier, reporting et exports.
## 4.5 Administration
- Back-office : création et désactivation de comptes, gestion des rôles.
# 5. Tests et déploiement
## 5.1 Tests
- Tests unitaires, fonctionnels et d'intégration, en priorité sur les calculs de taux, de prix et de marge.
- Tests de charge et de performance : seulement si l'application devient critique.
- Recette utilisateur (UAT) avant la mise en production.
## 5.2 Déploiement
- Mise en place d'un CI/CD si possible.
- Déploiement progressif : staging puis production.
# 6. Hors périmètre de la V1
- Intégrations API internes ou externes (paiement, SMS, ERP…).
- Documentation des endpoints (Swagger).