-- Migration 007 — Memory Stores Anthropic par famille + log newsletters
-- © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
--
-- Apply: wrangler d1 execute ikcp-prod --file migrations/007_memory_stores.sql

-- Ajoute le memory_store_id à users (Marcel se souvient de la famille
-- à travers les sessions)
ALTER TABLE users ADD COLUMN memory_store_id TEXT;

-- Index pour les opérations d'initialisation des memory stores
CREATE INDEX IF NOT EXISTS idx_users_memory ON users(memory_store_id)
  WHERE memory_store_id IS NOT NULL;

-- Log des newsletters envoyées (anti-doublon, audit, conformité MIF II)
CREATE TABLE IF NOT EXISTS newsletter_log (
  id              TEXT PRIMARY KEY,           -- ULID
  user_id         TEXT NOT NULL,
  session_id      TEXT,                       -- session marcel-editorial
  week_iso        TEXT NOT NULL,              -- "2026-W23"
  subject         TEXT,
  preview         TEXT,                       -- premier paragraphe
  status          TEXT NOT NULL,              -- queued | sent | failed | skipped
  sent_at         INTEGER,
  resend_id       TEXT,                       -- ID Resend pour bounce tracking
  created_at      INTEGER NOT NULL,
  metadata_json   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_user_week
  ON newsletter_log(user_id, week_iso);

CREATE INDEX IF NOT EXISTS idx_newsletter_status
  ON newsletter_log(status, created_at DESC)
  WHERE status != 'sent';

-- Log des push notifications envoyées (app mobile)
CREATE TABLE IF NOT EXISTS push_log (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  kind            TEXT NOT NULL,              -- session_ready | echeance_alert | newsletter | drift_alert
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data_json       TEXT,                       -- payload custom
  status          TEXT NOT NULL,              -- queued | sent | failed
  sent_at         INTEGER,
  apns_token      TEXT,
  fcm_token       TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_push_user
  ON push_log(user_id, created_at DESC);

-- Newsletter content cache (pour preview dans dashboard)
CREATE TABLE IF NOT EXISTS newsletter_content (
  newsletter_id   TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  week_iso        TEXT NOT NULL,
  html_content    TEXT,
  md_content      TEXT,
  visual_paths    TEXT,                       -- JSON array R2 keys
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (newsletter_id) REFERENCES newsletter_log(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
