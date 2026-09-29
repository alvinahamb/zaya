-- =====================================================================
--  Backoffice Zaya - Schéma PostgreSQL - Version 1
--
--  Conventions (voir section 3.1 du document) :
--    Tables      : PascalCase, singulier, sans accent
--    Colonnes    : camelCase, sans accent
--    Clé primaire: id            Clé étrangère : id + nom de la table
--    Euro        : sans suffixe  (prix, somme)
--    Ariary      : suffixe Ar    (sommeAr, prixVenteAr, montantAr...)
--    Pourcentage : suffixe Pct   (margePct)
--
--  Les identifiants sont entre guillemets pour conserver la casse
--  camelCase (PostgreSQL met sinon tout en minuscules).
--
--  Exécution : psql -U <utilisateur> -d <base> -f zaya_schema.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  Nettoyage (permet de relancer le script)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS monthly_achievements CASCADE;
DROP TABLE IF EXISTS "Livraison"    CASCADE;
DROP TABLE IF EXISTS "Budget"       CASCADE;
DROP TABLE IF EXISTS "Frais"        CASCADE;
DROP TABLE IF EXISTS "BoostReseau"  CASCADE;
DROP TABLE IF EXISTS "Boost"        CASCADE;
DROP TABLE IF EXISTS "PublicationProduit" CASCADE;
DROP TABLE IF EXISTS "PublicationReseau" CASCADE;
DROP TABLE IF EXISTS "Publication"  CASCADE;
DROP TABLE IF EXISTS "DetailVente"  CASCADE;
DROP TABLE IF EXISTS "VenteReseau"  CASCADE;
DROP TABLE IF EXISTS "Vente"        CASCADE;
DROP TABLE IF EXISTS "ClientReseau" CASCADE;
DROP TABLE IF EXISTS "Client"       CASCADE;
DROP TABLE IF EXISTS "DetailAchat"  CASCADE;
DROP TABLE IF EXISTS "Achat"        CASCADE;
DROP TABLE IF EXISTS "ProduitImage" CASCADE;
DROP TABLE IF EXISTS "Produit"      CASCADE;
DROP TABLE IF EXISTS "Reseau"       CASCADE;
DROP TABLE IF EXISTS "Categorie"    CASCADE;
DROP TABLE IF EXISTS "Utilisateur"  CASCADE;
DROP FUNCTION IF EXISTS "verifierStockDetailVente"();


-- =====================================================================
--  1. Tables de référence
-- =====================================================================

