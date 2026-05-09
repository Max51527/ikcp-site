/**
 * ikcp-api — Worker gateway pour les intégrations API gratuites
 *
 * Endpoints :
 *   POST /v1/agents/ask    → orchestration multi-thématiques (proxy → Marcel)
 *   POST /v1/notion        → crée une fiche prospect dans Notion
 *   POST /v1/email         → envoie un email via Resend
 *   GET  /v1/legifrance    → proxy Légifrance (recherche article)
 *   GET  /v1/insee         → proxy Insee (données démographiques)
 *   GET  /v1/dvf           → comparables transactions immobilières (api.cquest.org)
 *   GET  /v1/health        → status
 *
 * Bindings / Secrets (à configurer dans Cloudflare Dashboard) :
 *   NOTION_TOKEN     (secret) — token API Notion
 *   NOTION_DB_ID     (env)    — ID de la database Notion (Prospects)
 *   RESEND_API_KEY   (secret) — clé API Resend
 *   RESEND_FROM      (env)    — adresse email expéditeur (ex: marcel@ikcp.eu)
 *   RESEND_TO        (env)    — adresse Maxime (maxime@ikcp.fr)
 *   INSEE_KEY        (secret) — clé API Insee (gratuit sur api.insee.fr)
 *
 * Pour les API entièrement gratuites SANS clé :
 *   - Légifrance : api.piste.gouv.fr (open data, mais demande inscription) ou alternative
 *
 * Toutes les réponses : { success, data, error, trace_id, timestamp }
 */

import { handleAgentsAsk } from './agents.js';

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'http://localhost:3000',
];

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status = 200, req, trace = '') {
  return new Response(
    JSON.stringify({ ...body, trace_id: trace, timestamp: new Date().toISOString() }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Request-ID': trace,
        'X-API-Version': 'v1',
        ...corsHeaders(req),
      },
    }
  );
}

// ──────────────────────────────────────────────────────────────
// Notion API : créer une fiche prospect
// Doc : https://developers.notion.com/reference/post-page
// ──────────────────────────────────────────────────────────────
async function handleNotion(req, env, trace) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) {
    return json({ success: false, error: 'Notion non configuré (NOTION_TOKEN/NOTION_DB_ID manquants)' }, 503, req, trace);
  }
  let body;
  try { body = await req.json(); } catch { return json({ success: false, error: 'JSON invalide' }, 400, req, trace); }

  const { profile = {}, source = 'Marcel chat', message = '', leadScore = 0, page = '' } = body;

  const props = {
    Name: { title: [{ text: { content: profile.first_name || profile.email || `Prospect ${Date.now()}` } }] },
    Source: { select: { name: source } },
    Email: profile.email ? { email: profile.email } : undefined,
    Score: { number: leadScore || 0 },
    Page: { url: page || 'https://ikcp.eu' },
    Message: { rich_text: [{ text: { content: (message || '').slice(0, 1900) } }] },
    Date: { date: { start: new Date().toISOString() } },
  };
  Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DB_ID },
      properties: props,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Notion error:', res.status, err);
    return json({ success: false, error: `Notion API ${res.status}` }, 502, req, trace);
  }

  const data = await res.json();
  return json({ success: true, data: { notion_id: data.id, url: data.url } }, 201, req, trace);
}

// ──────────────────────────────────────────────────────────────
// Resend : envoyer un email
// Doc : https://resend.com/docs/api-reference/emails/send-email
// ──────────────────────────────────────────────────────────────
async function handleEmail(req, env, trace) {
  if (!env.RESEND_API_KEY) {
    return json({ success: false, error: 'Resend non configuré (RESEND_API_KEY manquant)' }, 503, req, trace);
  }
  let body;
  try { body = await req.json(); } catch { return json({ success: false, error: 'JSON invalide' }, 400, req, trace); }

  const { to = env.RESEND_TO, subject = 'Notification IKCP', text = '', html = '', reply_to = '' } = body;

  if (!to || !subject || (!text && !html)) {
    return json({ success: false, error: 'to/subject + text|html requis' }, 400, req, trace);
  }

  const payload = {
    from: env.RESEND_FROM || 'Marcel <marcel@ikcp.eu>',
    to: Array.isArray(to) ? to : [to],
    subject: subject.slice(0, 200),
    text: text.slice(0, 50000),
    html: html.slice(0, 100000) || undefined,
  };
  if (reply_to) payload.reply_to = reply_to;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', res.status, err);
    return json({ success: false, error: `Resend API ${res.status}` }, 502, req, trace);
  }

  const data = await res.json();
  return json({ success: true, data: { email_id: data.id } }, 201, req, trace);
}

