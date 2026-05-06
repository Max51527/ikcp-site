/**
 * IKCP Client Portal — espace client privé family office
 *
 * Auth : magic link passwordless (Resend) + JWT cookie (HS256)
 *
 * Routes :
 *   GET  /              → page login (formulaire email)
 *   POST /auth/send     → génère token, envoie email magic link, retourne 200
 *   GET  /auth/verify?token=... → vérifie + crée session + redirect /dashboard
 *   GET  /auth/logout   → supprime session + cookie + redirect /
 *   GET  /dashboard     → vue d'ensemble client (auth required)
 *   GET  /marcel        → chat Marcel persistant (auth required) [phase 2]
 *   GET  /dossiers      → liste dossiers (auth required) [phase 2]
 *
 * Bindings requis :
 *   DB              D1 database "ikcp-client-db"
 *   TOKENS          KV namespace pour magic tokens (TTL 15 min)
 *   JWT_SECRET      Secret HMAC HS256 (>=32 chars, généré aléatoirement)
 *   RESEND_API_KEY  Clé API Resend pour magic link mail
 *   RESEND_FROM     "IKCP <maxime@ikcp.eu>"
 *   APP_URL         "https://client.ikcp.eu"  (URL publique du worker)
 *   ADMIN_EMAILS    "maxime@ikcp.fr,maxime@ikcp.eu" (séparés virgule)
 */

const COOKIE_NAME = 'ikcp_session';
const SESSION_TTL_DAYS = 7;
const MAGIC_TOKEN_TTL_MIN = 15;

// ─── Utilitaires ───
function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function b64url(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return hex(buf);
}
function uuid() {
  return crypto.randomUUID();
}
function now() { return Date.now(); }

// ─── JWT HS256 ───
async function jwtSign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encSig = b64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${encSig}`;
}

async function jwtVerify(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const [encHeader, encPayload, encSig] = parts;
    const data = `${encHeader}.${encPayload}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(b64urlDecode(encSig), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecode(encPayload));
    if (payload.exp && payload.exp < now()) return null;
    return payload;
  } catch { return null; }
}

// ─── Cookie helpers ───
function parseCookies(req) {
  const out = {};
  const c = req.headers.get('Cookie') || '';
  c.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  parts.push('HttpOnly');
  parts.push('Secure');
  parts.push('SameSite=Strict');
  return parts.join('; ');
}

// ─── Auth helpers ───
async function getCurrentUser(req, env) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = await jwtVerify(token, env.JWT_SECRET);
  if (!payload || !payload.sid) return null;
  // Vérifie session existe en DB
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?')
    .bind(payload.sid).first();
  if (!session) return null;
  if (session.expires_at < now()) return null;
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id).first();
  if (!user || user.status !== 'active') return null;
  return user;
}

function requireAuth(handler) {
  return async (req, env, ctx) => {
    const user = await getCurrentUser(req, env);
    if (!user) {
      const url = new URL(req.url);
      return Response.redirect(`${env.APP_URL || url.origin}/?next=${encodeURIComponent(url.pathname)}`, 302);
    }
    return handler(req, env, ctx, user);
  };
}

async function audit(env, { user_id, email, action, detail, ip, ua }) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (user_id, email, action, detail, ip, ua, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(user_id || null, email || null, action, detail || null, ip || null, (ua || '').slice(0, 200), now()).run();
  } catch (e) { console.error('[audit]', e); }
}

// ─── Email envoi via Resend ───
async function sendMagicLinkEmail(env, email, magicUrl) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const html = renderMagicLinkEmail(magicUrl);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'IKCP <maxime@ikcp.eu>',
      to: [email],
      subject: 'Votre lien de connexion · Espace client IKCP',
      html
    })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

// ─── Routes Handlers ───

