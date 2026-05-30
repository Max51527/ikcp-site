/**
 * IKCP Client Portal Worker — Cloudflare (freemium v2)
 *
 * Espace membre :
 *  - Auth magic link (zero password) · cookie HttpOnly Secure SameSite=Strict
 *  - Quota Pappers par tier (free 1/mois, premium 10, fo illimité)
 *  - Stripe (optionnel — Sprint 3) : checkout, webhook, portal
 *  - Sync logiciel-gp (polling Bearer service token)
 *
 * Bindings REQUIS :
 *  D1            ikcp-client-db    — npx wrangler d1 execute ikcp-client-db --file=schema.sql --remote
 *  KV            CLIENT_KV         — npx wrangler kv namespace create CLIENT_KV
 *
 * Secrets :
 *  RESEND_API_KEY      (requis pour envoi email — sans ça, lien affiché dans les logs)
 *  CABINET_TOKEN       (optionnel — polling cabinet)
 *  STRIPE_SECRET_KEY   (optionnel — Sprint 3 paiement)
 *  STRIPE_WEBHOOK_SECRET (optionnel)
 *
 * Vars wrangler.toml :
 *  APP_URL      = URL du worker (magic link verify)
 *  FRONT_URL    = URL du front (post-auth redirect)
 *  IKCP_PAPPERS_URL = https://ikcp-pappers.maxime-ead.workers.dev
 *
 * MODE SANS RESEND : si RESEND_API_KEY absent, le lien est affiché en console
 *  → visible via : npx wrangler tail ikcp-client
 *  → ou via Cloudflare Dashboard → Workers → ikcp-client → Logs
 */

// Règle Maxime : le FREE ne consomme AUCUN token LLM.
// free = simulateurs (JS local, 0 token) + 1 cartographie SIREN/mois (Pappers, 0 token LLM).
// Marcel conversationnel (LLM) = Premium. Le teaser Marcel public reste géré par
// le widget plafonné sur les pages publiques (séparé de l'espace membre).
const TIER_LIMITS = {
  // Freemium « outil 100% complet » : tous les univers VISIBLES pour tous,
  // usage rationné par tier. Free = avant-goût (largeur Sonnet) ; profondeur
  // (Opus + veille Perplexity) réservée aux payants (gérée côté Marcel).
  free:    { pappers: 1,        marcel_msgs: 5,        marcel_memory_days: 0 },
  premium: { pappers: 10,       marcel_msgs: Infinity, marcel_memory_days: 90 },
  fo:      { pappers: Infinity, marcel_msgs: Infinity, marcel_memory_days: Infinity },
};

const COOKIE_NAME = 'ikcp_session';
const SESSION_TTL_DAYS = 30;
const MAGIC_TTL_MIN = 15;

