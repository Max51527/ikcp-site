/**
 * IKCP Client Portal Worker — Cloudflare (freemium v2)
 *
 * Espace membre :
 *  - Auth magic link (zero password) · JWT cookie HttpOnly + Secure + SameSite=Strict
 *  - Stripe checkout + webhook (Premium 29€/mois)
 *  - Quota Pappers par tier (free 1/mois, premium 10, fo illimité)
 *  - Sync logiciel-gp (polling Bearer service token)
 *
 * Bindings (cf. wrangler.toml) :
 *  D1            ikcp-client-db    — schema.sql
 *  KV            CLIENT_KV         — magic tokens, rate limit
 *  Secret        JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY,
 *                STRIPE_WEBHOOK_SECRET, CABINET_TOKEN
 *  Var           APP_URL, IKCP_PAPPERS_URL,
 *                STRIPE_PRICE_PREMIUM_MONTHLY, STRIPE_PRICE_PREMIUM_YEARLY
 */

const TIER_LIMITS = {
  free:    { pappers: 1,        marcel_msgs: 30,    marcel_memory_days: 0 },
  premium: { pappers: 10,       marcel_msgs: Infinity, marcel_memory_days: 90 },
  fo:      { pappers: Infinity, marcel_msgs: Infinity, marcel_memory_days: Infinity },
};

const COOKIE_NAME = 'ikcp_session';
const SESSION_TTL_DAYS = 30;
const MAGIC_TTL_MIN = 15;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'OPTIONS') return cors(204);

      // ─── PUBLIC ROUTES ──────────────────────────────────
      if (path === '/health') return json({ status: 'ok', service: 'ikcp-client', version: '2.0', bindings: bindingsStatus(env) });
      if (path === '/auth/send' && method === 'POST') return await handleAuthSend(request, env);
      if (path === '/auth/verify' && method === 'GET') return await handleAuthVerify(request, env);
      if (path === '/stripe/webhook' && method === 'POST') return await handleStripeWebhook(request, env);

      // ─── CABINET POLLING (Bearer service token) ────────
      if (path.startsWith('/api/v1/cabinet/')) return await handleCabinet(request, env);

      // ─── AUTHENTICATED ROUTES ──────────────────────────
      const session = await requireSession(request, env);
      if (!session) return json({ error: 'unauthorized' }, 401);

      if (path === '/api/v1/me' && method === 'GET') return await handleMe(session, env);
      if (path === '/api/v1/usage' && method === 'GET') return await handleUsage(session, env);
      if (path === '/api/v1/pappers/lookup' && method === 'POST') return await handlePappersLookup(request, session, env);
      if (path === '/api/v1/stripe/checkout' && method === 'POST') return await handleStripeCheckout(request, session, env);
      if (path === '/api/v1/stripe/portal' && method === 'POST') return await handleStripePortal(session, env);
      if (path === '/auth/logout') return await handleLogout(session, env);

      // ─── Espace utilisateur (CRUD freemium v2) ──────────
      if (path === '/api/v1/me/sirens' && method === 'POST') return await handleSirensAdd(request, session, env);
      if (path === '/api/v1/me/sirens' && method === 'GET') return await handleSirensList(session, env);

      if (path === '/api/v1/me/conversations' && method === 'GET') return await handleConvList(session, env);

      if (path === '/api/v1/me/contacts' && method === 'GET') return await handleContactsList(session, env);
      if (path === '/api/v1/me/contacts' && method === 'POST') return await handleContactsAdd(request, session, env);
      const cm = path.match(/^\/api\/v1\/me\/contacts\/([a-f0-9-]+)$/);
      if (cm && method === 'DELETE') return await handleContactsDelete(cm[1], session, env);

      if (path === '/api/v1/me/alerts' && method === 'GET') return await handleAlertsList(request, session, env);

      if (path === '/api/v1/me/documents' && method === 'GET') return await handleDocsList(session, env);

      if (path === '/api/v1/me/watches' && method === 'GET') return await handleWatchesList(session, env);
      if (path === '/api/v1/me/watches' && method === 'POST') return await handleWatchesAdd(request, session, env);

      if (path === '/api/v1/me/export' && method === 'GET') return await handleExportRgpd(session, env);
      if (path === '/api/v1/me' && method === 'DELETE') return await handleDeleteAccount(request, session, env);

      return json({ error: 'not_found' }, 404);
    } catch (err) {
      console.error('Worker error:', err.stack || err.message);
      return json({ error: 'internal_error', message: err.message }, 500);
    }
  },
};

