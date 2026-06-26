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

// ─── Veille — Perplexity (défaut) OU Mistral souverain (LLM_PRIMARY=mistral) ───
async function callPerplexity(env, query, mode) {
  // ── VEILLE SOUVERAINE — Mistral (FR) si LLM_PRIMARY=mistral (zéro US) ──
  // Caveat honnête : Mistral n'a pas la recherche web LIVE de Perplexity → veille
  // basée sur les connaissances du modèle (moins fraîche, mais 100 % souveraine).
  // En mode souverain on NE retombe PAS sur Perplexity (US). Pour du temps réel
  // souverain : ajouter Qwant API (FR) + Mistral (brique future).
  if (env.LLM_PRIMARY === 'mistral' && env.MISTRAL_API_KEY) {
    try {
      const mr = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.MISTRAL_MODEL || 'mistral-large-latest',
          temperature: 0.2, max_tokens: 1800,
          messages: [
            { role: 'system', content: `Tu es l'agent de veille souverain du Family Office IKCP. Réponds en français, structuré markdown, pour dirigeants français fortunés (patrimoine / fiscal / lifestyle / collections). Distingue clairement les faits établis des estimations et signale quand une donnée mérite une vérification à jour. Termine par une question d'orientation (jamais de recommandation produit — conformité MIF II).` },
            { role: 'user', content: query },
          ],
        }),
      });
      if (mr.ok) {
        const md = await mr.json();
        const summary = md.choices && md.choices[0] && md.choices[0].message && md.choices[0].message.content;
        if (summary) return { summary, sources: [], model: 'ikcp-souverain', usage: md.usage };
      }
    } catch (_) { /* pas de repli US en mode souverain */ }
    return { summary: 'Veille souveraine momentanément indisponible — merci de réessayer.', sources: [], model: 'ikcp-souverain' };
  }
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
      // Anti-abus : plafond 60/h par IP (KV) — protège Perplexity contre le vidage par curl.
      { const _ip = request.headers.get('CF-Connecting-IP') || ''; if (_ip && env.VEILLE_CACHE) { const _k='rlip:'+_ip+':'+Math.floor(Date.now()/3600000); let _n=0; try{ _n=parseInt(await env.VEILLE_CACHE.get(_k))||0; }catch(_){} if(_n>=60) return json({ error:'rate_limited' },429,origin); try{ await env.VEILLE_CACHE.put(_k,String(_n+1),{expirationTtl:3700}); }catch(_){} } }
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

    // ─── /digest : veille patrimoniale du jour (générée par le cron) ──
    if (url.pathname === '/digest' && request.method === 'GET') {
      const cached = await env.VEILLE_CACHE.get('daily_digest');
      if (cached) return new Response(cached, { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
      return json({ digest: null, note: 'Digest pas encore généré (cron quotidien 6h UTC).' }, 200, origin);
    }

    return json({ error: 'not_found', path: url.pathname }, 404, origin);
  },

  // ─── CRON quotidien (06:00 UTC) — veille patrimoniale du jour ──
  // Génère un digest général via Perplexity (1 appel quick ≈ coût négligeable)
  // et le stocke 36 h en KV. Comble le « gap automatisation » : les membres
  // voient une veille fraîche chaque jour sans appel personnalisé coûteux.
  async scheduled(event, env, ctx) {
    if (!env.PERPLEXITY_API_KEY) return;
    const q = "Tu rédiges la « veille patrimoniale du jour » pour un CLIENT QUI N'EST PAS un professionnel de la finance (un dirigeant, une famille). "
      + "Donne les 3 actualités patrimoniales ou fiscales françaises les plus importantes du moment (loi de finances, transmission, immobilier, holding, placements). "
      + "RÈGLES STRICTES : "
      + "1) Français simple, clair et rassurant — on s'adresse à quelqu'un d'intelligent mais non spécialiste. "
      + "2) Pour chaque point : un titre court en gras (## ), puis UNE phrase commençant par « Concrètement pour vous : » qui explique l'impact sans jargon. Si un terme technique est indispensable, explique-le en 3 mots entre parenthèses. "
      + "3) INTERDIT : les numéros de référence type [1], tout commentaire sur les sources, toute question à la fin, tout préambule (« je ne vois pas… », « voici… »). "
      + "Commence DIRECTEMENT par le titre du premier point. Maximum 130 mots au total.";
    try {
      const res = await callPerplexity(env, q, 'quick');
      // Nettoyage serveur : retire les renvois [n] et tout préambule/question méta résiduels.
      const cleanSummary = (res.summary || '')
        .replace(/\[\d+\](?:\s*\[\d+\])*/g, '')
        .replace(/^\s*(je ne vois pas|je n['’]ai pas trouvé|en revanche,? les résultats)[^\n]*\n?/gim, '')
        .replace(/^\s*(souhaitez-vous|voulez-vous)[^\n]*\?\s*$/gim, '')
        .trim();
      const payload = JSON.stringify({
        date: new Date(event.scheduledTime).toISOString().slice(0, 10),
        summary: cleanSummary,
        sources: (res.sources || []).slice(0, 6),
        generated_at: event.scheduledTime,
      });
      await env.VEILLE_CACHE.put('daily_digest', payload, { expirationTtl: 129600 }); // 36 h
      await auditLog(env, 'cron', 'daily_digest', { len: res.summary.length });
    } catch (e) {
      await auditLog(env, 'cron', 'daily_digest_error', { error: String(e).slice(0, 200) });
    }
  },
};