export default {
  async fetch(request, env) {
    _reqOrigin = request.headers.get('Origin') || ''; // capture avant tout
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

      // ─── ACCÈS GOUVERNÉ — invitation + parrainage (public) ──
      if (path === '/api/v1/invite/check' && method === 'POST') return await handleInviteCheck(request, env);
      if (path === '/api/v1/invite/apply' && method === 'POST') return await handleInviteApply(request, env);

      // ─── FEEDBACK bêta (public) → email Maxime via Resend ──
      if (path === '/api/v1/feedback' && method === 'POST') return await handleFeedback(request, env);

      // ─── ADMIN (x-admin-secret) — validation des candidatures ──
      if (path.startsWith('/api/v1/admin/')) return await handleAdmin(request, env, path, method);

      // ─── AUTHENTICATED ROUTES ──────────────────────────
      const session = await requireSession(request, env);
      if (!session) return json({ error: 'unauthorized' }, 401);

      if (path === '/api/v1/me/referral' && method === 'GET') return await handleReferralCode(session, env);

      if (path === '/api/v1/me' && method === 'GET') return await handleMe(session, env);
      if (path === '/api/v1/usage' && method === 'GET') return await handleUsage(session, env);
      if (path === '/api/v1/usage/marcel' && method === 'POST') return await handleMarcelUsage(session, env);
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

      if (path === '/api/v1/me/collections' && method === 'GET') return await handleCollectionsList(session, env);
      if (path === '/api/v1/me/collections' && method === 'POST') return await handleCollectionsAdd(request, session, env);
      const colm = path.match(/^\/api\/v1\/me\/collections\/([a-f0-9-]+)$/);
      if (colm && method === 'DELETE') return await handleCollectionsDelete(colm[1], session, env);

      if (path === '/api/v1/me/export' && method === 'GET') return await handleExportRgpd(session, env);
      if (path === '/api/v1/me' && method === 'DELETE') return await handleDeleteAccount(request, session, env);

      // ── Prototype Sprint 2 — profil, consentements, audit log
      if (path === '/api/v1/me/profile' && method === 'POST') return await handleProfileSave(request, session, env);
      if (path === '/api/v1/me/consents' && method === 'POST') return await handleConsentsSave(request, session, env);
      if (path === '/api/v1/me/audit-log' && method === 'GET') return await handleAuditLog(session, env);

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

  const isE2E = email.toLowerCase() === 'e2e-test@ikcp.eu'; // [E2E-TEST] exempté du rate-limit
  const rlKey = `rl:magic:${email.toLowerCase()}`;
  if (!isE2E) {
    const count = parseInt((await env.CLIENT_KV.get(rlKey)) || '0');
    if (count >= 3) return json({ error: 'rate_limited', retry_after_minutes: 60 }, 429);
    await env.CLIENT_KV.put(rlKey, String(count + 1), { expirationTtl: 3600 });
  }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + MAGIC_TTL_MIN * 60_000;

  await env.D1.prepare(
    'INSERT INTO magic_tokens (token_hash, email, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)'
  ).bind(tokenHash, email.toLowerCase(), now, expiresAt, request.headers.get('CF-Connecting-IP') || '').run();

  const verifyUrl = `${env.APP_URL}/auth/verify?token=${token}`;
  // [E2E-TEST TEMPORAIRE] compte de test technique : renvoie le lien sans email.
  // Gated sur un email factice unique — à retirer après validation du parcours.
  if (email.toLowerCase() === 'e2e-test@ikcp.eu') {
    return json({ ok: true, e2e: true, dev_verify_url: verifyUrl });
  }
  const emailSent = await sendEmail(env, { to: email, subject: 'Votre lien de connexion · IKCP', html: emailTemplateMagic(verifyUrl) });

  // MODE SANS RESEND : log le lien en console (visible wrangler tail ou dashboard CF)
  if (!emailSent) {
    console.log(`[DEV] Magic link pour ${email} : ${verifyUrl}`);
  }

  await audit(env, null, 'magic_sent', request, { email });
  return json({
    ok: true,
    message: emailSent
      ? 'Lien envoyé. Vérifiez votre boîte mail (et les spams). Valide 15 minutes.'
      : 'Lien généré (mode dev — email non configuré). Consultez les logs worker.',
    // En mode dev uniquement (sans Resend), renvoie le lien dans la réponse pour tests
    ...((!emailSent && !env.PRODUCTION) ? { dev_verify_url: verifyUrl } : {}),
  });
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
    // Accès gouverné : si une candidature a été APPROUVÉE pour cet email,
    // on crée le compte directement au tier accordé (bêta). Sinon 'free'.
    let grantedTier = 'free', src = 'organic';
    try {
      const appr = await env.D1.prepare("SELECT grant_tier FROM member_applications WHERE email = ? AND status = 'approved' ORDER BY reviewed_at DESC LIMIT 1").bind(row.email).first();
      if (appr && appr.grant_tier) { grantedTier = appr.grant_tier; src = 'invitation'; }
    } catch (_) { /* table absente = pas de candidature, on reste free */ }
    const id = crypto.randomUUID();
    await env.D1.prepare('INSERT INTO users (id, email, tier, created_at, last_login_at, source) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, row.email, grantedTier, Date.now(), Date.now(), src).run();
    user = { id, email: row.email, tier: grantedTier };
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

  // SameSite=None requis : le front (ikcp.eu) et l'API (…workers.dev) sont
  // sur des domaines différents → un cookie Strict/Lax ne serait jamais
  // renvoyé sur les fetch cross-site, d'où la boucle de login. None+Secure
  // permet l'envoi cross-site (durcissement api.ikcp.eu prévu ensuite).
  const cookieValue = `${COOKIE_NAME}=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`;
  // On passe AUSSI le token dans le fragment d'URL (#s=...) : le fragment
  // n'est jamais envoyé au serveur, et le front le récupère puis le retire
  // de l'URL immédiatement → session par jeton, robuste cross-domaine.
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${env.FRONT_URL || 'https://ikcp.eu'}/app/dashboard.html#s=${sessionToken}`,
      'Set-Cookie': cookieValue,
    },
  });
}

