-- =====================================================================
--  Notifications marquées « vues »
--
--  Les notifications sont calculées à la volée (tâches, échéances) ; cette
--  table retient seulement celles que chaque utilisateur a marquées vues,
--  par clé « <id de la notification>|<échéance relative> ». Une tâche vue la
--  veille réapparaît donc le jour même, puis si elle passe en retard.
--  Migration additive : ne touche à aucune table existante ni à leurs données.
--  Jouée automatiquement au démarrage de l'API (IF NOT EXISTS, donc
--  rejouable sans effet), ou à la main :
--    docker compose exec -T db psql -U zaya -d zaya < backend/prisma/sql/2026-09-29_notifications_vues.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS "NotificationVue" (
    "idUtilisateur" INT           NOT NULL,
    "cle"           VARCHAR(200)  NOT NULL,
    "dateVue"       TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT "pkNotificationVue" PRIMARY KEY ("idUtilisateur", "cle"),
    CONSTRAINT "fkNotificationVueUtilisateur"
        FOREIGN KEY ("idUtilisateur") REFERENCES "Utilisateur" ("id") ON DELETE CASCADE
);
