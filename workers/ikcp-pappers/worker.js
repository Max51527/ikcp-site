/**
 * IKCP Pappers Worker — Cloudflare Worker
 *
 * Wrappe l'API Pappers (https://api.pappers.fr/v2) pour :
 *  - Cacher la clé API (côté serveur, jamais exposée au front)
 *  - Mettre en cache les réponses (KV, TTL 1h) — économise les requêtes Pappers (free tier limité)
 *  - Normaliser le payload pour Théodore (l'agent Architecte 360°)
 *  - CORS strict pour ikcp.eu uniquement
 *
 * Endpoints :
 *  GET /                          health check
 *  GET /search?q=<query>          recherche entreprise par nom
 *  GET /entreprise/:siren         fiche complète d'une entreprise
 *  GET /entreprise/:siren/short   version résumée (pour previews / chat Marcel)
 *
 * Bindings requis :
 *  PAPPERS_API_KEY  (secret)   — clé Pappers — wrangler secret put PAPPERS_API_KEY
 *  PAPPERS_CACHE    (KV)       — cache 1h — voir wrangler.toml
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://ikcp-eu.pages.dev', // Cloudflare Pages (preview + prod)
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'null', // file:// (test local)
];

const PAPPERS_BASE = 'https://api.pappers.fr/v2';
const CACHE_TTL_SECONDS = 3600; // 1 heure

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) || origin === ''
      || (origin && (origin.endsWith('.ikcp.eu') || origin.endsWith('.pages.dev') || origin.endsWith('.workers.dev')));

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health
    if (path === '/' || path === '/health') {
      return json({
        status: 'ok',
        service: 'ikcp-pappers',
        version: '1.0',
        configured: {
          api_key: !!env.PAPPERS_API_KEY,
          cache_kv: !!env.PAPPERS_CACHE,
        },
      }, 200, origin, allowed);
    }

    // DVF — prix immobiliers réels (data.gouv geo-dvf + Base Adresse Nationale, gratuit, sans clé)
    if (path === '/dvf') {
      const q = url.searchParams.get('q');
      if (!q || q.length < 2) return error('Paramètre `q` requis (commune ou code postal)', 400, origin, allowed);
      return await getDVF(q, env, origin, allowed);
    }

    // Vérifie la clé API
    if (!env.PAPPERS_API_KEY) {
      return error('PAPPERS_API_KEY non configurée — `wrangler secret put PAPPERS_API_KEY`', 500, origin, allowed);
    }

    // SEARCH par nom
    if (path === '/search') {
      const q = url.searchParams.get('q');
      if (!q || q.length < 2) return error('Paramètre `q` requis (min. 2 caractères)', 400, origin, allowed);
      return await searchCompanies(q, env, origin, allowed);
    }

    // FICHE complète par SIREN
    const sirenMatch = path.match(/^\/entreprise\/(\d{9})$/);
    if (sirenMatch) {
      return await getEntreprise(sirenMatch[1], env, origin, allowed, false);
    }

    // FICHE résumée par SIREN
    const shortMatch = path.match(/^\/entreprise\/(\d{9})\/short$/);
    if (shortMatch) {
      return await getEntreprise(shortMatch[1], env, origin, allowed, true);
    }

    return error('Endpoint non trouvé', 404, origin, allowed);
  },
};

// ──────────────────────────────────────────────────────────────
// SEARCH
// ──────────────────────────────────────────────────────────────
async function searchCompanies(q, env, origin, allowed) {
  const cacheKey = `search:${q.toLowerCase()}`;

  // Cache hit
  if (env.PAPPERS_CACHE) {
    const cached = await env.PAPPERS_CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json', 'X-IKCP-Cache': 'HIT' },
      });
    }
  }

  // Cache miss → appel Pappers
  const params = new URLSearchParams({
    api_token: env.PAPPERS_API_KEY,
    q,
    par_page: '10',
    precision: 'standard',
  });

  let pappersRes;
  try {
    pappersRes = await fetch(`${PAPPERS_BASE}/recherche?${params}`);
  } catch (e) {
    return error(`Erreur réseau Pappers : ${e.message}`, 502, origin, allowed);
  }

  if (!pappersRes.ok) {
    const txt = await pappersRes.text();
    return error(`Pappers ${pappersRes.status} : ${txt.slice(0, 200)}`, pappersRes.status, origin, allowed);
  }

  const data = await pappersRes.json();

  const result = {
    query: q,
    total: data.total || 0,
    results: (data.resultats || []).slice(0, 10).map(r => ({
      siren: r.siren,
      nom: r.nom_entreprise || r.denomination,
      forme_juridique: r.forme_juridique,
      capital: r.capital,
      siege: {
        ville: r.siege?.ville,
        code_postal: r.siege?.code_postal,
      },
      dirigeant_principal: r.dirigeant_principal?.nom_complet,
      date_creation: r.date_creation,
      etat: r.etat_administratif,
    })),
    fetched_at: new Date().toISOString(),
  };

  const body = JSON.stringify(result);
  if (env.PAPPERS_CACHE) {
    await env.PAPPERS_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL_SECONDS });
  }

  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json', 'X-IKCP-Cache': 'MISS' },
  });
}

// ──────────────────────────────────────────────────────────────
// ENTREPRISE par SIREN
// ──────────────────────────────────────────────────────────────
async function getEntreprise(siren, env, origin, allowed, short) {
  const cacheKey = `ent:${short ? 'short:' : ''}${siren}`;

  if (env.PAPPERS_CACHE) {
    const cached = await env.PAPPERS_CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json', 'X-IKCP-Cache': 'HIT' },
      });
    }
  }

  const params = new URLSearchParams({
    api_token: env.PAPPERS_API_KEY,
    siren,
  });

  let pappersRes;
  try {
    pappersRes = await fetch(`${PAPPERS_BASE}/entreprise?${params}`);
  } catch (e) {
    return error(`Erreur réseau Pappers : ${e.message}`, 502, origin, allowed);
  }

  if (!pappersRes.ok) {
    if (pappersRes.status === 404) {
      return error(`SIREN ${siren} introuvable`, 404, origin, allowed);
    }
    const txt = await pappersRes.text();
    return error(`Pappers ${pappersRes.status} : ${txt.slice(0, 200)}`, pappersRes.status, origin, allowed);
  }

  const data = await pappersRes.json();

  const full = {
    siren: data.siren,
    siret_siege: data.siret_siege,
    nom: data.nom_entreprise,
    nom_commercial: data.nom_commercial,
    forme_juridique: data.forme_juridique,
    capital: data.capital,
    devise_capital: data.devise_capital,
    date_creation: data.date_creation,
    date_immatriculation_rcs: data.date_immatriculation_rcs,
    siege: {
      adresse_ligne_1: data.siege?.adresse_ligne_1,
      code_postal: data.siege?.code_postal,
      ville: data.siege?.ville,
      pays: data.siege?.pays || 'France',
    },
    code_naf: data.code_naf,
    libelle_code_naf: data.libelle_code_naf,
    domaine_activite: data.domaine_activite,
    tranche_effectif: data.tranche_effectif,
    effectif: data.effectif,
    chiffre_affaires: data.chiffre_affaires,
    resultat: data.resultat,
    date_cloture_exercice: data.date_cloture_exercice,
    economie_sociale_solidaire: data.economie_sociale_solidaire,
    representants: (data.representants || []).map(r => ({
      nom: r.nom_complet || `${r.prenom || ''} ${r.nom || ''}`.trim(),
      qualite: r.qualite,
      date_prise_de_poste: r.date_prise_de_poste,
      date_de_naissance: r.date_de_naissance,
      personne_morale: r.personne_morale,
    })),
    beneficiaires_effectifs: (data.beneficiaires_effectifs || []).map(b => ({
      nom: b.nom_complet || `${b.prenom || ''} ${b.nom || ''}`.trim(),
      pourcentage_parts: b.pourcentage_parts,
      pourcentage_votes: b.pourcentage_votes,
      date_prise_de_poste: b.date_prise_de_poste,
    })),
    finances: (data.finances || []).slice(0, 5).map(f => ({
      annee: f.annee,
      date_cloture_exercice: f.date_cloture_exercice,
      duree_exercice: f.duree_exercice,
      chiffre_affaires: f.chiffre_affaires,
      resultat: f.resultat,
      effectif: f.effectif,
    })),
    actes: short ? undefined : (data.actes || []).slice(0, 5).map(a => ({
      type: a.type,
      date_depot: a.date_depot_formate || a.date_depot,
    })),
    fetched_at: new Date().toISOString(),
  };

  const result = short
    ? {
        siren: full.siren,
        nom: full.nom,
        forme_juridique: full.forme_juridique,
        capital: full.capital,
        date_creation: full.date_creation,
        siege: full.siege,
        code_naf: full.code_naf,
        libelle_code_naf: full.libelle_code_naf,
        tranche_effectif: full.tranche_effectif,
        chiffre_affaires: full.chiffre_affaires,
        resultat: full.resultat,
        nb_dirigeants: full.representants.length,
        nb_beneficiaires: full.beneficiaires_effectifs.length,
        fetched_at: full.fetched_at,
      }
    : full;

  const body = JSON.stringify(result);
  if (env.PAPPERS_CACHE) {
    await env.PAPPERS_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL_SECONDS });
  }

  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json', 'X-IKCP-Cache': 'MISS' },
  });
}

// ──────────────────────────────────────────────────────────────
// DVF — prix immobiliers réels (data.gouv · geo-dvf · sans clé)
// ──────────────────────────────────────────────────────────────
async function getDVF(q, env, origin, allowed) {
  // 1. Commune -> code INSEE via Base Adresse Nationale (gratuit, sans clé)
  let citycode, nom, cp;
  try {
    const ban = await fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(q) + '&type=municipality&limit=1');
    const bj = await ban.json();
    const f = bj.features && bj.features[0];
    if (!f) return error('Commune introuvable : ' + q, 404, origin, allowed);
    citycode = f.properties.citycode;
    nom = f.properties.city || f.properties.name;
    cp = f.properties.postcode || '';
  } catch (e) {
    return error('Résolution commune indisponible', 502, origin, allowed);
  }

  const cacheKey = 'dvf:' + citycode;
  if (env.PAPPERS_CACHE) {
    const cached = await env.PAPPERS_CACHE.get(cacheKey);
    if (cached) return new Response(cached, { status: 200, headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json', 'X-IKCP-Cache': 'HIT' } });
  }

  let dep;
  if (citycode.startsWith('97') || citycode.startsWith('98')) dep = citycode.slice(0, 3);
  else dep = citycode.slice(0, 2);

  let csv = null, year = null;
  for (const y of ['2024', '2023']) {
    try {
      const r = await fetch('https://files.data.gouv.fr/geo-dvf/latest/csv/' + y + '/communes/' + dep + '/' + citycode + '.csv');
      if (r.ok) { csv = await r.text(); year = y; break; }
    } catch (_) {}
  }
  if (!csv) {
    const nd = JSON.stringify({ commune: nom, code: citycode, cp, year: null, no_data: true });
    return new Response(nd, { status: 200, headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json' } });
  }

  const lines = csv.split('\n');
  const head = lines[0].split(',');
  const ix = {};
  ['date_mutation', 'nature_mutation', 'valeur_fonciere', 'type_local', 'surface_reelle_bati', 'adresse_nom_voie', 'id_mutation'].forEach(k => ix[k] = head.indexOf(k));
  const muts = {};
  for (let i = 1; i < lines.length; i++) {
    if (i > 40000) break;
    const c = lines[i].split(',');
    if (c.length < head.length) continue;
    if (c[ix.nature_mutation] !== 'Vente') continue;
    const tl = c[ix.type_local];
    if (tl !== 'Maison' && tl !== 'Appartement') continue;
    const id = c[ix.id_mutation];
    (muts[id] = muts[id] || []).push({
      date: c[ix.date_mutation], type: tl,
      valeur: parseFloat(c[ix.valeur_fonciere]) || 0,
      surface: parseFloat(c[ix.surface_reelle_bati]) || 0,
      voie: (c[ix.adresse_nom_voie] || '').trim(),
    });
  }
  const maison = [], appart = [], recent = [];
  Object.keys(muts).forEach(id => {
    const rows = muts[id];
    if (rows.length !== 1) return;
    const r = rows[0];
    if (r.surface < 9 || r.valeur < 1000) return;
    const pm2 = Math.round(r.valeur / r.surface);
    if (pm2 < 200 || pm2 > 30000) return;
    (r.type === 'Maison' ? maison : appart).push(pm2);
    recent.push({ date: r.date, type: r.type, valeur: Math.round(r.valeur), surface: Math.round(r.surface), prix_m2: pm2, voie: r.voie });
  });
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
  recent.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const result = {
    commune: nom, code: citycode, cp, year,
    maison: { median_m2: median(maison), count: maison.length },
    appartement: { median_m2: median(appart), count: appart.length },
    total_ventes: maison.length + appart.length,
    recent: recent.slice(0, 6),
    source: 'DVF · data.gouv.fr',
  };
  const body = JSON.stringify(result);
  if (env.PAPPERS_CACHE) await env.PAPPERS_CACHE.put(cacheKey, body, { expirationTtl: 60 * 60 * 24 * 30 });
  return new Response(body, { status: 200, headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json', 'X-IKCP-Cache': 'MISS' } });
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, origin, allowed) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json' },
  });
}

function error(message, status, origin, allowed) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(origin, allowed), 'Content-Type': 'application/json' },
  });
}
