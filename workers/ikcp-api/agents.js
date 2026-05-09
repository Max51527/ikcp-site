/**
 * /v1/agents/ask — proxy vers le Worker Marcel (`ikcp-chat`).
 *
 * Contrat front (page family-office v4-live) :
 *   POST { theme, question, history? }
 *   → 200 { success:true, data:{ text, sources:[{name,url?}], next_action } }
 *
 * Implémentation : on délègue à Marcel via service binding (recommandé) ou
 * fetch HTTP fallback. Marcel possède déjà :
 *  - les tools déterministes (calc_impot_revenu / succession / donation / ifi /
 *    plus_value_immo / demembrement)
 *  - le web search natif Anthropic
 *  - le prompt caching et les règles MIF II
 *
 * Pour activer le service binding (sans coût d'invocation) :
 *   wrangler.toml :
 *     [[services]]
 *     binding = "MARCEL"
 *     service = "ikcp-chat"
 *
 * Sans binding, on retombe sur fetch vers MARCEL_URL.
 */

const MARCEL_URL = 'https://ikcp-chat.maxime-ead.workers.dev';

const ALLOWED_THEMES = new Set([
  'art', 'markets', 'fiscal', 'juridique', 'immo',
  'pe', 'transmission', 'financement', 'philanthropie', 'admin',
]);

const THEME_DEFAULT_SOURCES = {
  art: ['Artprice', 'CGI 885 I', 'CGI 150 V bis'],
  markets: ['Bigdata.com', 'Quantalys', 'CGI 150-0 D'],
  fiscal: ['Légifrance', 'BOFIP', 'CGI 779 I'],
  juridique: ['CGI 787 B', 'Code civil', 'Cass. com. 2024'],
  immo: ['DVF api.gouv.fr', 'CGI 964', 'CGI 150 U'],
  pe: ['CGI 150-0 B ter', 'AMF GECO', 'France Invest'],
  transmission: ['CGI 787 B', 'CGI 150-0 B ter', 'Pappers'],
  financement: ['Banque de France OAT 10y', 'CGI 31'],
  philanthropie: ['CGI 200', 'CGI 978', 'CGI 238 bis'],
  admin: ['Calendrier fiscal DGFiP', 'Cloudflare Email Routing'],
};

export async function handleAgentsAsk(request, env, json, trace) {
  let body;
  try { body = await request.json(); }
  catch { return json({ success: false, error: 'JSON invalide' }, 400, request, trace); }

  const { theme, question, history } = body || {};
  if (!theme || !ALLOWED_THEMES.has(theme)) {
    return json({ success: false, error: 'theme inconnu', allowed: [...ALLOWED_THEMES] }, 400, request, trace);
  }
  if (!question || typeof question !== 'string' || question.trim().length < 4 || question.length > 1500) {
    return json({ success: false, error: 'question invalide (4 à 1500 caractères)' }, 400, request, trace);
  }

  // Marcel attend { message, history, theme }. On lui passe la question telle
  // quelle et il applique le THEME_CONTEXTS correspondant côté worker Marcel.
  const marcelPayload = {
    message: question,
    history: Array.isArray(history) ? history.slice(-8) : [],
    theme,
  };

  let marcelResp;
  try {
    marcelResp = await callMarcel(env, marcelPayload);
  } catch (err) {
    return json({ success: false, error: 'marcel_unavailable', detail: String(err).slice(0, 200) }, 502, request, trace);
  }

  if (!marcelResp || !marcelResp.reply) {
    return json({ success: false, error: 'reply_vide' }, 502, request, trace);
  }

  return json({
    success: true,
    data: {
      text: marcelResp.reply,
      sources: extractSources(marcelResp.reply, theme),
      next_action: 'Soumettre cette analyse à Maxime',
      meta: {
        web_search_used: !!marcelResp.web_search_used,
        season: marcelResp.season || null,
        follow_ups: Array.isArray(marcelResp.follow_ups) ? marcelResp.follow_ups : [],
      },
    },
  }, 200, request, trace);
}

async function callMarcel(env, payload) {
  // Service binding prioritaire (latence quasi-nulle, coût d'invocation 0)
  if (env.MARCEL && typeof env.MARCEL.fetch === 'function') {
    const res = await env.MARCEL.fetch('https://internal/marcel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://ikcp.eu' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Marcel binding ${res.status}`);
    return res.json();
  }

  // Fallback HTTP
  const res = await fetch(MARCEL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://ikcp.eu' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Marcel HTTP ${res.status}`);
  return res.json();
}

/**
 * Extraction heuristique des sources depuis la réponse Marcel.
 * Marcel cite déjà ses sources en clair (CGI / BOFIP / API). On capte les
 * mentions courantes ; sinon fallback sur les sources par défaut du thème.
 */
function extractSources(text, theme) {
  const found = new Set();
  const patterns = [
    /\b(CGI\s+\d+(?:[-\s]\w+)?(?:\s*(?:bis|ter|quater|quinquies|sexies))?)\b/gi,
    /\b(art\.\s*\d+(?:\s*[A-Z])?(?:\s*(?:bis|ter|quater))?\s*(?:CGI|Code\s+civil|CMF))\b/gi,
    /\b(BOFIP-[A-Z\-\d]+)\b/gi,
    /\b(api\.gouv\.fr\/[a-z\-]+)\b/gi,
    /\b(Bigdata\.com|Artprice|Pappers|DVF|Légifrance|PriceHubble|Notaires de France|Insee)\b/g,
  ];
  patterns.forEach(p => {
    let m;
    while ((m = p.exec(text)) !== null) {
      const s = m[1].replace(/\s+/g, ' ').trim();
      if (s.length < 80) found.add(s);
    }
  });
  if (found.size === 0) {
    return (THEME_DEFAULT_SOURCES[theme] || []).slice(0, 4).map(name => ({ name }));
  }
  return [...found].slice(0, 6).map(name => ({ name }));
}
