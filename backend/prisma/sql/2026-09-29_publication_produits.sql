-- =====================================================================
--  Bijoux présentés dans une publication
--
--  Migration additive : table de liaison publication ↔ produit. Les bijoux
--  choisis appartiennent à la commande liée à la publication (contrôlé par
--  l'API). Ne touche à aucune table existante ni à leurs données.
--  Jouée automatiquement au démarrage de l'API (IF NOT EXISTS, donc
--  rejouable sans effet), ou à la main :
--    docker compose exec -T db psql -U zaya -d zaya < backend/prisma/sql/2026-09-29_publication_produits.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS "PublicationProduit" (
    "idPublication" INT NOT NULL,
    "idProduit"     INT NOT NULL,

    CONSTRAINT "pkPublicationProduit" PRIMARY KEY ("idPublication", "idProduit"),
    CONSTRAINT "fkPublicationProduitPublication"
        FOREIGN KEY ("idPublication") REFERENCES "Publication" ("id") ON DELETE CASCADE,
    CONSTRAINT "fkPublicationProduitProduit"
        FOREIGN KEY ("idProduit") REFERENCES "Produit" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idxPublicationProduitProduit" ON "PublicationProduit" ("idProduit");
