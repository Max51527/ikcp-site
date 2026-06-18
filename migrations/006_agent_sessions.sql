-- Migration 006 — Managed Agents sessions tracking
-- © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
--
-- Apply: wrangler d1 execute ikcp-prod --file migrations/006_agent_sessions.sql
--
-- Tracks Anthropic Managed Agents sessions started via workers/ikcp-agents.
-- One row per session. Updated by:
--   - workers/ikcp-agents (on create + on webhook session.status_idled)
--   - workers/ikcp-agents (on webhook session.outcome_evaluation_ended)

CREATE TABLE IF NOT EXISTS agent_sessions (
  id              TEXT PRIMARY KEY,           -- sesn_xxx (Anthropic)
  user_id         TEXT NOT NULL,
  agent_kind      TEXT NOT NULL,              -- reporting | documents | suivi
  agent_id        TEXT NOT NULL,              -- agent_xxx (Anthropic, persistent)
  agent_version   INTEGER NOT NULL DEFAULT 0, -- version pinnée (0 = latest)
  status          TEXT NOT NULL,              -- running | idle | terminated
  stop_reason     TEXT,                       -- end_turn | requires_action | retries_exhausted
  outcome_result  TEXT,                       -- satisfied | needs_revision | max_iterations_reached | failed | interrupted
  created_at      INTEGER NOT NULL,           -- ms epoch
  ended_at        INTEGER,                    -- ms epoch (NULL si toujours running/idle)
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  cache_read      INTEGER DEFAULT 0,
  metadata_json   TEXT,                       -- JSON {task, rubric_present, file_count, …}
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user
  ON agent_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_status
  ON agent_sessions(status, created_at DESC)
  WHERE status != 'terminated';

CREATE INDEX IF NOT EXISTS idx_agent_sessions_kind
  ON agent_sessions(agent_kind, created_at DESC);

-- Cost dashboard helper view
CREATE VIEW IF NOT EXISTS v_agent_costs_daily AS
SELECT
  DATE(created_at / 1000, 'unixepoch') AS day,
  agent_kind,
  COUNT(*) AS sessions_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cache_read) AS total_cache_read,
  -- Opus 4.8 pricing: $5/1M input, $25/1M output, $0.50/1M cache read
  ROUND(
    SUM(input_tokens) * 0.000005
    + SUM(output_tokens) * 0.000025
    + SUM(cache_read) * 0.0000005,
    4
  ) AS estimated_cost_usd
FROM agent_sessions
WHERE created_at >= (strftime('%s', 'now', '-30 days') * 1000)
GROUP BY day, agent_kind
ORDER BY day DESC, agent_kind;
