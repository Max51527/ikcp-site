-- ──────────────────────────────────────────────────────────────
-- Schema Cloudflare D1 — Espace membre IKCP (freemium v2)
-- À exécuter via :
--   npx wrangler d1 execute ikcp-client-db --file=schema.sql --remote
-- ──────────────────────────────────────────────────────────────

-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                  -- UUID v4
  email TEXT UNIQUE,                    -- NULL après suppression RGPD
  tier TEXT NOT NULL DEFAULT 'free',    -- 'free' | 'premium' | 'fo'
  display_name TEXT,
  prenom TEXT,                          -- prénom affiché dans l'app
  profile_json TEXT,                    -- JSON onboarding { objectifs, patrimoine, ... }
  consents_json TEXT,                   -- JSON consentements RGPD { marketing, analytics, ... }
  marketing_consent INTEGER DEFAULT 0, -- 0 | 1 (dédupliqué pour requêtes rapides)
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at INTEGER NOT NULL,          -- unix ms
  last_login_at INTEGER,
  last_seen INTEGER,                    -- dernière activité
  deleted_at INTEGER,                   -- suppression RGPD (soft delete)
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

-- ──────────────────────────────────────────────────────────────
-- TABLES ESPACE MEMBRE (freemium v2)
-- ──────────────────────────────────────────────────────────────

-- SIREN rattachés à l'utilisateur
CREATE TABLE IF NOT EXISTS user_sirens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  siren TEXT NOT NULL,
  nom_societe TEXT,
  forme_juridique TEXT,
  capital INTEGER,
  date_creation TEXT,
  ville TEXT,
  cached_json TEXT,         -- données Pappers complètes (JSON)
  last_refreshed_at INTEGER,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sirens_user ON user_sirens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sirens_user_siren ON user_sirens(user_id, siren);

-- Conversations Marcel (historique résumé)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  sphere TEXT,               -- 'fiscal' | 'patrimoine' | 'transmission' | 'lifestyle'
  agent_principal TEXT,      -- 'Marcel' | 'Codex' | 'Batisseur' | etc.
  messages_count INTEGER DEFAULT 0,
  last_message_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_convs_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_convs_last ON conversations(last_message_at DESC);

-- Carnet de contacts privé
CREATE TABLE IF NOT EXISTS user_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,    -- 'juridique' | 'finance' | 'comptable' | 'conciergerie' | 'hospitalite' | 'art' | 'lifestyle' | 'sante' | 'education'
  nom TEXT NOT NULL,
  prenom TEXT,
  societe TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  pays TEXT DEFAULT 'France',
  telephone TEXT,
  email TEXT,
  site_web TEXT,
  notes TEXT,
  tags_json TEXT,
  is_favorite INTEGER DEFAULT 0,
  last_interaction_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON user_contacts(user_id);

-- Alertes Marcel (veille automatique)
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sphere TEXT,               -- 'fiscal' | 'marchés' | 'immobilier' | 'collectibles'
  source TEXT,               -- 'marcel_veille' | 'perplexity' | 'pappers'
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  importance INTEGER DEFAULT 1,  -- 1=info, 2=important, 3=urgent
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, read_at) WHERE read_at IS NULL;

-- Documents signés (DER, LM, rapports)
CREATE TABLE IF NOT EXISTS user_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'DER' | 'LM' | 'rapport' | 'cartographie'
  title TEXT NOT NULL,
  r2_key TEXT,               -- clé R2 pour téléchargement PDF
  hash_eidas TEXT,           -- hash SHA-256 du document signé
  signed_at INTEGER,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_docs_user ON user_documents(user_id);

-- Veilles marché (montres, art, voitures, vins)
CREATE TABLE IF NOT EXISTS user_watches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market TEXT NOT NULL,      -- 'horlogerie' | 'art' | 'automobile' | 'vinsspiritueux'
  category TEXT,
  query TEXT NOT NULL,       -- ex: 'Patek 5711 vert' | 'Masi Costasera Riserva 2019'
  target_price INTEGER,      -- cible en EUR centimes
  last_value INTEGER,        -- dernière valeur trouvée
  last_checked_at INTEGER,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_watches_user ON user_watches(user_id, active);

-- ──────────────────────────────────────────────────────────────
-- MIGRATIONS (si la DB existe déjà, exécuter séparément)
-- npx wrangler d1 execute ikcp-client-db --remote --command "ALTER TABLE ..."
-- ──────────────────────────────────────────────────────────────
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_json TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS consents_json TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen INTEGER;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at INTEGER;
