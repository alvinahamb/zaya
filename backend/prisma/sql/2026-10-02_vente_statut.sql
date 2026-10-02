-- =====================================================================
--  Statut des ventes : creee → en_livraison → payee
--
--  Une vente n'est comptée (CA, statistiques, récap des commandes) qu'une
--  fois payée ; avant, ses articles restent réservés dans le stock.
--  Les ventes existantes étaient déjà conclues : elles passent « payee »,
--  les nouvelles démarrent « creee ».
--  Migration additive, jouée automatiquement au démarrage de l'API.
-- =====================================================================

ALTER TABLE "Vente" ADD COLUMN IF NOT EXISTS "statut" VARCHAR(20) NOT NULL DEFAULT 'payee';

ALTER TABLE "Vente" ALTER COLUMN "statut" SET DEFAULT 'creee';

CREATE INDEX IF NOT EXISTS "idxVenteStatut" ON "Vente" ("statut");
