/* ══════════════════════════════════════════════════════════════
 * IKCP — OAuth proxy GitHub pour Sveltia/Decap CMS (admin/)
 *
 * Permet l'authentification GitHub du CMS sans Netlify (100 % Cloudflare).
 *
 * SECRETS REQUIS (wrangler secret put) :
 *   GITHUB_CLIENT_ID      — depuis la GitHub OAuth App
 *   GITHUB_CLIENT_SECRET  — depuis la GitHub OAuth App
 *
 * GitHub OAuth App (github.com/settings/developers → New OAuth App) :
 *   Application name        : IKCP CMS
 *   Homepage URL            : https://ikcp.eu
 *   Authorization callback  : https://ikcp-cms-auth.maxime-ead.workers.dev/callback
 * ══════════════════════════════════════════════════════════════ */

function htmlResponse(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // 1. Démarrage du flux OAuth
    if (pathname === '/auth') {
      if (!env.GITHUB_CLIENT_ID) return new Response('GITHUB_CLIENT_ID manquant', { status: 500 });
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
      authUrl.searchParams.set('scope', 'repo,user');
      authUrl.searchParams.set('state', crypto.randomUUID());
      return Response.redirect(authUrl.href, 302);
    }

    // 2. Retour de GitHub → échange code ↔ token → renvoi au CMS via postMessage
    if (pathname === '/callback') {
      const code = searchParams.get('code');
      if (!code) return htmlResponse('<p>Code OAuth manquant.</p>');

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'ikcp-cms-auth' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await tokenRes.json().catch(() => ({}));
      const token = data.access_token;
      const status = token ? 'success' : 'error';
      const content = token ? { token, provider: 'github' } : { error: data.error || 'no_token' };

      return htmlResponse(
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
        '<script>(function(){' +
        'function send(){if(window.opener){window.opener.postMessage(' +
        "'authorization:github:" + status + ":' + JSON.stringify(" + JSON.stringify(content) + ")" +
        ",\"*\");}}' +
        'window.addEventListener("message",send,false);send();' +
        'setTimeout(function(){window.close();},1000);' +
        '})();</script>' +
        '<p>Connexion ' + (status === 'success' ? 'réussie' : 'échouée') + ' — vous pouvez fermer cette fenêtre.</p>' +
        '</body></html>'
      );
    }

    // Health / racine
    return Response.json({ status: 'ok', service: 'ikcp-cms-auth', configured: { client_id: !!env.GITHUB_CLIENT_ID, client_secret: !!env.GITHUB_CLIENT_SECRET } });
  },
};
