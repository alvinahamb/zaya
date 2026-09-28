-- =====================================================================
--  Photos supplémentaires d'un produit
--
--  Migration additive : la photo principale reste dans "Produit"."image" ;
--  cette table ne contient que les photos secondaires, dans l'ordre
--  d'affichage. Ne touche à aucune table existante ni à leurs données.
--  Jouée automatiquement au démarrage de l'API (IF NOT EXISTS, donc
--  rejouable sans effet), ou à la main :
--    docker compose exec -T db psql -U zaya -d zaya < backend/prisma/sql/2026-09-28_produit_images.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS "ProduitImage" (
    "id"            SERIAL        PRIMARY KEY,
    "idProduit"     INT           NOT NULL,
    "url"           VARCHAR(255)  NOT NULL,
    "ordre"         INT           NOT NULL DEFAULT 0,
    "dateCreation"  TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "fkProduitImageProduit"
        FOREIGN KEY ("idProduit") REFERENCES "Produit" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idxProduitImageProduit" ON "ProduitImage" ("idProduit", "ordre");