CREATE TABLE "Utilisateur" (
    "id"            SERIAL       PRIMARY KEY,
    "nom"           VARCHAR(100),
    "email"         VARCHAR(150) NOT NULL UNIQUE,
    "motDePasse"    VARCHAR(255) NOT NULL,              -- hash bcrypt / argon2
    "role"          VARCHAR(20)  NOT NULL DEFAULT 'admin',
    "actif"         BOOLEAN      NOT NULL DEFAULT TRUE,
    "dateCreation"  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE "Categorie" (
    "id"            SERIAL       PRIMARY KEY,
    "nom"           VARCHAR(100) NOT NULL UNIQUE,
    "dateCreation"  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE "Reseau" (
    "id"            SERIAL       PRIMARY KEY,
    "nom"           VARCHAR(100) NOT NULL UNIQUE,
    "lienCompte"    VARCHAR(255),
    "dateCreation"  TIMESTAMP    NOT NULL DEFAULT NOW()
);


-- =====================================================================
--  2. Catalogue
-- =====================================================================

CREATE TABLE "Produit" (
    "id"            SERIAL        PRIMARY KEY,
    "idCategorie"   INT           NOT NULL,
    "nom"           VARCHAR(150)  NOT NULL,
    "description"   TEXT,
    "materiel"      VARCHAR(100),
    "codeShein"     VARCHAR(50)   UNIQUE,               -- plusieurs NULL autorisés
    "image"         VARCHAR(255),
    "prix"          NUMERIC(10,2) CHECK ("prix" >= 0),  -- euro : prix d'achat
    "prixVenteAr"   NUMERIC(14,2) CHECK ("prixVenteAr" >= 0),  -- Ariary : dernier prix de vente posé
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkProduitCategorie"
        FOREIGN KEY ("idCategorie") REFERENCES "Categorie" ("id")
);

-- Photos secondaires (la principale reste dans "Produit"."image")
CREATE TABLE "ProduitImage" (
    "id"            SERIAL        PRIMARY KEY,
    "idProduit"     INT           NOT NULL,
    "url"           VARCHAR(255)  NOT NULL,
    "ordre"         INT           NOT NULL DEFAULT 0,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkProduitImageProduit"
        FOREIGN KEY ("idProduit") REFERENCES "Produit" ("id") ON DELETE CASCADE
);
CREATE INDEX "idxProduitImageProduit" ON "ProduitImage" ("idProduit", "ordre");


-- =====================================================================
--  3. Achats (commandes)
-- =====================================================================

CREATE TABLE "Achat" (
    "id"                    SERIAL        PRIMARY KEY,
    "nom"                   VARCHAR(150)  NOT NULL,
    "description"           TEXT,
    "dateCommande"          DATE,
    "dateArriveeEstimee"    DATE,
    "dateArrivee"           DATE,
    "somme"                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("somme" >= 0),     -- euro : Σ quantite x prix (calculée)
    "sommeTotale"           NUMERIC(12,2) CHECK ("sommeTotale" >= 0),                  -- euro : total saisi (frais inclus) ; s'il est renseigné, il fait foi pour le taux
    "sommeAr"               NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("sommeAr" >= 0),   -- Ariary : montant payé
    "dateFigement"          TIMESTAMP,                                                  -- NULL tant que la tarification est en brouillon
    "dateCreation"          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE "DetailAchat" (
    "id"            SERIAL        PRIMARY KEY,
    "idAchat"       INT           NOT NULL,
    "idProduit"     INT           NOT NULL,
    "quantite"      INT           NOT NULL CHECK ("quantite" > 0),
    "prix"          NUMERIC(10,2) NOT NULL CHECK ("prix" >= 0),   -- euro : prix d'achat unitaire
    "margePct"      NUMERIC(6,2),                                 -- % : lié à prixVenteAr
    "prixVenteAr"   NUMERIC(14,2) CHECK ("prixVenteAr" >= 0),     -- Ariary : lié à margePct
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkDetailAchatAchat"
        FOREIGN KEY ("idAchat")   REFERENCES "Achat"   ("id") ON DELETE CASCADE,
    CONSTRAINT "fkDetailAchatProduit"
        FOREIGN KEY ("idProduit") REFERENCES "Produit" ("id"),
    CONSTRAINT "uqDetailAchatAchatProduit"
        UNIQUE ("idAchat", "idProduit")
);


-- =====================================================================
--  5. Clients et ventes
-- =====================================================================

-- Client connu (facultatif sur une vente : la vente reste anonyme par défaut)
CREATE TABLE "Client" (
    "id"            SERIAL        PRIMARY KEY,
    "nom"           VARCHAR(150)  NOT NULL,              -- nom et prénom
    "telephone"     VARCHAR(30),
    "adresse"       TEXT,
    "note"          TEXT,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Réseaux par lesquels le client commande
CREATE TABLE "ClientReseau" (
    "idClient"      INT NOT NULL,
    "idReseau"      INT NOT NULL,

    CONSTRAINT "pkClientReseau" PRIMARY KEY ("idClient", "idReseau"),
    CONSTRAINT "fkClientReseauClient" FOREIGN KEY ("idClient") REFERENCES "Client" ("id") ON DELETE CASCADE,
    CONSTRAINT "fkClientReseauReseau" FOREIGN KEY ("idReseau") REFERENCES "Reseau" ("id")
);

CREATE TABLE "Vente" (
    "id"            SERIAL        PRIMARY KEY,
    "nom"           VARCHAR(150),
    "idClient"      INT,                                 -- NULL : client anonyme
    "dateVente"     DATE          NOT NULL DEFAULT CURRENT_DATE,
    "reductionAr"   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("reductionAr" >= 0),   -- Ariary
    "sommeAr"       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("sommeAr" >= 0),       -- Ariary : Σ quantite x prixVenteAr - reductionAr
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkVenteClient"
        FOREIGN KEY ("idClient") REFERENCES "Client" ("id") ON DELETE SET NULL
);

-- Réseaux sur lesquels la vente s'est faite (au moins un, contrôlé par l'API)
CREATE TABLE "VenteReseau" (
    "idVente"       INT NOT NULL,
    "idReseau"      INT NOT NULL,

    CONSTRAINT "pkVenteReseau" PRIMARY KEY ("idVente", "idReseau"),
    CONSTRAINT "fkVenteReseauVente"  FOREIGN KEY ("idVente")  REFERENCES "Vente"  ("id") ON DELETE CASCADE,
    CONSTRAINT "fkVenteReseauReseau" FOREIGN KEY ("idReseau") REFERENCES "Reseau" ("id")
);

CREATE TABLE "DetailVente" (
    "id"             SERIAL        PRIMARY KEY,
    "idVente"        INT           NOT NULL,
    "idDetailAchat"  INT           NOT NULL,      -- ligne de commande d'origine (donne produit + commande)
    "quantite"       INT           NOT NULL CHECK ("quantite" > 0),
    "prixVenteAr"    NUMERIC(14,2) NOT NULL CHECK ("prixVenteAr" >= 0),   -- Ariary : prix réellement pratiqué
    "dateCreation"   TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkDetailVenteVente"
        FOREIGN KEY ("idVente")       REFERENCES "Vente"       ("id") ON DELETE CASCADE,
    CONSTRAINT "fkDetailVenteDetailAchat"
        FOREIGN KEY ("idDetailAchat") REFERENCES "DetailAchat" ("id")
);


-- Livraison d'une vente (une au plus par vente)
--   a_programmer → programmee (livreur appelé) → en_cours → livree ; annulee
CREATE TABLE "Livraison" (
    "id"                       SERIAL        PRIMARY KEY,
    "idVente"                  INT           NOT NULL UNIQUE,
    "idClient"                 INT,
    "libelle"                  VARCHAR(150),
    "adresse"                  TEXT,                     -- recopiée du client, modifiable
    "telephone"                VARCHAR(30),
    "livreur"                  VARCHAR(100),             -- nom ou contact du livreur
    "fraisAr"                  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("fraisAr" >= 0),   -- Ariary
    "statut"                   VARCHAR(20)   NOT NULL DEFAULT 'a_programmer',
    "dateHeureAppelLivreur"    TIMESTAMP,                -- quand appeler les livreurs
    "dateHeureLivraison"       TIMESTAMP,                -- livraison prévue
    "dateHeureLivree"          TIMESTAMP,                -- livraison réelle
    "note"                     TEXT,
    "dateCreation"             TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "ckLivraisonStatut"
        CHECK ("statut" IN ('a_programmer', 'programmee', 'en_cours', 'livree', 'annulee')),
    CONSTRAINT "fkLivraisonVente"
        FOREIGN KEY ("idVente")  REFERENCES "Vente"  ("id") ON DELETE CASCADE,
    CONSTRAINT "fkLivraisonClient"
        FOREIGN KEY ("idClient") REFERENCES "Client" ("id") ON DELETE SET NULL
);


-- =====================================================================
--  6. Social media manager
-- =====================================================================

CREATE TABLE "Publication" (
    "id"                    SERIAL       PRIMARY KEY,
    "nom"                   VARCHAR(150) NOT NULL,
    "description"           TEXT,
    "statut"                VARCHAR(20)  NOT NULL DEFAULT 'a_faire',
    "dateHeurePublication"  TIMESTAMP,
    "lienPinterest"         VARCHAR(255),
    "lienContenu"           VARCHAR(255),
    "idAchat"               INT,
    "dateCreation"          TIMESTAMP    NOT NULL DEFAULT NOW(),

    -- supprimee : corbeille, la publication peut être restaurée
    CONSTRAINT "ckPublicationStatut"
        CHECK ("statut" IN ('a_faire', 'creee', 'publiee', 'supprimee')),
    CONSTRAINT "fkPublicationAchat"
        FOREIGN KEY ("idAchat")  REFERENCES "Achat"  ("id") ON DELETE SET NULL
);

-- Une publication est diffusée sur un ou plusieurs réseaux
CREATE TABLE "PublicationReseau" (
    "idPublication" INT NOT NULL,
    "idReseau"      INT NOT NULL,
    "dateHeurePublication" TIMESTAMP,   -- heure propre au réseau ; NULL = date de la publication

    CONSTRAINT "pkPublicationReseau" PRIMARY KEY ("idPublication", "idReseau"),
    CONSTRAINT "fkPublicationReseauPublication"
        FOREIGN KEY ("idPublication") REFERENCES "Publication" ("id") ON DELETE CASCADE,
    CONSTRAINT "fkPublicationReseauReseau"
        FOREIGN KEY ("idReseau")      REFERENCES "Reseau"      ("id")
);

-- Bijoux présentés dans la publication (pris dans la commande liée)
CREATE TABLE "PublicationProduit" (
    "idPublication" INT NOT NULL,
    "idProduit"     INT NOT NULL,

    CONSTRAINT "pkPublicationProduit" PRIMARY KEY ("idPublication", "idProduit"),
    CONSTRAINT "fkPublicationProduitPublication"
        FOREIGN KEY ("idPublication") REFERENCES "Publication" ("id") ON DELETE CASCADE,
    CONSTRAINT "fkPublicationProduitProduit"
        FOREIGN KEY ("idProduit")     REFERENCES "Produit"     ("id") ON DELETE CASCADE
);
CREATE INDEX "idxPublicationProduitProduit" ON "PublicationProduit" ("idProduit");


-- =====================================================================
--  7. Boosts, frais et budgets
-- =====================================================================

-- Un boost promeut une publication ; sa commande se déduit de la publication
CREATE TABLE "Boost" (
    "id"            SERIAL        PRIMARY KEY,
    "nom"           VARCHAR(150),
    "idPublication" INT           NOT NULL,
    "dateBoost"     DATE,
    "montantAr"     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("montantAr" >= 0),   -- Ariary
    "raison"        TEXT,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkBoostPublication"
        FOREIGN KEY ("idPublication") REFERENCES "Publication" ("id") ON DELETE CASCADE
);

-- Réseaux sur lesquels le boost est diffusé
CREATE TABLE "BoostReseau" (
    "idBoost"       INT NOT NULL,
    "idReseau"      INT NOT NULL,

    CONSTRAINT "pkBoostReseau" PRIMARY KEY ("idBoost", "idReseau"),
    CONSTRAINT "fkBoostReseauBoost"  FOREIGN KEY ("idBoost")  REFERENCES "Boost"  ("id") ON DELETE CASCADE,
    CONSTRAINT "fkBoostReseauReseau" FOREIGN KEY ("idReseau") REFERENCES "Reseau" ("id")
);

-- Frais rattachés soit à une commande, soit à un boost (jamais aux deux)
CREATE TABLE "Frais" (
    "id"            SERIAL        PRIMARY KEY,
    "idAchat"       INT,
    "idBoost"       INT,
    "libelle"       VARCHAR(150),
    "montantAr"     NUMERIC(14,2) NOT NULL CHECK ("montantAr" >= 0),   -- Ariary
    "dateFrais"     DATE,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkFraisAchat"
        FOREIGN KEY ("idAchat") REFERENCES "Achat" ("id") ON DELETE CASCADE,
    CONSTRAINT "fkFraisBoost"
        FOREIGN KEY ("idBoost") REFERENCES "Boost" ("id") ON DELETE CASCADE,
    CONSTRAINT "ckFraisUneCible"
        CHECK (("idAchat" IS NOT NULL)::int + ("idBoost" IS NOT NULL)::int = 1)
);

-- Budget de communication alloué à une commande (ex. 50 000 Ar), consommé par les boosts
CREATE TABLE "Budget" (
    "id"            SERIAL        PRIMARY KEY,
    "idAchat"       INT           NOT NULL,
    "libelle"       VARCHAR(150),
    "montantAr"     NUMERIC(14,2) NOT NULL CHECK ("montantAr" >= 0),   -- Ariary
    "dateBudget"    DATE,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkBudgetAchat"
        FOREIGN KEY ("idAchat") REFERENCES "Achat" ("id") ON DELETE CASCADE
);


-- =====================================================================
--  7 bis. Objectifs du mois (voir backend/prisma/sql/2026-09-22_monthly_achievements.sql)
--  Nommage snake_case imposé par la spécification de la fonctionnalité.
-- =====================================================================

CREATE TABLE monthly_achievements (
    id             SERIAL        PRIMARY KEY,
    user_id        INT           NOT NULL,
    title          VARCHAR(150)  NOT NULL,
    description    TEXT,
    category       VARCHAR(50),
    target_value   NUMERIC(14,2) NOT NULL CHECK (target_value >= 0),
    current_value  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
    unit           VARCHAR(30),
    start_date     DATE          NOT NULL,
    end_date       DATE          NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'en_cours'
        CHECK (status IN ('en_cours', 'atteint', 'abandonne')),
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
    completed_at   TIMESTAMP,

    CONSTRAINT fk_monthly_achievements_user
        FOREIGN KEY (user_id) REFERENCES "Utilisateur" ("id") ON DELETE CASCADE,
    CONSTRAINT ck_monthly_achievements_dates CHECK (end_date >= start_date)
);


-- =====================================================================
--  8. Index (PostgreSQL n'indexe pas automatiquement les clés étrangères)
-- =====================================================================

CREATE INDEX idx_monthly_achievements_user     ON monthly_achievements (user_id);
CREATE INDEX idx_monthly_achievements_end_date ON monthly_achievements (end_date);

CREATE INDEX "idxProduitCategorie"        ON "Produit"     ("idCategorie");
CREATE INDEX "idxDetailAchatProduit"      ON "DetailAchat" ("idProduit");
CREATE INDEX "idxBoostPublication"        ON "Boost"       ("idPublication");
CREATE INDEX "idxBoostReseauReseau"       ON "BoostReseau" ("idReseau");
CREATE INDEX "idxBudgetAchat"             ON "Budget"      ("idAchat");
CREATE INDEX "idxFraisAchat"              ON "Frais"       ("idAchat");
CREATE INDEX "idxFraisBoost"              ON "Frais"       ("idBoost");
CREATE INDEX "idxClientReseauReseau"      ON "ClientReseau" ("idReseau");
CREATE INDEX "idxVenteReseauReseau"       ON "VenteReseau" ("idReseau");
CREATE INDEX "idxVenteClient"             ON "Vente"       ("idClient");
CREATE INDEX "idxLivraisonClient"         ON "Livraison"   ("idClient");
CREATE INDEX "idxLivraisonStatut"         ON "Livraison"   ("statut");
CREATE INDEX "idxVenteDate"               ON "Vente"       ("dateVente");
CREATE INDEX "idxDetailVenteVente"        ON "DetailVente" ("idVente");
CREATE INDEX "idxDetailVenteDetailAchat"  ON "DetailVente" ("idDetailAchat");
CREATE INDEX "idxPublicationReseauReseau" ON "PublicationReseau" ("idReseau");
CREATE INDEX "idxPublicationAchat"        ON "Publication" ("idAchat");
CREATE INDEX "idxPublicationDate"         ON "Publication" ("dateHeurePublication");


-- =====================================================================
--  9. Règle d'intégrité : on ne vend pas plus que le stock restant
--     stock restant = DetailAchat.quantite - Σ DetailVente.quantite
-- =====================================================================

CREATE FUNCTION "verifierStockDetailVente"() RETURNS TRIGGER AS $$
DECLARE
    quantiteAchetee INT;
    quantiteVendue  INT;
BEGIN
    -- Verrouille la ligne de commande pour éviter deux ventes simultanées
    SELECT "quantite" INTO quantiteAchetee
    FROM "DetailAchat"
    WHERE "id" = NEW."idDetailAchat"
    FOR UPDATE;

    SELECT COALESCE(SUM("quantite"), 0) INTO quantiteVendue
    FROM "DetailVente"
    WHERE "idDetailAchat" = NEW."idDetailAchat"
      AND "id" IS DISTINCT FROM NEW."id";

    IF quantiteVendue + NEW."quantite" > quantiteAchetee THEN
        RAISE EXCEPTION 'Stock insuffisant pour la ligne de commande % (acheté : %, déjà vendu : %, demandé : %)',
            NEW."idDetailAchat", quantiteAchetee, quantiteVendue, NEW."quantite"
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trgDetailVenteStock"
    BEFORE INSERT OR UPDATE OF "quantite", "idDetailAchat" ON "DetailVente"
    FOR EACH ROW EXECUTE FUNCTION "verifierStockDetailVente"();

COMMIT;