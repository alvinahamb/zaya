-- =====================================================================
--  Objectifs du mois (monthly_achievements)
--
--  Migration additive : ne touche à aucune table existante ni à leurs
--  données. Jouée automatiquement au démarrage de l'API (CREATE ... IF NOT
--  EXISTS, donc rejouable sans effet), ou à la main :
--    docker compose exec -T db psql -U zaya -d zaya < backend/prisma/sql/2026-09-22_monthly_achievements.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS monthly_achievements (
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

CREATE INDEX IF NOT EXISTS idx_monthly_achievements_user     ON monthly_achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_achievements_end_date ON monthly_achievements (end_date);
