/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial
 * Maxime Juveneton · ORIAS 23001568 · maxime@ikcp.fr
 *
 * Ce fichier est la propriété exclusive d'IKCP. Sa reproduction, même
 * partielle, et son adaptation sont interdites sans autorisation écrite
 * préalable. Code protégé par le Code de la propriété intellectuelle
 * français (CPI L111-1, L113-9, L122-4).
 *
 * ikcp-agents — orchestrateur Anthropic Managed Agents
 *
 * Architecture : voir docs/MANAGED-AGENTS-INTEGRATION.md
 *
 * Endpoints :
 *  POST   /api/agents/task                  — crée une session
 *  GET    /api/agents/task/:id              — statut d'une session
 *  GET    /api/agents/task/:id/outputs      — liste fichiers produits
 *  GET    /api/agents/task/:id/file/:fid    — download fichier output
 *  POST   /webhooks/anthropic               — réception events (HMAC-signed)
 *  GET    /health                           — healthcheck
 *
 * Modèle : claude-opus-4-8 (sur les agents, défini en YAML)
 * Beta header : managed-agents-2026-04-01 (auto via x-api-key path)
 */

const ANTHROPIC_API = 'https://api.anthropic.com';
const BETA_HEADER = 'managed-agents-2026-04-01';
const API_VERSION = '2023-06-01';

const AGENT_KIND_TO_ENV_VAR = {
  reporting: 'MARCEL_REPORTING_AGENT_ID',
  documents: 'MARCEL_DOCUMENTS_AGENT_ID',
  suivi: 'MARCEL_SUIVI_AGENT_ID',
};

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://client.ikcp.eu',
];

// ──────────────────────────────────────────────────────────────
// ROUTER
// ──────────────────────────────────────────────────────────────
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      // Webhook — pas de CORS, pas d'auth user (HMAC verifie)
      if (url.pathname === '/webhooks/anthropic' && req.method === 'POST') {
        return await handleWebhook(req, env, ctx);
      }

      // Health
      if (url.pathname === '/health') {
        return json({ ok: true, ts: Date.now() }, 200, cors);
      }

      // Auth user (magic-link cookie → user_id) pour toutes les autres routes
      const userId = await authUser(req, env);
      if (!userId) return json({ error: 'unauthorized' }, 401, cors);

      // POST /api/agents/task
      if (url.pathname === '/api/agents/task' && req.method === 'POST') {
        return await startTask(req, env, ctx, userId, cors);
      }

      // GET /api/agents/task/:id
      const taskMatch = url.pathname.match(/^\/api\/agents\/task\/([^/]+)$/);
      if (taskMatch && req.method === 'GET') {
        return await getTask(taskMatch[1], env, userId, cors);
      }

      // GET /api/agents/task/:id/outputs
      const outputsMatch = url.pathname.match(/^\/api\/agents\/task\/([^/]+)\/outputs$/);
      if (outputsMatch && req.method === 'GET') {
        return await listOutputs(outputsMatch[1], env, userId, cors);
      }

      // GET /api/agents/task/:id/file/:fid
      const fileMatch = url.pathname.match(/^\/api\/agents\/task\/([^/]+)\/file\/([^/]+)$/);
      if (fileMatch && req.method === 'GET') {
        return await downloadFile(fileMatch[1], fileMatch[2], env, userId, cors);
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      console.error('worker error:', e?.stack || e);
      return json({ error: 'internal_error', message: String(e?.message || e) }, 500, cors);
    }
  },
};

