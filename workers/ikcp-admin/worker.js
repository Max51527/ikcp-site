/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial
 * Maxime Juveneton · ORIAS 23001568 · maxime@ikcp.fr
 *
 * ikcp-admin — Cockpit administrateur
 *
 * Endpoints (auth GitHub OAuth limité à @Max51527) :
 *   GET  /api/cockpit/overview       — MRR, familles, sessions, coûts
 *   GET  /api/cockpit/sessions       — sessions récentes paginées
 *   GET  /api/cockpit/users          — liste des familles actives
 *   GET  /api/cockpit/alerts         — alertes opérationnelles
 *   GET  /api/cockpit/financials     — vue MRR / ARPU / churn
 *   POST /api/cockpit/run-agent      — lancer un agent pour un client donné
 *   POST /api/cockpit/send-message   — envoyer message admin à un client
 *   GET  /api/cockpit/activity-stream — SSE live des nouvelles sessions
 *
 *   GET  /auth/github                — démarre OAuth (login Maxime)
 *   GET  /auth/callback              — finalise OAuth
 *
 * Secrets :
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *   ADMIN_ALLOWED_LOGINS  (CSV: "Max51527,partner_login")
 *   ANTHROPICAPIKEY (pour run-agent)
 *   MARCEL_ENV_ID + tous les MARCEL_*_AGENT_ID
 */

const ADMIN_COOKIE = 'ikcp_admin_session';
const COOKIE_TTL = 8 * 3600; // 8h

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      // ─── Auth ─────────────────────────────────────────────
      if (url.pathname === '/auth/github') return handleAuthGithub(env);
      if (url.pathname === '/auth/callback') return handleAuthCallback(req, url, env);
      if (url.pathname === '/auth/logout') return handleLogout(cors);

      // ─── Health public ───────────────────────────────────
      if (url.pathname === '/health') {
        return json({ ok: true, ts: Date.now() }, 200, cors);
      }

      // ─── Auth requis pour le reste ───────────────────────
      const session = await verifyAdminSession(req, env);
      if (!session) return json({ error: 'unauthorized' }, 401, cors);

      // ─── Cockpit ─────────────────────────────────────────
      if (url.pathname === '/api/cockpit/overview') {
        return await getOverview(env, cors);
      }
      if (url.pathname === '/api/cockpit/sessions') {
        return await listSessions(url, env, cors);
      }
      if (url.pathname === '/api/cockpit/users') {
        return await listUsers(url, env, cors);
      }
      if (url.pathname === '/api/cockpit/alerts') {
        return await listAlerts(env, cors);
      }
      if (url.pathname === '/api/cockpit/financials') {
        return await getFinancials(env, cors);
      }
      if (url.pathname === '/api/cockpit/run-agent' && req.method === 'POST') {
        return await runAgentForUser(req, env, session, cors);
      }
      if (url.pathname === '/api/cockpit/activity-stream') {
        return await streamActivity(env, cors);
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      console.error('admin error:', e?.stack || e);
      return json({ error: 'internal_error', message: String(e?.message || e) }, 500, cors);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// AUTH GitHub OAuth (admin seulement)
// ═══════════════════════════════════════════════════════════════════

function handleAuthGithub(env) {
  if (!env.GITHUB_CLIENT_ID) return new Response('not configured', { status: 500 });
  const state = crypto.randomUUID();
  const auth = new URL('https://github.com/login/oauth/authorize');
  auth.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  auth.searchParams.set('scope', 'read:user');
  auth.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: { Location: auth.toString() },
  });
}

