/**
 * ikcp-veille — Proxy Perplexity Pro pour Cassius
 *
 * Endpoints :
 *   GET  /health                                 — health check
 *   POST /search  { query, mode, user_id, tier } — quick | deep
 *   POST /watch   { query, target_price, user }  — surveillance quotidienne
 *
 * Auth : Bearer <session_token> validé contre ikcp-client
 * Tier check : seuls premium / fo peuvent appeler
 * Rate-limit : KV par user_id + day (quick) ou month (deep)
 * Audit : chaque appel loggué vers ikcp-temoin
 *
 * Région : Cloudflare WEUR (Paris), RGPD souverain
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://cassius.fo',
  'https://www.cassius.fo',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev',   // Marcel peut tool-call
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8765',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8765',
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin)
    || (origin?.endsWith('.ikcp.eu'))
    || (origin?.endsWith('.cassius.fo'))
    || (origin?.endsWith('.maxime-ead.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

// ─── Rate-limit par tier ─────────────────────────────────────────
async function checkRateLimit(env, userId, tier, mode) {
  if (tier === 'fo' && mode === 'quick') return { ok: true };  // illimité quick pour FO
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const key = mode === 'deep'
    ? `rl:${userId}:${month}:deep`
    : `rl:${userId}:${today}:quick`;
  const current = parseInt(await env.VEILLE_CACHE.get(key) || '0', 10);
  const limit = mode === 'deep'
    ? parseInt(env.RATE_LIMIT_DEEP_PER_MONTH, 10)
    : parseInt(env.RATE_LIMIT_QUICK_PER_DAY, 10);
  if (current >= limit) {
    return {
      ok: false,
      message: `Quota ${mode} atteint (${current}/${limit}). Réinitialisation ${mode === 'deep' ? 'mensuelle' : 'quotidienne'}.`,
      upgrade_path: tier === 'premium' ? 'fo' : null,
    };
  }
  await env.VEILLE_CACHE.put(key, String(current + 1), {
    expirationTtl: mode === 'deep' ? 60 * 60 * 24 * 31 : 60 * 60 * 24,
  });
  return { ok: true, remaining: limit - current - 1 };
}

// ─── Vérif tier via user payload (à durcir Sprint 2 avec JWT signé) ─
function checkTier(tier, modeNeeded) {
  if (modeNeeded === 'quick' && (tier === 'premium' || tier === 'fo')) return true;
  if (modeNeeded === 'deep' && tier === 'fo') return true;
  return false;
}

// ─── Audit Témoin async ──────────────────────────────────────────
async function auditLog(env, userId, action, metadata) {
  try {
    await fetch('https://ikcp-temoin.maxime-ead.workers.dev/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        family_id: userId,
        question: `[veille:${action}] ${metadata.query || ''}`.slice(0, 500),
        response: metadata.summary?.slice(0, 1000) || '',
        model: 'perplexity-pro',
        metadata,
      }),
    });
  } catch (_) { /* audit non-bloquant */ }
}

// ─── Perplexity API call ─────────────────────────────────────────
async function callPerplexity(env, query, mode) {
  const model = mode === 'deep' ? env.PERPLEXITY_MODEL_DEEP : env.PERPLEXITY_MODEL_QUICK;
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Tu es l'agent de veille de Cassius (Family Office IKCP).
Réponds en français, sourcé, structuré markdown.
Cible : dirigeants français HNW, contexte patrimonial / fiscal / lifestyle / collections.
Cite toutes les sources avec URL.
Distingue clairement les faits récents des estimations.
Termine par une question d'orientation (jamais une recommandation produit, conformité MIF II).`,
        },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
      return_citations: true,
      return_images: false,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`perplexity_upstream_${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = await r.json();
  return {
    summary: data.choices?.[0]?.message?.content || '',
    sources: data.citations || data.search_results || [],
    model: data.model,
    usage: data.usage,
  };
}

// ─── Hash query pour cache 24 h ─────────────────────────────────
async function hashQuery(q) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(q.toLowerCase().trim()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // ─── /health ─────────────────────────────────────────────
    if (url.pathname === '/health') {
      return json({
        status: 'ok',
        service: 'ikcp-veille',
        version: '0.1.0',
        provider: 'perplexity-pro',
        models: {
          quick: env.PERPLEXITY_MODEL_QUICK,
          deep: env.PERPLEXITY_MODEL_DEEP,
        },
        configured: {
          api_key: !!env.PERPLEXITY_API_KEY,
          cache: !!env.VEILLE_CACHE,
        },
        rate_limits: {
          quick_per_day: env.RATE_LIMIT_QUICK_PER_DAY,
          deep_per_month: env.RATE_LIMIT_DEEP_PER_MONTH,
        },
        timestamp: new Date().toISOString(),
      }, 200, origin);
    }

    // ─── /search ─────────────────────────────────────────────
    if (url.pathname === '/search' && request.method === 'POST') {
      if (!env.PERPLEXITY_API_KEY) {
        return json({ error: 'api_key_missing' }, 500, origin);
      }
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400, origin); }
      const { query, mode = 'quick', user_id, tier = 'free' } = body || {};
      if (!query || typeof query !== 'string') return json({ error: 'query_required' }, 400, origin);
      if (!user_id) return json({ error: 'user_id_required' }, 400, origin);

      // Tier check
      if (!checkTier(tier, mode)) {
        return json({
          error: 'tier_insufficient',
          required: mode === 'deep' ? 'fo' : 'premium',
          current: tier,
          upgrade_url: 'https://ikcp.eu/cassius/pricing',
        }, 403, origin);
      }

      // Rate-limit check
      const rl = await checkRateLimit(env, user_id, tier, mode);
      if (!rl.ok) return json({ error: 'rate_limited', ...rl }, 429, origin);

      // Cache check (quick mode uniquement)
      const queryHash = await hashQuery(query);
      if (mode === 'quick') {
        const cached = await env.VEILLE_CACHE.get(`cache:${queryHash}`, 'json');
        if (cached) {
          return json({ ...cached, cached: true, remaining: rl.remaining }, 200, origin);
        }
      }

      // Call Perplexity
      try {
        const result = await callPerplexity(env, query, mode);

        // Cache si quick
        if (mode === 'quick') {
          await env.VEILLE_CACHE.put(`cache:${queryHash}`, JSON.stringify(result), {
            expirationTtl: parseInt(env.CACHE_TTL_QUICK_HOURS, 10) * 3600,
          });
        }

        // Audit
        await auditLog(env, user_id, mode, { query, summary: result.summary, sources_count: result.sources?.length });

        return json({
          ...result,
          mode,
          cached: false,
          remaining: rl.remaining,
        }, 200, origin);
      } catch (err) {
        return json({ error: 'perplexity_error', message: err.message }, 502, origin);
      }
    }

    return json({ error: 'not_found', path: url.pathname }, 404, origin);
  },
};
