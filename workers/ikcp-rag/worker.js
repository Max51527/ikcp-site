/**
 * ikcp-rag — Base de connaissances patrimoniale IKCP (RAG SOUVERAIN)
 * ─────────────────────────────────────────────────────────────────────────────
 * RÔLE : donner à Marcel l'expertise PROPRE d'IKCP (OBO, Dutreil, détention immo,
 * cotisations TNS…) écrite dans la page Notion « Documentation ».
 *
 * PIPELINE : contenu (Notion OU push direct) → découpage en fiches → embeddings
 *            → Cloudflare VECTORIZE (WEUR) → recherche à la question → Marcel.
 *
 * EMBEDDINGS SOUVERAINS (2 voies, zéro US) :
 *   - Cloudflare Workers AI `@cf/baai/bge-m3` (multilingue, 1024 dim) — AUCUNE clé,
 *     même infra que D1/Vectorize. C'est la voie par défaut.
 *   - Mistral `mistral-embed` (UE) — utilisée SI MISTRAL_API_KEY est posée.
 *   ⚠ Si tu changes de voie (poses/retires la clé Mistral) → re-`/ingest` (vecteurs
 *     incompatibles entre modèles).
 *
 * « METTRE À JOUR » :
 *   - POST /ingest-push {text}  → indexe un texte fourni (je pousse la doc Notion
 *     via la MCP authentifiée à ton compte : ni token Notion ni partage requis).
 *   - POST /ingest              → tire la page Notion côté worker (requiert NOTION_TOKEN
 *     + intégration partagée). Pour le CRON auto plus tard.
 *
 * SOUVERAIN : Cloudflare WEUR (+ Mistral FR en option). ZÉRO US.
 * SÉCURITÉ : MISTRAL_API_KEY / NOTION_TOKEN / RAG_ADMIN = SECRETS, jamais en clair.
 */

const ALLOWED = [
  'https://ikcp.eu', 'https://www.ikcp.eu', 'https://app.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev', // Marcel peut interroger
  'https://ikcp-eu.pages.dev', 'http://localhost:5500',
];
function cors(o) {
  const ok = ALLOWED.includes(o) || (o && (o.endsWith('.ikcp.eu') || o.endsWith('.workers.dev') || o.endsWith('.pages.dev')));
  return {
    'Access-Control-Allow-Origin': ok ? o : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Vary': 'Origin',
  };
}
function json(d, s = 200, o = '') {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(o) } });
}

const NOTION_VER = '2022-06-28';
function hasEmbed(env) { return !!(env.MISTRAL_API_KEY || env.AI); }
function embedProvider(env) { return env.MISTRAL_API_KEY ? 'mistral-embed' : (env.AI ? 'cf/bge-m3' : null); }
function ready(env) { return !!(hasEmbed(env) && env.VEC); }                 // /search + /ingest-push
function configured(env) { return !!(hasEmbed(env) && env.VEC && env.NOTION_TOKEN); } // /ingest Notion auto

// ── Extraire le texte lisible d'un bloc Notion ───────────────────────────────
function blockText(b) {
  const t = b[b.type];
  if (!t) return '';
  const rt = t.rich_text || t.caption || [];
  let s = (Array.isArray(rt) ? rt : []).map(x => x.plain_text || '').join('');
  if (!s.trim()) return '';
  if (b.type.indexOf('heading') === 0) return '\n## ' + s;          // titres = repères de section
  if (b.type === 'toggle' || b.type === 'callout') return '\n### ' + s;
  return s;
}

