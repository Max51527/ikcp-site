/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4 · reproduction interdite
 *
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

// POST /auth/beta-redeem — valider un code beta et déclencher l'onboarding
//
// Body : { code: "BETA-FAMI-XXXX-YYYY", email?: "..." }
// Réponse :
//   { valid: true, redirect_url: "/auth/send?next=/dashboard" } si OK
//   { valid: false, reason: "code inconnu / expiré / déjà utilisé" } sinon
//
// Si email fourni : déclenche directement l'envoi du magic link
// vers l'email avec un flag beta_member=true sur le user créé.
//
// Ne révèle rien de sensible côté erreur (anti-énumération).
async function handleBetaRedeem(req, env) {
  if (!env.DB) {
    return Response.json({ valid: false, reason: 'beta_unavailable' }, { status: 503, headers: corsBetaHeaders(req) });
  }
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ valid: false, reason: 'invalid_json' }, { status: 400, headers: corsBetaHeaders(req) }); }

  const code = String(body.code || '').toUpperCase().trim();
  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  if (!/^[A-Z0-9-]{8,32}$/.test(code)) {
    return Response.json({ valid: false, reason: 'invalid_format' }, { status: 400, headers: corsBetaHeaders(req) });
  }

  // Lookup
  let row;
  try {
    row = await env.DB.prepare('SELECT * FROM beta_codes WHERE code = ?').bind(code).first();
  } catch (e) {
    // Table peut-être pas encore créée
    return Response.json({ valid: false, reason: 'beta_not_initialized' }, { status: 503, headers: corsBetaHeaders(req) });
  }
  if (!row) {
    audit(env, { action: 'beta_redeem_unknown', detail: code.slice(0, 12), ip: req.headers.get('CF-Connecting-IP') });
    return Response.json({ valid: false, reason: 'unknown_or_expired' }, { headers: corsBetaHeaders(req) });
  }

  if (row.expires_at && row.expires_at < now()) {
    audit(env, { action: 'beta_redeem_expired', detail: code, ip: req.headers.get('CF-Connecting-IP') });
    return Response.json({ valid: false, reason: 'expired' }, { headers: corsBetaHeaders(req) });
  }
  if ((row.used_count || 0) >= (row.max_uses || 1)) {
    audit(env, { action: 'beta_redeem_exhausted', detail: code, ip: req.headers.get('CF-Connecting-IP') });
    return Response.json({ valid: false, reason: 'already_used' }, { headers: corsBetaHeaders(req) });
  }

  // Code valide → marquer comme utilisé (atomique grâce au check used_count < max_uses)
  await env.DB.prepare(
    'UPDATE beta_codes SET used_count = used_count + 1, redeemed_at = ?, used_by_email = COALESCE(used_by_email, ?) WHERE code = ? AND used_count < max_uses'
  ).bind(now(), email, code).run();

  audit(env, { email, action: 'beta_redeem_success', detail: code, ip: req.headers.get('CF-Connecting-IP') });

  // Si email fourni, on génère un magic link beta direct (raccourci onboarding)
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    // On délègue à handleAuthSend en simulant la requête (réutilise la logique anti-rate-limit)
    const fakeReq = new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, next: '/dashboard?beta=1' }),
    });
    // On ne propage pas la réponse — on laisse l'envoi mail asynchrone
    handleAuthSend(fakeReq, env, {}).catch(e => console.error('[beta] auth-send fail', e));
    return Response.json({
      valid: true,
      magic_sent: true,
      redirect_url: null,
      message: 'Vérifiez votre boîte mail — votre lien de connexion est en route.',
    }, { headers: corsBetaHeaders(req) });
  }

  // Sinon, on redirige vers la page de login avec next=/dashboard
  const appUrl = env.APP_URL || new URL(req.url).origin;
  return Response.json({
    valid: true,
    redirect_url: `${appUrl}/?next=/dashboard&beta=1`,
    message: 'Code accepté. Saisissez votre email pour recevoir le lien de connexion.',
  }, { headers: corsBetaHeaders(req) });
}

