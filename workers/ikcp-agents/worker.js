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
  // ─── Spécialistes techniques (Opus 4.8) ───
  documents:        'MARCEL_DOCUMENTS_AGENT_ID',        // OCR + extraction générique
  suivi:            'MARCEL_SUIVI_AGENT_ID',            // planning + arbitrages
  patrimoine:       'MARCEL_PATRIMOINE_AGENT_ID',       // 360° 1-10 M€
  fortune:          'MARCEL_FORTUNE_AGENT_ID',          // HNW/UHNW 10-500 M€
  transmission:     'MARCEL_TRANSMISSION_AGENT_ID',     // donations, succ., Dutreil
  remuneration:     'MARCEL_REMUNERATION_AGENT_ID',     // dirigeant + épargne salar.
  strategie:        'MARCEL_STRATEGIE_AGENT_ID',        // feuille de route 5 ans
  fiscalite_impots: 'MARCEL_FISCALITE_IMPOTS_AGENT_ID', // OCR avis IR/IFI/2042
  immobilier:       'MARCEL_IMMOBILIER_AGENT_ID',       // direct + papier + DVF
  defiscalisation:  'MARCEL_DEFISCALISATION_AGENT_ID',  // PER, FCPI, Girardin, dons
  // ─── Spécialistes éditoriaux (Fable 5) ───
  reporting:        'MARCEL_REPORTING_AGENT_ID',        // DER trimestriel
  editorial:        'MARCEL_EDITORIAL_AGENT_ID',        // newsletter UPPERCUT
  gouvernance:      'MARCEL_GOUVERNANCE_AGENT_ID',      // charte familiale + NextGen
};

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://client.ikcp.eu',
  'https://app.ikcp.eu',          // app mobile PWA / Capacitor
  'capacitor://localhost',         // Capacitor iOS native scheme
  'http://localhost',              // Capacitor Android native
  'https://localhost',             // Capacitor Android https
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

      // ─── DÉMO publique (sans auth, rate-limited 1/IP/jour) ───
      if (url.pathname === '/api/agents/demo' && req.method === 'POST') {
        return await startDemoTask(req, env, ctx, cors);
      }
      const demoStreamMatch = url.pathname.match(/^\/api\/agents\/demo\/([^/]+)\/stream$/);
      if (demoStreamMatch && req.method === 'GET') {
        return await streamDemoEvents(demoStreamMatch[1], env, cors);
      }
      const demoVoiceMatch = url.pathname.match(/^\/api\/agents\/demo\/([^/]+)\/voice$/);
      if (demoVoiceMatch && req.method === 'POST') {
        return await speakDemoSummary(demoVoiceMatch[1], req, env, cors);
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

      // ─── MEMORY STORES — Marcel se souvient de chaque famille ───
      if (url.pathname === '/api/me/memory' && req.method === 'GET') {
        return await getMyMemory(env, userId, cors);
      }
      if (url.pathname === '/api/me/memory/init' && req.method === 'POST') {
        return await initMyMemory(env, userId, cors);
      }

      // ─── NEWSLETTERS PERSO — log et derniers envois ───
      if (url.pathname === '/api/me/newsletters' && req.method === 'GET') {
        return await getMyNewsletters(env, userId, cors);
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      console.error('worker error:', e?.stack || e);
      return json({ error: 'internal_error', message: String(e?.message || e) }, 500, cors);
    }
  },

  // ─── CRON HANDLER — newsletter hebdo vendredi 8h UTC ───
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
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
    // MCP sub-agents existants (HMAC)
    documents:   'https://documents-mcp.ikcp.eu/mcp/call',
    suivi:       'https://suivi-mcp.ikcp.eu/mcp/call',
    reporting:   'https://reporting-mcp.ikcp.eu/mcp/call',
    // Nouveaux dispatch via les workers existants (Pattern 9)
    patrimoine:  'https://ikcp-batisseur.maxime-ead.workers.dev/mcp/call',  // patrimoine 360°
    fortune:     'https://ikcp-hermes.maxime-ead.workers.dev/mcp/call',     // transmission HNW
    gouvernance: 'https://ikcp-hermes.maxime-ead.workers.dev/mcp/call',     // partage hermes
    editorial:   'https://ikcp-veille.maxime-ead.workers.dev/mcp/call',     // veille pour brief
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