async function handleAuthCallback(req, url, env) {
  const code = url.searchParams.get('code');
  if (!code) return new Response('missing code', { status: 400 });

  const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) return new Response('oauth failed', { status: 400 });

  // Récupérer login GitHub
  const userResp = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'ikcp-admin' },
  });
  const user = await userResp.json();
  const login = user.login;

  // Vérifier que l'utilisateur est dans la whitelist
  const allowed = (env.ADMIN_ALLOWED_LOGINS || 'Max51527').split(',').map(s => s.trim());
  if (!allowed.includes(login)) {
    return new Response(`Access denied for @${login}`, { status: 403 });
  }

  // Émettre la session signée (HMAC)
  const sessionPayload = `${login}:${Date.now() + COOKIE_TTL * 1000}`;
  const sig = await hmacSha256(env.ADMIN_SIGNING_SECRET || env.HMAC_SECRET || 'fallback', sessionPayload);
  const cookie = `${ADMIN_COOKIE}=${sessionPayload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_TTL}`;

  return new Response(`<!DOCTYPE html><meta charset="utf-8"><title>IKCP Admin</title>
<style>body{font-family:sans-serif;background:#0a0d0b;color:#f4ece1;padding:60px;text-align:center;}
.brand{font-family:'Playfair Display',serif;font-size:32px;color:#c4a273;letter-spacing:.16em;}</style>
<div class="brand">IKCP.</div>
<p>Bienvenue, ${login}. Redirection vers le cockpit…</p>
<script>setTimeout(function(){location.href='/cockpit.html';},1000);</script>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie },
  });
}

function handleLogout(cors) {
  return new Response(null, {
    status: 302,
    headers: {
      ...cors,
      Location: '/',
      'Set-Cookie': `${ADMIN_COOKIE}=; Path=/; Max-Age=0`,
    },
  });
}

async function verifyAdminSession(req, env) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`));
  if (!match) return null;
  const [payload, sig] = match[1].split('.');
  if (!payload || !sig) return null;

  const expected = await hmacSha256(env.ADMIN_SIGNING_SECRET || env.HMAC_SECRET || 'fallback', payload);
  if (!constantTimeEqual(expected, sig)) return null;

  const [login, expiresAt] = payload.split(':');
  if (Date.now() > parseInt(expiresAt, 10)) return null;

  return { login };
}

// ═══════════════════════════════════════════════════════════════════
// COCKPIT — overview, sessions, users, alerts, financials
// ═══════════════════════════════════════════════════════════════════

async function getOverview(env, cors) {
  // Active families = users avec session récente OU tier payant
  const activeUsers = await env.DB.prepare(`
    SELECT COUNT(DISTINCT u.id) AS n
    FROM users u
    WHERE u.tier IN ('augmente', 'bespoke')
       OR EXISTS (
         SELECT 1 FROM agent_sessions s
         WHERE s.user_id = u.id AND s.created_at > ?
       )
  `).bind(Date.now() - 30 * 86400_000).first();

  // Sessions cette semaine
  const sessionsWeek = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(input_tokens) AS in_tok,
      SUM(output_tokens) AS out_tok,
      SUM(cache_read) AS cache_tok
    FROM agent_sessions
    WHERE created_at > ?
  `).bind(Date.now() - 7 * 86400_000).first();

  // Coût ce mois (pricing Opus 4.8 : $5/M input, $25/M output, $0.5/M cache)
  const month = await env.DB.prepare(`
    SELECT
      SUM(input_tokens) AS in_tok,
      SUM(output_tokens) AS out_tok,
      SUM(cache_read) AS cache_tok
    FROM agent_sessions
    WHERE created_at > ?
  `).bind(Date.now() - 30 * 86400_000).first();

  const costMonth = (month?.in_tok || 0) * 0.000005
                  + (month?.out_tok || 0) * 0.000025
                  + (month?.cache_tok || 0) * 0.0000005;

  // MRR rough = nb users payants × tier price
  const tiers = await env.DB.prepare(`
    SELECT tier, COUNT(*) AS n FROM users
    WHERE tier IN ('augmente', 'bespoke') GROUP BY tier
  `).all();

  const TIER_PRICE_MONTHLY = { augmente: 567, bespoke: 1250 }; // 6800/12, 15000/12
  let mrr = 0;
  for (const t of (tiers.results || [])) {
    mrr += (TIER_PRICE_MONTHLY[t.tier] || 0) * t.n;
  }

  return json({
    families_active: activeUsers?.n || 0,
    mrr_eur: Math.round(mrr),
    sessions_week: sessionsWeek?.total || 0,
    cost_month_usd: Math.round(costMonth * 100) / 100,
    cost_budget_usd: 580,
    cost_pct_used: Math.round(costMonth / 580 * 100),
    tiers_breakdown: tiers.results || [],
    ts: Date.now(),
  }, 200, cors);
}

async function listSessions(url, env, cors) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const rows = await env.DB.prepare(`
    SELECT id, user_id, agent_kind, status, stop_reason, outcome_result,
           created_at, ended_at, input_tokens, output_tokens
    FROM agent_sessions
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return json({ sessions: rows.results || [] }, 200, cors);
}