// ── Récupère TOUT le contenu d'une page Notion (récursif + pagination) ───────
async function notionText(pageId, env) {
  const out = [];
  async function walk(id, depth) {
    if (depth > 6) return;
    let cursor = null;
    do {
      const u = 'https://api.notion.com/v1/blocks/' + id + '/children?page_size=100' + (cursor ? '&start_cursor=' + cursor : '');
      const r = await fetch(u, { headers: { 'Authorization': 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': NOTION_VER } });
      if (!r.ok) throw new Error('notion ' + r.status + ' (partage l\'intégration sur la page ?)');
      const d = await r.json();
      for (const b of (d.results || [])) {
        const txt = blockText(b);
        if (txt) out.push(txt);
        if (b.has_children) await walk(b.id, depth + 1);
      }
      cursor = d.has_more ? d.next_cursor : null;
    } while (cursor);
  }
  await walk(pageId, 0);
  return out.join('\n');
}

// ── Normalise le texte pour l'embedding (LinkedIn « gras maths », emojis…) ───
//    bge-m3 renvoie 3030 « invalid input » sur les caractères hors-norme.
function sanitize(s) {
  return String(s)
    .normalize('NFKC')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ── Découpe en fiches ~1100 caractères, sur les paragraphes (overlap léger) ──
function chunkText(text, size = 1100, overlap = 120) {
  const parts = [], paras = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 2);
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n' + p).length > size && buf) { parts.push(buf.trim()); buf = buf.slice(-overlap) + '\n' + p; }
    else buf += '\n' + p;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

// ── Embeddings souverains (1024 dim) — Mistral UE si clé, sinon Workers AI ────
async function embed(texts, env) {
  // Voie 1 — Mistral La Plateforme (UE), si la clé est posée
  if (env.MISTRAL_API_KEY) {
    const r = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + env.MISTRAL_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral-embed', input: texts }),
    });
    if (!r.ok) throw new Error('mistral ' + r.status + ' ' + (await r.text()).slice(0, 140));
    const d = await r.json();
    return (d.data || []).map(x => x.embedding);
  }
  // Voie 2 — Cloudflare Workers AI bge-m3 (multilingue, 1024 dim, zéro clé, même stack souveraine)
  if (env.AI) {
    const out = await env.AI.run('@cf/baai/bge-m3', { text: texts });
    return out.data || [];
  }
  throw new Error('aucun moteur embeddings (ni MISTRAL_API_KEY ni binding AI)');
}

// ── (Ré)indexation complète de la doc Notion dans Vectorize ──────────────────
async function ingest(env) {
  const text = await notionText(env.NOTION_DOC_ID, env);
  const chunks = chunkText(sanitize(text));
  let indexed = 0;
  for (let i = 0; i < chunks.length; i += 16) {            // par lots (limite embeddings)
    const batch = chunks.slice(i, i + 16);
    const vecs = await embed(batch, env);
    const items = vecs.map((values, j) => ({ id: 'doc-' + (i + j), values, metadata: { text: batch[j].slice(0, 1500) } }));
    await env.VEC.upsert(items);
    indexed += items.length;
  }
  return { chunks: chunks.length, indexed, chars: text.length };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const o = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(o) });

    if (url.pathname === '/health') {
      return json({ status: 'ok', service: 'ikcp-rag', ready: ready(env), embed: embedProvider(env), vectorize: !!env.VEC, workers_ai: !!env.AI, mistral: !!env.MISTRAL_API_KEY, notion_pull: configured(env), doc: env.NOTION_DOC_ID ? 'set' : 'absent', region: 'EU/FR' }, 200, o);
    }

    // ── POST /ingest-push {text, source?} : indexe un texte FOURNI (je pousse la doc).
    //    Pas de NOTION_TOKEN ni de partage requis : le contenu arrive dans le body. ──
    if (url.pathname === '/ingest-push' && req.method === 'POST') {
      if (!ready(env)) return json({ error: 'rag_not_ready', hint: 'binding VEC + un moteur embeddings (AI ou MISTRAL_API_KEY)' }, 503, o);
      if (env.RAG_ADMIN) { const t = url.searchParams.get('token') || req.headers.get('X-Admin-Token') || ''; if (t !== env.RAG_ADMIN) return json({ error: 'unauthorized' }, 401, o); }
      let body; try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, o); }
      const text = (body && body.text) || '';
      const source = String((body && body.source) || 'push').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'push';
      if (!text || text.length < 20) return json({ error: 'empty_text' }, 400, o);
      try {
        const chunks = chunkText(sanitize(text)); let indexed = 0;
        for (let i = 0; i < chunks.length; i += 16) {
          const batch = chunks.slice(i, i + 16);
          const vecs = await embed(batch, env);
          const items = vecs.map((values, j) => ({ id: source + '-' + (i + j), values, metadata: { text: batch[j].slice(0, 1500), source } }));
          await env.VEC.upsert(items);
          indexed += items.length;
        }
        return json({ ok: true, source, provider: embedProvider(env), chunks: chunks.length, indexed, chars: text.length }, 200, o);
      } catch (e) { return json({ error: 'ingest_push', message: e.message }, 502, o); }
    }

    // ── POST /ingest : tire la page Notion côté worker (requiert NOTION_TOKEN + partage). ──
    if (url.pathname === '/ingest' && req.method === 'POST') {
      if (!configured(env)) return json({ error: 'notion_pull_not_configured', hint: 'pose NOTION_TOKEN + partage l\'intégration sur la page Documentation, ou utilise /ingest-push' }, 503, o);
      if (env.RAG_ADMIN) { const t = url.searchParams.get('token') || req.headers.get('X-Admin-Token') || ''; if (t !== env.RAG_ADMIN) return json({ error: 'unauthorized' }, 401, o); }
      try { const res = await ingest(env); return json({ ok: true, ...res }, 200, o); }
      catch (e) { return json({ error: 'ingest', message: e.message }, 502, o); }
    }

    // ── GET /search?q=…&k=4 : fiches IKCP pertinentes (Marcel s'en sert) ──
    if (url.pathname === '/search') {
      if (!ready(env)) return json({ error: 'rag_not_ready' }, 503, o);
      const q = url.searchParams.get('q') || '';
      const k = Math.min(8, Math.max(1, +(url.searchParams.get('k') || 4)));
      if (!q) return json({ error: 'missing_q' }, 400, o);
      try {
        const [vec] = await embed([sanitize(q)], env);
        const res = await env.VEC.query(vec, { topK: k, returnMetadata: true });
        const fiches = (res.matches || []).map(m => ({ score: m.score, text: (m.metadata && m.metadata.text) || '' }));
        return json({ q, fiches }, 200, o);
      } catch (e) { return json({ error: 'search', message: e.message }, 502, o); }
    }

    return json({ error: 'not_found', path: url.pathname }, 404, o);
  },

  // ── CRON hebdo : ré-indexation AUTO (la doc Notion reste synchro avec Marcel) ──
  async scheduled(event, env, ctx) {
    if (configured(env)) ctx.waitUntil(ingest(env).catch(e => console.log('[rag-cron]', e.message)));
  },
};