// ═══════════════════════════════════════════════════════════════════
// DÉMO PUBLIQUE — sandbox sans auth pour prospects + page démo
// ═══════════════════════════════════════════════════════════════════

const DEMO_PRESETS = {
  reporting: {
    task: "Génère un DER trimestriel de démonstration pour la famille D. — patrimoine 4,2 M€ (60% immo + 30% AV + 10% PEA). Produis 3 visuels (donut allocation, timeline échéances Q3, perf vs cible) et un .docx 4 pages. Ton pédagogique pour dirigeant 55-65 ans.",
    rubric: "Le DER contient : (1) page de garde IKCP, (2) au moins 3 charts matplotlib embedded dans le docx avec palette IKCP (gold/cream/ink), (3) section échéances J+90, (4) section allocation, (5) section performance, (6) disclaimer pédagogique MIF II en fin. Pas de produit financier nommé."
  },
  patrimoine: {
    task: "Démo : analyse patrimoniale 360° famille fictive Durand — actifs 7,5 M€ (SARL exploitation 4M€, SCI 2M€, AV 1M€, PEA 0,5M€) - passifs 1,2M€. Produis les 5 visuels obligatoires + PDF synthèse 5 pages.",
    rubric: "Synthèse contient : donut classes actifs + treemap granularité + pyramide liquidité + heatmap fiscale 5 enveloppes + schéma Mermaid de structure. PDF 4-6 pages. Points d'attention listés (surconcentration, liquidité, frottement fiscal)."
  },
  fortune: {
    task: "Démo HNW : famille Lefèvre, holding FR avec participation SOPARFI LUX, patrimoine 35 M€. Compare 3 scénarios transmission (Dutreil familial pur / Holding apport + Dutreil / Donation-cession). Produis schéma actuel + 2 scénarios + waterfall transmission.",
    rubric: "Mémo contient : Mermaid structure actuelle, Mermaid de 2 scénarios alternatifs, tableau comparatif juridictions, waterfall transmission net héritiers, avertissement substance BEPS/ATAD. Sources CGI + convention FR-LUX 1958/2018 citées."
  },
  gouvernance: {
    task: "Démo charte familiale : famille Martin, 2 parents 60 ans + 3 enfants (32/28/24 ans, dont 1 dans l'entreprise). Rédige charte familiale base (valeurs, gouvernance, transmission, conflits) + plan de formation NextGen 6 modules.",
    rubric: "Livrable contient : génogramme Mermaid (3 générations), visuel pédagogique (RACI familial), corps narratif 8-12 pages, ton chaleureux multi-générationnel (parent ET enfant s'y retrouvent), section formation NextGen avec 6 modules, disclaimer formalisation juridique."
  },
};

async function startDemoTask(req, env, ctx, cors) {
  const body = await req.json().catch(() => ({}));
  const { kind, email } = body;

  if (!DEMO_PRESETS[kind]) {
    return json({ error: 'invalid_demo_kind', accepted: Object.keys(DEMO_PRESETS) }, 400, cors);
  }

  // Rate limit demo : 1/IP/jour (sauf si bypass token)
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const todayKey = `demo:${ip}:${new Date().toISOString().slice(0, 10)}`;
  if (env.AGENT_KV) {
    const used = await env.AGENT_KV.get(todayKey);
    if (used && !(body.bypass_token === env.DEMO_BYPASS_TOKEN)) {
      return json({ error: 'demo_quota_used', message: '1 démo par jour. Demandez un code beta pour accès complet.' }, 429, cors);
    }
    await env.AGENT_KV.put(todayKey, '1', { expirationTtl: 86400 });
  }

  const preset = DEMO_PRESETS[kind];
  const agentId = env[AGENT_KIND_TO_ENV_VAR[kind]];
  const envId = env.MARCEL_ENV_ID;
  if (!agentId || !envId) {
    return json({ error: 'demo_misconfigured', hint: `Set ${AGENT_KIND_TO_ENV_VAR[kind]} + MARCEL_ENV_ID` }, 500, cors);
  }

  // Créer la session avec un user_id démo dédié
  const demoUserId = `demo_${kind}_${Date.now().toString(36)}`;
  const session = await anthropicFetch(env, 'POST', '/v1/sessions', {
    agent: agentId,
    environment_id: envId,
    title: `DEMO ${kind} · ${ip.slice(0, 8)}`,
    metadata: { user_id: demoUserId, kind, source: 'demo', email: email || null, ip },
  });

  await env.DB.prepare(`
    INSERT INTO agent_sessions
      (id, user_id, agent_kind, agent_id, agent_version, status, created_at, metadata_json)
    VALUES (?, ?, ?, ?, ?, 'running', ?, ?)
  `).bind(
    session.id, demoUserId, kind, agentId, 0, Date.now(),
    JSON.stringify({ demo: true, ip, email: email || null }),
  ).run();

  // Background : drainer le stream pour gérer custom_tool_use éventuels
  ctx.waitUntil(drainSessionStream(session.id, env));

  // Envoi du kickoff outcome
  await anthropicFetch(env, 'POST', `/v1/sessions/${session.id}/events`, {
    events: [{
      type: 'user.define_outcome',
      description: preset.task,
      rubric: { type: 'text', content: preset.rubric },
      max_iterations: 3,
    }],
  });

  return json({
    session_id: session.id,
    kind,
    stream_url: `/api/agents/demo/${session.id}/stream`,
    voice_url: `/api/agents/demo/${session.id}/voice`,
    estimated_duration_sec: kind === 'fortune' ? 180 : 90,
  }, 200, cors);
}

