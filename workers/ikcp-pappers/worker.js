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
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'null', // file:// (test local)
];

const PAPPERS_BASE = 'https://api.pappers.fr/v2';
const CACHE_TTL_SECONDS = 3600; // 1 heure

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) || origin === '';

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