async function handleLogout(session, env) {
  await env.D1.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?').bind(Date.now(), session.token_hash).run();
  return new Response(null, {
    status: 302,
    headers: { 'Location': `${env.FRONT_URL || 'https://ikcp.eu'}/app/index.html`, 'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0` },
  });
}

async function requireSession(request, env) {
  // Session par JETON (contourne le blocage des cookies tiers cross-domaine) :
  // on accepte le token soit dans l'en-tête Authorization: Bearer, soit dans
  // le cookie ikcp_session. Le front (api.js) envoie le Bearer en priorité.
  let token = null;
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
  if (!token) {
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (m) token = m[1];
  }
  if (!token) return null;
  const tokenHash = await sha256(token);
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
  // Récupère les champs étendus en DB (prenom, display_name, profile_json)
  const [userRow, usage] = await Promise.all([
    env.D1.prepare('SELECT id, email, tier, display_name, prenom, profile_json, consents_json, created_at, last_login_at FROM users WHERE id = ?')
      .bind(session.user_id).first(),
    env.D1.prepare('SELECT pappers_lookups, marcel_messages FROM usage WHERE user_id = ? AND year_month = ?')
      .bind(session.user_id, month).first(),
  ]);
  const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free;
  // Retourne les champs à la racine (compatible avec le front)
  return json({
    id:           userRow?.id || session.user_id,
    email:        userRow?.email || session.email,
    tier:         userRow?.tier || session.tier,
    display_name: userRow?.display_name || null,
    prenom:       userRow?.prenom || null,
    profile_json: userRow?.profile_json || null,
    consents_json: userRow?.consents_json || null,
    created_at:   userRow?.created_at || null,
    last_login_at: userRow?.last_login_at || null,
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
// FEEDBACK bêta → email Maxime (Resend déjà actif). Pas de stockage requis.
// ──────────────────────────────────────────────────────────────
async function handleFeedback(request, env) {
  const b = await request.json().catch(() => ({}));
  const besoin = (b.besoin || '').toString().trim();
  if (besoin.length < 5) return json({ ok: false, error: 'feedback_trop_court' }, 400);
  const cats = Array.isArray(b.categories) ? b.categories.join(', ') : (b.categories || '');
  const prio = (b.priorite || 'moyenne').toString();
  const email = (b.email || '').toString().slice(0, 254);
  const page = (b.page || '').toString().slice(0, 200);
  const source = (b.source || '').toString().slice(0, 60);
  const esc = s => (s == null ? '' : String(s)).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#1B2A4A">📨 Retour bêta IKCP</h2>
    <p><b>Priorité :</b> ${esc(prio)} &nbsp;·&nbsp; <b>Catégories :</b> ${esc(cats) || '—'}</p>
    <p style="background:#F4EFE7;border-left:3px solid #C9A96E;padding:12px 14px;white-space:pre-wrap">${esc(besoin)}</p>
    <p style="font-size:13px;color:#6B5D52"><b>De :</b> ${esc(email) || 'anonyme'} &nbsp;·&nbsp; <b>Page :</b> ${esc(page)} &nbsp;·&nbsp; <b>Source :</b> ${esc(source)}</p>
  </div>`;
  const sent = await sendEmail(env, { to: 'maxime@ikcp.fr', subject: `[IKCP Bêta] Retour ${prio}${cats ? ' · ' + cats : ''}`, html });
  await emitEvent(env, null, 'beta_feedback', { categories: cats, priorite: prio, email, page, source }).catch(() => {});
  return json({ ok: true, emailed: !!sent });
}

// ──────────────────────────────────────────────────────────────
// MARCEL — quota mensuel (freemium) check + incrément
// Appelé par le worker Marcel AVANT de répondre (utilisateur connecté).
// premium/fo = illimité ; free = TIER_LIMITS.free.marcel_msgs / mois.
// ──────────────────────────────────────────────────────────────
async function handleMarcelUsage(session, env) {
  const month = new Date().toISOString().slice(0, 7);
  const limit = (TIER_LIMITS[session.tier] || TIER_LIMITS.free).marcel_msgs;
  if (limit === Infinity) {
    // payant : on incrémente pour les stats, jamais de blocage
    await env.D1.prepare(
      'INSERT INTO usage (user_id, year_month, marcel_messages) VALUES (?, ?, 1) ' +
      'ON CONFLICT(user_id, year_month) DO UPDATE SET marcel_messages = marcel_messages + 1'
    ).bind(session.user_id, month).run();
    return json({ allowed: true, unlimited: true });
  }
  const usage = await env.D1.prepare('SELECT marcel_messages FROM usage WHERE user_id = ? AND year_month = ?').bind(session.user_id, month).first();
  const used = usage?.marcel_messages || 0;
  if (used >= limit) {
    return json({ allowed: false, tier: session.tier, used, limit, reset_at: nextMonthFirst(),
      upgrade_url: `${env.FRONT_URL || 'https://ikcp.eu'}/app/profil.html` });
  }
  await env.D1.prepare(
    'INSERT INTO usage (user_id, year_month, marcel_messages) VALUES (?, ?, 1) ' +
    'ON CONFLICT(user_id, year_month) DO UPDATE SET marcel_messages = marcel_messages + 1'
  ).bind(session.user_id, month).run();
  return json({ allowed: true, used: used + 1, limit, remaining: limit - used - 1 });
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
      upgrade_url: `${env.FRONT_URL || 'https://ikcp.eu'}/app/profil.html`,
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
  params.append('success_url', `${env.FRONT_URL || 'https://ikcp.eu'}/app/dashboard.html?upgraded=1`);
  params.append('cancel_url', `${env.FRONT_URL || 'https://ikcp.eu'}/app/dashboard.html`);
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
  params.append('return_url', `${env.FRONT_URL || 'https://ikcp.eu'}/app/profil.html`);
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
    db:            !!env.D1,
    kv:            !!env.CLIENT_KV,
    resend:        !!env.RESEND_API_KEY,
    resend_from:   env.RESEND_FROM || 'noreply@ikcp.eu (défaut)',
    pappers_url:   !!env.IKCP_PAPPERS_URL,
    cabinet:       !!env.CABINET_TOKEN,
    stripe:        !!env.STRIPE_SECRET_KEY,      // optionnel Sprint 3
    dev_mode:      !env.RESEND_API_KEY,          // true si pas de Resend
  };
}

// Origines autorisées (worker + pages.dev + domaine custom)
const ALLOWED_ORIGINS = [
  'https://ikcp.eu', 'https://www.ikcp.eu',
  'https://ikcp-eu.pages.dev',
  'https://ikcp-chat.maxime-ead.workers.dev',
  'http://localhost:5500', 'http://localhost:3000', 'http://127.0.0.1:5500',
  'null', '',
];
// Module-level origin — safe en CF Workers (chaque requête = isolat V8 dédié)
let _reqOrigin = '';

function corsHeaders(origin = '') {
  const o = origin || _reqOrigin;
  const ok = ALLOWED_ORIGINS.includes(o) || (o && (o.endsWith('.ikcp.eu') || o.endsWith('.workers.dev') || o.endsWith('.pages.dev')));
  return {
    'Access-Control-Allow-Origin': ok ? (o || 'https://ikcp.eu') : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}
function cors(status) { return new Response(null, { status, headers: corsHeaders() }); }

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
  if (!env.RESEND_API_KEY) {
    console.warn('[sendEmail] RESEND_API_KEY absent — email non envoyé');
    return false; // indique l'échec proprement
  }
  // Sender : noreply@ikcp.eu si domaine vérifié Resend, sinon fallback domaine test
  const from = env.RESEND_FROM || 'IKCP <noreply@ikcp.eu>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[sendEmail] Resend error:', res.status, err.slice(0, 300));
    return false;
  }
  return true; // succès
}

async function audit(env, userId, action, request, metadata = {}) {
  const ip = request ? (request.headers.get('CF-Connecting-IP') || '') : '';
  const ua = request ? (request.headers.get('User-Agent') || '').slice(0, 500) : '';
  await env.D1.prepare('INSERT INTO audit_log (id, user_id, action, ip, user_agent, metadata_json, ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, action, ip, ua, JSON.stringify(metadata), Date.now()).run();
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
    <p>Pour aller plus loin : <a href="https://ikcp.eu/app/profil.html" style="color:#D97757">Premium 29 €/mois</a> — 10 lookups, Marcel personnalisé, cartographie auto.</p>
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
    .bind(session.user_id).all();
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
    .bind(id, session.user_id, s, data?.nom || null, data?.forme_juridique || null, data?.capital || null, data?.date_creation || null, data?.siege?.ville || null, data ? JSON.stringify(data) : null, now, 0, now)
    .run();
  await audit(env, session.user_id, 'siren_add', request, { siren: s });
  return json({ ok: true, id, data });
}

async function handleConvList(session, env) {
  const rows = await env.D1.prepare('SELECT id, title, sphere, agent_principal, messages_count, last_message_at FROM conversations WHERE user_id = ? ORDER BY last_message_at DESC LIMIT 50')
    .bind(session.user_id).all();
  return json(rows.results || []);
}

async function handleContactsList(session, env) {
  const rows = await env.D1.prepare('SELECT id, category, nom, prenom, societe, email, telephone, ville, notes, is_favorite, last_interaction_at FROM user_contacts WHERE user_id = ? ORDER BY is_favorite DESC, nom ASC')
    .bind(session.user_id).all();
  return json(rows.results || []);
}

async function handleContactsAdd(request, session, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.nom || !body.category) return json({ error: 'missing_fields', required: ['nom', 'category'] }, 400);

  // Quota tier discovery : 5 contacts max
  const count = await env.D1.prepare('SELECT COUNT(*) AS n FROM user_contacts WHERE user_id = ?').bind(session.user_id).first();
  if (session.tier === 'free' && (count?.n || 0) >= 5) {
    return json({ error: 'tier_limit', max: 5, upgrade: 'premium' }, 403);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await env.D1.prepare('INSERT INTO user_contacts (id, user_id, category, nom, prenom, societe, adresse, code_postal, ville, pays, telephone, email, site_web, notes, tags_json, is_favorite, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, session.user_id, body.category, body.nom, body.prenom || null, body.societe || null, body.adresse || null, body.code_postal || null, body.ville || null, body.pays || 'France', body.telephone || null, body.email || null, body.site_web || null, body.notes || null, body.tags_json || null, body.is_favorite ? 1 : 0, now, now)
    .run();
  await audit(env, session.user_id, 'contact_add', request, { category: body.category });
  return json({ ok: true, id });
}

async function handleContactsDelete(id, session, env) {
  await env.D1.prepare('DELETE FROM user_contacts WHERE id = ? AND user_id = ?').bind(id, session.user_id).run();
  return json({ ok: true });
}

async function handleAlertsList(request, session, env) {
  const u = new URL(request.url);
  const unread = u.searchParams.get('unread') === '1';
  const sql = unread
    ? 'SELECT id, sphere, source, title, body, url, importance, read_at, created_at FROM alerts WHERE user_id = ? AND read_at IS NULL ORDER BY importance DESC, created_at DESC LIMIT 50'
    : 'SELECT id, sphere, source, title, body, url, importance, read_at, created_at FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
  const rows = await env.D1.prepare(sql).bind(session.user_id).all();
  return json(rows.results || []);
}

async function handleDocsList(session, env) {
  const rows = await env.D1.prepare('SELECT id, type, title, r2_key, hash_eidas, signed_at, size_bytes, created_at FROM user_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(session.user_id).all();
  return json(rows.results || []);
}

async function handleWatchesList(session, env) {
  const rows = await env.D1.prepare('SELECT id, market, category, query, target_price, last_value, last_checked_at, active, created_at FROM user_watches WHERE user_id = ? AND active = 1 ORDER BY created_at DESC')
    .bind(session.user_id).all();
  return json(rows.results || []);
}

async function handleWatchesAdd(request, session, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.market || !body.query) return json({ error: 'missing_fields', required: ['market', 'query'] }, 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.D1.prepare('INSERT INTO user_watches (id, user_id, market, category, query, target_price, last_value, last_checked_at, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id, session.user_id, body.market, body.category || null, body.query, body.target_price || null, null, null, 1, now).run();
  await audit(env, session.user_id, 'watch_add', request, { market: body.market, query: body.query });
  return json({ ok: true, id });
}

// ─── Collections (montres, autos, vins, art, joaillerie…) ──────────
// Table user_collection_items (schema-collections.sql). On crée la table
// à la volée si absente, pour ne pas dépendre d'une migration manuelle.
async function ensureCollectionsTable(env) {
  await env.D1.prepare(`
    CREATE TABLE IF NOT EXISTS user_collection_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT, model TEXT, reference TEXT, year_made INTEGER, quantity INTEGER DEFAULT 1,
      acquired_at TEXT, acquired_from TEXT, acquired_price REAL, acquired_currency TEXT DEFAULT 'EUR',
      current_value REAL, current_value_at INTEGER, current_value_source TEXT,
      photo_r2_key TEXT, certificate_r2_key TEXT, invoice_r2_key TEXT,
      notes TEXT, tags_json TEXT, status TEXT DEFAULT 'in_collection',
      surveillance_active INTEGER DEFAULT 1,
      created_at INTEGER, updated_at INTEGER
    )
  `).run();
}

async function handleCollectionsList(session, env) {
  await ensureCollectionsTable(env);
  const rows = await env.D1.prepare(
    `SELECT id, category, brand, model, reference, year_made, quantity,
            acquired_at, acquired_from, acquired_price, acquired_currency,
            current_value, current_value_at, current_value_source,
            notes, tags_json, status, surveillance_active, created_at, updated_at
     FROM user_collection_items WHERE user_id = ? ORDER BY category ASC, created_at DESC`
  ).bind(session.user_id).all();
  return json(rows.results || []);
}

async function handleCollectionsAdd(request, session, env) {
  await ensureCollectionsTable(env);
  const body = await request.json().catch(() => ({}));
  if (!body.category) return json({ error: 'missing_fields', required: ['category'] }, 400);
  // Le suivi de collections est une fonctionnalité Premium / Family Office.
  if (session.tier === 'free') return json({ error: 'tier_limit', upgrade: 'premium' }, 403);

  const id = crypto.randomUUID();
  const now = Date.now();
  await env.D1.prepare(
    `INSERT INTO user_collection_items
       (id, user_id, category, brand, model, reference, year_made, quantity,
        acquired_at, acquired_from, acquired_price, acquired_currency,
        current_value, current_value_at, current_value_source,
        notes, tags_json, status, surveillance_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, session.user_id, body.category, body.brand || null, body.model || null,
    body.reference || null, body.year_made || null, body.quantity || 1,
    body.acquired_at || null, body.acquired_from || null, body.acquired_price || null, body.acquired_currency || 'EUR',
    body.current_value || null, body.current_value ? now : null, body.current_value_source || null,
    body.notes || null, body.tags_json || null, body.status || 'in_collection',
    body.surveillance_active === 0 ? 0 : 1, now, now
  ).run();
  await audit(env, session.user_id, 'collection_add', request, { category: body.category });
  return json({ ok: true, id });
}

async function handleCollectionsDelete(id, session, env) {
  await env.D1.prepare('DELETE FROM user_collection_items WHERE id = ? AND user_id = ?').bind(id, session.user_id).run();
  await audit(env, session.user_id, 'collection_delete', null, { id });
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════
// ACCÈS GOUVERNÉ — invitation (clients directs) + parrainage (membres)
// + candidature soumise à la validation de Maxime.
// NB : ne modifie PAS le login actuel — c'est une couche additionnelle.
// Le hard-gate (bloquer un signup sans candidature approuvée) viendra
// derrière le flag env.GATE_SIGNUPS quand Maxime le décidera.
// ════════════════════════════════════════════════════════════════
async function ensureGovernanceTables(env) {
  await env.D1.prepare(`
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,                         -- 'direct' | 'parrainage'
      created_by TEXT,                            -- 'admin' ou user_id du parrain
      email TEXT,                                 -- destinataire éventuel
      status TEXT DEFAULT 'active',               -- 'active' | 'revoked'
      max_uses INTEGER DEFAULT 1, uses INTEGER DEFAULT 0,
      created_at INTEGER, expires_at INTEGER
    )
  `).run();
  await env.D1.prepare(`
    CREATE TABLE IF NOT EXISTS member_applications (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT,
      referrer_user_id TEXT, prenom TEXT, profile_json TEXT, siren TEXT,
      patrimoine_declare TEXT,
      status TEXT DEFAULT 'pending',              -- 'pending' | 'approved' | 'rejected'
      grant_tier TEXT,                            -- tier accordé à l'approbation (premium | fo)
      note TEXT, created_at INTEGER, reviewed_at INTEGER, reviewed_by TEXT
    )
  `).run();
  // Migration douce si la table existait avant l'ajout de grant_tier
  try { await env.D1.prepare('ALTER TABLE member_applications ADD COLUMN grant_tier TEXT').run(); } catch (_) { /* colonne déjà présente */ }
}

function genInviteCode() {
  const a = crypto.randomUUID().replace(/[^a-z0-9]/gi, '').toUpperCase();
  return 'IKCP-' + a.slice(0, 6);
}

async function findActiveInvite(env, code) {
  if (!code) return null;
  const inv = await env.D1.prepare('SELECT * FROM invitations WHERE code = ?').bind(String(code).trim().toUpperCase()).first();
  if (!inv) return null;
  if (inv.status !== 'active') return null;
  if (inv.expires_at && Date.now() > inv.expires_at) return null;
  if (inv.max_uses && inv.uses >= inv.max_uses) return null;
  return inv;
}

async function handleInviteCheck(request, env) {
  await ensureGovernanceTables(env);
  const { code } = await request.json().catch(() => ({}));
  const inv = await findActiveInvite(env, code);
  if (!inv) return json({ valid: false }, 200);
  return json({ valid: true, type: inv.type });
}

async function handleInviteApply(request, env) {
  await ensureGovernanceTables(env);
  const b = await request.json().catch(() => ({}));
  const email = (b.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
  const inv = await findActiveInvite(env, b.code);
  if (!inv) return json({ error: 'invite_invalid' }, 403);

  // Une seule candidature en cours par email
  const existing = await env.D1.prepare("SELECT id, status FROM member_applications WHERE email = ? AND status = 'pending'").bind(email).first();
  if (existing) return json({ ok: true, application_id: existing.id, already: true });

  const id = crypto.randomUUID();
  await env.D1.prepare(
    `INSERT INTO member_applications (id, email, code, referrer_user_id, prenom, profile_json, siren, patrimoine_declare, status, created_at)
     VALUES (?,?,?,?,?,?,?,?, 'pending', ?)`
  ).bind(id, email, inv.code, inv.type === 'parrainage' ? inv.created_by : null,
    b.prenom || null, b.profile_json || null, b.siren || null, b.patrimoine_declare || null, Date.now()).run();
  await env.D1.prepare('UPDATE invitations SET uses = uses + 1 WHERE id = ?').bind(inv.id).run();
  await emitEvent(env, null, 'application_submitted', { email, code: inv.code, type: inv.type });
  return json({ ok: true, application_id: id });
}

async function handleReferralCode(session, env) {
  await ensureGovernanceTables(env);
  // Le parrainage est réservé aux membres premium / fo.
  if (session.tier === 'free') return json({ error: 'tier_limit', upgrade: 'premium' }, 403);
  let inv = await env.D1.prepare("SELECT code, uses, max_uses FROM invitations WHERE type = 'parrainage' AND created_by = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .bind(session.user_id).first();
  if (!inv) {
    const code = genInviteCode();
    await env.D1.prepare('INSERT INTO invitations (id, code, type, created_by, status, max_uses, uses, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), code, 'parrainage', session.user_id, 'active', 10, 0, Date.now()).run();
    inv = { code, uses: 0, max_uses: 10 };
  }
  return json({ code: inv.code, uses: inv.uses, max_uses: inv.max_uses, link: `https://ikcp.eu/app/beta-invite.html?code=${inv.code}` });
}

// ─── Admin (header x-admin-secret) ───
async function handleAdmin(request, env, path, method) {
  if (!env.ADMIN_SECRET) return json({ error: 'admin_not_configured' }, 503);
  if (request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) return json({ error: 'forbidden' }, 403);
  await ensureGovernanceTables(env);

  // Lister les candidatures
  if (path === '/api/v1/admin/applications' && method === 'GET') {
    const u = new URL(request.url);
    const status = u.searchParams.get('status') || 'pending';
    const rows = await env.D1.prepare('SELECT * FROM member_applications WHERE status = ? ORDER BY created_at DESC LIMIT 200').bind(status).all();
    return json(rows.results || []);
  }
  // Décision sur une candidature (approve → accorde un tier bêta)
  const dm = path.match(/^\/api\/v1\/admin\/applications\/([a-f0-9-]+)\/decision$/);
  if (dm && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const decision = b.decision === 'approve' ? 'approved' : 'rejected';
    const grantTier = decision === 'approved'
      ? (['premium', 'fo'].includes(b.grant_tier) ? b.grant_tier : 'fo')   // fondateurs = FO par défaut
      : null;
    const appRow = await env.D1.prepare('SELECT email FROM member_applications WHERE id = ?').bind(dm[1]).first();
    await env.D1.prepare('UPDATE member_applications SET status = ?, grant_tier = ?, note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?')
      .bind(decision, grantTier, b.note || null, Date.now(), 'maxime', dm[1]).run();
    // Si le client a déjà un compte → on applique le tier tout de suite.
    if (decision === 'approved' && appRow?.email) {
      await env.D1.prepare('UPDATE users SET tier = ? WHERE email = ?').bind(grantTier, appRow.email).run();
      await emitEvent(env, null, 'application_approved', { email: appRow.email, tier: grantTier });
    }
    return json({ ok: true, status: decision, grant_tier: grantTier });
  }
  // Générer un code d'invitation direct
  if (path === '/api/v1/admin/invitations' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const code = genInviteCode();
    const expires = b.expires_days ? Date.now() + b.expires_days * 86_400_000 : null;
    await env.D1.prepare('INSERT INTO invitations (id, code, type, created_by, email, status, max_uses, uses, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), code, 'direct', 'admin', b.email || null, 'active', b.max_uses || 1, 0, Date.now(), expires).run();
    return json({ ok: true, code, link: `https://ikcp.eu/app/beta-invite.html?code=${code}` });
  }
  // Statistiques de pilotage (cockpit)
  if (path === '/api/v1/admin/stats' && method === 'GET') {
    const month = new Date().toISOString().slice(0, 7);
    const safe = async (q, ...b) => { try { return (await env.D1.prepare(q).bind(...b).first())?.n || 0; } catch (_) { return 0; } };
    const [free, premium, fo, pending, marcelMonth, signups7d] = await Promise.all([
      safe("SELECT COUNT(*) n FROM users WHERE tier='free'"),
      safe("SELECT COUNT(*) n FROM users WHERE tier='premium'"),
      safe("SELECT COUNT(*) n FROM users WHERE tier='fo'"),
      safe("SELECT COUNT(*) n FROM member_applications WHERE status='pending'"),
      safe('SELECT SUM(marcel_messages) n FROM usage WHERE year_month=?', month),
      safe('SELECT COUNT(*) n FROM users WHERE created_at > ?', Date.now() - 7 * 86400000),
    ]);
    const members = free + premium + fo;
    // Estimation coût IA du mois (Premium ~5€/client, FO ~30€ — voir PRICING-2026)
    const coutIA = Math.round(premium * 5 + fo * 30);
    const revenu = premium * 59; // Premium 59€ (FO sur devis, non compté)
    return json({ members, by_tier: { free, premium, fo }, pending_applications: pending,
      marcel_messages_month: marcelMonth, signups_7d: signups7d,
      revenu_premium_estime: revenu, cout_ia_estime: coutIA, marge_estimee: revenu - coutIA });
  }
  // Liste des membres
  if (path === '/api/v1/admin/members' && method === 'GET') {
    const month = new Date().toISOString().slice(0, 7);
    try {
      const rows = await env.D1.prepare(
        'SELECT u.id, u.email, u.tier, u.prenom, u.created_at, u.last_login_at, u.source, ' +
        '(SELECT marcel_messages FROM usage WHERE user_id = u.id AND year_month = ?) AS marcel_month ' +
        'FROM users u ORDER BY u.created_at DESC LIMIT 200'
      ).bind(month).all();
      return json(rows.results || []);
    } catch (e) { return json({ error: 'members_failed', detail: e.message }, 500); }
  }
  // Définir le tier d'un membre (test / gestion manuelle)
  if (path === '/api/v1/admin/set-tier' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || '').toString().trim().toLowerCase();
    const tier = ['free', 'premium', 'fo'].includes(b.tier) ? b.tier : null;
    if (!email || !tier) return json({ error: 'email_et_tier_requis' }, 400);
    const u = await env.D1.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (!u) return json({ error: 'membre_introuvable', hint: 'Le membre doit s\'être connecté au moins une fois.' }, 404);
    await env.D1.prepare('UPDATE users SET tier = ? WHERE id = ?').bind(tier, u.id).run();
    await emitEvent(env, u.id, 'tier_set_admin', { email, tier }).catch(() => {});
    return json({ ok: true, email, tier });
  }
  // Retours bêta récents (events)
  if (path === '/api/v1/admin/feedback' && method === 'GET') {
    try {
      const rows = await env.D1.prepare("SELECT id, payload_json, ts FROM events WHERE type='beta_feedback' ORDER BY ts DESC LIMIT 100").all();
      return json(rows.results || []);
    } catch (_) { return json([]); }
  }
  return json({ error: 'not_found' }, 404);
}

async function handleExportRgpd(session, env) {
  const userId = session.user_id;
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

async function handleProfileSave(request, session, env) {
  const body = await request.json().catch(() => ({}));
  const { profile_json, prenom } = body;
  if (!profile_json) return json({ error: 'profile_json_required' }, 400);
  await env.D1.prepare('UPDATE users SET profile_json = ?, prenom = COALESCE(?, prenom), last_seen = ? WHERE id = ?')
    .bind(profile_json, prenom || null, Date.now(), session.user_id).run();
  await audit(env, session.user_id, 'profile_save', request, { has_prenom: !!prenom });
  return json({ ok: true });
}

async function handleConsentsSave(request, session, env) {
  const body = await request.json().catch(() => ({}));
  const { consents } = body;
  if (typeof consents !== 'object' || consents === null) return json({ error: 'consents_required' }, 400);
  await env.D1.prepare('UPDATE users SET consents_json = ?, marketing_consent = ?, last_seen = ? WHERE id = ?')
    .bind(JSON.stringify(consents), consents.marketing ? 1 : 0, Date.now(), session.user_id).run();
  await audit(env, session.user_id, 'consents_update', request, { keys: Object.keys(consents) });
  return json({ ok: true, saved: consents });
}

async function handleAuditLog(session, env) {
  const rows = await env.D1.prepare('SELECT id, action, ip, user_agent, metadata_json, ts FROM audit_log WHERE user_id = ? ORDER BY ts DESC LIMIT 30')
    .bind(session.user_id).all();
  return json((rows.results || []).map(r => ({
    id: r.id,
    action: r.action,
    user_agent: (r.user_agent || '').slice(0, 80),
    ip_masked: maskIp(r.ip),
    metadata: r.metadata_json ? safeParseJson(r.metadata_json) : null,
    ts: r.ts,
    ts_iso: new Date(r.ts).toISOString(),
  })));
}

function maskIp(ip) {
  if (!ip) return '—';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::****'; // IPv6
  return ip.split('.').slice(0, 2).join('.') + '.x.x'; // IPv4
}
function safeParseJson(s) { try { return JSON.parse(s); } catch (_) { return s; } }

async function handleDeleteAccount(request, session, env) {
  const userId = session.user_id;
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