// SSE stream proxy — relaie les events Anthropic vers le browser
async function streamDemoEvents(sessionId, env, cors) {
  const upstream = await fetch(
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
  if (!upstream.ok || !upstream.body) {
    return json({ error: 'stream_failed', status: upstream.status }, 502, cors);
  }

  // Pipe direct — Cloudflare Workers supportent les streams sortants
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

// Synthèse vocale du résumé de la session
async function speakDemoSummary(sessionId, req, env, cors) {
  const body = await req.json().catch(() => ({}));
  const { voice = 'default', summary_max_chars = 600 } = body;

  // Vérifier que la session est idle (sinon on ne peut pas résumer)
  const session = await anthropicFetch(env, 'GET', `/v1/sessions/${sessionId}`);
  if (session.status !== 'idle') {
    return json({ error: 'session_not_idle', status: session.status }, 409, cors);
  }

  // Récupérer les events agent.message et extraire le dernier message texte
  const events = await anthropicFetch(env, 'GET', `/v1/sessions/${sessionId}/events?limit=50`);
  const agentMessages = (events.data || [])
    .filter(e => e.type === 'agent.message')
    .flatMap(e => (e.content || []).filter(b => b.type === 'text').map(b => b.text));
  const lastMessage = agentMessages.slice(-1)[0] || 'Démonstration terminée.';

  // Tronquer pour le TTS (sinon trop long)
  const truncated = lastMessage.length > summary_max_chars
    ? lastMessage.slice(0, summary_max_chars) + '… (voir le livrable complet pour la suite)'
    : lastMessage;

  // Appel au worker ikcp-voice (TTS VoxCPM2)
  const voiceUrl = env.IKCP_VOICE_URL || 'https://voice.ikcp.eu';
  const r = await fetch(`${voiceUrl}/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: truncated, voice, format: 'wav' }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    return json({ error: 'tts_failed', status: r.status, body: errText.slice(0, 200) }, 502, cors);
  }
  const audio = await r.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: { ...cors, 'Content-Type': 'audio/wav', 'X-Summary-Length': String(truncated.length) },
  });
}

// ═══════════════════════════════════════════════════════════════════
// MEMORY STORES — Marcel se souvient de chaque famille (cross-session)
// ═══════════════════════════════════════════════════════════════════

async function initMyMemory(env, userId, cors) {
  // Vérifie si l'user a déjà un memory_store
  const existing = await env.DB.prepare(
    `SELECT memory_store_id, email, name FROM users WHERE id=?`
  ).bind(userId).first();

  if (!existing) return json({ error: 'user_not_found' }, 404, cors);
  if (existing.memory_store_id) {
    return json({ memory_store_id: existing.memory_store_id, status: 'already_exists' }, 200, cors);
  }

  // Crée le memory store côté Anthropic
  const store = await anthropicFetch(env, 'POST', '/v1/memory_stores', {
    name: `IKCP — ${existing.name || existing.email || userId.slice(0, 8)}`,
    description: `Mémoire persistante de la famille (préférences fiscales, allocation cible, contexte personnel, échéances clés). Marcel y lit avant chaque tâche et y écrit après. Tout PII reste filtré au worker EU.`,
    metadata: { user_id: userId, project: 'ikcp-family-office' },
  });

  // Seed avec quelques fichiers de base
  const seedFiles = [
    {
      path: '/contexte/famille.md',
      content: `# Contexte famille\n\nCe fichier sera enrichi au fil des sessions. Marcel y inscrit :\n- composition familiale\n- objectifs patrimoniaux exprimés\n- préférences de communication\n- événements à ne pas oublier\n\n_(initialisé le ${new Date().toISOString().slice(0, 10)})_\n`,
    },
    {
      path: '/preferences/format.md',
      content: `# Préférences de format\n\n- Format rapport préféré : .docx\n- Niveau de détail : équilibré\n- Ton : pédagogique, vouvoiement\n- Langue : français\n\n_(à enrichir par Marcel selon les retours)_\n`,
    },
    {
      path: '/allocation/cible.md',
      content: `# Allocation cible (DER)\n\nÀ remplir lors du premier DER. Marcel comparera l'allocation actuelle à celle-ci dans chaque rapport.\n`,
    },
  ];
  for (const seed of seedFiles) {
    await anthropicFetch(env, 'POST', `/v1/memory_stores/${store.id}/memories`, seed);
  }

  // Persiste l'ID en D1
  await env.DB.prepare(
    `UPDATE users SET memory_store_id=? WHERE id=?`
  ).bind(store.id, userId).run();

  return json({
    memory_store_id: store.id,
    status: 'created',
    seeded_files: seedFiles.length,
  }, 200, cors);
}

async function getMyMemory(env, userId, cors) {
  const row = await env.DB.prepare(
    `SELECT memory_store_id FROM users WHERE id=?`
  ).bind(userId).first();
  if (!row?.memory_store_id) {
    return json({ memory_store_id: null, files: [] }, 200, cors);
  }
  const files = await anthropicFetch(env, 'GET',
    `/v1/memory_stores/${row.memory_store_id}/memories?view=basic`);
  return json({
    memory_store_id: row.memory_store_id,
    files: (files.data || []).map(m => ({
      id: m.id, path: m.path,
      size: m.content_size_bytes, updated_at: m.updated_at,
    })),
  }, 200, cors);
}

async function getMyNewsletters(env, userId, cors) {
  const rows = await env.DB.prepare(`
    SELECT id, week_iso, subject, preview, status, sent_at
    FROM newsletter_log
    WHERE user_id = ? AND status = 'sent'
    ORDER BY sent_at DESC LIMIT 20
  `).bind(userId).all();
  return json({ newsletters: rows.results || [] }, 200, cors);
}

// ═══════════════════════════════════════════════════════════════════
// CRON HANDLER — newsletter hebdo vendredi 8h UTC (10h Paris été)
// ═══════════════════════════════════════════════════════════════════

async function handleScheduled(event, env) {
  const cron = event?.cron || '';
  console.log(`[CRON] triggered: ${cron} at ${new Date().toISOString()}`);

  if (cron === '0 8 * * 5') {
    return await runWeeklyNewsletters(env);
  }
  if (cron === '0 3 * * *') {
    return await runDailyMemoryBackup(env);
  }

  console.log(`[CRON] unhandled cron pattern: ${cron}`);
}

// ═══════════════════════════════════════════════════════════════════
// BACKUP QUOTIDIEN MEMORY STORES → R2
// Empêche la perte irréversible si bug Anthropic ou suppression accidentelle.
// Sauve chaque memory store en JSON dans R2 (rétention 30 jours).
// ═══════════════════════════════════════════════════════════════════

async function runDailyMemoryBackup(env) {
  if (!env.DOCS) {
    console.warn('[BACKUP] R2 binding DOCS missing — skipping memory backup');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`[BACKUP] memory stores → R2 (${today})`);

  // Tous les users avec un memory store
  const users = await env.DB.prepare(`
    SELECT id, memory_store_id FROM users
    WHERE memory_store_id IS NOT NULL AND deleted_at IS NULL
  `).all();

  const list = users.results || [];
  console.log(`[BACKUP] ${list.length} memory stores à sauver`);

  let saved = 0, failed = 0;
  for (const u of list) {
    try {
      // Lister tous les fichiers du memory store
      const filesList = await anthropicFetch(env, 'GET',
        `/v1/memory_stores/${u.memory_store_id}/memories?view=full`);

      const snapshot = {
        user_id: u.id,
        memory_store_id: u.memory_store_id,
        backup_date: today,
        backup_ts: Date.now(),
        files_count: (filesList.data || []).length,
        files: filesList.data || [],
      };

      const key = `memory-backups/${today}/${u.id}.json`;
      await env.DOCS.put(key, JSON.stringify(snapshot, null, 2), {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          user_id: u.id,
          memory_store_id: u.memory_store_id,
          backup_date: today,
        },
      });
      saved++;
    } catch (e) {
      failed++;
      console.error(`[BACKUP] failed for ${u.id}:`, e?.message);
    }
  }

  // Index global du jour
  await env.DOCS.put(`memory-backups/${today}/_index.json`, JSON.stringify({
    date: today, ts: Date.now(),
    total: list.length, saved, failed,
  }, null, 2));

  // Cleanup : supprimer les backups > 30 jours
  // (R2 lifecycle rules sont l'idéal — fait via dashboard CF ; ici on log juste)
  console.log(`[BACKUP] ${saved}/${list.length} memory stores sauvés (${failed} échecs)`);
}

