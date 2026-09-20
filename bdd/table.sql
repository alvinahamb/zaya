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
DROP TABLE IF EXISTS "Publication"  CASCADE;
DROP TABLE IF EXISTS "DetailVente"  CASCADE;
DROP TABLE IF EXISTS "Vente"        CASCADE;
DROP TABLE IF EXISTS "Frais"        CASCADE;
DROP TABLE IF EXISTS "Boost"        CASCADE;
DROP TABLE IF EXISTS "DetailAchat"  CASCADE;
DROP TABLE IF EXISTS "Achat"        CASCADE;
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
    "somme"                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("somme" >= 0),     -- euro : Σ quantite x prix
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
--  4. Boosts et frais
-- =====================================================================

CREATE TABLE "Boost" (
    "id"            SERIAL        PRIMARY KEY,
    "nom"           VARCHAR(150),
    "idAchat"       INT           NOT NULL,
    "idReseau"      INT           NOT NULL,
    "dateBoost"     DATE,
    "montantAr"     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("montantAr" >= 0),   -- Ariary
    "raison"        TEXT,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkBoostAchat"
        FOREIGN KEY ("idAchat")  REFERENCES "Achat"  ("id"),
    CONSTRAINT "fkBoostReseau"
        FOREIGN KEY ("idReseau") REFERENCES "Reseau" ("id")
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


-- =====================================================================
--  5. Ventes (client anonyme)
-- =====================================================================

CREATE TABLE "Vente" (
    "id"            SERIAL        PRIMARY KEY,
    "nom"           VARCHAR(150),
    "idReseau"      INT           NOT NULL,
    "dateVente"     DATE          NOT NULL DEFAULT CURRENT_DATE,
    "reductionAr"   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("reductionAr" >= 0),   -- Ariary
    "sommeAr"       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK ("sommeAr" >= 0),       -- Ariary : Σ quantite x prixVenteAr - reductionAr
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkVenteReseau"
        FOREIGN KEY ("idReseau") REFERENCES "Reseau" ("id")
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
    "idReseau"              INT,
    "idAchat"               INT,
    "dateCreation"          TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT "ckPublicationStatut"
        CHECK ("statut" IN ('a_faire', 'creee', 'publiee')),
    CONSTRAINT "fkPublicationReseau"
        FOREIGN KEY ("idReseau") REFERENCES "Reseau" ("id") ON DELETE SET NULL,
    CONSTRAINT "fkPublicationAchat"
        FOREIGN KEY ("idAchat")  REFERENCES "Achat"  ("id") ON DELETE SET NULL
);


-- =====================================================================
--  7. Index (PostgreSQL n'indexe pas automatiquement les clés étrangères)
-- =====================================================================

CREATE INDEX "idxProduitCategorie"        ON "Produit"     ("idCategorie");
CREATE INDEX "idxDetailAchatProduit"      ON "DetailAchat" ("idProduit");
CREATE INDEX "idxBoostAchat"              ON "Boost"       ("idAchat");
CREATE INDEX "idxBoostReseau"             ON "Boost"       ("idReseau");
CREATE INDEX "idxFraisAchat"              ON "Frais"       ("idAchat");
CREATE INDEX "idxFraisBoost"              ON "Frais"       ("idBoost");
CREATE INDEX "idxVenteReseau"             ON "Vente"       ("idReseau");
CREATE INDEX "idxVenteDate"               ON "Vente"       ("dateVente");
CREATE INDEX "idxDetailVenteVente"        ON "DetailVente" ("idVente");
CREATE INDEX "idxDetailVenteDetailAchat"  ON "DetailVente" ("idDetailAchat");
CREATE INDEX "idxPublicationReseau"       ON "Publication" ("idReseau");
CREATE INDEX "idxPublicationAchat"        ON "Publication" ("idAchat");
CREATE INDEX "idxPublicationDate"         ON "Publication" ("dateHeurePublication");


-- =====================================================================
--  8. Règle d'intégrité : on ne vend pas plus que le stock restant
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