// ──────────────────────────────────────────────────────────────
// AUTH — MAGIC LINK
// ──────────────────────────────────────────────────────────────
async function handleAuthSend(request, env) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400);

  const rlKey = `rl:magic:${email.toLowerCase()}`;
  const count = parseInt((await env.CLIENT_KV.get(rlKey)) || '0');
  if (count >= 3) return json({ error: 'rate_limited', retry_after_minutes: 60 }, 429);
  await env.CLIENT_KV.put(rlKey, String(count + 1), { expirationTtl: 3600 });

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + MAGIC_TTL_MIN * 60_000;

  await env.D1.prepare(
    'INSERT INTO magic_tokens (token_hash, email, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)'
  ).bind(tokenHash, email.toLowerCase(), now, expiresAt, request.headers.get('CF-Connecting-IP') || '').run();

  const verifyUrl = `${env.APP_URL}/auth/verify?token=${token}`;
  await sendEmail(env, { to: email, subject: 'Votre lien de connexion · IKCP', html: emailTemplateMagic(verifyUrl) });

  await audit(env, null, 'magic_sent', request, { email });
  return json({ ok: true, message: 'Lien envoyé. Vérifiez votre boîte mail (TTL 15 min).' });
}

async function handleAuthVerify(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'token_required' }, 400);

  const tokenHash = await sha256(token);
  const row = await env.D1.prepare('SELECT email, expires_at, used_at FROM magic_tokens WHERE token_hash = ?').bind(tokenHash).first();
  if (!row) return json({ error: 'token_invalid' }, 401);
  if (row.used_at) return json({ error: 'token_already_used' }, 401);
  if (Date.now() > row.expires_at) return json({ error: 'token_expired' }, 401);

  await env.D1.prepare('UPDATE magic_tokens SET used_at = ? WHERE token_hash = ?').bind(Date.now(), tokenHash).run();

  let user = await env.D1.prepare('SELECT * FROM users WHERE email = ?').bind(row.email).first();
  if (!user) {
    const id = crypto.randomUUID();
    await env.D1.prepare('INSERT INTO users (id, email, tier, created_at, last_login_at, source) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, row.email, 'free', Date.now(), Date.now(), 'organic').run();
    user = { id, email: row.email, tier: 'free' };
    await audit(env, id, 'signup', request);
    await emitEvent(env, id, 'signup', { email: row.email });
    await sendEmail(env, { to: row.email, subject: 'Bienvenue · IKCP', html: emailTemplateWelcome() });
  } else {
    await env.D1.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(Date.now(), user.id).run();
  }

  const sessionToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const sessionHash = await sha256(sessionToken);
  const expiresAt = Date.now() + SESSION_TTL_DAYS * 86_400_000;
  await env.D1.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sessionHash, user.id, Date.now(), expiresAt, request.headers.get('CF-Connecting-IP') || '', (request.headers.get('User-Agent') || '').slice(0, 500)).run();

  await audit(env, user.id, 'login', request);

  const cookieValue = `${COOKIE_NAME}=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`;
  return new Response(null, {
    status: 302,
    headers: { 'Location': `${env.APP_URL}/salon`, 'Set-Cookie': cookieValue },
  });
}