// GET / — page login
function handleLogin(req, env) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/dashboard';
  const sent = url.searchParams.get('sent') === '1';
  return new Response(renderLoginPage({ next, sent }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// POST /auth/send — envoie magic link
async function handleAuthSend(req, env, ctx) {
  if (!env.JWT_SECRET) {
    return new Response('Server not configured (JWT_SECRET missing)', { status: 500 });
  }
  let payload = {};
  try {
    const ct = req.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) payload = await req.json();
    else {
      const fd = await req.formData();
      payload = Object.fromEntries(fd.entries());
    }
  } catch { /* ignore */ }

  const email = String(payload.email || '').trim().toLowerCase();
  const next = String(payload.next || '/dashboard');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(renderLoginPage({ error: 'Email invalide.', next }), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Rate limit basique : 3 sends / email / heure (KV)
  const rlKey = `rl:send:${email}`;
  if (env.TOKENS) {
    const cur = parseInt(await env.TOKENS.get(rlKey) || '0');
    if (cur >= 3) {
      await audit(env, { email, action: 'magic_send_rate_limit', ip: req.headers.get('CF-Connecting-IP') });
      return new Response(renderLoginPage({
        error: 'Trop de demandes. Réessayez dans une heure.', next
      }), { status: 429, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    await env.TOKENS.put(rlKey, String(cur + 1), { expirationTtl: 3600 });
  }

  // Generate token (32 bytes hex)
  const tokenRaw = crypto.getRandomValues(new Uint8Array(32));
  const token = hex(tokenRaw);

  // Store token in KV with TTL 15 min — mapping token → {email, next}
  if (env.TOKENS) {
    await env.TOKENS.put(`tok:${token}`, JSON.stringify({ email, next, ts: now() }), {
      expirationTtl: MAGIC_TOKEN_TTL_MIN * 60
    });
  }

  const appUrl = env.APP_URL || new URL(req.url).origin;
  const magicUrl = `${appUrl}/auth/verify?token=${token}&next=${encodeURIComponent(next)}`;

  // Send email (in background to return fast)
  ctx.waitUntil(
    sendMagicLinkEmail(env, email, magicUrl)
      .then(() => audit(env, { email, action: 'magic_sent', ip: req.headers.get('CF-Connecting-IP'), ua: req.headers.get('User-Agent') }))
      .catch(e => {
        console.error('[send_email]', e);
        return audit(env, { email, action: 'magic_send_failed', detail: e.message });
      })
  );

  // Redirect to login with sent=1
  const u = new URL(req.url);
  return Response.redirect(`${u.origin}/?sent=1&next=${encodeURIComponent(next)}`, 302);
}

// GET /auth/verify — vérifie token, crée session, set cookie, redirect
async function handleAuthVerify(req, env) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const next = url.searchParams.get('next') || '/dashboard';
  if (!/^[a-f0-9]{32,128}$/.test(token)) {
    return new Response(renderError('Lien invalide ou expiré.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  if (!env.TOKENS) {
    return new Response('TOKENS KV not bound', { status: 500 });
  }

  const raw = await env.TOKENS.get(`tok:${token}`);
  if (!raw) {
    return new Response(renderError('Ce lien a expiré ou a déjà été utilisé.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  const data = JSON.parse(raw);
  // Burn token immediately
  await env.TOKENS.delete(`tok:${token}`);

  const email = data.email;

  // Find or create user
  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    const id = uuid();
    await env.DB.prepare(
      'INSERT INTO users (id, email, role, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email, 'client', 'active', now()).run();
    user = { id, email, role: 'client', status: 'active' };
  }

  // Create session
  const sessionId = uuid();
  const expiresAt = now() + SESSION_TTL_DAYS * 24 * 3600 * 1000;
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, ip, ua, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    sessionId, user.id, expiresAt,
    req.headers.get('CF-Connecting-IP') || null,
    (req.headers.get('User-Agent') || '').slice(0, 200),
    now()
  ).run();

  // Update last login
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now(), user.id).run();

  await audit(env, {
    user_id: user.id, email,
    action: 'login_success',
    ip: req.headers.get('CF-Connecting-IP'),
    ua: req.headers.get('User-Agent')
  });

  // Sign JWT
  const jwt = await jwtSign(
    { uid: user.id, email, sid: sessionId, exp: expiresAt },
    env.JWT_SECRET
  );

  // Set cookie + redirect
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const headers = new Headers();
  headers.append('Set-Cookie', setCookie(COOKIE_NAME, jwt, {
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
    path: '/'
  }));
  headers.set('Location', safeNext);
  return new Response(null, { status: 302, headers });
}

// GET /auth/logout — supprime session + cookie
async function handleLogout(req, env) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (token) {
    const payload = await jwtVerify(token, env.JWT_SECRET);
    if (payload && payload.sid) {
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(payload.sid).run();
      await audit(env, { user_id: payload.uid, email: payload.email, action: 'logout' });
    }
  }
  const headers = new Headers();
  headers.append('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
  headers.set('Location', '/');
  return new Response(null, { status: 302, headers });
}

// GET /dashboard
const handleDashboard = requireAuth(async (req, env, ctx, user) => {
  // Compte sessions, dossiers, dernier login
  const [{ count: sessionCount } = {}] = (await env.DB.prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND expires_at > ?'
  ).bind(user.id, now()).all()).results || [{}];

  const [{ count: dossierCount } = {}] = (await env.DB.prepare(
    'SELECT COUNT(*) as count FROM dossiers WHERE user_id = ?'
  ).bind(user.id).all()).results || [{}];

  return new Response(renderDashboard({ user, sessionCount, dossierCount }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
});

// GET /marcel — phase 2 placeholder
const handleMarcel = requireAuth(async (req, env, ctx, user) => {
  return new Response(renderComingSoon({ user, title: 'Marcel · privé', subtitle: 'Conversation persistante avec mémoire complète.' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
});

// GET /dossiers — phase 2 placeholder
const handleDossiers = requireAuth(async (req, env, ctx, user) => {
  return new Response(renderComingSoon({ user, title: 'Vos dossiers', subtitle: 'Gestion sécurisée des pièces patrimoniales.' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
});

// ─── Routing ───
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    const m = req.method;

    // Health
    if (p === '/health') {
      return Response.json({
        status: 'ok',
        service: 'ikcp-client',
        version: '0.1',
        bindings: {
          db: !!env.DB,
          tokens: !!env.TOKENS,
          jwt: !!env.JWT_SECRET,
          resend: !!env.RESEND_API_KEY
        }
      });
    }

    // Static (favicon etc.)
    if (p === '/favicon.ico') return new Response(null, { status: 204 });

    // Routes
    if (p === '/' && m === 'GET') return handleLogin(req, env);
    if (p === '/auth/send' && m === 'POST') return handleAuthSend(req, env, ctx);
    if (p === '/auth/verify' && m === 'GET') return handleAuthVerify(req, env);
    if (p === '/auth/logout') return handleLogout(req, env);
    if (p === '/dashboard' && m === 'GET') return handleDashboard(req, env, ctx);
    if (p === '/marcel' && m === 'GET') return handleMarcel(req, env, ctx);
    if (p === '/dossiers' && m === 'GET') return handleDossiers(req, env, ctx);

    return new Response('Not found', { status: 404 });
  }
};

// ════════════════════════════════════════════════════════════
// HTML TEMPLATES — pages servies en SSR
// ════════════════════════════════════════════════════════════

const SHARED_HEAD = `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
:root {
  --bg:#0c0f0d; --bg-2:#0a0d0b;
  --ink:#f4ece1; --ink-mute:#9a9388; --ink-faint:#5e5851;
  --gold:#c4a273; --gold-bright:#e3c08c;
  --line:rgba(196,162,115,0.16); --line-faint:rgba(196,162,115,0.06);
  --err:#dc2626; --ok:#16a34a;
}
html,body { background:var(--bg); color:var(--ink); font-family:'Inter',sans-serif; min-height:100vh; line-height:1.55; -webkit-font-smoothing:antialiased; }
a { color:var(--gold); text-decoration:none; }
a:hover { color:var(--gold-bright); }
nav.top { position:fixed; top:0; left:0; right:0; z-index:50; padding:20px 40px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(to bottom, rgba(12,15,13,0.92), rgba(12,15,13,0)); backdrop-filter:blur(8px); }
.brand { font-family:'Playfair Display',serif; font-size:22px; font-weight:500; letter-spacing:0.06em; }
.brand b { color:var(--gold); font-weight:500; }
.brand-sub { display:block; font-size:9px; letter-spacing:0.32em; color:var(--ink-faint); text-transform:uppercase; margin-top:3px; }
.btn { display:inline-flex; align-items:center; justify-content:center; padding:14px 28px; background:var(--gold); color:var(--bg); font-size:12px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; border-radius:1px; border:1px solid var(--gold); cursor:pointer; transition:all 0.3s; }
.btn:hover { background:transparent; color:var(--gold); }
.btn-ghost { background:transparent; color:var(--ink-mute); border:1px solid var(--line); }
.btn-ghost:hover { color:var(--gold); border-color:var(--gold); background:transparent; }
.input { width:100%; padding:14px 16px; background:transparent; border:1px solid var(--line); color:var(--ink); font-family:inherit; font-size:14px; border-radius:1px; transition:border 0.25s; }
.input:focus { outline:none; border-color:var(--gold); }
.label { display:block; font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--ink-faint); margin-bottom:8px; }
.card { background:var(--bg-2); border:1px solid var(--line); padding:32px; border-radius:1px; }
.muted { color:var(--ink-mute); font-size:13.5px; line-height:1.65; font-weight:300; }
em.gold { color:var(--gold); font-style:italic; font-family:'Playfair Display',serif; font-weight:400; }
</style>
`;

function renderLoginPage({ error, sent, next } = {}) {
  return `<!DOCTYPE html><html lang="fr"><head>
${SHARED_HEAD}
<title>Espace client · IKCP</title>
<style>
section.auth { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:80px 24px; }
.auth-box { width:100%; max-width:440px; }
.auth-kicker { font-size:10.5px; letter-spacing:0.4em; text-transform:uppercase; color:var(--gold); margin-bottom:20px; text-align:center; }
.auth-h1 { font-family:'Playfair Display',serif; font-weight:400; font-size:42px; line-height:1.1; letter-spacing:-0.02em; margin-bottom:16px; text-align:center; }
.auth-h1 em { font-style:italic; color:var(--gold); }
.auth-sub { color:var(--ink-mute); font-size:14.5px; line-height:1.6; text-align:center; margin-bottom:38px; font-weight:300; }
form { display:flex; flex-direction:column; gap:14px; }
.alert { padding:12px 16px; border-radius:1px; font-size:13px; line-height:1.55; }
.alert-error { background:rgba(220,38,38,0.08); color:#fca5a5; border:1px solid rgba(220,38,38,0.3); }
.alert-success { background:rgba(22,163,74,0.08); color:#86efac; border:1px solid rgba(22,163,74,0.3); }
.note { font-size:11.5px; color:var(--ink-faint); text-align:center; margin-top:24px; font-style:italic; font-family:'Playfair Display',serif; }
</style>
</head>
<body>
<nav class="top">
  <div>
    <div class="brand">IKCP<b>.</b></div>
    <div class="brand-sub">Espace client</div>
  </div>
  <a href="https://ikcp.eu" class="muted" style="font-size:12px;">← ikcp.eu</a>
</nav>

<section class="auth">
  <div class="auth-box">
    <div class="auth-kicker">— Accès privé —</div>
    <h1 class="auth-h1">Bienvenue<br><em>dans votre espace.</em></h1>
    <p class="auth-sub">Saisissez votre email. Un lien de connexion sécurisé vous sera envoyé.</p>

    ${error ? `<div class="alert alert-error" role="alert">⚠ ${esc(error)}</div>` : ''}
    ${sent ? `<div class="alert alert-success" role="status">✓ Si cet email correspond à un compte, un lien vous a été envoyé. Vérifiez votre boîte (et les spams).</div>` : ''}

    ${!sent ? `
    <form method="POST" action="/auth/send" autocomplete="on" style="margin-top:18px;">
      <input type="hidden" name="next" value="${esc(next || '/dashboard')}">
      <div>
        <label for="email" class="label">Votre email</label>
        <input class="input" type="email" name="email" id="email" required autofocus inputmode="email" autocomplete="email" placeholder="vous@exemple.fr">
      </div>
      <button type="submit" class="btn">Recevoir le lien de connexion</button>
    </form>
    ` : `
    <a href="/" class="btn btn-ghost" style="margin-top:18px; width:100%; padding:14px;">Renvoyer un lien</a>
    `}

    <p class="note">Connexion sans mot de passe. Lien valable 15 minutes.</p>
  </div>
</section>
</body></html>`;
}

function renderDashboard({ user, sessionCount, dossierCount }) {
  const firstName = user.first_name || user.email.split('@')[0];
  return `<!DOCTYPE html><html lang="fr"><head>
${SHARED_HEAD}
<title>Tableau de bord · IKCP Espace client</title>
<style>
nav.top a.menu-item { color:var(--ink-mute); font-size:13px; margin-left:24px; transition:color 0.25s; }
nav.top a.menu-item:hover { color:var(--gold); }
section.dash { padding:120px 40px 80px; max-width:1200px; margin:0 auto; }
.welcome { margin-bottom:48px; padding-bottom:32px; border-bottom:1px solid var(--line); }
.welcome-kicker { font-size:10.5px; letter-spacing:0.36em; text-transform:uppercase; color:var(--gold); margin-bottom:14px; }
.welcome-h1 { font-family:'Playfair Display',serif; font-weight:400; font-size:48px; line-height:1.05; letter-spacing:-0.02em; margin-bottom:14px; }
.welcome-h1 em { font-style:italic; color:var(--gold); }
.welcome-sub { color:var(--ink-mute); font-size:15px; line-height:1.6; max-width:540px; font-weight:300; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:24px; margin-bottom:60px; }
.tile { padding:32px; border:1px solid var(--line); position:relative; transition:all 0.3s; background:var(--bg-2); cursor:default; }
.tile:hover { border-color:var(--gold); }
.tile-num { font-family:'Playfair Display',serif; font-size:38px; font-weight:400; color:var(--gold); line-height:1; margin-bottom:6px; }
.tile-num em { font-style:italic; }
.tile-label { font-size:10.5px; letter-spacing:0.24em; text-transform:uppercase; color:var(--ink-faint); }
.tile-desc { font-size:12.5px; color:var(--ink-mute); margin-top:14px; line-height:1.55; }
.actions-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; margin-top:32px; }
.action { padding:24px; border:1px solid var(--line); display:flex; align-items:center; gap:18px; transition:all 0.3s; background:var(--bg-2); text-decoration:none; }
.action:hover { border-color:var(--gold); background:rgba(196,162,115,0.04); }
.action-icon { font-size:24px; }
.action-text { color:var(--ink); font-weight:500; font-size:14px; letter-spacing:0.02em; }
.action-sub { font-size:11.5px; color:var(--ink-faint); margin-top:3px; font-weight:300; }
.action-arrow { margin-left:auto; color:var(--gold); }
.foot { margin-top:60px; padding-top:32px; border-top:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; font-size:11.5px; color:var(--ink-faint); }
</style>
</head>
<body>
<nav class="top">
  <div>
    <div class="brand">IKCP<b>.</b></div>
    <div class="brand-sub">Espace client</div>
  </div>
  <div>
    <a href="/dashboard" class="menu-item">Tableau de bord</a>
    <a href="/marcel" class="menu-item">Marcel</a>
    <a href="/dossiers" class="menu-item">Dossiers</a>
    <a href="/auth/logout" class="menu-item">Déconnexion</a>
  </div>
</nav>

<section class="dash">

  <div class="welcome">
    <div class="welcome-kicker">— Bienvenue —</div>
    <h1 class="welcome-h1">Bonjour <em>${esc(firstName)}</em>.</h1>
    <p class="welcome-sub">Votre espace privé centralise les conversations Marcel, vos dossiers patrimoniaux et vos rapports trimestriels.</p>
  </div>

  <div class="grid">
    <div class="tile">
      <div class="tile-num">${dossierCount || 0}</div>
      <div class="tile-label">Dossiers ouverts</div>
      <div class="tile-desc">Patrimoine, succession, transmission, fiscalité.</div>
    </div>
    <div class="tile">
      <div class="tile-num"><em>0</em></div>
      <div class="tile-label">Rapports trimestriels</div>
      <div class="tile-desc">Synthèse régulière de votre situation.</div>
    </div>
    <div class="tile">
      <div class="tile-num">${sessionCount || 1}</div>
      <div class="tile-label">Sessions actives</div>
      <div class="tile-desc">Connexions valides actuellement.</div>
    </div>
  </div>

  <div>
    <div class="welcome-kicker" style="margin-bottom:18px;">— Accès rapides —</div>
    <div class="actions-row">
      <a href="/marcel" class="action">
        <span class="action-icon">💬</span>
        <span><span class="action-text">Marcel privé</span><br><span class="action-sub">Conversation avec mémoire</span></span>
        <span class="action-arrow">→</span>
      </a>
      <a href="/dossiers" class="action">
        <span class="action-icon">📁</span>
        <span><span class="action-text">Mes dossiers</span><br><span class="action-sub">Pièces et notes patrimoniales</span></span>
        <span class="action-arrow">→</span>
      </a>
      <a href="mailto:maxime@ikcp.fr?subject=Demande%20depuis%20espace%20client" class="action">
        <span class="action-icon">✉️</span>
        <span><span class="action-text">Écrire à Maxime</span><br><span class="action-sub">Réponse sous 24h</span></span>
        <span class="action-arrow">→</span>
      </a>
    </div>
  </div>

  <div class="foot">
    <div>Connecté en tant que <strong style="color:var(--ink);">${esc(user.email)}</strong></div>
    <div>IKCP · ORIAS 23001568 · CIF — CNCEF Patrimoine</div>
  </div>

</section>
</body></html>`;
}

function renderComingSoon({ user, title, subtitle }) {
  return `<!DOCTYPE html><html lang="fr"><head>${SHARED_HEAD}<title>${esc(title)} · IKCP</title>
<style>
section.cs { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:120px 24px 60px; text-align:center; }
.cs-h1 { font-family:'Playfair Display',serif; font-size:48px; font-weight:400; line-height:1.1; letter-spacing:-0.02em; margin-bottom:14px; }
.cs-h1 em { font-style:italic; color:var(--gold); }
.cs-sub { color:var(--ink-mute); font-size:15px; max-width:480px; margin-bottom:36px; }
.cs-tag { font-size:10px; letter-spacing:0.32em; text-transform:uppercase; color:var(--gold); margin-bottom:20px; }
</style></head>
<body>
<nav class="top">
  <div><div class="brand">IKCP<b>.</b></div><div class="brand-sub">Espace client</div></div>
  <div><a href="/dashboard" style="color:var(--ink-mute); font-size:13px;">← Tableau de bord</a></div>
</nav>
<section class="cs">
  <div class="cs-tag">Prochainement</div>
  <h1 class="cs-h1"><em>${esc(title)}</em></h1>
  <p class="cs-sub">${esc(subtitle)}</p>
  <a href="/dashboard" class="btn btn-ghost">Retour au tableau de bord</a>
</section>
</body></html>`;
}

function renderError(msg) {
  return `<!DOCTYPE html><html lang="fr"><head>${SHARED_HEAD}<title>Erreur · IKCP</title>
<style>section.err { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 24px; text-align:center; }
.err-h1 { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; margin-bottom:16px; }
.err-msg { color:var(--ink-mute); font-size:14.5px; margin-bottom:28px; max-width:440px; }</style></head>
<body>
<nav class="top"><div><div class="brand">IKCP<b>.</b></div><div class="brand-sub">Espace client</div></div></nav>
<section class="err">
  <h1 class="err-h1">Lien invalide</h1>
  <p class="err-msg">${esc(msg)}</p>
  <a href="/" class="btn">Retour à l'accueil</a>
</section>
</body></html>`;
}

function renderMagicLinkEmail(magicUrl) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="background:#f9f6f0; font-family:Georgia,serif; margin:0; padding:0;">
<div style="max-width:560px; margin:32px auto; background:#1f1a16; padding:28px; text-align:center; border-radius:16px 16px 0 0;">
  <div style="color:#c4a273; font-size:26px; font-weight:bold; letter-spacing:3px; font-family:'Playfair Display',serif;">IKCP.</div>
  <div style="color:rgba(255,255,255,0.4); font-size:9px; letter-spacing:2px; margin-top:4px;">ESPACE CLIENT · ACCÈS SÉCURISÉ</div>
</div>
<div style="max-width:560px; margin:0 auto; background:#fff; padding:36px 32px; border:1px solid #e5ded2; border-top:none;">
  <p style="font-size:16px; color:#1f1a16; margin:0 0 14px;">Bonjour,</p>
  <p style="font-size:14.5px; line-height:1.65; color:#6d5c4a; margin:0 0 26px;">
    Voici votre <strong>lien de connexion sécurisé</strong> vers votre espace client IKCP.
    Il est valable <strong>15 minutes</strong> et ne peut être utilisé qu'une seule fois.
  </p>
  <div style="text-align:center; margin:28px 0;">
    <a href="${magicUrl}" style="display:inline-block; background:#1f1a16; color:#fff; padding:16px 36px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; letter-spacing:0.04em;">
      Se connecter à mon espace →
    </a>
  </div>
  <p style="font-size:12px; color:#9e9080; margin:24px 0 8px; word-break:break-all;">
    Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
  </p>
  <p style="font-size:11px; color:#b8956e; margin:0; word-break:break-all; font-family:Consolas,monospace; line-height:1.4;">
    ${magicUrl}
  </p>
  <p style="font-size:11px; color:#9e9080; font-style:italic; margin:36px 0 0; padding-top:18px; border-top:1px dashed #e5ded2;">
    Vous n'avez pas demandé ce lien ? Ignorez simplement cet email — aucun compte ne sera créé sans votre validation.
  </p>
</div>
<div style="max-width:560px; margin:0 auto; padding:18px 32px; text-align:center; border:1px solid #e5ded2; border-top:none; border-radius:0 0 16px 16px; background:#fafafa;">
  <p style="font-size:10px; color:#9e9080; margin:0;">IKCP · SIREN 947 972 436 · ORIAS 23001568</p>
</div>
</body></html>`;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
