-- =====================================================================
--  Heure de publication propre à chaque réseau social
--
--  Migration additive : ajoute une colonne nullable à la table de liaison
--  "PublicationReseau". NULL = le réseau suit la date de la publication.
--  Aucune donnée existante n'est modifiée. Rejouable (IF NOT EXISTS).
-- =====================================================================

ALTER TABLE "PublicationReseau" ADD COLUMN IF NOT EXISTS "dateHeurePublication" TIMESTAMP;