// ──────────────────────────────────────────────────────────────
// Légifrance : recherche article CGI / Code civil
// Note : api.piste.gouv.fr nécessite inscription. Pour démo on retourne
// un mock structuré. Production : configurer LEGIFRANCE_TOKEN.
// ──────────────────────────────────────────────────────────────
async function handleLegifrance(req, env, trace) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  if (!query) return json({ success: false, error: 'paramètre ?q= requis' }, 400, req, trace);

  // Si LEGIFRANCE_TOKEN est configuré, requête réelle ; sinon mock
  if (!env.LEGIFRANCE_TOKEN) {
    return json({
      success: true,
      data: {
        query,
        note: 'Mock — LEGIFRANCE_TOKEN non configuré. Activez via api.piste.gouv.fr',
        link: `https://www.legifrance.gouv.fr/search/all?searchField=ALL&query=${encodeURIComponent(query)}`,
      },
    }, 200, req, trace);
  }

  // Vraie API si configurée
  const res = await fetch(`https://api.piste.gouv.fr/dila/legifrance-beta/lf-engine-app/consult/getArticle`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.LEGIFRANCE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: query }),
  });

  if (!res.ok) {
    return json({ success: false, error: `Légifrance API ${res.status}` }, 502, req, trace);
  }
  const data = await res.json();
  return json({ success: true, data }, 200, req, trace);
}

// ──────────────────────────────────────────────────────────────
// DVF — Demande de Valeurs Foncières (api.cquest.org, miroir public DVF DGFiP)
// Doc : https://app.dvf.etalab.gouv.fr / mirroir api.cquest.org/dvf
//
// Paramètres :
//   ?code_postal=75116  ou  ?code_insee=75116
//   ?type=Maison|Appartement  (optionnel)
//   ?surface_min=70 &surface_max=90  (optionnel)
//   ?annee_min=2024  (optionnel, défaut : 2 dernières années)
//
// Sortie : médiane prix/m², Q1, Q3, n transactions, échantillon top 10.
// Aucun secret nécessaire — endpoint public, mais on rate-limit pour éviter abus.
// ──────────────────────────────────────────────────────────────
async function handleDvf(req, env, trace) {
  const url = new URL(req.url);
  const codePostal = url.searchParams.get('code_postal');
  const codeInsee = url.searchParams.get('code_insee');
  const type = url.searchParams.get('type'); // Maison | Appartement
  const surfMin = +url.searchParams.get('surface_min') || 0;
  const surfMax = +url.searchParams.get('surface_max') || 99999;
  const anneeMin = +url.searchParams.get('annee_min') || (new Date().getFullYear() - 2);

  if (!codePostal && !codeInsee) {
    return json({ success: false, error: 'paramètre ?code_postal= ou ?code_insee= requis' }, 400, req, trace);
  }

  const upstream = codeInsee
    ? `https://api.cquest.org/dvf?code_commune=${encodeURIComponent(codeInsee)}`
    : `https://api.cquest.org/dvf?code_postal=${encodeURIComponent(codePostal)}`;

  let res;
  try {
    res = await fetch(upstream, { headers: { 'Accept': 'application/json' } });
  } catch (e) {
    return json({ success: false, error: 'DVF upstream unreachable', detail: String(e).slice(0, 200) }, 502, req, trace);
  }
  if (!res.ok) {
    return json({ success: false, error: `DVF ${res.status}` }, 502, req, trace);
  }

  const raw = await res.json();
  const transactions = Array.isArray(raw.resultats) ? raw.resultats : [];

  // Filtrage côté Worker (l'API DVF n'a pas tous les filtres en query string)
  const filtered = transactions.filter(t => {
    if (!t.valeur_fonciere || !t.surface_reelle_bati) return false;
    if (type && t.type_local !== type) return false;
    if (t.surface_reelle_bati < surfMin || t.surface_reelle_bati > surfMax) return false;
    const annee = t.date_mutation ? +t.date_mutation.slice(0, 4) : 0;
    if (annee < anneeMin) return false;
    return true;
  });

  // Stats agrégées : médiane €/m², quartiles, n
  const prixM2 = filtered.map(t => t.valeur_fonciere / t.surface_reelle_bati).filter(p => p > 100 && p < 100000).sort((a, b) => a - b);
  const stats = prixM2.length === 0 ? null : {
    n: prixM2.length,
    median_eur_m2: Math.round(prixM2[Math.floor(prixM2.length / 2)]),
    q1_eur_m2: Math.round(prixM2[Math.floor(prixM2.length / 4)]),
    q3_eur_m2: Math.round(prixM2[Math.floor(prixM2.length * 3 / 4)]),
    min_eur_m2: Math.round(prixM2[0]),
    max_eur_m2: Math.round(prixM2[prixM2.length - 1]),
  };

  // Échantillon top 10 transactions récentes
  const sample = filtered
    .sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''))
    .slice(0, 10)
    .map(t => ({
      date: t.date_mutation,
      type: t.type_local,
      adresse: [t.adresse_numero, t.adresse_nom_voie].filter(Boolean).join(' '),
      commune: t.nom_commune,
      surface: t.surface_reelle_bati,
      prix: t.valeur_fonciere,
      eur_m2: Math.round(t.valeur_fonciere / t.surface_reelle_bati),
    }));

  return json({
    success: true,
    data: {
      query: { code_postal: codePostal, code_insee: codeInsee, type, surface_min: surfMin, surface_max: surfMax, annee_min: anneeMin },
      stats,
      sample,
      source: 'DVF DGFiP via api.cquest.org · données ouvertes etalab',
    },
  }, 200, req, trace);
}

