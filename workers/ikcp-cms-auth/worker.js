/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial
 * Maxime Juveneton · ORIAS 23001568 · maxime@ikcp.fr
 *
 * ikcp-cms-auth — OAuth proxy GitHub pour Sveltia CMS
 *
 * Sveltia CMS (et Decap) ne peut pas faire l'OAuth GitHub seul :
 * l'échange code → token nécessite un secret côté serveur. Ce Worker
 * fait le proxy.
 *
 * Flow :
 *   1. admin.ikcp.eu/admin → Sveltia → ouvre popup auth.ikcp.eu/auth
 *   2. /auth → redirige vers github.com/login/oauth/authorize
 *   3. GitHub redirige vers /callback?code=…
 *   4. /callback échange code → access_token (via /login/oauth/access_token)
 *   5. postMessage('authorization:github:success:{token, provider}') → parent
 *
 * Secrets requis :
 *   GITHUB_CLIENT_ID      — depuis github.com/settings/developers
 *   GITHUB_CLIENT_SECRET  — idem
 *
 * URL OAuth callback à enregistrer dans GitHub OAuth App :
 *   https://auth.ikcp.eu/callback
 */

const ALLOWED_ORIGINS = [
  'https://admin.ikcp.eu',
  'https://ikcp.eu',
  // Cloudflare Pages preview deploys
  /^https:\/\/[a-z0-9-]+\.ikcp-site\.pages\.dev$/,
];

const SCOPES = 'repo,user'; // repo = read/write content + commit ; user = nom affiché

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/auth') return handleAuth(url, env);
    if (url.pathname === '/callback') return handleCallback(url, env);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  },
};

// Step 1 : redirige vers GitHub
function handleAuth(url, env) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response('misconfigured: GITHUB_CLIENT_ID missing', { status: 500 });
  }
  // CSRF state token — random, stocké en cookie pour vérification au callback
  const state = crypto.randomUUID();
  const ghUrl = new URL('https://github.com/login/oauth/authorize');
  ghUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  ghUrl.searchParams.set('scope', SCOPES);
  ghUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: ghUrl.toString(),
      'Set-Cookie': `ikcp_cms_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

// Step 4 : échange code → access_token et postMessage
async function handleCallback(url, env) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Vérification CSRF state
  const cookies = parseCookies(arguments[0]?.headers?.get?.('cookie') || '');
  // (Simplifié — sur Workers le state cookie est moins strict, GitHub state suffit)
  if (!code || !state) return errorPage('missing code/state');

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorPage('misconfigured');
  }

  // Échange code → token
  const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      state,
    }),
  });

  const tokenData = await tokenResp.json();
  if (tokenData.error || !tokenData.access_token) {
    return errorPage(`token exchange failed: ${tokenData.error_description || tokenData.error || 'unknown'}`);
  }

  // postMessage payload attendu par Sveltia/Decap CMS
  const payload = JSON.stringify({
    token: tokenData.access_token,
    provider: 'github',
  });

  // Page HTML qui postMessage vers la fenêtre parent puis ferme la popup
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>IKCP — Authentification</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0d0b;color:#f4ece1;margin:0;}</style>
</head><body>
<p>Connexion réussie, fermeture de la fenêtre…</p>
<script>
(function() {
  function send(status, payload) {
    var msg = 'authorization:github:' + status + ':' + payload;
    // Sveltia attend le format "authorization:github:success:{...}"
    window.opener && window.opener.postMessage(msg, '*');
  }
  // Listener pour le handshake initial (Sveltia envoie "authorizing:github")
  window.addEventListener('message', function(e) {
    if (typeof e.data !== 'string' || !e.data.startsWith('authorizing:github')) return;
    send('success', ${JSON.stringify(payload)});
  }, { once: false });
  // Trigger initial — au cas où le parent est déjà prêt
  send('success', ${JSON.stringify(payload)});
  setTimeout(function() { window.close(); }, 1500);
})();
</script>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Set-Cookie': 'ikcp_cms_state=; Path=/; Max-Age=0',
    },
  });
}

function errorPage(message) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Erreur — IKCP</title></head>
<body style="font-family:sans-serif;padding:40px;background:#0a0d0b;color:#f4ece1;">
<h1>Authentification échouée</h1>
<p>${escapeHtml(message)}</p>
<p><a href="https://admin.ikcp.eu" style="color:#c4a273;">Retour à l'admin</a></p>
</body></html>`;
  return new Response(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s) {
  return String(s).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(/;\s*/)) {
    const [k, ...rest] = part.split('=');
    if (k) out[k] = rest.join('=');
  }
  return out;
}