async function runWeeklyNewsletters(env) {
  const week = getIsoWeek(new Date());

  // Sélectionne les users tier payant (premium = Découverte/Augmenté, fo = Bespoke/Partner)
  // qui n'ont pas déjà reçu la newsletter de cette semaine.
  // Note alignement schéma : `users.display_name` côté ikcp-client (pas `name`).
  // marketing_consent = 1 (opt-in newsletter) — colonne existante dans users.
  const candidates = await env.DB.prepare(`
    SELECT u.id, u.email, COALESCE(u.prenom, u.display_name) AS name, u.tier, u.memory_store_id
    FROM users u
    LEFT JOIN newsletter_log n
      ON n.user_id = u.id AND n.week_iso = ?
    WHERE u.tier IN ('premium', 'fo')
      AND u.email IS NOT NULL
      AND u.deleted_at IS NULL
      AND (u.marketing_consent = 1 OR u.tier = 'fo')
      AND n.id IS NULL
    LIMIT 100
  `).bind(week).all();

  const users = candidates.results || [];
  console.log(`[CRON] ${users.length} users to newsletter this week (${week})`);

  // ─── CIRCUIT BREAKER : compteur d'échecs consécutifs ───
  // Si 3 échecs d'affilée → on stoppe la cohorte pour éviter de spam
  // une API en panne. Maxime sera notifié via push_log.
  let queued = 0, failed = 0, consecutiveFailures = 0;
  for (const user of users) {
    if (consecutiveFailures >= 3) {
      console.error(`[CRON] CIRCUIT BREAKER tripped after ${consecutiveFailures} consecutive failures — abandoning cohort`);
      // Log dans push_log pour alerter Maxime au prochain reload du cockpit
      try {
        await env.DB.prepare(`
          INSERT INTO push_log (id, user_id, kind, title, body, status, created_at)
          VALUES (?, ?, 'ops_alert', 'Newsletter cron cassé', ?, 'queued', ?)
        `).bind(
          `alert_${week}_breaker`, 'admin', `Circuit breaker activé semaine ${week} après ${consecutiveFailures} échecs. ${queued}/${users.length} traités.`,
          Date.now(),
        ).run();
      } catch (_) { /* push_log peut ne pas exister yet */ }
      break;
    }
    try {
      await queueNewsletterFor(user, week, env);
      queued++;
      consecutiveFailures = 0;
    } catch (e) {
      failed++;
      consecutiveFailures++;
      console.error(`[CRON] failed for user ${user.id} (consecutive=${consecutiveFailures}):`, e?.message);
      // Marquer comme failed dans newsletter_log pour retry manuel
      try {
        const newsletterId = `nl_${week}_${user.id.slice(0, 12)}_failed`;
        await env.DB.prepare(`
          INSERT OR IGNORE INTO newsletter_log
            (id, user_id, week_iso, status, created_at, metadata_json)
          VALUES (?, ?, ?, 'failed', ?, ?)
        `).bind(newsletterId, user.id, week, Date.now(),
          JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
        ).run();
      } catch (_) { /* ignore */ }
    }
  }
  console.log(`[CRON] ${queued}/${users.length} queued, ${failed} failed`);
}

