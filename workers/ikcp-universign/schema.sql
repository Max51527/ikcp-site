-- IKCP Universign — schéma D1
-- Suivi des transactions de signature électronique

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT UNIQUE NOT NULL,
  custom_id TEXT,
  family_id TEXT,
  doc_count INTEGER DEFAULT 1,
  signers_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_universign_family ON transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_universign_status ON transactions(status);
