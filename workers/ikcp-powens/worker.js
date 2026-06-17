/**
 * ikcp-powens — Agrégation bancaire DSP2 (Powens / moteur « biapi ») · SOUVERAIN FR
 * ─────────────────────────────────────────────────────────────────────────────
 * RÔLE (en une phrase) : permettre à un membre de connecter sa banque, récupérer
 * un jeton d'accès, le ranger en base (D1 Paris), et exposer ses comptes au cockpit.
 *
 * POURQUOI un worker séparé ? Parce que la connexion bancaire manipule des SECRETS
 * (client_id / client_secret Powens) et des jetons utilisateurs. Ça ne doit JAMAIS
 * vivre dans une page (le navigateur du client verrait les secrets). Un worker =
 * du code qui tourne côté serveur, chez Cloudflare, où les secrets restent cachés.
 *
 * LE FLUX DSP2 EN 4 TEMPS :
 *   1. /connect  → on crée un utilisateur Powens temporaire + un code court, et on
 *                  renvoie l'URL de la « Webview » (l'écran Powens où le client
 *                  choisit sa banque et donne son consentement — SCA obligatoire).
 *   2. Le client se connecte à sa banque DANS la Webview (on ne voit jamais ses
 *                  identifiants bancaires : c'est Powens, agréé, qui les gère).
 *   3. /callback → Powens nous renvoie un « code ». On l'échange (avec nos secrets)
 *                  contre un access_token PERMANENT, qu'on range en D1 (Paris).
 *   4. /accounts → avec ce jeton, on lit les comptes/soldes et on les montre.
 *
 * SÉCURITÉ (règles IKCP) :
 *   - client_id / client_secret = SECRETS Cloudflare, jamais dans ce fichier.
 *   - access_token rangé en D1 Paris (chiffrement applicatif = TODO renfort).
 *   - Aucune donnée bancaire ne quitte la France (Powens FR + D1 Paris).
 *
 * ⚠️ Les chemins d'API ci-dessous (/auth/init, /auth/token/code, /auth/token/access,
 *    /users/me/accounts) suivent le standard biapi mais sont À CONFIRMER dans la doc
 *    de TON sandbox. La STRUCTURE est bonne ; on ajustera les chemins au test.
 */