async function queueNewsletterFor(user, week, env) {
  // S'assure que le memory store existe
  let memoryStoreId = user.memory_store_id;
  if (!memoryStoreId) {
    const store = await anthropicFetch(env, 'POST', '/v1/memory_stores', {
      name: `IKCP — ${user.name || user.email}`,
      description: `Mémoire famille.`,
      metadata: { user_id: user.id },
    });
    memoryStoreId = store.id;
    await env.DB.prepare(`UPDATE users SET memory_store_id=? WHERE id=?`)
      .bind(memoryStoreId, user.id).run();
  }

  // Lance la session marcel-editorial avec memory store attaché
  const agentId = env.MARCEL_EDITORIAL_AGENT_ID;
  const envId = env.MARCEL_ENV_ID;
  if (!agentId || !envId) {
    throw new Error('editorial agent or env not configured');
  }

  const session = await anthropicFetch(env, 'POST', '/v1/sessions', {
    agent: agentId,
    environment_id: envId,
    title: `Newsletter ${week} · ${user.id.slice(0, 8)}`,
    resources: [
      { type: 'memory_store', memory_store_id: memoryStoreId, access: 'read_write',
        instructions: 'Mémoire de cette famille. Lis le contexte avant de rédiger, écris-y ce que tu apprends de neuf cette semaine.' },
    ],
    metadata: { user_id: user.id, kind: 'newsletter_weekly', week },
  });

  // Tracking en D1
  const newsletterId = `nl_${week}_${user.id.slice(0, 12)}`;
  await env.DB.prepare(`
    INSERT INTO newsletter_log (id, user_id, session_id, week_iso, status, created_at, metadata_json)
    VALUES (?, ?, ?, ?, 'queued', ?, ?)
  `).bind(
    newsletterId, user.id, session.id, week, Date.now(),
    JSON.stringify({ tier: user.tier, agent_kind: 'editorial' }),
  ).run();

  // Persist agent_sessions aussi
  await env.DB.prepare(`
    INSERT INTO agent_sessions
      (id, user_id, agent_kind, agent_id, agent_version, status, created_at, metadata_json)
    VALUES (?, ?, 'editorial', ?, ?, 'running', ?, ?)
  `).bind(
    session.id, user.id, agentId, 0, Date.now(),
    JSON.stringify({ newsletter_id: newsletterId, week, source: 'cron_weekly' }),
  ).run();

  // Outcome — rubric pour newsletter perso UPPERCUT
  await anthropicFetch(env, 'POST', `/v1/sessions/${session.id}/events`, {
    events: [{
      type: 'user.define_outcome',
      description: `Rédige la newsletter UPPERCUT IKCP de la semaine ${week} pour cette famille (${user.name || 'client'}). Lis d'abord son memory store (/contexte/famille.md, /allocation/cible.md, /preferences/format.md). Compose ensuite une newsletter PERSO de 250-400 mots qui aborde 1-2 sujets fiscaux/patrimoniaux PERTINENTS pour SA situation cette semaine, en citant les sources. Ton UPPERCUT : direct, premier degré, opinionnated. Génère 1 visuel hero matplotlib (palette IKCP) qui résume le sujet principal. Persist via editorial.persist_article puis appelle editorial.send_email_via_resend pour l'envoi.`,
      rubric: { type: 'text', content: `La newsletter contient : (1) un titre accrocheur sans "Dans un monde", (2) 250-400 mots, (3) 1-2 sujets adaptés à la famille (lus depuis memory store), (4) au moins 1 source CGI/BOFIP/article cité avec lien, (5) ton UPPERCUT respecté, (6) 1 visuel hero PNG palette IKCP, (7) disclaimer MIF II final.` },
      max_iterations: 3,
    }],
  });
}

function getIsoWeek(d) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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
