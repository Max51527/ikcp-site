-- ──────────────────────────────────────────────────────────────
-- Schema Cloudflare D1 — Espace membre IKCP (freemium v2)
-- À exécuter via :
--   npx wrangler d1 execute ikcp-client-db --file=schema.sql --remote
-- ──────────────────────────────────────────────────────────────

-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                  -- UUID v4
  email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',    -- 'free' | 'premium' | 'fo'
  display_name TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at INTEGER NOT NULL,          -- unix ms
  last_login_at INTEGER,
  source TEXT,                          -- 'organic' | 'ikcp.eu' | 'recommandation' | etc.
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Magic links (TTL 15 min, single-use)
CREATE TABLE IF NOT EXISTS magic_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_magic_email ON magic_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_expires ON magic_tokens(expires_at);

-- Sessions (cookie HttpOnly · TTL 30j)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Compteurs d'usage mensuel
CREATE TABLE IF NOT EXISTS usage (
  user_id TEXT NOT NULL,
  year_month TEXT NOT NULL,             -- "2026-05"
  pappers_lookups INTEGER NOT NULL DEFAULT 0,
  marcel_messages INTEGER NOT NULL DEFAULT 0,
  pdf_exports INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Lookups Pappers (historique pour Théodore + cabinet sync)
CREATE TABLE IF NOT EXISTS pappers_lookups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  siren TEXT NOT NULL,
  query TEXT,
  company_name TEXT,
  forme_juridique TEXT,
  capital INTEGER,
  ts INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_lookups_user_ts ON pappers_lookups(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_lookups_siren ON pappers_lookups(siren);
CREATE INDEX IF NOT EXISTS idx_lookups_ts ON pappers_lookups(ts);

-- Conversations Marcel (résumé pour cabinet)
CREATE TABLE IF NOT EXISTS marcel_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  agents_called TEXT,
  started_at INTEGER NOT NULL,
  last_message_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_marcel_user ON marcel_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_marcel_last ON marcel_sessions(last_message_at);

-- Événements pour le polling logiciel-gp + audit
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,                   -- 'signup' 'login' 'pappers_lookup' 'marcel_message' 'subscription_upgraded' 'subscription_canceled' 'payment_failed'
  payload_json TEXT,
  ts INTEGER NOT NULL,
  cabinet_synced_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_events_user_ts ON events(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_unsynced ON events(cabinet_synced_at, ts) WHERE cabinet_synced_at IS NULL;

-- Audit log (RGPD + sécurité)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  ts INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_user_ts ON audit_log(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_ts ON audit_log(action, ts DESC);

-- Stripe events (idempotency + retry)
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT,
  payload_json TEXT NOT NULL,
  processed_at INTEGER,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stripe_processed ON stripe_events(processed_at, ts);