async function listUsers(url, env, cors) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const rows = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.tier, u.memory_store_id, u.created_at,
      (SELECT COUNT(*) FROM agent_sessions WHERE user_id = u.id) AS total_sessions,
      (SELECT MAX(created_at) FROM agent_sessions WHERE user_id = u.id) AS last_session_at
    FROM users u
    WHERE u.tier IN ('augmente', 'bespoke', 'freemium')
    ORDER BY last_session_at DESC NULLS LAST
    LIMIT ?
  `).bind(limit).all();
  return json({ users: rows.results || [] }, 200, cors);
}

async function listAlerts(env, cors) {
  const alerts = [];

  // Users tier payant qui n'ont pas eu de session depuis 30j (churn risk)
  const churnRisk = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, MAX(s.created_at) AS last_seen
    FROM users u
    LEFT JOIN agent_sessions s ON s.user_id = u.id
    WHERE u.tier IN ('augmente', 'bespoke')
    GROUP BY u.id
    HAVING last_seen IS NULL OR last_seen < ?
  `).bind(Date.now() - 30 * 86400_000).all();
  for (const u of (churnRisk.results || [])) {
    alerts.push({
      level: 'warn',
      kind: 'churn_risk',
      message: `${u.name || u.email} pas de session depuis 30j`,
      user_id: u.id,
    });
  }

  // Sessions en erreur > 5%
  const sessionsTotal = await env.DB.prepare(`
    SELECT COUNT(*) AS n FROM agent_sessions WHERE created_at > ?
  `).bind(Date.now() - 7 * 86400_000).first();
  const sessionsError = await env.DB.prepare(`
    SELECT COUNT(*) AS n FROM agent_sessions
    WHERE created_at > ? AND status = 'terminated'
  `).bind(Date.now() - 7 * 86400_000).first();
  const errorRate = sessionsTotal?.n > 0 ? sessionsError.n / sessionsTotal.n : 0;
  if (errorRate > 0.05) {
    alerts.push({
      level: 'error',
      kind: 'error_rate',
      message: `Taux d'erreur sessions ${(errorRate * 100).toFixed(1)}% (>5%)`,
    });
  }

  return json({ alerts }, 200, cors);
}

async function getFinancials(env, cors) {
  // Évolution MRR mois par mois (8 derniers mois)
  // Simplification : on prend la création d'user comme proxy d'activation
  const months = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const start = d.getTime();
    const end = new Date(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1).getTime();
    const r = await env.DB.prepare(`
      SELECT
        COUNT(*) AS new_users,
        SUM(CASE WHEN tier='augmente' THEN 1 ELSE 0 END) AS augmente,
        SUM(CASE WHEN tier='bespoke' THEN 1 ELSE 0 END) AS bespoke
      FROM users WHERE created_at >= ? AND created_at < ?
    `).bind(start, end).first();
    months.push({
      month: d.toISOString().slice(0, 7),
      new_users: r?.new_users || 0,
      mrr_added: (r?.augmente || 0) * 567 + (r?.bespoke || 0) * 1250,
    });
  }

  return json({ monthly: months }, 200, cors);
}

