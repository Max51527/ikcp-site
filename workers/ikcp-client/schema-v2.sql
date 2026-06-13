-- ┌─────────────────────────────────────────────────────────────┐
-- │  CASSIUS — Schema D1 v2 (espace client + freemium)         │
-- │  Région : WEUR Paris (CDG)                                 │
-- │  Date : 2026-05-16                                          │
-- │  Workers concernés : ikcp-client (auth) · ikcp-chat (Marcel)│
-- │                      ikcp-veille (Perplexity) · Témoin     │
-- └─────────────────────────────────────────────────────────────┘

-- ─── 1. USERS — identité + tier freemium ───────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                       -- UUID v4
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  prenom TEXT,
  tier TEXT NOT NULL DEFAULT 'discovery',    -- discovery | premium_essentiel | premium_fo
  beta_fondateur INTEGER DEFAULT 0,          -- 1 si famille fondatrice (50 max)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,                  -- active | trialing | past_due | canceled
  subscription_until INTEGER,                -- ts expiration (incl. 6 mois offerts bêta)
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  marketing_consent INTEGER DEFAULT 0,       -- RGPD
  rgpd_consent_at INTEGER,
  deleted_at INTEGER                         -- soft delete (droit à l'oubli)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

-- ─── 2. SESSIONS — auth magic link ─────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,               -- SHA-256 du token (jamais stocké en clair)
  email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  purpose TEXT NOT NULL,                     -- 'magic_link' | 'session'
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_tokens_email ON auth_tokens(email);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON auth_tokens(expires_at);

-- ─── 3. SIRENS — sociétés rattachées (1 user, N sociétés) ──────
CREATE TABLE IF NOT EXISTS user_sirens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  siren TEXT NOT NULL,
  nom_societe TEXT,
  forme_juridique TEXT,
  capital REAL,
  date_creation TEXT,
  ville TEXT,
  cached_json TEXT,                          -- snapshot Pappers complet
  last_refreshed_at INTEGER,
  is_primary INTEGER DEFAULT 0,              -- société principale
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, siren)
);
CREATE INDEX IF NOT EXISTS idx_sirens_user ON user_sirens(user_id);

-- ─── 4. CONVERSATIONS — historique Marcel + sub-agents ────────
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT,                                -- "Pacte Dutreil holding" (auto-généré)
  sphere TEXT,                               -- patrimoine|fiscalite|transmission|...
  agent_principal TEXT,                      -- marcel|codex|hermes|iris|...
  delegated_to TEXT,                         -- JSON array des sub-agents mobilisés
  messages_count INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,            -- coût cumulé
  started_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  archived INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,                        -- user | assistant | tool
  content TEXT NOT NULL,
  agent TEXT,                                -- marcel|codex|hermes|iris|...
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,                                -- claude-sonnet-4-6 | claude-opus-4-7
  perplexity_used INTEGER DEFAULT 0,         -- 1 si Perplexity invoqué
  feedback_value INTEGER,                    -- +1 (👍) | -1 (👎) | NULL
  feedback_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);

-- ─── 5. CONTACTS — carnet utilisateur perso ────────────────────
CREATE TABLE IF NOT EXISTS user_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,                    -- juridique|comptable|finance|conciergerie|hospitalite|art|lifestyle|sante|education
  nom TEXT NOT NULL,
  prenom TEXT,
  societe TEXT,                              -- cabinet, étude, maison
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  pays TEXT DEFAULT 'France',
  telephone TEXT,
  email TEXT,
  site_web TEXT,
  notes TEXT,                                -- notes perso
  tags_json TEXT,                            -- tags arbitraires
  is_favorite INTEGER DEFAULT 0,
  last_interaction_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_user_cat ON user_contacts(user_id, category);

-- ─── 6. ALERTES — proactives (Loi Finances, jurisprudence, cote)
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  sphere TEXT,                               -- fiscalite|joaillerie|...
  source TEXT,                               -- collector|perplexity|manual
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  importance INTEGER DEFAULT 0,              -- 0 info | 1 attention | 2 urgent
  read_at INTEGER,
  archived INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_user_read ON alerts(user_id, read_at);

-- ─── 7. DOCUMENTS — DER, LM, rapports générés ──────────────────
CREATE TABLE IF NOT EXISTS user_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,                        -- der|lm|rapport|conversation_pdf|cartographie
  title TEXT NOT NULL,
  r2_key TEXT,                               -- key dans R2 EU
  hash_eidas TEXT,                           -- hash signature Témoin
  signed_at INTEGER,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_user ON user_documents(user_id, created_at DESC);

-- ─── 8. WATCHES — actifs surveillés (collector quotidien) ─────
CREATE TABLE IF NOT EXISTS user_watches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  market TEXT NOT NULL,                      -- montre|voiture|vin|art|crypto|...
  category TEXT,                             -- patek-nautilus|porsche-gt3|...
  query TEXT NOT NULL,                       -- "Patek 5711/1A vert"
  target_price REAL,                         -- alerte si <=
  last_value REAL,
  last_checked_at INTEGER,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watches_user ON user_watches(user_id, active);

-- ─── 9. USAGE — comptage requêtes par tier (rate-limit) ───────
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,                         -- YYYY-MM-DD
  agent TEXT NOT NULL,                       -- marcel|codex|hermes|iris|...|perplexity
  requests_count INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  cost_estimate_eur REAL DEFAULT 0,
  PRIMARY KEY (user_id, day, agent)
);

-- ─── 10. AUDIT MIF II (mirror Témoin local) ───────────────────
-- Note : Témoin stocke la version SHA-256 + R2. Cette table est un index rapide.
CREATE TABLE IF NOT EXISTS audit_index (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,                      -- login|chat|delegate|search|signature|export|delete
  agent TEXT,
  conversation_id TEXT,
  temoin_hash TEXT,                          -- hash Témoin pour cross-référence
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_index(user_id, created_at DESC);

-- ─── Seed: tier discovery anonyme (cookie session) ─────────────
-- Géré côté worker : si pas d'auth, user_id = 'anon_<session_hash>', tier = 'discovery'
