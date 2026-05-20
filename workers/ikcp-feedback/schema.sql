-- Schéma D1 — ikcp-feedback-db (WEUR Paris)
-- À exécuter une seule fois :
--   npx wrangler d1 execute ikcp-feedback-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS feedbacks (
  id         TEXT PRIMARY KEY,                      -- FB-XXXXXXXX
  ts         TEXT NOT NULL,                         -- ISO 8601 UTC
  besoin     TEXT NOT NULL,                         -- Texte libre (besoin exprimé)
  categories TEXT,                                  -- CSV : "Deal Flow · PE, Immo"
  priorite   TEXT,                                  -- "Indispensable" / "Souhaitable" / "Bonus"
  email      TEXT,                                  -- Contact optionnel
  page       TEXT,                                  -- Origine : /family-office.html, /app/...
  ai_summary TEXT,                                  -- Résumé Haiku (optionnel)
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index pour tri par date
CREATE INDEX IF NOT EXISTS idx_feedbacks_ts ON feedbacks(ts DESC);

-- Index pour filtrage par priorité
CREATE INDEX IF NOT EXISTS idx_feedbacks_priorite ON feedbacks(priorite);