const ALLOWED = [
  'https://ikcp.eu', 'https://www.ikcp.eu', 'https://app.ikcp.eu',
  'https://ikcp-eu.pages.dev', 'http://localhost:5500', 'http://127.0.0.1:5500',
];
function cors(o) {
  const ok = ALLOWED.includes(o) || (o && (o.endsWith('.ikcp.eu') || o.endsWith('.workers.dev') || o.endsWith('.pages.dev')));
  return {
    'Access-Control-Allow-Origin': ok ? o : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}
function json(d, s = 200, o = '') {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(o) } });
}
// L'URL de base de TON API Powens, construite depuis le nom de ton « domain ».
function base(env) { return `https://${env.POWENS_DOMAIN}.biapi.pro/2.0`; }
// Tant que les 3 réglages ne sont pas posés, le worker répond proprement (pas de plantage).
function configured(env) { return !!(env.POWENS_DOMAIN && env.POWENS_CLIENT_ID && env.POWENS_CLIENT_SECRET); }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const o = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(o) });

    // ── /health : un simple « es-tu là et configuré ? » (sans rien révéler) ──
    if (url.pathname === '/health') {
      return json({ status: 'ok', service: 'ikcp-powens', configured: configured(env), domain: env.POWENS_DOMAIN ? 'set' : 'absent', region: 'EU/FR (à confirmer côté Powens)' }, 200, o);
    }

    // Garde-fou : sans secrets, on n'appelle rien et on explique quoi faire.
    if (!configured(env)) {
      return json({ error: 'powens_not_configured', hint: 'Pose POWENS_DOMAIN (var) + POWENS_CLIENT_ID & POWENS_CLIENT_SECRET (secrets) sur le worker.' }, 503, o);
    }

    // ── 1) /connect : prépare la connexion bancaire, renvoie l'URL de la Webview ──
    if (url.pathname === '/connect' && req.method === 'POST') {
      const memberId = url.searchParams.get('user') || 'anon'; // qui connecte sa banque ?
      try {
        // a. créer un utilisateur Powens anonyme → on récupère un auth_token
        const init = await fetch(base(env) + '/auth/init', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: env.POWENS_CLIENT_ID, client_secret: env.POWENS_CLIENT_SECRET }),
        });
        if (!init.ok) return json({ error: 'powens_init', status: init.status, detail: (await init.text()).slice(0, 200) }, 502, o);
        const ini = await init.json();
        // b. transformer l'auth_token en « code » court (valable pour la Webview)
        const cr = await fetch(base(env) + '/auth/token/code', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ini.auth_token },
          body: JSON.stringify({}),
        });
        const code = cr.ok ? (await cr.json()).code : '';
        // c. construire l'URL de la Webview Powens Connect
        const redirect = env.POWENS_REDIRECT_URI || 'https://ikcp-powens.maxime-ead.workers.dev/callback';
        const webview = (env.POWENS_WEBVIEW || 'https://webview.powens.com') + '/fr/connect'
          + '?client_id=' + encodeURIComponent(env.POWENS_CLIENT_ID)
          + '&redirect_uri=' + encodeURIComponent(redirect)
          + '&code=' + encodeURIComponent(code)
          + '&state=' + encodeURIComponent(memberId); // pour savoir QUI revient
        return json({ webview_url: webview, id_user: ini.id_user || null }, 200, o);
      } catch (e) { return json({ error: e.message }, 502, o); }
    }

    // ── 2) /callback : Powens nous renvoie ici après la connexion bancaire ──
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const memberId = url.searchParams.get('state') || 'anon';
      if (!code) return json({ error: 'missing_code' }, 400, o);
      try {
        // échanger le code (avec nos secrets) contre un access_token PERMANENT
        const ex = await fetch(base(env) + '/auth/token/access', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: env.POWENS_CLIENT_ID, client_secret: env.POWENS_CLIENT_SECRET, code }),
        });
        if (!ex.ok) return json({ error: 'powens_exchange', status: ex.status, detail: (await ex.text()).slice(0, 200) }, 502, o);
        const tok = await ex.json();
        // ranger le jeton en D1 Paris (TODO : chiffrement applicatif avant prod)
        if (env.POWENS_DB) {
          try {
            await env.POWENS_DB.prepare('INSERT OR REPLACE INTO powens_tokens (member_id, access_token, id_user, created_at) VALUES (?,?,?,?)')
              .bind(memberId, tok.access_token, tok.id_user || null, new Date().toISOString()).run();
          } catch (_) {}
        }
        // renvoyer le membre vers son cockpit, comptes connectés
        return Response.redirect('https://ikcp.eu/app/cockpit?powens=ok', 302);
      } catch (e) { return json({ error: e.message }, 502, o); }
    }

    // ── 3) /accounts : lire les comptes/soldes du membre (via le jeton rangé) ──
    if (url.pathname === '/accounts') {
      const memberId = url.searchParams.get('user') || 'anon';
      if (!env.POWENS_DB) return json({ error: 'no_db', hint: 'Crée la D1 ikcp-powens-db et bind POWENS_DB.' }, 500, o);
      const row = await env.POWENS_DB.prepare('SELECT access_token FROM powens_tokens WHERE member_id=?').bind(memberId).first();
      if (!row) return json({ connected: false, accounts: [] }, 200, o);
      const r = await fetch(base(env) + '/users/me/accounts', { headers: { 'Authorization': 'Bearer ' + row.access_token } });
      if (!r.ok) return json({ error: 'powens_accounts', status: r.status }, 502, o);
      const d = await r.json();
      return json({ connected: true, accounts: d.accounts || d }, 200, o);
    }

    return json({ error: 'not_found', path: url.pathname }, 404, o);
  },
};