// ──────────────────────────────────────────────────────────────
// START TASK — POST /api/agents/task
// ──────────────────────────────────────────────────────────────
async function startTask(req, env, ctx, userId, cors) {
  const body = await req.json().catch(() => ({}));
  const { kind, task, rubric, file_ids = [], metadata = {} } = body;

  if (!kind || !AGENT_KIND_TO_ENV_VAR[kind]) {
    return json({ error: 'invalid_kind', accepted: Object.keys(AGENT_KIND_TO_ENV_VAR) }, 400, cors);
  }
  if (!task || typeof task !== 'string' || task.length < 10) {
    return json({ error: 'invalid_task', hint: 'task must be ≥ 10 chars' }, 400, cors);
  }
  if (file_ids.length > 999) {
    return json({ error: 'too_many_files', max: 999 }, 400, cors);
  }

  const agentId = env[AGENT_KIND_TO_ENV_VAR[kind]];
  const envId = env.MARCEL_ENV_ID;
  if (!agentId || !envId) {
    return json({ error: 'misconfigured', hint: `Set ${AGENT_KIND_TO_ENV_VAR[kind]} + MARCEL_ENV_ID secrets` }, 500, cors);
  }

  // 1) Créer la session — agent shorthand (latest version)
  const session = await anthropicFetch(env, 'POST', '/v1/sessions', {
    agent: agentId,
    environment_id: envId,
    title: `${kind} · ${userId.slice(0, 8)} · ${new Date().toISOString().slice(0, 10)}`,
    resources: file_ids.map(fid => ({
      type: 'file',
      file_id: fid,
      mount_path: `/workspace/inputs/${fid}.bin`,
    })),
    metadata: {
      ...metadata,
      user_id: userId,
      kind,
      source: 'ikcp-agents',
    },
  });

  // 2) Persister en D1
  await env.DB.prepare(`
    INSERT INTO agent_sessions
      (id, user_id, agent_kind, agent_id, agent_version, status, created_at, metadata_json)
    VALUES (?, ?, ?, ?, ?, 'running', ?, ?)
  `).bind(
    session.id, userId, kind, agentId, 0, Date.now(),
    JSON.stringify({ task, rubric: rubric ? '[present]' : null, file_count: file_ids.length }),
  ).run();

  // 3) Stream-first : ouvrir le stream AVANT d'envoyer le kickoff
  //    (en background — l'utilisateur reçoit la réponse immédiatement)
  ctx.waitUntil(drainSessionStream(session.id, env));

  // 4) Envoyer le kickoff — outcome si rubric, message sinon
  const kickoff = rubric
    ? {
        type: 'user.define_outcome',
        description: task,
        rubric: { type: 'text', content: rubric },
        max_iterations: 5,
      }
    : {
        type: 'user.message',
        content: [{ type: 'text', text: task }],
      };

  await anthropicFetch(env, 'POST', `/v1/sessions/${session.id}/events`, {
    events: [kickoff],
  });

  return json({
    session_id: session.id,
    status: 'running',
    poll_url: `/api/agents/task/${session.id}`,
  }, 200, cors);
}

