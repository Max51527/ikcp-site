-- IKCP Témoin — schéma D1 (SQLite Paris)
-- Audit log immutable conforme MIF II / RGPD / eIDAS

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT UNIQUE NOT NULL,
  family_id TEXT NOT NULL,
  user_id TEXT,
  timestamp TEXT NOT NULL,
  universe TEXT,
  question TEXT NOT NULL,
  answer_summary TEXT,
  agent TEXT,
  model TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  sources TEXT,
  mif2_compliant INTEGER DEFAULT 1,
  r2_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_family ON audit_log(family_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_universe ON audit_log(universe);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
