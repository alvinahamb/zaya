-- =====================================================================
--  Jeton personnel pour les Rappels iPhone
--
--  Un raccourci iOS lit chaque matin les tâches du jour via
--  /api/rappels/aujourdhui. Il s'authentifie avec un jeton long terme,
--  révocable, dont on ne stocke que l'empreinte SHA-256 (hex).
--  Migration additive, jouée automatiquement au démarrage de l'API.
-- =====================================================================

ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "jetonRappels" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "Utilisateur_jetonRappels_key" ON "Utilisateur" ("jetonRappels");