async function handleLogout(session, env) {
  await env.D1.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?').bind(Date.now(), session.token_hash).run();
  return new Response(null, {
    status: 302,
    headers: { 'Location': `${env.APP_URL}/`, 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` },
  });
}

async function requireSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  const tokenHash = await sha256(m[1]);
  const row = await env.D1.prepare(
    'SELECT s.token_hash, s.user_id, s.expires_at, s.revoked_at, u.email, u.tier ' +
    'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
  ).bind(tokenHash).first();
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.now() > row.expires_at) return null;
  return row;
}

// ──────────────────────────────────────────────────────────────
// USER API
// ──────────────────────────────────────────────────────────────
async function handleMe(session, env) {
  const month = new Date().toISOString().slice(0, 7);
  const usage = await env.D1.prepare('SELECT pappers_lookups, marcel_messages FROM usage WHERE user_id = ? AND year_month = ?')
    .bind(session.user_id, month).first();
  const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free;
  return json({
    user: { id: session.user_id, email: session.email, tier: session.tier },
    quota: {
      pappers: { used: usage?.pappers_lookups || 0, limit: limits.pappers },
      marcel:  { used: usage?.marcel_messages || 0, limit: limits.marcel_msgs },
    },
    reset_at: nextMonthFirst(),
  });
}

async function handleUsage(session, env) {
  const rows = await env.D1.prepare(
    'SELECT year_month, pappers_lookups, marcel_messages FROM usage WHERE user_id = ? ORDER BY year_month DESC LIMIT 12'
  ).bind(session.user_id).all();
  return json({ history: rows.results || [] });
}

// ──────────────────────────────────────────────────────────────
// PAPPERS — quota check + proxy
// ──────────────────────────────────────────────────────────────
async function handlePappersLookup(request, session, env) {
  const month = new Date().toISOString().slice(0, 7);
  const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free;
  const usage = await env.D1.prepare('SELECT pappers_lookups FROM usage WHERE user_id = ? AND year_month = ?').bind(session.user_id, month).first();
  const used = usage?.pappers_lookups || 0;

  if (used >= limits.pappers) {
    return json({
      error: 'quota_exceeded',
      tier: session.tier, limit: limits.pappers, used,
      reset_at: nextMonthFirst(),
      upgrade_url: `${env.APP_URL}/abonnement`,
    }, 402);
  }

  const { siren, query } = await request.json().catch(() => ({}));
  if (!siren && !query) return json({ error: 'siren_or_query_required' }, 400);

  const pappersUrl = siren
    ? `${env.IKCP_PAPPERS_URL}/entreprise/${siren}`
    : `${env.IKCP_PAPPERS_URL}/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(pappersUrl);
  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'pappers_failed', status: res.status, detail: err.slice(0, 200) }, 502);
  }
  const data = await res.json();

  await env.D1.prepare(
    'INSERT INTO usage (user_id, year_month, pappers_lookups) VALUES (?, ?, 1) ' +
    'ON CONFLICT(user_id, year_month) DO UPDATE SET pappers_lookups = pappers_lookups + 1'
  ).bind(session.user_id, month).run();

  if (data.siren && data.nom) {
    await env.D1.prepare(
      'INSERT INTO pappers_lookups (id, user_id, siren, query, company_name, forme_juridique, capital, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), session.user_id, data.siren, query || '', data.nom, data.forme_juridique || '', data.capital || 0, Date.now()).run();
    await emitEvent(env, session.user_id, 'pappers_lookup', { siren: data.siren, nom: data.nom });
  }

  return json({ data, quota: { used: used + 1, limit: limits.pappers } });
}

// ──────────────────────────────────────────────────────────────
// STRIPE — checkout + webhook + portal
// ──────────────────────────────────────────────────────────────
async function handleStripeCheckout(request, session, env) {
  const { plan } = await request.json().catch(() => ({}));
  const priceMap = { monthly: env.STRIPE_PRICE_PREMIUM_MONTHLY, yearly: env.STRIPE_PRICE_PREMIUM_YEARLY };
  const priceId = priceMap[plan];
  if (!priceId) return json({ error: 'invalid_plan' }, 400);

  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('customer_email', session.email);
  params.append('success_url', `${env.APP_URL}/salon?upgraded=1`);
  params.append('cancel_url', `${env.APP_URL}/salon`);
  params.append('metadata[user_id]', session.user_id);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) return json({ error: 'stripe_failed', detail: data }, 502);
  return json({ checkout_url: data.url });
}