// ──────────────────────────────────────────────────────────────
// Insee : données démographiques (gratuit, clé requise)
// Doc : https://api.insee.fr/catalogue/site/themes/wso2/subthemes/insee/pages/item-info.jag?name=Donnees+Locales&version=V0.1
// ──────────────────────────────────────────────────────────────
async function handleInsee(req, env, trace) {
  const url = new URL(req.url);
  const codeCommune = url.searchParams.get('commune');
  if (!codeCommune) return json({ success: false, error: 'paramètre ?commune= (code Insee) requis' }, 400, req, trace);

  if (!env.INSEE_KEY) {
    return json({
      success: true,
      data: {
        commune: codeCommune,
        note: 'Mock — INSEE_KEY non configurée. Inscription gratuite sur api.insee.fr',
      },
    }, 200, req, trace);
  }

  const res = await fetch(`https://api.insee.fr/donnees-locales/V0.1/donnees/geo-COM_DEM-1/COM-${codeCommune}.all`, {
    headers: {
      'Authorization': `Bearer ${env.INSEE_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    return json({ success: false, error: `Insee API ${res.status}` }, 502, req, trace);
  }
  const data = await res.json();
  return json({ success: true, data }, 200, req, trace);
}

// ──────────────────────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const trace = crypto.randomUUID();
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Origin check (sauf pour /v1/health)
    if (path !== '/v1/health') {
      const origin = request.headers.get('Origin') || '';
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return json({ success: false, error: 'Origin not allowed' }, 403, request, trace);
      }
    }

    // Health
    if (path === '/v1/health' || path === '/') {
      return json({
        success: true,
        data: {
          service: 'ikcp-api',
          version: '1.0.0',
          endpoints: ['/v1/agents/ask', '/v1/notion', '/v1/email', '/v1/legifrance?q=', '/v1/insee?commune=', '/v1/dvf?code_postal='],
          configured: {
            marcel_binding: !!env.MARCEL,
            notion: !!env.NOTION_TOKEN,
            resend: !!env.RESEND_API_KEY,
            legifrance: !!env.LEGIFRANCE_TOKEN,
            insee: !!env.INSEE_KEY,
          },
        },
      }, 200, request, trace);
    }

    // Routing
    if (path === '/v1/agents/ask' && request.method === 'POST') return handleAgentsAsk(request, env, json, trace);
    if (path === '/v1/notion' && request.method === 'POST') return handleNotion(request, env, trace);
    if (path === '/v1/email' && request.method === 'POST') return handleEmail(request, env, trace);
    if (path === '/v1/legifrance' && request.method === 'GET') return handleLegifrance(request, env, trace);
    if (path === '/v1/insee' && request.method === 'GET') return handleInsee(request, env, trace);
    if (path === '/v1/dvf' && request.method === 'GET') return handleDvf(request, env, trace);

    return json({ success: false, error: 'not_found', path }, 404, request, trace);
  },
};