// ──────────────────────────────────────────────────────────────
// GET TASK — GET /api/agents/task/:id
// ──────────────────────────────────────────────────────────────
async function getTask(sessionId, env, userId, cors) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_sessions WHERE id=? AND user_id=?`
  ).bind(sessionId, userId).first();

  if (!row) return json({ error: 'not_found' }, 404, cors);

  return json({
    session_id: row.id,
    kind: row.agent_kind,
    status: row.status,
    stop_reason: row.stop_reason,
    outcome_result: row.outcome_result,
    created_at: row.created_at,
    ended_at: row.ended_at,
    usage: {
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cache_read: row.cache_read,
    },
  }, 200, cors);
}

// ──────────────────────────────────────────────────────────────
// LIST OUTPUTS — GET /api/agents/task/:id/outputs
// ──────────────────────────────────────────────────────────────
async function listOutputs(sessionId, env, userId, cors) {
  // Vérif ownership
  const row = await env.DB.prepare(
    `SELECT 1 FROM agent_sessions WHERE id=? AND user_id=?`
  ).bind(sessionId, userId).first();
  if (!row) return json({ error: 'not_found' }, 404, cors);

  // Files API avec scope_id — nécessite BOTH beta headers
  const resp = await fetch(
    `${ANTHROPIC_API}/v1/files?scope_id=${encodeURIComponent(sessionId)}`,
    {
      headers: {
        'x-api-key': env.ANTHROPICAPIKEY,
        'anthropic-version': API_VERSION,
        'anthropic-beta': `files-api-2025-04-14,${BETA_HEADER}`,
      },
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: 'anthropic_error', status: resp.status, body: text }, 502, cors);
  }
  const data = await resp.json();
  return json({
    files: (data.data || []).map(f => ({
      id: f.id,
      filename: f.filename,
      size_bytes: f.size_bytes,
      mime_type: f.mime_type,
      created_at: f.created_at,
    })),
  }, 200, cors);
}

// ──────────────────────────────────────────────────────────────
// DOWNLOAD FILE — GET /api/agents/task/:id/file/:fid
// ──────────────────────────────────────────────────────────────
async function downloadFile(sessionId, fileId, env, userId, cors) {
  const row = await env.DB.prepare(
    `SELECT 1 FROM agent_sessions WHERE id=? AND user_id=?`
  ).bind(sessionId, userId).first();
  if (!row) return json({ error: 'not_found' }, 404, cors);

  const resp = await fetch(
    `${ANTHROPIC_API}/v1/files/${encodeURIComponent(fileId)}/content`,
    {
      headers: {
        'x-api-key': env.ANTHROPICAPIKEY,
        'anthropic-version': API_VERSION,
        'anthropic-beta': `files-api-2025-04-14,${BETA_HEADER}`,
      },
    },
  );
  if (!resp.ok) {
    return json({ error: 'download_failed', status: resp.status }, 502, cors);
  }
  // Proxy le stream + content-disposition
  const headers = new Headers(cors);
  for (const h of ['content-type', 'content-length', 'content-disposition']) {
    const v = resp.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(resp.body, { status: 200, headers });
}

// ──────────────────────────────────────────────────────────────
// WEBHOOK — POST /webhooks/anthropic
// ──────────────────────────────────────────────────────────────
async function handleWebhook(req, env, ctx) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify HMAC signature
  const event = await verifyWebhookSignature(body, headers, env.ANTHROPIC_WEBHOOK_SIGNING_KEY);
  if (!event) return new Response('invalid signature', { status: 400 });

  // Dedup retries — webhook envoie le même event.id sur retry
  const seenKey = `webhook:${event.id}`;
  if (await env.AGENT_KV.get(seenKey)) {
    return new Response('', { status: 204 });
  }
  await env.AGENT_KV.put(seenKey, '1', { expirationTtl: 86400 });

  switch (event.data.type) {
    case 'session.status_idled': {
      const session = await anthropicFetch(env, 'GET', `/v1/sessions/${event.data.id}`);
      await env.DB.prepare(`
        UPDATE agent_sessions
        SET status='idle',
            stop_reason=?,
            ended_at=?,
            input_tokens=?,
            output_tokens=?,
            cache_read=?
        WHERE id=?
      `).bind(
        session.status_idle_reason?.type || null,
        Date.now(),
        session.usage?.input_tokens ?? 0,
        session.usage?.output_tokens ?? 0,
        session.usage?.cache_read_input_tokens ?? 0,
        event.data.id,
      ).run();

      // Trigger user notification (magic-link email)
      ctx.waitUntil(notifyUserSessionReady(event.data.id, env));
      return new Response('', { status: 204 });
    }

    case 'session.status_terminated': {
      await env.DB.prepare(
        `UPDATE agent_sessions SET status='terminated', ended_at=? WHERE id=?`
      ).bind(Date.now(), event.data.id).run();
      return new Response('', { status: 204 });
    }

    case 'session.outcome_evaluation_ended': {
      // Mettre à jour le outcome_result pour visibilité dashboard
      const session = await anthropicFetch(env, 'GET', `/v1/sessions/${event.data.id}`);
      const lastEval = (session.outcome_evaluations || []).slice(-1)[0];
      if (lastEval) {
        await env.DB.prepare(
          `UPDATE agent_sessions SET outcome_result=? WHERE id=?`
        ).bind(lastEval.result, event.data.id).run();
      }
      return new Response('', { status: 204 });
    }

    case 'vault_credential.refresh_failed': {
      // Alerte ops — un MCP OAuth est cassé
      console.error('vault_credential.refresh_failed', event.data.id);
      ctx.waitUntil(alertOps('vault_refresh_failed', event.data.id, env));
      return new Response('', { status: 204 });
    }

    default:
      return new Response('', { status: 204 });
  }
}

// ──────────────────────────────────────────────────────────────
// STREAM DRAINER — Pattern 9 custom tool dispatch
// ──────────────────────────────────────────────────────────────
async function drainSessionStream(sessionId, env) {
  const resp = await fetch(
    `${ANTHROPIC_API}/v1/sessions/${sessionId}/events/stream`,
    {
      headers: {
        'x-api-key': env.ANTHROPICAPIKEY,
        'anthropic-version': API_VERSION,
        'anthropic-beta': BETA_HEADER,
        'Accept': 'text/event-stream',
      },
    },
  );
  if (!resp.ok || !resp.body) {
    console.error('stream open failed', resp.status);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE = events séparés par \n\n
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) continue;
        let payload;
        try { payload = JSON.parse(dataLine.slice(6)); }
        catch { continue; }

        if (payload.type === 'agent.custom_tool_use') {
          // Dispatch vers le sub-agent HMAC
          try {
            const result = await callSubAgent(payload.name, payload.input, env);
            await anthropicFetch(env, 'POST', `/v1/sessions/${sessionId}/events`, {
              events: [{
                type: 'user.custom_tool_result',
                custom_tool_use_id: payload.id,
                content: [{ type: 'text', text: JSON.stringify(result) }],
              }],
            });
          } catch (e) {
            // Renvoyer une erreur structurée à l'agent — il s'adaptera
            await anthropicFetch(env, 'POST', `/v1/sessions/${sessionId}/events`, {
              events: [{
                type: 'user.custom_tool_result',
                custom_tool_use_id: payload.id,
                content: [{ type: 'text', text: JSON.stringify({ error: String(e.message || e) }) }],
                is_error: true,
              }],
            });
          }
        } else if (
          payload.type === 'session.status_idle' &&
          payload.stop_reason?.type !== 'requires_action'
        ) {
          return; // terminal idle
        } else if (payload.type === 'session.status_terminated') {
          return;
        }
      }
    }
  } catch (e) {
    console.error('stream drain error:', e?.stack || e);
  }
}

// Dispatch HMAC vers les MCP sub-agents existants
// Tool name format : "service.method" (ex: "documents.ocr_pdf", "suivi.next_deadline")
async function callSubAgent(toolName, input, env) {
  const [service, ...rest] = toolName.split('.');
  const method = rest.join('.');

  const subAgentUrl = {
    documents: 'https://documents-mcp.ikcp.eu/mcp/call',
    suivi: 'https://suivi-mcp.ikcp.eu/mcp/call',
    reporting: 'https://reporting-mcp.ikcp.eu/mcp/call',
  }[service];

  if (!subAgentUrl) {
    throw new Error(`unknown_sub_agent: ${service}`);
  }

  const bodyText = JSON.stringify({ method, input, ts: Date.now() });
  const sig = await hmacSha256(env.HMAC_SECRET, bodyText);

  const r = await fetch(subAgentUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ikcp-signature': sig,
    },
    body: bodyText,
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`sub_agent_error_${r.status}: ${errText.slice(0, 200)}`);
  }
  return await r.json();
}

// ──────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────

async function anthropicFetch(env, method, path, body) {
  const r = await fetch(`${ANTHROPIC_API}${path}`, {
    method,
    headers: {
      'x-api-key': env.ANTHROPICAPIKEY,
      'anthropic-version': API_VERSION,
      'anthropic-beta': BETA_HEADER,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`anthropic_${r.status}: ${text.slice(0, 300)}`);
  }
  return await r.json();
}

// HMAC-SHA256 hex (Workers Web Crypto)
async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify Anthropic webhook signature
// Format header: `webhook-signature: v1,<base64sig>`
// Spec: HMAC-SHA256(signing_key, `${webhook_id}.${webhook_timestamp}.${body}`)
async function verifyWebhookSignature(body, headers, signingKey) {
  if (!signingKey) return null;
  const sigHeader = headers['webhook-signature'];
  const webhookId = headers['webhook-id'];
  const webhookTs = headers['webhook-timestamp'];
  if (!sigHeader || !webhookId || !webhookTs) return null;

  // Reject if timestamp > 5min skew
  const tsMs = parseInt(webhookTs, 10) * 1000;
  if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return null;

  // Strip "whsec_" prefix and base64-decode signing key
  const rawKey = signingKey.startsWith('whsec_') ? signingKey.slice(6) : signingKey;
  const keyBytes = Uint8Array.from(atob(rawKey), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const toSign = `${webhookId}.${webhookTs}.${body}`;
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)));

  // sigHeader format: "v1,<sig> v1,<sig> …" — multiple sigs possible
  const sigs = sigHeader.split(' ').map(s => s.split(',')[1]).filter(Boolean);
  const ok = sigs.some(s => constantTimeEqual(s, expectedB64));
  if (!ok) return null;

  try { return JSON.parse(body); } catch { return null; }
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Magic-link cookie → user_id (stub — utiliser la vraie logique d'ikcp-client)
async function authUser(req, env) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/ikcp_session=([^;]+)/);
  if (!match) return null;
  // Lookup session token en D1
  const row = await env.DB.prepare(
    `SELECT user_id FROM sessions WHERE token=? AND expires_at > ?`
  ).bind(match[1], Date.now()).first();
  return row?.user_id || null;
}

async function notifyUserSessionReady(sessionId, env) {
  const row = await env.DB.prepare(
    `SELECT user_id, agent_kind FROM agent_sessions WHERE id=?`
  ).bind(sessionId).first();
  if (!row) return;
  const user = await env.DB.prepare(`SELECT email FROM users WHERE id=?`).bind(row.user_id).first();
  if (!user?.email) return;

  // Envoi Resend (clé partagée avec ikcp-client)
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Marcel IKCP <marcel@ikcp.eu>',
      to: [user.email],
      subject: `Votre ${labelForKind(row.agent_kind)} est prêt`,
      html: `
        <p>Bonjour,</p>
        <p>Votre ${labelForKind(row.agent_kind)} est disponible dans votre espace privé :</p>
        <p><a href="${env.IKCP_CLIENT_BASE_URL}/dashboard?task=${sessionId}">Accéder à mon livrable</a></p>
        <p>Cordialement,<br>Marcel · IKCP</p>
      `,
    }),
  });
}

function labelForKind(kind) {
  return {
    reporting: 'rapport',
    documents: 'document analysé',
    suivi: 'memo trimestriel',
  }[kind] || 'livrable';
}

async function alertOps(kind, ref, env) {
  // Stub — à brancher Slack/email ops
  console.warn(`[OPS ALERT] ${kind}: ${ref}`);
}

function corsHeaders(req) {
  const origin = req.headers.get('origin');
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, cookie',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}