async function handleStripePortal(session, env) {
  const user = await env.D1.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').bind(session.user_id).first();
  if (!user?.stripe_customer_id) return json({ error: 'no_subscription' }, 400);
  const params = new URLSearchParams();
  params.append('customer', user.stripe_customer_id);
  params.append('return_url', `${env.APP_URL}/salon`);
  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  return json({ portal_url: data.url });
}

async function handleStripeWebhook(request, env) {
  const sig = request.headers.get('Stripe-Signature') || '';
  const body = await request.text();
  const valid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ error: 'invalid_signature' }, 401);

  const event = JSON.parse(body);
  const seen = await env.D1.prepare('SELECT id FROM stripe_events WHERE id = ?').bind(event.id).first();
  if (seen) return json({ received: true, idempotent: true });
  await env.D1.prepare('INSERT INTO stripe_events (id, type, payload_json, ts) VALUES (?, ?, ?, ?)')
    .bind(event.id, event.type, JSON.stringify(event), Date.now()).run();

  const obj = event.data?.object || {};
  const userId = obj.metadata?.user_id;

  switch (event.type) {
    case 'checkout.session.completed':
      if (userId) {
        await env.D1.prepare('UPDATE users SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
          .bind('premium', obj.customer, obj.subscription, userId).run();
        await audit(env, userId, 'tier_upgraded', request, { from: 'free', to: 'premium' });
        await emitEvent(env, userId, 'subscription_upgraded', { from_tier: 'free', to_tier: 'premium' });
        const u = await env.D1.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
        if (u) await sendEmail(env, { to: u.email, subject: 'Bienvenue Premium · IKCP', html: emailTemplatePremiumWelcome() });
      }
      break;
    case 'customer.subscription.deleted': {
      const u = await env.D1.prepare('SELECT id, email FROM users WHERE stripe_customer_id = ?').bind(obj.customer).first();
      if (u) {
        await env.D1.prepare('UPDATE users SET tier = ? WHERE id = ?').bind('free', u.id).run();
        await audit(env, u.id, 'tier_downgraded', request, { from: 'premium', to: 'free' });
        await emitEvent(env, u.id, 'subscription_canceled', { from_tier: 'premium', to_tier: 'free' });
        await sendEmail(env, { to: u.email, subject: 'On vous regrette · IKCP', html: emailTemplateCancelRetention() });
      }
      break;
    }
    case 'invoice.payment_failed': {
      const u = await env.D1.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').bind(obj.customer).first();
      if (u) {
        await audit(env, u.id, 'payment_failed', request);
        await emitEvent(env, u.id, 'payment_failed', {});
      }
      break;
    }
  }

  await env.D1.prepare('UPDATE stripe_events SET processed_at = ? WHERE id = ?').bind(Date.now(), event.id).run();
  return json({ received: true });
}