function corsBetaHeaders(req) {
  // CORS ouvert sur les domaines IKCP (pour que la landing-beta puisse appeler depuis ikcp.eu)
  const origin = req.headers.get('Origin') || '';
  const allowed = ['https://ikcp.eu', 'https://www.ikcp.eu', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// GET /api/export/me — export complet des données du client (RGPD portabilité)
//
// Retourne un JSON unique structuré avec :
//   - profile : infos user (depuis users)
//   - sessions : sessions actives
//   - conversations : historique Marcel (history JSON)
//   - dossiers : dossiers patrimoniaux ouverts
//   - audit_log : événements (limité aux 1000 derniers)
//   - export_meta : version + horodatage + hash SHA-256 pour vérification
//
// Headers : application/json + Content-Disposition attachment pour
// déclencher le téléchargement côté navigateur. La page UI proposera un
// "Exporter mes données" qui ouvre simplement cette URL.
//
// Argumentaire commercial : *vos données vous appartiennent · 1 clic*.
// Anti-friction à l'adhésion (cf. avantage concurrentiel #5 du doc audit).
const handleExportMe = requireAuth(async (req, env, ctx, user) => {
  const { results: sessions = [] } = await env.DB.prepare(
    'SELECT id, expires_at, ip, ua, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all();

  let conversations = [], dossiers = [], audit_log = [];
  try {
    const r = await env.DB.prepare(
      'SELECT id, title, history, profile, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'
    ).bind(user.id).all();
    conversations = (r.results || []).map(c => ({
      ...c,
      history: c.history ? safeJSON(c.history) : null,
      profile: c.profile ? safeJSON(c.profile) : null,
    }));
  } catch (e) { /* table non encore créée — silencieux */ }

  try {
    const r = await env.DB.prepare(
      'SELECT id, title, category, status, notes, created_at, updated_at FROM dossiers WHERE user_id = ? ORDER BY updated_at DESC'
    ).bind(user.id).all();
    dossiers = r.results || [];
  } catch (e) { /* idem */ }

  try {
    const r = await env.DB.prepare(
      'SELECT action, detail, ip, ua, ts FROM audit_log WHERE user_id = ? ORDER BY ts DESC LIMIT 1000'
    ).bind(user.id).all();
    audit_log = r.results || [];
  } catch (e) { /* idem */ }

  const payload = {
    export_meta: {
      version: '1.0',
      generated_at: new Date().toISOString(),
      service: 'ikcp-client',
      legal_basis: 'RGPD art. 20 — droit à la portabilité',
    },
    profile: {
      id: user.id, email: user.email,
      first_name: user.first_name, last_name: user.last_name,
      role: user.role, status: user.status,
      created_at: user.created_at, last_login_at: user.last_login_at,
    },
    sessions, conversations, dossiers, audit_log,
  };

  const body = JSON.stringify(payload, null, 2);
  const sha256 = await hashSha256(body);
  payload.export_meta.sha256 = sha256;
  const finalBody = JSON.stringify(payload, null, 2);

  audit(env, { user_id: user.id, email: user.email, action: 'data_export', detail: `sha256=${sha256.slice(0, 16)}…` });

  const filename = `ikcp-export-${user.email.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(finalBody, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Export-Sha256': sha256,
    }
  });
});

// GET /api/dashboard/me — agrège toutes les tables D1 dans le shape exact
// attendu par proposals/dashboard-render.js (cf. dashboard-data.js).
// Permet au front de basculer du mock à la donnée réelle sans modif rendu.
//
// Shape retournée :
//   { client, patrimoine, echeances, conversations, arbitrages,
//     documents, livrables, services, univers_perso, opportunites,
//     value_scorecard, backtest_12m, activity }
//
// Tolérant à l'absence de données (tables non encore peuplées) — chaque
// section retourne [] ou un objet vide cohérent. Permet de servir un
// utilisateur fraîchement onboardé.
const handleDashboardMe = requireAuth(async (req, env, ctx, user) => {
  const NOW = Date.now();
  const NOW_ISO = new Date().toISOString();

  // Helpers
  const safeAll = async (sql, ...binds) => {
    try { const r = await env.DB.prepare(sql).bind(...binds).all(); return r.results || []; }
    catch { return []; }
  };
  const safeOne = async (sql, ...binds) => {
    try { const r = await env.DB.prepare(sql).bind(...binds).first(); return r || null; }
    catch { return null; }
  };

  // CLIENT — depuis users + members (à ajouter en Phase 2 multi-utilisateur)
  const client = {
    id: user.id,
    family_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0],
    members: [{ first: user.first_name || '', last: user.last_name || '', age: null, role: 'principal' }],
    member_since: new Date(user.created_at).toISOString().slice(0, 10),
    cgp: 'Maxime Juveneton',
    tier: 'Family Office augmenté',
    email: user.email,
  };

  // PATRIMOINE — dernier snapshot
  const patSnap = await safeOne(
    'SELECT * FROM patrimoine_snapshot WHERE user_id = ? ORDER BY asof DESC LIMIT 1',
    user.id
  );
  const patrimoine = patSnap ? {
    net_worth: patSnap.net_worth,
    variation_trimestre_pct: patSnap.variation_trim_pct,
    variation_an_pct: patSnap.variation_an_pct,
    classes: safeJSON(patSnap.classes_json) || [],
    allocation_cible: safeJSON(patSnap.allocation_cible_json) || {},
    drift_max_pct: patSnap.drift_max_pct,
    drift_severity: patSnap.drift_severity,
  } : { net_worth: 0, classes: [], allocation_cible: {}, drift_severity: 'none', drift_max_pct: 0 };

  // ÉCHÉANCES — 8 prochaines à venir
  const echeancesRaw = await safeAll(
    'SELECT * FROM echeances WHERE user_id = ? AND date >= date("now") ORDER BY date ASC LIMIT 8',
    user.id
  );
  const echeances = echeancesRaw.map(e => ({
    date: e.date, label: e.label, montant: e.montant, source: e.source,
    status: e.status, urgent: !!e.urgent,
  }));

  // CONVERSATIONS — 5 plus récentes
  const convRaw = await safeAll(
    'SELECT id, title, history, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5',
    user.id
  );
  const conversations = convRaw.map(c => {
    const hist = safeJSON(c.history) || [];
    const lastUser = [...hist].reverse().find(h => h.role === 'user');
    const lastAssistant = [...hist].reverse().find(h => h.role === 'assistant');
    return {
      id: c.id, title: c.title || '(sans titre)',
      last_question: lastUser ? String(lastUser.content || '').slice(0, 200) : '',
      last_message: lastAssistant ? String(lastAssistant.content || '').slice(0, 240) : '',
      date: new Date(c.updated_at).toISOString().slice(0, 10),
      theme: null, theme_label: '', agents: [], status: 'cloturee',
    };
  });

  // ARBITRAGES — en attente + en discussion
  const arbRaw = await safeAll(
    'SELECT * FROM arbitrages WHERE user_id = ? AND status IN ("en_attente", "en_discussion") ORDER BY prepared_at DESC',
    user.id
  );
  const arbitrages = arbRaw.map(a => ({
    id: a.id, conv_id: a.conv_id, titre: a.titre,
    contexte: a.contexte, reco_marcel: a.reco_marcel,
    sources: safeJSON(a.sources_json) || [],
    gain_estime: a.gain_estime, gain_qualitatif: a.gain_qualitatif,
    status: a.status,
    preparé_le: new Date(a.prepared_at).toISOString().slice(0, 10),
  }));

  // DOCUMENTS — tous les non-générés (les générés vont dans livrables)
  const docsRaw = await safeAll(
    'SELECT * FROM documents WHERE user_id = ? AND generated = 0 ORDER BY date_recu DESC LIMIT 50',
    user.id
  );
  const documents = docsRaw.map(d => ({
    id: d.id, type: d.type, label: d.label, annee: d.annee,
    date_recu: new Date(d.date_recu).toISOString().slice(0, 10),
    tags: safeJSON(d.tags_json) || [], pages: d.pages,
  }));

  // LIVRABLES — documents générés par Reporting-agent
  const livRaw = await safeAll(
    'SELECT * FROM documents WHERE user_id = ? AND generated = 1 ORDER BY date_recu DESC LIMIT 20',
    user.id
  );
  const livrables = livRaw.map(l => ({
    id: l.id, type: l.type, label: l.label,
    date: new Date(l.date_recu).toISOString().slice(0, 10),
    signed: !!l.signed_at, pages: l.pages,
    requires_signature: !l.signed_at && (l.type === 'memo' || l.type === 'der' || l.type === 'rapport_adequation'),
  }));

  // UNIVERS PERSO — groupés par univers_key
  const universRaw = await safeAll(
    'SELECT * FROM univers_items WHERE user_id = ? ORDER BY univers_key, updated_at DESC',
    user.id
  );
  const universByKey = {};
  for (const u of universRaw) {
    if (!universByKey[u.univers_key]) {
      universByKey[u.univers_key] = { key: u.univers_key, items: [], total_estime: 0, derniere_alerte: u.derniere_alerte };
    }
    universByKey[u.univers_key].items.push({
      titre: u.titre, etat: u.etat, valeur_estimee: u.valeur_estimee,
      source: u.source_estimation, tendance: u.tendance,
    });
    universByKey[u.univers_key].total_estime += (u.valeur_estimee || 0);
  }
  const univers_perso = Object.values(universByKey);

  // OPPORTUNITÉS — open + ciblé sur user (ou pool global)
  const oppRaw = await safeAll(
    'SELECT * FROM opportunites WHERE (user_id = ? OR user_id IS NULL) AND status = "open" ORDER BY fit_score DESC LIMIT 10',
    user.id
  );
  const opportunites = oppRaw.map(o => ({
    id: o.id, categorie: o.categorie, titre: o.titre, pitch: o.pitch,
    ticket_min: o.ticket_min, ticket_max: o.ticket_max,
    deadline: o.deadline, source: o.source,
    fit_score: o.fit_score, fit_reasons: safeJSON(o.fit_reasons_json) || [],
  }));

  // ACTIVITY — 20 derniers events
  const evtRaw = await safeAll(
    'SELECT who, what, ts FROM events WHERE user_id = ? ORDER BY ts DESC LIMIT 20',
    user.id
  );
  const activity = evtRaw.map(e => ({
    ts: new Date(e.ts).toISOString(),
    who: e.who, what: e.what,
  }));

  // VALUE SCORECARD — agrégats sur le mois en cours
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthStartTs = monthStart.getTime();
  const [{ count: questionsTraitees = 0 } = {}] = await safeAll(
    'SELECT COUNT(*) as count FROM events WHERE user_id = ? AND who = "Marcel" AND ts >= ?',
    user.id, monthStartTs
  );
  const [{ count: docsClasses = 0 } = {}] = await safeAll(
    'SELECT COUNT(*) as count FROM documents WHERE user_id = ? AND created_at >= ? AND generated = 0',
    user.id, monthStartTs
  );
  const [{ count: arbPrepares = 0 } = {}] = await safeAll(
    'SELECT COUNT(*) as count FROM arbitrages WHERE user_id = ? AND status = "en_attente"',
    user.id
  );
  const [{ sum: optimisations = 0 } = {}] = await safeAll(
    'SELECT COALESCE(SUM(gain_estime), 0) as sum FROM arbitrages WHERE user_id = ? AND prepared_at >= ?',
    user.id, monthStartTs
  );
  const nextDeadlineDays = echeances.length > 0
    ? Math.max(0, Math.round((new Date(echeances[0].date).getTime() - NOW) / 86400000))
    : null;

  const value_scorecard = {
    periode_label: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    questions_traitees: questionsTraitees,
    documents_classes_auto: docsClasses,
    arbitrages_prepares: arbPrepares,
    optimisations_identifiees_eur: optimisations || 0,
    prochaines_echeances: echeances.length,
    next_deadline_days: nextDeadlineDays,
  };

  return Response.json({
    NOW: NOW_ISO,
    client, patrimoine, echeances, conversations, arbitrages,
    documents, livrables,
    services: { rdv_prochain: null, voyages_planifies: [], partenaires: [] },
    univers_perso, opportunites,
    services_premium: [],
    value_scorecard,
    backtest_12m: { metrics: [], vs_family_office_classique: {} },
    activity,
  });
});

// POST /api/docs/upload — upload d'un document patrimonial avec
// classification automatique par documents-mcp-server.
//
// Body : { filename: string, mime_type: string, base64: string, hint?: string }
// Limite : 5 MB après decode base64 (~6.7 MB en base64).
//
// Pipeline :
//   1. Validation taille + mime
//   2. Hash SHA-256 du contenu
//   3. Upload R2 : `docs/<user_id>/<sha>.<ext>`
//   4. Insert D1 documents (status='pending_classification')
//   5. Appel documents-mcp-server.classify_document via service binding
//   6. Update D1 avec type + fields + summary + classified_at
//   7. Audit log
//
// RGPD :
//   · Stockage R2 chiffré at-rest (Cloudflare default)
//   · Hash SHA-256 dans audit (pas le contenu)
//   · Anthropic vision appelée uniquement pour OCR/classification
//     (DPA Anthropic à signer · conservation 30 j max · pas de retraining)
//   · Suppression possible via DELETE /api/docs/:id
const handleDocsUpload = requireAuth(async (req, env, ctx, user) => {
  if (!env.DOCS_R2) {
    return Response.json({ error: 'docs_storage_unavailable' }, { status: 503 });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { filename, mime_type, base64, hint } = body || {};
  if (!filename || !mime_type || !base64) {
    return Response.json({ error: 'missing_fields', required: ['filename', 'mime_type', 'base64'] }, { status: 400 });
  }

  const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED_MIME.includes(mime_type)) {
    return Response.json({ error: 'unsupported_mime', allowed: ALLOWED_MIME }, { status: 400 });
  }

  // Decode base64 + validation taille
  let bytes;
  try {
    const binary = atob(base64.replace(/\s/g, ''));
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return Response.json({ error: 'invalid_base64' }, { status: 400 });
  }
  const MAX_SIZE = 5 * 1024 * 1024;
  if (bytes.length > MAX_SIZE) {
    return Response.json({ error: 'file_too_large', max_bytes: MAX_SIZE, got_bytes: bytes.length }, { status: 413 });
  }

  // Hash SHA-256 — clé R2 + traçabilité audit RGPD
  const sha = await sha256Hex(bytes.buffer);
  const ext = filename.split('.').pop().toLowerCase().slice(0, 5).replace(/[^a-z0-9]/g, '') || 'bin';
  const r2Key = `docs/${user.id}/${sha}.${ext}`;

  // Upload R2
  await env.DOCS_R2.put(r2Key, bytes, {
    httpMetadata: { contentType: mime_type },
    customMetadata: {
      user_id: user.id,
      filename: filename.slice(0, 200),
      uploaded_at: String(now()),
    },
  });

  // Insert D1 — status pending
  const docId = 'doc_' + crypto.randomUUID().slice(0, 12);
  try {
    await env.DB.prepare(`
      INSERT INTO documents (id, user_id, type, label, r2_key, mime_type, size_bytes, sha256, date_recu, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).bind(docId, user.id, filename.slice(0, 200), r2Key, mime_type, bytes.length, sha, now(), now()).run();
  } catch (e) {
    console.error('[docs-upload] D1 insert fail', e);
    // Continue tout de même — on a R2, on pourra rattraper
  }

  audit(env, {
    user_id: user.id, email: user.email,
    action: 'doc_uploaded',
    detail: `sha=${sha.slice(0, 16)} · size=${bytes.length} · type=${mime_type}`,
    ip: req.headers.get('CF-Connecting-IP'),
  });

  // Classification asynchrone via service binding
  // Si DOCUMENTS_MCP n'est pas configuré (pas encore déployé), on retourne
  // simplement le doc uploadé sans classification — le client peut relancer
  // via un endpoint /api/docs/:id/classify ultérieurement.
  let classification = null;
  if (env.DOCUMENTS_MCP && env.MCP_SHARED_SECRET) {
    try {
      classification = await callDocumentsMcp('classify_document', { r2_key: r2Key, hint }, env);
      if (classification && classification.classification) {
        const c = classification.classification;
        const tagsJson = JSON.stringify(c.key_fields || {});
        await env.DB.prepare(`
          UPDATE documents SET type = ?, label = ?, tags_json = ?, annee = ?, created_at = ?
          WHERE id = ?
        `).bind(
          c.type || 'autre',
          c.summary ? c.summary.slice(0, 200) : filename,
          tagsJson,
          (c.key_fields && (c.key_fields.annee || c.key_fields.annee_revenus)) || null,
          now(),
          docId,
        ).run();
        audit(env, { user_id: user.id, action: 'doc_classified', detail: `${docId} → ${c.type} (conf ${c.confidence})` });
      }
    } catch (e) {
      console.error('[docs-upload] classification fail', e);
      audit(env, { user_id: user.id, action: 'doc_classification_failed', detail: e.message });
    }
  }

  return Response.json({
    success: true,
    document: {
      id: docId,
      r2_key: r2Key,
      sha256: sha,
      size_bytes: bytes.length,
      mime_type,
      filename,
      uploaded_at: new Date().toISOString(),
      classification: classification && classification.classification ? classification.classification : null,
    },
  });
});

// DELETE /api/docs/:id — suppression RGPD-compliant
//   · Supprime de R2
//   · Marque D1 comme deleted (anonymisation, conservation log audit)
//   · Audit log
const handleDocsDelete = requireAuth(async (req, env, ctx, user) => {
  const url = new URL(req.url);
  const docId = url.pathname.split('/').pop();
  if (!docId || !docId.startsWith('doc_')) {
    return Response.json({ error: 'invalid_doc_id' }, { status: 400 });
  }

  const doc = await env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(docId, user.id).first();
  if (!doc) return Response.json({ error: 'not_found' }, { status: 404 });

  // Supprime R2
  if (env.DOCS_R2 && doc.r2_key) {
    try { await env.DOCS_R2.delete(doc.r2_key); }
    catch (e) { console.error('[docs-delete] R2', e); }
  }

  // Anonymise D1 (on garde la ligne pour l'audit · CNIL accepte)
  await env.DB.prepare(`
    UPDATE documents SET label = '[supprimé]', r2_key = '', tags_json = NULL
    WHERE id = ? AND user_id = ?
  `).bind(docId, user.id).run();

  audit(env, {
    user_id: user.id, email: user.email,
    action: 'doc_deleted',
    detail: `${docId} · sha=${doc.sha256?.slice(0, 16)}`,
    ip: req.headers.get('CF-Connecting-IP'),
  });

  return Response.json({ success: true, deleted: docId });
});

// Appel sub-agent documents-mcp-server via service binding (latence ~0)
async function callDocumentsMcp(toolName, args, env) {
  const body = JSON.stringify({ name: toolName, arguments: args });
  const sig = await hmacSha256(body, env.MCP_SHARED_SECRET);

  const res = await env.DOCUMENTS_MCP.fetch('https://internal/mcp/call_tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IKCP-Signature': sig },
    body,
  });
  if (!res.ok) throw new Error(`docs-mcp ${res.status}`);
  const json = await res.json();
  return json.result;
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashSha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return s; }
}

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

    // CORS preflight pour /auth/beta-redeem (appelé depuis la landing publique)
    if (p === '/auth/beta-redeem' && m === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsBetaHeaders(req) });
    }

    // Routes
    if (p === '/' && m === 'GET') return handleLogin(req, env);
    if (p === '/auth/beta-redeem' && m === 'POST') return handleBetaRedeem(req, env);
    if (p === '/auth/send' && m === 'POST') return handleAuthSend(req, env, ctx);
    if (p === '/auth/verify' && m === 'GET') return handleAuthVerify(req, env);
    if (p === '/auth/logout') return handleLogout(req, env);
    if (p === '/dashboard' && m === 'GET') return handleDashboard(req, env, ctx);
    if (p === '/marcel' && m === 'GET') return handleMarcel(req, env, ctx);
    if (p === '/dossiers' && m === 'GET') return handleDossiers(req, env, ctx);
    if (p === '/api/export/me' && m === 'GET') return handleExportMe(req, env, ctx);
    if (p === '/api/dashboard/me' && m === 'GET') return handleDashboardMe(req, env, ctx);
    if (p === '/api/docs/upload' && m === 'POST') return handleDocsUpload(req, env, ctx);
    if (p.startsWith('/api/docs/') && m === 'DELETE') return handleDocsDelete(req, env, ctx);

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
      <a href="/api/export/me" class="action" download>
        <span class="action-icon">⬇</span>
        <span><span class="action-text">Exporter mes données</span><br><span class="action-sub">RGPD · 1 clic · JSON signé SHA-256</span></span>
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
