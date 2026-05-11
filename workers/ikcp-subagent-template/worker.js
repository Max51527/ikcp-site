/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4
 *
 * IKCP — Sub-agent MCP server template (Cloudflare Worker)
 *
 * Template minimal pour exposer un sub-agent IKCP comme MCP server HTTPS,
 * conforme à la convention IKCP (cf. docs/CLAUDE-AGENT-SDK-INTEGRATION.md).
 *
 * Endpoints :
 *   GET  /mcp/health          → status + version + tools count
 *   POST /mcp/list_tools      → liste des tools (schémas inclus)
 *   POST /mcp/call_tool       → exécution d'un tool
 *
 * Auth : header `X-IKCP-Signature` HMAC-SHA256 du body avec MCP_SHARED_SECRET
 *
 * Convention nommage : un sub-agent par Worker. Exemples :
 *   · documents-mcp-server  (OCR + classification)
 *   · suivi-mcp-server      (cron rappels échéances)
 *   · reporting-mcp-server  (DER / RA / bilan PDF)
 *   · juridique-mcp-server  (RAG Légifrance + analyse actes)
 *
 * Pour créer un nouveau sub-agent :
 *   1. cp -r workers/ikcp-subagent-template workers/<nom>-mcp-server
 *   2. Adapter SUBAGENT_NAME, TOOLS, callTool() ci-dessous
 *   3. wrangler deploy
 *   4. Service binding dans ikcp-marcel/wrangler.toml
 */

const SUBAGENT_NAME = 'template';
const VERSION = '0.1.0';

// ─── Tools exposés par ce sub-agent ──────────────────────────────────────────
// Format conforme à la spec MCP (input_schema = JSON Schema).
const TOOLS = [
  {
    name: 'example_tool',
    description: "Tool d'exemple. À remplacer par les tools réels du sub-agent.",
    input_schema: {
      type: 'object',
      properties: {
        input_text: { type: 'string', description: 'Texte d\'entrée pour exemple' },
      },
      required: ['input_text'],
    },
  },
];

// ─── Implémentation des tools ────────────────────────────────────────────────
// Chaque case correspond à un nom de tool. Retourne un objet JSON sérialisable.
async function callTool(name, args, env) {
  try {
    if (name === 'example_tool') {
      return { echo: args.input_text, length: String(args.input_text || '').length };
    }
    return { error: 'unknown_tool', tool: name };
  } catch (e) {
    return { error: 'tool_execution_error', message: e.message };
  }
}

// ─── Routing HTTP ────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/mcp/health' && request.method === 'GET') {
      return Response.json({
        status: 'ok',
        subagent: SUBAGENT_NAME,
        version: VERSION,
        tools_count: TOOLS.length,
        protocol: 'mcp-http',
      });
    }

    // Auth obligatoire pour tous les autres endpoints
    if (!env.MCP_SHARED_SECRET) {
      return jsonError(503, 'mcp_secret_not_configured', 'Define MCP_SHARED_SECRET in worker secrets');
    }
    const authResult = await verifyAuth(request, env.MCP_SHARED_SECRET);
    if (!authResult.ok) {
      return jsonError(401, 'unauthorized', authResult.reason);
    }

    if (path === '/mcp/list_tools' && request.method === 'POST') {
      return Response.json({ tools: TOOLS });
    }

    if (path === '/mcp/call_tool' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return jsonError(400, 'invalid_json'); }

      const { name, arguments: args } = body || {};
      if (!name || typeof name !== 'string') {
        return jsonError(400, 'tool_name_required');
      }

      // Vérifie que le tool existe (sécurité — n'exécute que des tools déclarés)
      if (!TOOLS.find(t => t.name === name)) {
        return jsonError(404, 'tool_not_found', `Tool ${name} not declared in TOOLS`);
      }

      const result = await callTool(name, args || {}, env);
      return Response.json({ result });
    }

    return jsonError(404, 'not_found', `${request.method} ${path} not handled`);
  },
};

// ─── Auth HMAC ───────────────────────────────────────────────────────────────
// Le client (Marcel) calcule HMAC-SHA256(body, MCP_SHARED_SECRET) et l'envoie
// dans le header `X-IKCP-Signature`. Le serveur recalcule et compare.
// Permet une auth bilatérale sans certificats.
async function verifyAuth(request, secret) {
  const sig = request.headers.get('X-IKCP-Signature');
  if (!sig) return { ok: false, reason: 'missing_signature' };

  // Pour les requêtes POST avec body, on signe le body
  // Pour list_tools sans body, on signe une chaîne fixe ('list_tools')
  const body = request.method === 'POST' ? await request.clone().text() : 'list_tools';
  const expected = await hmacSha256(body, secret);

  if (!constantTimeEqual(sig, expected)) {
    return { ok: false, reason: 'invalid_signature' };
  }
  return { ok: true };
}

async function hmacSha256(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function jsonError(status, error, detail) {
  return new Response(JSON.stringify({ error, detail }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