// ──────────────────────────────────────────────────────────────
// CABINET POLLING (logiciel-gp)
// ──────────────────────────────────────────────────────────────
async function handleCabinet(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.substring(7) !== env.CABINET_TOKEN) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  if (url.pathname === '/api/v1/cabinet/sync' && request.method === 'GET') {
    const since = parseInt(url.searchParams.get('since') || '0');
    const events = await env.D1.prepare(
      'SELECT e.id, e.user_id, u.email AS user_email, e.type, e.payload_json, e.ts ' +
      'FROM events e LEFT JOIN users u ON u.id = e.user_id ' +
      'WHERE e.ts > ? ORDER BY e.ts ASC LIMIT 200'
    ).bind(since).all();

    if (events.results?.length) {
      const ids = events.results.map(e => `'${e.id}'`).join(',');
      await env.D1.prepare(`UPDATE events SET cabinet_synced_at = ? WHERE id IN (${ids})`).bind(Date.now()).run();
    }

    return json({
      since, now: Date.now(),
      events: (events.results || []).map(e => ({
        id: e.id, type: e.type, user_id: e.user_id, user_email: e.user_email,
        payload: e.payload_json ? JSON.parse(e.payload_json) : null, ts: e.ts,
      })),
    });
  }

  return json({ error: 'not_found' }, 404);
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function bindingsStatus(env) {
  return {
    db: !!env.D1, kv: !!env.CLIENT_KV, jwt: !!env.JWT_SECRET, resend: !!env.RESEND_API_KEY,
    stripe: !!env.STRIPE_SECRET_KEY, stripe_webhook: !!env.STRIPE_WEBHOOK_SECRET,
    cabinet: !!env.CABINET_TOKEN, pappers_url: !!env.IKCP_PAPPERS_URL,
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}
function cors(status) { return new Response(null, { status, headers: corsHeaders() }); }
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(body, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const signed = `${parts.t}.${body}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === parts.v1;
}

async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) { console.warn('RESEND_API_KEY missing'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'IKCP <noreply@ikcp.eu>', to: [to], subject, html }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

async function audit(env, userId, action, request, metadata = {}) {
  await env.D1.prepare('INSERT INTO audit_log (id, user_id, action, ip, user_agent, metadata_json, ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, action, request.headers.get('CF-Connecting-IP') || '',
      (request.headers.get('User-Agent') || '').slice(0, 500), JSON.stringify(metadata), Date.now()).run();
}

async function emitEvent(env, userId, type, payload) {
  await env.D1.prepare('INSERT INTO events (id, user_id, type, payload_json, ts) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, type, JSON.stringify(payload), Date.now()).run();
}

function nextMonthFirst() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ──────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ──────────────────────────────────────────────────────────────
function emailTemplateMagic(verifyUrl) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#FAF6EE;color:#2D2520">
    <h1 style="font-size:24px;color:#D97757;margin:0 0 16px">Votre lien de connexion</h1>
    <p style="font-size:15px;line-height:1.6">Voici votre lien pour vous connecter à votre Salon IKCP. Valide <b>15 minutes</b>, à usage unique.</p>
    <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:#D97757;color:#FAF6EE;text-decoration:none;border-radius:30px;margin:18px 0;font-weight:600">Me connecter →</a>
    <p style="font-size:12px;color:#9B8B7C">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  </div>`;
}
function emailTemplateWelcome() {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#FAF6EE;color:#2D2520">
    <h1 style="font-size:24px;color:#D97757">Bienvenue dans votre Salon IKCP</h1>
    <p>Compte <b>Découverte</b> activé : 1 cartographie d'entreprise par mois (Pappers), 30 messages avec Marcel.</p>
    <p>Pour aller plus loin : <a href="https://client.ikcp.eu/abonnement" style="color:#D97757">Premium 29 €/mois</a> — 10 lookups, Marcel personnalisé, cartographie auto.</p>
  </div>`;
}
function emailTemplatePremiumWelcome() {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#FAF6EE;color:#2D2520">
    <h1 style="font-size:24px;color:#D97757">Bienvenue Premium</h1>
    <p>Votre compte est activé. Vous bénéficiez désormais de :</p>
    <ul><li>10 cartographies Pappers par mois</li><li>Marcel personnalisé · mémoire 90 j</li><li>Théodore (cartographie auto)</li><li>Olympe (synthèse trimestrielle)</li></ul>
    <p>Mail prioritaire à Maxime : <a href="mailto:maxime@ikcp.fr">maxime@ikcp.fr</a></p>
  </div>`;
}
function emailTemplateCancelRetention() {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#FAF6EE;color:#2D2520">
    <h1 style="font-size:24px;color:#D97757">On vous regrette</h1>
    <p>Vous repassez en compte Découverte. Votre historique est préservé.</p>
    <p>Pour toute question : <a href="mailto:maxime@ikcp.fr">maxime@ikcp.fr</a></p>
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// CRUD ESPACE UTILISATEUR (freemium v2)
// ──────────────────────────────────────────────────────────────

async function handleSirensList(session, env) {
  const rows = await env.D1.prepare('SELECT id, siren, nom_societe, forme_juridique, capital, date_creation, ville, is_primary FROM user_sirens WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC')
    .bind(session.userId).all();
  return json(rows.results || []);
}

async function handleSirensAdd(request, session, env) {
  const { siren } = await request.json().catch(() => ({}));
  if (!siren || !/^\d{9}$/.test(String(siren).replace(/\s/g, '')))
    return json({ error: 'invalid_siren' }, 400);
  const s = String(siren).replace(/\s/g, '');

  // Cartographie via worker ikcp-pappers
  let data = null;
  try {
    const r = await fetch(`${env.IKCP_PAPPERS_URL}/entreprise/${s}/short`);
    data = await r.json();
  } catch (_) { /* ignore — on stocke quand même */ }

  const id = crypto.randomUUID();
  const now = Date.now();
  await env.D1.prepare('INSERT INTO user_sirens (id, user_id, siren, nom_societe, forme_juridique, capital, date_creation, ville, cached_json, last_refreshed_at, is_primary, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, session.userId, s, data?.nom || null, data?.forme_juridique || null, data?.capital || null, data?.date_creation || null, data?.siege?.ville || null, data ? JSON.stringify(data) : null, now, 0, now)
    .run();
  await audit(env, session.userId, 'siren_add', request, { siren: s });
  return json({ ok: true, id, data });
}

async function handleConvList(session, env) {
  const rows = await env.D1.prepare('SELECT id, title, sphere, agent_principal, messages_count, last_message_at FROM conversations WHERE user_id = ? ORDER BY last_message_at DESC LIMIT 50')
    .bind(session.userId).all();
  return json(rows.results || []);
}

async function handleContactsList(session, env) {
  const rows = await env.D1.prepare('SELECT id, category, nom, prenom, societe, email, telephone, ville, notes, is_favorite, last_interaction_at FROM user_contacts WHERE user_id = ? ORDER BY is_favorite DESC, nom ASC')
    .bind(session.userId).all();
  return json(rows.results || []);
}

async function handleContactsAdd(request, session, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.nom || !body.category) return json({ error: 'missing_fields', required: ['nom', 'category'] }, 400);

  // Quota tier discovery : 5 contacts max
  const count = await env.D1.prepare('SELECT COUNT(*) AS n FROM user_contacts WHERE user_id = ?').bind(session.userId).first();
  if (session.tier === 'discovery' && (count?.n || 0) >= 5) {
    return json({ error: 'tier_limit', max: 5, upgrade: 'premium_essentiel' }, 403);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await env.D1.prepare('INSERT INTO user_contacts (id, user_id, category, nom, prenom, societe, adresse, code_postal, ville, pays, telephone, email, site_web, notes, tags_json, is_favorite, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, session.userId, body.category, body.nom, body.prenom || null, body.societe || null, body.adresse || null, body.code_postal || null, body.ville || null, body.pays || 'France', body.telephone || null, body.email || null, body.site_web || null, body.notes || null, body.tags_json || null, body.is_favorite ? 1 : 0, now, now)
    .run();
  await audit(env, session.userId, 'contact_add', request, { category: body.category });
  return json({ ok: true, id });
}

async function handleContactsDelete(id, session, env) {
  await env.D1.prepare('DELETE FROM user_contacts WHERE id = ? AND user_id = ?').bind(id, session.userId).run();
  return json({ ok: true });
}

async function handleAlertsList(request, session, env) {
  const u = new URL(request.url);
  const unread = u.searchParams.get('unread') === '1';
  const sql = unread
    ? 'SELECT id, sphere, source, title, body, url, importance, read_at, created_at FROM alerts WHERE user_id = ? AND read_at IS NULL ORDER BY importance DESC, created_at DESC LIMIT 50'
    : 'SELECT id, sphere, source, title, body, url, importance, read_at, created_at FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
  const rows = await env.D1.prepare(sql).bind(session.userId).all();
  return json(rows.results || []);
}

async function handleDocsList(session, env) {
  const rows = await env.D1.prepare('SELECT id, type, title, r2_key, hash_eidas, signed_at, size_bytes, created_at FROM user_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(session.userId).all();
  return json(rows.results || []);
}

async function handleWatchesList(session, env) {
  const rows = await env.D1.prepare('SELECT id, market, category, query, target_price, last_value, last_checked_at, active, created_at FROM user_watches WHERE user_id = ? AND active = 1 ORDER BY created_at DESC')
    .bind(session.userId).all();
  return json(rows.results || []);
}

async function handleWatchesAdd(request, session, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.market || !body.query) return json({ error: 'missing_fields', required: ['market', 'query'] }, 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.D1.prepare('INSERT INTO user_watches (id, user_id, market, category, query, target_price, last_value, last_checked_at, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id, session.userId, body.market, body.category || null, body.query, body.target_price || null, null, null, 1, now).run();
  await audit(env, session.userId, 'watch_add', request, { market: body.market, query: body.query });
  return json({ ok: true, id });
}

async function handleExportRgpd(session, env) {
  const userId = session.userId;
  const [user, sirens, conversations, contacts, alerts, documents, watches] = await Promise.all([
    env.D1.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first(),
    env.D1.prepare('SELECT * FROM user_sirens WHERE user_id = ?').bind(userId).all(),
    env.D1.prepare('SELECT * FROM conversations WHERE user_id = ?').bind(userId).all(),
    env.D1.prepare('SELECT * FROM user_contacts WHERE user_id = ?').bind(userId).all(),
    env.D1.prepare('SELECT * FROM alerts WHERE user_id = ?').bind(userId).all(),
    env.D1.prepare('SELECT * FROM user_documents WHERE user_id = ?').bind(userId).all(),
    env.D1.prepare('SELECT * FROM user_watches WHERE user_id = ?').bind(userId).all(),
  ]);
  return json({
    export_date: new Date().toISOString(),
    user, sirens: sirens.results, conversations: conversations.results,
    contacts: contacts.results, alerts: alerts.results,
    documents: documents.results, watches: watches.results,
    rgpd_note: 'Vos données souveraines France (Cloudflare WEUR Paris). Pour exercer votre droit à l\'oubli : DELETE /api/v1/me',
  });
}

async function handleDeleteAccount(request, session, env) {
  const userId = session.userId;
  // Cascade — toutes les tables liées
  await Promise.all([
    env.D1.prepare('DELETE FROM user_sirens WHERE user_id = ?').bind(userId).run(),
    env.D1.prepare('DELETE FROM conversations WHERE user_id = ?').bind(userId).run(),
    env.D1.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').bind(userId).run().catch(() => {}),
    env.D1.prepare('DELETE FROM user_contacts WHERE user_id = ?').bind(userId).run(),
    env.D1.prepare('DELETE FROM alerts WHERE user_id = ?').bind(userId).run(),
    env.D1.prepare('DELETE FROM user_documents WHERE user_id = ?').bind(userId).run(),
    env.D1.prepare('DELETE FROM user_watches WHERE user_id = ?').bind(userId).run(),
    env.D1.prepare('DELETE FROM usage_daily WHERE user_id = ?').bind(userId).run().catch(() => {}),
    env.D1.prepare('DELETE FROM audit_index WHERE user_id = ?').bind(userId).run().catch(() => {}),
  ]);
  await env.D1.prepare('UPDATE users SET deleted_at = ?, email = NULL, display_name = NULL, prenom = NULL WHERE id = ?').bind(Date.now(), userId).run();
  await audit(env, userId, 'account_delete', request, {});
  return json({ ok: true, message: 'Compte supprimé. Vos données ont été effacées conformément au RGPD.' });
}
