/**
 * Module BrickLink — Lego (100% gratuit, API publique)
 *
 * Endpoint utilise : https://www.bricklink.com/v3/api.page (OAuth 1.0a)
 * Pour MVP gratuit sans OAuth : on utilise le price guide JSON public via :
 *   https://www.bricklink.com/catalogPriceGuide.asp?S=<setId>
 * Mais c'est du HTML. Plus simple : utiliser l'API Brickset (gratuite avec cle).
 *
 * Stratégie MVP : utiliser Rebrickable.com API publique (gratuite, no OAuth).
 * URL : https://rebrickable.com/api/v3/lego/sets/<setNum>/
 * Header : Authorization: key <REBRICKABLE_API_KEY> (1 req/sec, illimite mensuel)
 *
 * On retourne : { name, year, parts, official_price (USD), market_value_estimate }
 * Pour la valeur marche estimée : on cumule des sources tierces (BrickEconomy, BrickInsights).
 * En MVP : on retourne juste les infos officielles + invitation a configurer Brickset/BrickEconomy.
 */

export const MODULE_INFO = {
  id: 'bricklink',
  name: 'BrickLink / Rebrickable',
  category: 'lego',
  source_country: 'US',
  rgpd_safe: true,
  free_tier: 'illimite (1 req/sec)',
};

/**
 * Recherche par set ID Lego (ex : '10497-1' UCS Galaxy Explorer).
 * Retourne null si non trouvé, objet enrichi sinon.
 */
export async function lookupSet(setId, env) {
  // Sans clé API : on retourne stub structuré.
  // Avec clé REBRICKABLE_API_KEY configurée : appel réel.
  if (!env.REBRICKABLE_API_KEY) {
    return {
      _stub: true,
      message: 'REBRICKABLE_API_KEY non configurée. Ajouter via : wrangler secret put REBRICKABLE_API_KEY (clé gratuite : https://rebrickable.com/api/)',
      set_id: setId,
    };
  }

  try {
    const r = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(setId)}/`, {
      headers: {
        'Authorization': `key ${env.REBRICKABLE_API_KEY}`,
        'Accept': 'application/json',
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Rebrickable HTTP ${r.status}`);
    const data = await r.json();
    return {
      set_id: data.set_num,
      name: data.name,
      year: data.year,
      parts: data.num_parts,
      theme_id: data.theme_id,
      image_url: data.set_img_url,
      official_url: data.set_url,
      _source: 'rebrickable.com',
    };
  } catch (e) {
    return { _error: e.message, set_id: setId };
  }
}

/**
 * Recherche par mot-cle (ex: 'Millennium Falcon UCS').
 * Retourne liste de candidats.
 */
export async function searchSets(query, env) {
  if (!env.REBRICKABLE_API_KEY) {
    return { _stub: true, message: 'REBRICKABLE_API_KEY non configurée.' };
  }
  try {
    const r = await fetch(`https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(query)}&page_size=10&ordering=-year`, {
      headers: { 'Authorization': `key ${env.REBRICKABLE_API_KEY}`, 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return {
      query,
      count: data.count,
      results: (data.results || []).map(s => ({
        set_id: s.set_num,
        name: s.name,
        year: s.year,
        parts: s.num_parts,
        image_url: s.set_img_url,
      })),
    };
  } catch (e) {
    return { _error: e.message, query };
  }
}

/**
 * Cron handler : scanne les watches Lego et detecte les nouvelles sorties / changements.
 * Pour MVP : juste rafraichir les infos officielles.
 */
export async function dailyScan(env, db, watches) {
  const results = [];
  for (const w of watches) {
    try {
      const info = await lookupSet(w.query, env);
      results.push({ watch_id: w.id, info, fetched_at: new Date().toISOString() });
      // Rate limit Rebrickable : 1 req/sec
      await new Promise(r => setTimeout(r, 1100));
    } catch (e) {
      results.push({ watch_id: w.id, error: e.message });
    }
  }
  return results;
}
