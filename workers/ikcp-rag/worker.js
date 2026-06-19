/**
 * ikcp-rag — Base de connaissances patrimoniale IKCP (RAG SOUVERAIN)
 * ─────────────────────────────────────────────────────────────────────────────
 * RÔLE : donner à Marcel l'expertise PROPRE d'IKCP (OBO, Dutreil, détention immo,
 * cotisations TNS…) écrite dans la page Notion « Documentation ».
 *
 * PIPELINE : Notion (source) → découpage en fiches → embeddings MISTRAL (UE)
 *            → Cloudflare VECTORIZE (WEUR) → recherche à la question → Marcel.
 *
 * « METTRE À JOUR » : POST /ingest (manuel, protégé) OU CRON hebdo (auto). Tu
 * édites Notion → on ré-indexe → Marcel apprend, sans toucher au code.
 *
 * SOUVERAIN : Mistral FR (embeddings) + Vectorize Cloudflare WEUR. ZÉRO US.
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
function configured(env) { return !!(env.MISTRAL_API_KEY && env.VEC && env.NOTION_TOKEN); }

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

// ── Embeddings Mistral (UE) — mistral-embed = 1024 dimensions ────────────────
async function embed(texts, env) {
  const r = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + env.MISTRAL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'mistral-embed', input: texts }),
  });
  if (!r.ok) throw new Error('mistral ' + r.status + ' ' + (await r.text()).slice(0, 140));
  const d = await r.json();
  return (d.data || []).map(x => x.embedding);
}

// ── (Ré)indexation complète de la doc Notion dans Vectorize ──────────────────
async function ingest(env) {
  const text = await notionText(env.NOTION_DOC_ID, env);
  const chunks = chunkText(text);
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
      return json({ status: 'ok', service: 'ikcp-rag', configured: configured(env), mistral: !!env.MISTRAL_API_KEY, notion: !!env.NOTION_TOKEN, vectorize: !!env.VEC, doc: env.NOTION_DOC_ID ? 'set' : 'absent', region: 'EU/FR' }, 200, o);
    }
    if (!configured(env)) {
      return json({ error: 'rag_not_configured', hint: 'Crée l\'index Vectorize ikcp-knowledge (dim 1024) + bind VEC ; pose MISTRAL_API_KEY & NOTION_TOKEN (secrets) ; partage l\'intégration Notion sur la page Documentation.' }, 503, o);
    }

    // ── POST /ingest : (ré)indexe la doc Notion. « Mettre à jour » manuel. ──
    if (url.pathname === '/ingest' && req.method === 'POST') {
      if (env.RAG_ADMIN) { const t = url.searchParams.get('token') || req.headers.get('X-Admin-Token') || ''; if (t !== env.RAG_ADMIN) return json({ error: 'unauthorized' }, 401, o); }
      try { const res = await ingest(env); return json({ ok: true, ...res }, 200, o); }
      catch (e) { return json({ error: 'ingest', message: e.message }, 502, o); }
    }

    // ── GET /search?q=…&k=4 : fiches IKCP pertinentes (Marcel s'en sert) ──
    if (url.pathname === '/search') {
      const q = url.searchParams.get('q') || '';
      const k = Math.min(8, Math.max(1, +(url.searchParams.get('k') || 4)));
      if (!q) return json({ error: 'missing_q' }, 400, o);
      try {
        const [vec] = await embed([q], env);
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