async function runAgentForUser(req, env, session, cors) {
  const body = await req.json();
  const { user_id, kind, task, rubric } = body;
  if (!user_id || !kind || !task) {
    return json({ error: 'missing_fields' }, 400, cors);
  }

  const AGENT_KIND_TO_ENV_VAR = {
    documents: 'MARCEL_DOCUMENTS_AGENT_ID', suivi: 'MARCEL_SUIVI_AGENT_ID',
    patrimoine: 'MARCEL_PATRIMOINE_AGENT_ID', fortune: 'MARCEL_FORTUNE_AGENT_ID',
    transmission: 'MARCEL_TRANSMISSION_AGENT_ID', remuneration: 'MARCEL_REMUNERATION_AGENT_ID',
    strategie: 'MARCEL_STRATEGIE_AGENT_ID', fiscalite_impots: 'MARCEL_FISCALITE_IMPOTS_AGENT_ID',
    immobilier: 'MARCEL_IMMOBILIER_AGENT_ID', defiscalisation: 'MARCEL_DEFISCALISATION_AGENT_ID',
    reporting: 'MARCEL_REPORTING_AGENT_ID', editorial: 'MARCEL_EDITORIAL_AGENT_ID',
    gouvernance: 'MARCEL_GOUVERNANCE_AGENT_ID',
  };
  const agentId = env[AGENT_KIND_TO_ENV_VAR[kind]];
  if (!agentId) return json({ error: 'unknown_agent_kind' }, 400, cors);

  // Récupère memory store du user
  const user = await env.DB.prepare(`SELECT memory_store_id FROM users WHERE id=?`).bind(user_id).first();

  const resources = [];
  if (user?.memory_store_id) {
    resources.push({ type: 'memory_store', memory_store_id: user.memory_store_id, access: 'read_write' });
  }

  const sessionResp = await fetch('https://api.anthropic.com/v1/sessions', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPICAPIKEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'managed-agents-2026-04-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      agent: agentId,
      environment_id: env.MARCEL_ENV_ID,
      title: `[admin@${session.login}] ${kind} · ${user_id.slice(0, 8)}`,
      resources,
      metadata: { user_id, kind, source: 'admin_cockpit', admin: session.login },
    }),
  });
  const created = await sessionResp.json();

  const event = rubric
    ? { type: 'user.define_outcome', description: task, rubric: { type: 'text', content: rubric }, max_iterations: 5 }
    : { type: 'user.message', content: [{ type: 'text', text: task }] };

  await fetch(`https://api.anthropic.com/v1/sessions/${created.id}/events`, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPICAPIKEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'managed-agents-2026-04-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ events: [event] }),
  });

  await env.DB.prepare(`
    INSERT INTO agent_sessions (id, user_id, agent_kind, agent_id, agent_version, status, created_at, metadata_json)
    VALUES (?, ?, ?, ?, 0, 'running', ?, ?)
  `).bind(
    created.id, user_id, kind, agentId, Date.now(),
    JSON.stringify({ source: 'admin', admin: session.login }),
  ).run();

  return json({ session_id: created.id, status: 'running' }, 200, cors);
}

async function streamActivity(env, cors) {
  // Stream simple : tick chaque 10s avec nouvelles sessions depuis le timestamp précédent
  let lastTs = Date.now();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      for (let i = 0; i < 60; i++) {  // max 10 min de stream
        const sessions = await env.DB.prepare(`
          SELECT id, user_id, agent_kind, status, created_at
          FROM agent_sessions WHERE created_at > ? ORDER BY created_at DESC
        `).bind(lastTs).all();

        for (const s of (sessions.results || [])) {
          await writer.write(encoder.encode(`event: session\ndata: ${JSON.stringify(s)}\n\n`));
        }
        lastTs = Date.now();
        await new Promise(r => setTimeout(r, 10000));
      }
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function corsHeaders(req) {
  const origin = req.headers.get('origin');
  const allow = origin && /^https:\/\/(admin\.)?ikcp\.eu$/.test(origin) ? origin : 'https://admin.ikcp.eu';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, cookie',
    'access-control-allow-credentials': 'true',
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}
