-- =====================================================================
--  Type de contenu : publication ou story
--
--  Migration additive : ajoute une colonne à "Publication" (renommée
--  « Contenus » dans l'interface). Les contenus existants deviennent des
--  publications (valeur par défaut). Les types autorisés sont contrôlés par
--  l'API (TYPES_CONTENU), pour pouvoir en ajouter sans nouvelle migration.
--  Jouée automatiquement au démarrage de l'API (IF NOT EXISTS, donc
--  rejouable sans effet), ou à la main :
--    docker compose exec -T db psql -U zaya -d zaya < backend/prisma/sql/2026-09-29_contenu_type.sql
-- =====================================================================

ALTER TABLE "Publication" ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'publication';

CREATE INDEX IF NOT EXISTS "idxPublicationType" ON "Publication" ("type");
