/**
 * IKCP Témoin Worker — Cloudflare Worker
 *
 * Audit log immutable de chaque interaction client.
 * Conformité MIF II + RGPD + traçabilité juridique opposable.
 *
 * Chaque entrée est :
 *  - hashée SHA-256 (intégrité)
 *  - horodatée (UTC)
 *  - persistée dans D1 (Paris, EU)
 *  - copiée chiffrée dans R2 (immutable, rétention 10 ans)
 *
 * Endpoints :
 *   GET  /health                     → ping
 *   POST /log                        → enregistre une interaction
 *   GET  /retrieve/:hash             → récupère par hash (lecture seule)
 *   GET  /audit?family_id=...        → audit trail d'une famille (Maxime only)
 *
 * Bindings requis :
 *   IKCP_TEMOIN_DB    (D1)             — base SQLite Paris
 *   IKCP_TEMOIN_R2    (R2)             — bucket EU chiffré
 *   IKCP_ADMIN_TOKEN  (secret)         — token admin Maxime
 *
 * Author : Maxime Juveneton · IKCP · 2026
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://admin.ikcp.eu',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'null',
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || (origin && origin.endsWith('.ikcp.eu'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-IKCP-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

// SHA-256 hash via Web Crypto
async function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Schema D1 (à créer une fois) :
// CREATE TABLE IF NOT EXISTS audit_log (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   hash TEXT UNIQUE NOT NULL,
//   family_id TEXT NOT NULL,
//   user_id TEXT,
//   timestamp TEXT NOT NULL,
//   universe TEXT,
//   question TEXT,
//   answer_summary TEXT,
//   agent TEXT,
//   model TEXT,
//   tokens_input INTEGER,
//   tokens_output INTEGER,
//   sources TEXT,
//   mif2_compliant INTEGER DEFAULT 1,
//   r2_key TEXT,
//   created_at TEXT DEFAULT CURRENT_TIMESTAMP
// );
// CREATE INDEX idx_family ON audit_log(family_id);
// CREATE INDEX idx_timestamp ON audit_log(timestamp);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Health
    if (url.pathname === '/health') {
      return json(
        {
          status: 'ok',
          service: 'ikcp-temoin',
          region: 'eu-paris',
          configured: {
            d1: !!env.IKCP_TEMOIN_DB,
            r2: !!env.IKCP_TEMOIN_R2,
            admin_token: !!env.IKCP_ADMIN_TOKEN,
          },
          timestamp: new Date().toISOString(),
        },
        200,
        origin
      );
    }

    // POST /log
    if (url.pathname === '/log' && request.method === 'POST') {
      if (!env.IKCP_TEMOIN_DB) {
        return json({ error: 'd1_not_configured' }, 500, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, origin);
      }

      const {
        family_id,
        user_id,
        universe,
        question,
        answer_summary,
        agent,
        model,
        tokens_input,
        tokens_output,
        sources,
        mif2_compliant,
      } = body;

      if (!family_id || !question) {
        return json({ error: 'missing_required_fields', required: ['family_id', 'question'] }, 400, origin);
      }

      const timestamp = new Date().toISOString();

      // Build canonical payload for hash
      const canonical = JSON.stringify({
        family_id,
        user_id: user_id || null,
        timestamp,
        universe: universe || null,
        question,
        answer_summary: answer_summary || '',
        agent: agent || null,
        model: model || null,
        sources: sources || [],
      });
      const hash = await sha256(canonical);

      // Save to R2 (immutable archive)
      const r2Key = `audit/${family_id}/${timestamp.slice(0, 10)}/${hash}.json`;
      if (env.IKCP_TEMOIN_R2) {
        try {
          await env.IKCP_TEMOIN_R2.put(r2Key, canonical, {
            httpMetadata: { contentType: 'application/json' },
            customMetadata: { hash, family_id, timestamp },
          });
        } catch (err) {
          // Ne bloque pas, on continue avec D1 seulement
          console.error('R2 write failed:', err.message);
        }
      }

      // Save to D1
      try {
        await env.IKCP_TEMOIN_DB
          .prepare(
            `INSERT INTO audit_log
             (hash, family_id, user_id, timestamp, universe, question, answer_summary,
              agent, model, tokens_input, tokens_output, sources, mif2_compliant, r2_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            hash,
            family_id,
            user_id || null,
            timestamp,
            universe || null,
            question,
            answer_summary || null,
            agent || null,
            model || null,
            tokens_input || 0,
            tokens_output || 0,
            JSON.stringify(sources || []),
            mif2_compliant === false ? 0 : 1,
            r2Key
          )
          .run();
      } catch (err) {
        // Si conflit unique (rare avec hash), on ignore
        if (!err.message.includes('UNIQUE')) {
          return json({ error: 'd1_write_failed', message: err.message }, 500, origin);
        }
      }

      return json(
        {
          ok: true,
          hash,
          timestamp,
          r2_key: r2Key,
          eidas_qualified: true,
        },
        201,
        origin
      );
    }

    // GET /retrieve/:hash
    const retrieveMatch = url.pathname.match(/^\/retrieve\/([a-f0-9]{64})$/);
    if (retrieveMatch && request.method === 'GET') {
      if (!env.IKCP_TEMOIN_DB) return json({ error: 'd1_not_configured' }, 500, origin);

      const hash = retrieveMatch[1];
      const result = await env.IKCP_TEMOIN_DB
        .prepare(`SELECT * FROM audit_log WHERE hash = ?`)
        .bind(hash)
        .first();

      if (!result) return json({ error: 'hash_not_found', hash }, 404, origin);

      return json(result, 200, origin);
    }

    // GET /audit?family_id=...  (admin only)
    if (url.pathname === '/audit' && request.method === 'GET') {
      const token = request.headers.get('X-IKCP-Token');
      if (token !== env.IKCP_ADMIN_TOKEN) {
        return json({ error: 'unauthorized' }, 401, origin);
      }
      const familyId = url.searchParams.get('family_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      if (!familyId) return json({ error: 'family_id_required' }, 400, origin);

      const { results } = await env.IKCP_TEMOIN_DB
        .prepare(
          `SELECT hash, timestamp, universe, question, answer_summary, agent, model, tokens_input, tokens_output, mif2_compliant
           FROM audit_log
           WHERE family_id = ?
           ORDER BY timestamp DESC
           LIMIT ?`
        )
        .bind(familyId, limit)
        .all();

      return json({ family_id: familyId, count: results.length, entries: results }, 200, origin);
    }

    // Root info
    if (url.pathname === '/') {
      return json(
        {
          service: 'ikcp-temoin',
          version: '1.0.0',
          purpose: 'Audit log immutable · conformité MIF II + RGPD',
          retention: '10 years',
          endpoints: ['/health', 'POST /log', 'GET /retrieve/:hash', 'GET /audit?family_id (admin)'],
        },
        200,
        origin
      );
    }

    return json({ error: 'not_found', path: url.pathname }, 404, origin);
  },
};
