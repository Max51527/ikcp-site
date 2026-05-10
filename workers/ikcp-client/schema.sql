-- ikcp-client D1 schema v1
-- Run :  npx wrangler d1 execute ikcp-client-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'client',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  ua TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  email TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  ua TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);

-- Conversations Marcel persistantes par client (phase 2)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  history TEXT,        -- JSON [{role, content, ts}]
  profile TEXT,        -- JSON profile auto-detected
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);

-- Dossiers patrimoine par client (phase 2)
CREATE TABLE IF NOT EXISTS dossiers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,        -- succession | fiscal | immobilier | etc.
  status TEXT DEFAULT 'open',
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_dossiers_user ON dossiers(user_id);

-- ════════════════════════════════════════════════════════════════════
-- TABLES PHASE 2 — dashboard family office (ajout 2026-05-09)
-- Alimentent l'endpoint GET /api/dashboard/me dont le shape correspond
-- à proposals/dashboard-data.js (front bascule du mock à la donnée réelle
-- sans modification de rendu).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS patrimoine_snapshot (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asof INTEGER NOT NULL,
  net_worth INTEGER NOT NULL,
  variation_trim_pct REAL,
  variation_an_pct REAL,
  classes_json TEXT NOT NULL,
  allocation_cible_json TEXT,
  drift_max_pct REAL,
  drift_severity TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_patrimoine_user_asof ON patrimoine_snapshot(user_id, asof DESC);

CREATE TABLE IF NOT EXISTS echeances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  source TEXT,
  montant INTEGER,
  status TEXT NOT NULL DEFAULT 'a_venir',
  urgent INTEGER DEFAULT 0,
  rappel_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_echeances_user_date ON echeances(user_id, date);

CREATE TABLE IF NOT EXISTS arbitrages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conv_id TEXT,
  titre TEXT NOT NULL,
  contexte TEXT,
  reco_marcel TEXT NOT NULL,
  sources_json TEXT,
  gain_estime INTEGER,
  gain_qualitatif TEXT,
  status TEXT NOT NULL DEFAULT 'en_attente',
  prepared_at INTEGER NOT NULL,
  validated_at INTEGER,
  validated_by TEXT,
  decision_notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (conv_id) REFERENCES conversations(id)
);
CREATE INDEX IF NOT EXISTS idx_arbitrages_user_status ON arbitrages(user_id, status);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT NOT NULL,
  pages INTEGER,
  annee INTEGER,
  tags_json TEXT,
  generated INTEGER DEFAULT 0,
  signature_provider TEXT,
  signature_id TEXT,
  signed_at INTEGER,
  date_recu INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, type);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  who TEXT NOT NULL,
  what TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  payload_json TEXT,
  trace_id TEXT,
  ts INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_events_user_ts ON events(user_id, ts DESC);

CREATE TABLE IF NOT EXISTS univers_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  univers_key TEXT NOT NULL,
  titre TEXT NOT NULL,
  etat TEXT,
  valeur_estimee INTEGER,
  source_estimation TEXT,
  tendance TEXT,
  derniere_alerte TEXT,
  alerte_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_univers_user_key ON univers_items(user_id, univers_key);

CREATE TABLE IF NOT EXISTS opportunites (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  categorie TEXT NOT NULL,
  titre TEXT NOT NULL,
  pitch TEXT,
  ticket_min INTEGER,
  ticket_max INTEGER,
  deadline TEXT,
  source TEXT,
  fit_score INTEGER,
  fit_reasons_json TEXT,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_opportunites_user_status ON opportunites(user_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunites_deadline ON opportunites(deadline);

-- ════════════════════════════════════════════════════════════════════
-- BETA CODES — invitation pour la phase de beta test (50 familles S2 2026)
-- Format des codes : BETA-FAMI-XXXX-YYYY (4 segments × 4 chars alphanum)
-- Génération : Maxime depuis le dashboard admin (insertion manuelle ou
-- script seed). Validation côté Worker via /auth/beta-redeem.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS beta_codes (
  code TEXT PRIMARY KEY,            -- BETA-FAMI-XXXX-YYYY
  max_uses INTEGER DEFAULT 1,       -- combien de fois utilisable (1 = personnel, > 1 = lien partageable)
  used_count INTEGER DEFAULT 0,
  used_by_email TEXT,               -- premier email qui a redeemé
  created_at INTEGER NOT NULL,
  expires_at INTEGER,               -- timestamp · NULL si pas de péremption
  notes TEXT,                       -- ex : "Famille X · invité par Maxime · entreprise familiale CA 12 M€"
  redeemed_at INTEGER,
  source TEXT                       -- "linkedin", "rdv", "salon", "ami", "autre"
);

CREATE INDEX IF NOT EXISTS idx_beta_codes_expires ON beta_codes(expires_at);

-- Quelques codes de seed (à modifier en production) :
-- INSERT INTO beta_codes (code, max_uses, created_at, notes) VALUES
--   ('BETA-FAMI-DEMO-2026', 1, strftime('%s', 'now') * 1000, 'Démo pitch'),
--   ('BETA-FAMI-PIVOT-2026', 1, strftime('%s', 'now') * 1000, 'Pivot stratégique'),
--   ('BETA-FAMI-PILOTE-001', 1, strftime('%s', 'now') * 1000, 'Premier pilote');
