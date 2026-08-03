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

import STRATEGIES_CONTENT from './strategies-content.json'; // bundlé par wrangler — Bibliothèque des stratégies dirigeant (gated has_strategies)

// Règle Maxime : le FREE ne consomme AUCUN token LLM.
// free = simulateurs (JS local, 0 token) + 1 cartographie SIREN/mois (Pappers, 0 token LLM).
// Marcel conversationnel (LLM) = Premium. Le teaser Marcel public reste géré par
// le widget plafonné sur les pages publiques (séparé de l'espace membre).
const TIER_LIMITS = {
  // Freemium « outil 100% complet » : tous les univers VISIBLES pour tous,
  // usage rationné par tier. Free = avant-goût (largeur Sonnet) ; profondeur
  // (Opus + veille Perplexity) réservée aux payants (gérée côté Marcel).
  free:    { pappers: 1,        marcel_msgs: 5,        marcel_memory_days: 0,        powens: false },
  premium: { pappers: 10,       marcel_msgs: Infinity, marcel_memory_days: 90,       powens: true },
  fo:      { pappers: Infinity, marcel_msgs: Infinity, marcel_memory_days: Infinity, powens: true },
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
      if (path === '/health') return json({ status: 'ok', service: 'ikcp-client', version: '2.0' }); // M1 : cartographie des bindings retirée (ne pas exposer la conf à un anonyme)

      // ─── CONTENU ÉDITORIAL — surcharges publiées depuis /app/redaction ──
      // Public et cacheable : cms-hydrate.js le fusionne par-dessus _data/*.json.
      // Renvoie {} tant que rien n'a été édité → coût quasi nul.
      if (path === '/api/v1/contenu' && method === 'GET') return await handleContenuPublic(env);
      if (path === '/auth/send' && method === 'POST') return await handleAuthSend(request, env);
      if (path === '/auth/verify' && method === 'GET') return await handleAuthVerify(request, env);
      if (path === '/auth/demo' && method === 'POST') return await handleAuthDemo(request, env);
      if (path === '/auth/login' && method === 'POST') return await handleAuthLogin(request, env);
      if (path === '/stripe/webhook' && method === 'POST') return await handleStripeWebhook(request, env);

      // ─── DIAGNOSTIC : vérifier que le tarif "mensuel"/"annuel" configuré
      // correspond vraiment à l'intervalle Stripe attendu (jamais renvoyé au
      // client normal — clé dédiée, jamais la même qu'ADMIN_SECRET). ──────
      if (path === '/diag/stripe-prices' && method === 'POST') {
        if (!env.STRIPE_DIAG_ADMIN) return json({ error: 'diag_admin_missing', hint: 'Pose STRIPE_DIAG_ADMIN sur ikcp-client.' }, 503);
        if (request.headers.get('X-Admin-Token') !== env.STRIPE_DIAG_ADMIN) return json({ error: 'unauthorized' }, 401);
        if (!env.STRIPE_SECRET_KEY) return json({ error: 'stripe_key_missing' }, 503);
        const ids = { monthly: env.STRIPE_PRICE_PREMIUM_MONTHLY, yearly: env.STRIPE_PRICE_PREMIUM_YEARLY };
        const out = {};
        for (const [label, id] of Object.entries(ids)) {
          if (!id) { out[label] = { error: 'id_absent' }; continue; }
          try {
            const r = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
              headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
            });
            const d = await r.json();
            if (!r.ok) { out[label] = { error: d.error?.message || 'stripe_error', status: r.status }; continue; }
            out[label] = {
              id,
              montant: d.unit_amount ? (d.unit_amount / 100) : null,
              devise: d.currency,
              intervalle: d.recurring?.interval || null,
              coherent: label === 'monthly' ? d.recurring?.interval === 'month' : d.recurring?.interval === 'year',
            };
          } catch (e) { out[label] = { error: String(e).slice(0, 150) }; }
        }
        return json(out);
      }

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
      if (path === '/api/v1/me/password' && method === 'POST') return await handleSetPassword(request, session, env);

      if (path === '/api/v1/simulateurs' && method === 'GET') return await handleSimulateursMembre(session, env);
      if (path === '/api/v1/strategies' && method === 'GET') return await handleStrategiesCatalogue(session, env);
      const stratM = path.match(/^\/api\/v1\/strategies\/([a-z0-9_-]+)$/);
      if (stratM && method === 'GET') return await handleStrategieDetail(stratM[1], session, env);

      // ─── ATELIER — édition des fiches en direct (propriétaire uniquement) ──
      if (path.startsWith('/api/v1/atelier/')) return await handleAtelier(request, session, env, path, method);
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
      if (path === '/api/v1/me/memory' && method === 'GET') return await handleGetMemory(session, env);
      if (path === '/api/v1/me/memory' && method === 'POST') return await handleSaveMemory(request, session, env);

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
      return json({ error: 'internal_error' }, 500); // H1 : err loggé serveur uniquement, zéro fuite au client
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

  // ── VERROU D'INSCRIPTION (décision Maxime 02/07/2026) ────────────────────
  //  Chaque NOUVEL accès (email inconnu) est validé personnellement par Maxime
  //  avant tout envoi de lien — même pour un futur payant (anti-concurrents).
  //  Membres existants + candidatures approuvées : flux normal, inchangé.
  //  Escape hatch : poser GATE_SIGNUPS='0' sur le worker pour rouvrir.
  if (env.GATE_SIGNUPS !== '0') {
    const em = email.toLowerCase();
    const existing = await env.D1.prepare('SELECT id FROM users WHERE email = ?').bind(em).first().catch(() => null);
    if (!existing) {
      try { await ensureGovernanceTables(env); } catch (_) {}
      const app = await env.D1.prepare('SELECT status FROM member_applications WHERE email = ? ORDER BY created_at DESC LIMIT 1').bind(em).first().catch(() => null);
      if (!app || app.status !== 'approved') {
        if (!app) {
          try {
            await env.D1.prepare("INSERT INTO member_applications (id, email, status, created_at) VALUES (?, ?, 'pending', ?)")
              .bind(crypto.randomUUID(), em, Date.now()).run();
            await sendEmail(env, { to: 'maxime@ikcp.fr', subject: '[Marcel IA] Nouvelle demande d\'accès — ' + em,
              html: '<div style="font-family:Georgia,serif;padding:20px"><p>Nouvelle demande d\'accès à Marcel IA :</p><p style="font-size:17px"><b>' + em + '</b></p><p><a href="https://ikcp.eu/app/console" style="color:#8B6F3F;font-weight:bold">Valider ou refuser dans la console →</a></p></div>' });
          } catch (_) {}
        }
        await audit(env, null, 'signup_gated', request, { email: em });
        return json({ ok: true, pending: true, message: 'Demande d\'accès enregistrée. Chaque accès à Marcel IA est validé personnellement — vous recevrez votre lien de connexion par e-mail dès validation.' });
      }
    }
  }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + MAGIC_TTL_MIN * 60_000;

  await env.D1.prepare(
    'INSERT INTO magic_tokens (token_hash, email, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)'
  ).bind(tokenHash, email.toLowerCase(), now, expiresAt, request.headers.get('CF-Connecting-IP') || '').run();

  const verifyUrl = `${env.APP_URL}/auth/verify?token=${token}`;
  const emailSent = await sendEmail(env, { to: email, subject: 'Votre lien de connexion · Marcel IA', html: emailTemplateMagic(verifyUrl) });

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
  await ensureUserColumns(env); // auto-répare le schéma users (colonnes étendues)
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
    // ── ACCÈS GOUVERNÉ — bêta « 50 familles fondatrices » ──────────────
    //  BETA_CAP         : nombre maximum de membres.
    //  BETA_INVITE_ONLY : true  = personne n'entre sans invitation approuvée
    //                     false = les places fondatrices s'ouvrent jusqu'au cap
    // Verrou d'inscription (02/07/2026) : personne n'entre sans validation de Maxime.
    const BETA_CAP = 0;
    const BETA_INVITE_ONLY = true;

    // 1) Candidature APPROUVÉE → admis au tier accordé (prime sur le plafond).
    let grantedTier = null, src = 'invitation';
    try {
      const appr = await env.D1.prepare("SELECT grant_tier FROM member_applications WHERE email = ? AND status = 'approved' ORDER BY reviewed_at DESC LIMIT 1").bind(row.email).first();
      if (appr) grantedTier = appr.grant_tier || 'free';
    } catch (_) { /* table absente = pas de candidature approuvée */ }

    // 2) Sinon : place fondatrice ouverte tant que COUNT(users) < BETA_CAP.
    if (!grantedTier) {
      let memberCount = 0;
      try { const c = await env.D1.prepare('SELECT COUNT(*) AS n FROM users').first(); memberCount = (c && c.n) || 0; } catch (_) {}
      if (!BETA_INVITE_ONLY && memberCount < BETA_CAP) {
        grantedTier = 'free'; src = 'organic';            // place fondatrice
      } else {
        // 3) Plafond atteint / invitation stricte → liste d'attente : AUCUNE
        //    session, on enregistre la demande (best effort) et on renvoie le
        //    visiteur vers la page de découverte.
        try {
          await env.D1.prepare("INSERT INTO member_applications (id, email, status, created_at) VALUES (?, ?, 'pending', ?)")
            .bind(crypto.randomUUID(), row.email, Date.now()).run();
        } catch (_) { /* table absente : demande tracée via l'événement ci-dessous */ }
        await emitEvent(env, null, 'waitlist', { email: row.email }).catch(() => {});
        return new Response(null, { status: 302, headers: { 'Location': `${env.FRONT_URL || 'https://ikcp.eu'}/decouvrir` } });
      }
    }

    const id = crypto.randomUUID();
    await env.D1.prepare('INSERT INTO users (id, email, tier, created_at, last_login_at, source) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, row.email, grantedTier, Date.now(), Date.now(), src).run();
    user = { id, email: row.email, tier: grantedTier };
    await audit(env, id, 'signup', request);
    await emitEvent(env, id, 'signup', { email: row.email, src });
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

// ── ACCÈS DÉMO EXAMINATEUR (Google Play review) ─────────────────────────────
//  Gated : n'existe que si le secret DEMO_ACCESS_CODE est posé sur le worker
//  (wrangler secret put DEMO_ACCESS_CODE). Sans secret → 404, feature éteinte.
//  Le code est destiné à être communiqué à Google dans la Play Console ; le
//  compte servi est un compte de démonstration (données fictives, premium)
//  qui ne passe PAS par le verrou d'inscription ni par l'e-mail.
const DEMO_EMAIL = 'demo-review@ikcp.eu';

async function handleAuthDemo(request, env) {
  if (!env.DEMO_ACCESS_CODE) return json({ error: 'not_found' }, 404);

  // Rate-limit KV : 5 essais/heure par IP (le code est long, la fenêtre est étroite).
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:demo:${ip}`;
  const count = parseInt((await env.CLIENT_KV.get(rlKey)) || '0');
  if (count >= 5) return json({ error: 'rate_limited' }, 429);
  await env.CLIENT_KV.put(rlKey, String(count + 1), { expirationTtl: 3600 });

  const { code } = await request.json().catch(() => ({}));
  // Comparaison par empreinte (longueur constante, pas de fuite par timing).
  if (!code || (await sha256(String(code))) !== (await sha256(env.DEMO_ACCESS_CODE))) {
    return json({ error: 'invalid_code' }, 403);
  }

  await ensureUserColumns(env);
  let user = await env.D1.prepare('SELECT * FROM users WHERE email = ?').bind(DEMO_EMAIL).first();
  if (!user) {
    const id = crypto.randomUUID();
    await env.D1.prepare('INSERT INTO users (id, email, tier, created_at, last_login_at, source) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, DEMO_EMAIL, 'premium', Date.now(), Date.now(), 'demo-review').run();
    user = { id, email: DEMO_EMAIL, tier: 'premium' };
  }
  // État garanti à chaque connexion : premium + onboarding déjà fait + nom parlant.
  await env.D1.prepare("UPDATE users SET tier = 'premium', display_name = ?, prenom = ?, profile_json = ?, last_login_at = ? WHERE id = ?")
    .bind('Compte de démonstration', 'Démo', JSON.stringify({ onboarding_completed: true, prenom: 'Démo' }), Date.now(), user.id).run();

  const sessionToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const sessionHash = await sha256(sessionToken);
  await env.D1.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sessionHash, user.id, Date.now(), Date.now() + SESSION_TTL_DAYS * 86_400_000, ip, (request.headers.get('User-Agent') || '').slice(0, 500)).run();

  await audit(env, user.id, 'login_demo', request);
  return json({ token: sessionToken });
}

// ── AUTH PAR MOT DE PASSE (alternative au lien magique — zéro email à chaque connexion) ──
// Mot de passe JAMAIS stocké en clair : PBKDF2-SHA256, 210 000 itérations, sel aléatoire
// 16 octets, format « pbkdf2$iterations$sel_b64$hash_b64 ». Web Crypto natif Workers.
async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  return `pbkdf2$210000$${b64(salt)}$${b64(bits)}`;
}
async function verifyPassword(password, stored) {
  try {
    const [algo, iterStr, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'pbkdf2') return false;
    const iterations = parseInt(iterStr, 10) || 210000;
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
    const computed = btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
    if (computed.length !== (hashB64 || '').length) return false;
    let diff = 0;                                       // comparaison à temps constant
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch (_) { return false; }
}

async function handleAuthLogin(request, env) {
  await ensureUserColumns(env);
  const { email, password } = await request.json().catch(() => ({}));
  const em = (email || '').toLowerCase().trim();
  if (!em || !password) return json({ error: 'invalid' }, 400);
  // Anti-force-brute : 10 tentatives / 15 min par IP.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:login:${ip}`;
  const count = parseInt((await env.CLIENT_KV.get(rlKey)) || '0');
  if (count >= 10) return json({ error: 'rate_limited' }, 429);
  await env.CLIENT_KV.put(rlKey, String(count + 1), { expirationTtl: 900 });

  const user = await env.D1.prepare('SELECT id, email, tier, password_hash FROM users WHERE email = ?').bind(em).first();
  // Réponse générique : ne révèle jamais si le compte existe ou si c'est le mot de passe qui est faux.
  const bad = () => json({ error: 'bad_credentials' }, 401);
  if (!user || !user.password_hash) return bad();
  if (!(await verifyPassword(password, user.password_hash))) return bad();

  await env.D1.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(Date.now(), user.id).run();
  const sessionToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const sessionHash = await sha256(sessionToken);
  await env.D1.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(sessionHash, user.id, Date.now(), Date.now() + SESSION_TTL_DAYS * 86_400_000, ip, (request.headers.get('User-Agent') || '').slice(0, 500)).run();
  await audit(env, user.id, 'login_password', request);
  return json({ token: sessionToken });               // session 30 j → pas de reconnexion quotidienne
}

async function handleSetPassword(request, session, env) {
  await ensureUserColumns(env);
  const { password } = await request.json().catch(() => ({}));
  if (!password || String(password).length < 8) return json({ error: 'weak_password', hint: '8 caractères minimum' }, 400);
  const hash = await hashPassword(String(password));
  await env.D1.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, session.user_id).run();
  await audit(env, session.user_id, 'set_password', request);
  return json({ ok: true });
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
  let row;
  try {
    row = await env.D1.prepare(
      'SELECT s.token_hash, s.user_id, s.expires_at, s.revoked_at, u.email, u.tier, u.created_at, u.has_strategies ' +
      'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
    ).bind(tokenHash).first();
  } catch (_) {
    // has_strategies peut manquer sur une base ancienne pas encore migrée.
    row = await env.D1.prepare(
      'SELECT s.token_hash, s.user_id, s.expires_at, s.revoked_at, u.email, u.tier, u.created_at ' +
      'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
    ).bind(tokenHash).first();
  }
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.now() > row.expires_at) return null;
  // Essai gratuit : un compte 'free' récent est traité comme 'premium' (tier effectif).
  // Se propage à tous les handlers (Marcel, mémoire, quotas, thème).
  row.stored_tier = row.tier;
  row.tier = effectiveTier(row.tier, row.created_at);
  row.has_strategies = Number(row.has_strategies) === 1;
  return row;
}

// ──────────────────────────────────────────────────────────────
// USER API
// ──────────────────────────────────────────────────────────────
async function ensureUserColumns(env) {
  // Auto-réparation du schéma : ajoute les colonnes étendues si la base date
  // d'une version antérieure (SQLite n'a pas ADD COLUMN IF NOT EXISTS → try/catch).
  for (const col of ['display_name TEXT', 'prenom TEXT', 'profile_json TEXT', 'consents_json TEXT', 'source TEXT', 'stripe_customer_id TEXT', 'stripe_subscription_id TEXT', 'memory_json TEXT', 'password_hash TEXT', 'has_strategies INTEGER DEFAULT 0']) {
    try { await env.D1.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch (_) { /* colonne déjà présente */ }
  }
}

// ─── Mémoire conversationnelle Marcel (Premium/FO uniquement) ───────
// free = pas de mémoire (incitation upgrade). Stockée dans users.memory_json.
async function handleGetMemory(session, env) {
  const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free;
  if (!limits.marcel_memory_days) return json({ messages: [], memory: false });
  try {
    const row = await env.D1.prepare('SELECT memory_json FROM users WHERE id = ?').bind(session.user_id).first();
    const mem = row && row.memory_json ? JSON.parse(row.memory_json) : { messages: [] };
    return json({ messages: Array.isArray(mem.messages) ? mem.messages : [], memory: true });
  } catch (_) {
    await ensureUserColumns(env);
    return json({ messages: [], memory: true });
  }
}
async function handleSaveMemory(request, session, env) {
  const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free;
  if (!limits.marcel_memory_days) return json({ ok: false, memory: false });
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  const payload = JSON.stringify({ messages, updated_at: Date.now() });
  try {
    await env.D1.prepare('UPDATE users SET memory_json = ? WHERE id = ?').bind(payload, session.user_id).run();
  } catch (_) {
    await ensureUserColumns(env);
    try { await env.D1.prepare('UPDATE users SET memory_json = ? WHERE id = ?').bind(payload, session.user_id).run(); } catch (_) {}
  }
  return json({ ok: true });
}

// ─── Essai gratuit limité dans le temps (14 jours de Premium offert) ───
const TRIAL_DAYS = 14;
function effectiveTier(storedTier, createdAt) {
  if (storedTier && storedTier !== 'free') return storedTier; // membre payant : inchangé
  const c = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt || 0);
  if (!c) return 'free';
  return (Date.now() - c) < TRIAL_DAYS * 86400000 ? 'premium' : 'free'; // essai = 14 jours de PREMIUM offerts (offre = Découverte + Premium, 100% IA self-service ; 'fo' = tier hérité, non attribué)
}
function trialInfo(storedTier, createdAt) {
  if (storedTier && storedTier !== 'free') return { active: false, member: true };
  const c = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt || 0);
  if (!c) return { active: false };
  const left = Math.ceil((c + TRIAL_DAYS * 86400000 - Date.now()) / 86400000);
  return left > 0 ? { active: true, days_left: left } : { active: false, expired: true };
}

async function handleMe(session, env) {
  const month = new Date().toISOString().slice(0, 7);
  // Requête étendue ; si une colonne manque (vieille base), on auto-répare
  // puis on retombe sur les colonnes garanties → /me ne renvoie JAMAIS 500.
  let userRow = null;
  try {
    userRow = await env.D1.prepare('SELECT id, email, tier, display_name, prenom, profile_json, consents_json, created_at, last_login_at FROM users WHERE id = ?')
      .bind(session.user_id).first();
  } catch (_) {
    await ensureUserColumns(env);
    try {
      userRow = await env.D1.prepare('SELECT id, email, tier, display_name, prenom, profile_json, consents_json, created_at, last_login_at FROM users WHERE id = ?')
        .bind(session.user_id).first();
    } catch (_) {
      userRow = await env.D1.prepare('SELECT id, email, tier, created_at, last_login_at FROM users WHERE id = ?')
        .bind(session.user_id).first();
    }
  }
  const usage = await env.D1.prepare('SELECT pappers_lookups, marcel_messages FROM usage WHERE user_id = ? AND year_month = ?')
    .bind(session.user_id, month).first().catch(() => null);
  const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free;
  // Retourne les champs à la racine (compatible avec le front)
  return json({
    id:           userRow?.id || session.user_id,
    email:        userRow?.email || session.email,
    tier:         session.tier,                                          // tier EFFECTIF (essai = premium)
    has_strategies: session.has_strategies === true,                     // palier 249€/an (affichage seul — le vrai gate est côté /api/v1/strategies)
    stored_tier:  session.stored_tier || userRow?.tier || 'free',
    trial:        trialInfo(session.stored_tier || userRow?.tier, userRow?.created_at),
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

// ── BIBLIOTHÈQUE DES STRATÉGIES DIRIGEANT (palier « Stratégies » 249€/an) ───
// Catalogue : teaser accessible à tout membre connecté (titre + résumé tronqué,
// sans les sections à valeur commerciale). Fiche complète : gated has_strategies,
// vérifié ici côté serveur — jamais dans le HTML/JS statique du front.
//
// SOURCE DES FICHES : D1 (édition en direct depuis /app/redaction.html) fusionnée
// avec strategies-content.json (semence versionnée). En cas de même slug, la
// version D1 gagne — on peut donc corriger une fiche sans redéployer, et le JSON
// reste le filet de sécurité si la base est vide ou indisponible.
async function ensureFichesTable(env) {
  await env.D1.prepare(
    "CREATE TABLE IF NOT EXISTS fiches (slug TEXT PRIMARY KEY, data TEXT NOT NULL, " +
    "statut TEXT DEFAULT 'brouillon', updated_at TEXT)"
  ).run();
}
async function loadFiches(env, { includeDrafts = false } = {}) {
  const seed = (STRATEGIES_CONTENT.fiches || []).map(f => ({ ...f, _statut: 'publie', _source: 'seed' }));
  let live = [];
  try {
    await ensureFichesTable(env);
    const q = includeDrafts
      ? 'SELECT slug, data, statut, updated_at FROM fiches'
      : "SELECT slug, data, statut, updated_at FROM fiches WHERE statut='publie'";
    const rows = await env.D1.prepare(q).all();
    live = (rows.results || []).map(r => {
      try { return { ...JSON.parse(r.data), slug: r.slug, _statut: r.statut, _source: 'd1', _maj: r.updated_at }; }
      catch (_) { return null; }
    }).filter(Boolean);
  } catch (_) { /* base indisponible → on sert la semence */ }
  const bySlug = new Map();
  seed.forEach(f => bySlug.set(f.slug, f));
  live.forEach(f => bySlug.set(f.slug, f)); // D1 écrase la semence
  return [...bySlug.values()];
}

// Édition réservée au propriétaire : empreintes SHA-256 des e-mails autorisés
// (jamais l'e-mail en clair dans un dépôt public).
const OWNER_HASHES = [
  'c363eb19abba013b797cb98a4f5298485560d16d0ecbd5ba70c991dcb172d1a3',
  'cdf3440f43feeaab6e08910642d2e85e3e6b7b4be5e2a702951691d324f8f030',
  'd4c01e9f986be2d7c2c27d180463d6b5b528e6324f1555985043bdac8c832543',
];
async function isOwner(session) {
  if (!session || !session.email) return false;
  return OWNER_HASHES.includes(await sha256(String(session.email).trim().toLowerCase()));
}

// ── CONTENU ÉDITORIAL : surcharges de textes du site (édition « type WordPress ») ──
// Stockées en D1, servies publiquement, fusionnées par cms-hydrate.js par-dessus
// _data/*.json. Le HTML garde toujours son texte par défaut : si la base tombe ou
// si rien n'est édité, le site s'affiche normalement.
async function ensureSimulateursTable(env) {
  await env.D1.prepare(
    "CREATE TABLE IF NOT EXISTS simulateurs (id TEXT PRIMARY KEY, data TEXT NOT NULL, " +
    "statut TEXT DEFAULT 'brouillon', updated_at TEXT)"
  ).run();
}
// Simulateurs publiés — servis au membre du palier Stratégies (249 €/an).
async function handleSimulateursMembre(session, env) {
  const unlocked = session.tier === 'premium' && session.has_strategies === true;
  try {
    await ensureSimulateursTable(env);
    const rows = await env.D1.prepare("SELECT id, data FROM simulateurs WHERE statut='publie'").all();
    const list = (rows.results || []).map(r => {
      try { return { ...JSON.parse(r.data), id: r.id }; } catch (_) { return null; }
    }).filter(Boolean);
    if (!unlocked) {
      // Teaser : on annonce ce qui existe, jamais les formules ni les résultats.
      return json({ unlocked: false, simulateurs: list.map(s => ({ id: s.id, titre: s.titre, description: s.description })) });
    }
    return json({ unlocked: true, simulateurs: list });
  } catch (_) { return json({ unlocked, simulateurs: [] }); }
}

async function ensureContenuTable(env) {
  await env.D1.prepare(
    'CREATE TABLE IF NOT EXISTS contenu (cle TEXT PRIMARY KEY, valeur TEXT, updated_at TEXT)'
  ).run();
}
async function handleContenuPublic(env) {
  try {
    await ensureContenuTable(env);
    const rows = await env.D1.prepare('SELECT cle, valeur FROM contenu').all();
    const out = {};
    (rows.results || []).forEach(r => { out[r.cle] = r.valeur; });
    return new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...corsHeaders() },
    });
  } catch (_) {
    return new Response('{}', { headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
  }
}

// ── ATELIER : CRUD des fiches (propriétaire uniquement) ──
async function handleAtelier(request, session, env, path, method) {
  if (!(await isOwner(session))) return json({ error: 'forbidden' }, 403);

  // Simulateurs — formules guidées (aucun code exécutable stocké : le worker
  // ne fait que persister une liste d'étapes, évaluée par app/js/formule.js
  // au moyen d'une liste fermée d'opérations).
  if (path === '/api/v1/atelier/simulateurs') {
    await ensureSimulateursTable(env);
    if (method === 'GET') {
      const rows = await env.D1.prepare('SELECT id, data, statut, updated_at FROM simulateurs').all();
      return json({ simulateurs: (rows.results || []).map(r => {
        try { return { ...JSON.parse(r.data), id: r.id, _statut: r.statut, _maj: r.updated_at }; }
        catch (_) { return null; }
      }).filter(Boolean) });
    }
  }
  const simM = path.match(/^\/api\/v1\/atelier\/simulateurs\/([a-z0-9_-]+)$/i);
  if (simM) {
    await ensureSimulateursTable(env);
    const id = simM[1];
    if (method === 'PUT') {
      const b = await request.json().catch(() => null);
      if (!b || typeof b !== 'object') return json({ error: 'bad_json' }, 400);
      const statut = b._statut === 'publie' ? 'publie' : 'brouillon';
      const data = { ...b }; delete data._statut; delete data._maj; data.id = id;
      await env.D1.prepare(
        'INSERT INTO simulateurs (id, data, statut, updated_at) VALUES (?,?,?,?) ' +
        'ON CONFLICT(id) DO UPDATE SET data=excluded.data, statut=excluded.statut, updated_at=excluded.updated_at'
      ).bind(id, JSON.stringify(data).slice(0, 120000), statut, new Date().toISOString()).run();
      return json({ ok: true, id, statut });
    }
    if (method === 'DELETE') {
      await env.D1.prepare('DELETE FROM simulateurs WHERE id=?').bind(id).run();
      return json({ ok: true, deleted: id });
    }
  }

  // Textes du site
  if (path === '/api/v1/atelier/contenu') {
    await ensureContenuTable(env);
    if (method === 'GET') {
      const rows = await env.D1.prepare('SELECT cle, valeur, updated_at FROM contenu').all();
      return json({ contenu: rows.results || [] });
    }
    if (method === 'PUT') {
      const b = await request.json().catch(() => null);
      if (!b || typeof b.cle !== 'string') return json({ error: 'bad_json' }, 400);
      const cle = b.cle.trim().slice(0, 120);
      if (!/^[a-z]+\.[a-z0-9_.]+$/i.test(cle)) return json({ error: 'cle_invalide' }, 400);
      if (b.valeur === null || b.valeur === '') {
        await env.D1.prepare('DELETE FROM contenu WHERE cle=?').bind(cle).run();
        return json({ ok: true, cle, supprime: true });
      }
      await env.D1.prepare(
        'INSERT INTO contenu (cle, valeur, updated_at) VALUES (?,?,?) ' +
        'ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur, updated_at=excluded.updated_at'
      ).bind(cle, String(b.valeur).slice(0, 8000), new Date().toISOString()).run();
      return json({ ok: true, cle });
    }
  }

  await ensureFichesTable(env);

  if (path === '/api/v1/atelier/fiches' && method === 'GET') {
    const all = await loadFiches(env, { includeDrafts: true });
    return json({ fiches: all.map(f => ({
      slug: f.slug, titre: f.titre, categorie: f.categorie, statut: f._statut,
      source: f._source, maj: f._maj || null, simulateurId: f.simulateurId || null,
    })) });
  }

  const m = path.match(/^\/api\/v1\/atelier\/fiches\/([a-z0-9_-]+)$/i);
  if (m) {
    const slug = m[1];
    if (method === 'GET') {
      const all = await loadFiches(env, { includeDrafts: true });
      const f = all.find(x => x.slug === slug);
      return f ? json(f) : json({ error: 'not_found' }, 404);
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return json({ error: 'bad_json' }, 400);
      const statut = body._statut === 'publie' ? 'publie' : 'brouillon';
      const data = { ...body }; delete data._statut; delete data._source; delete data._maj;
      data.slug = slug;
      await env.D1.prepare(
        'INSERT INTO fiches (slug, data, statut, updated_at) VALUES (?,?,?,?) ' +
        'ON CONFLICT(slug) DO UPDATE SET data=excluded.data, statut=excluded.statut, updated_at=excluded.updated_at'
      ).bind(slug, JSON.stringify(data).slice(0, 400000), statut, new Date().toISOString()).run();
      return json({ ok: true, slug, statut });
    }
    if (method === 'DELETE') {
      await env.D1.prepare('DELETE FROM fiches WHERE slug=?').bind(slug).run();
      return json({ ok: true, deleted: slug });
    }
  }
  return json({ error: 'not_found' }, 404);
}

async function handleStrategiesCatalogue(session, env) {
  const list = (await loadFiches(env)).map(f => ({
    slug: f.slug,
    categorie: f.categorie,
    titre: f.titre,
    sousTitre: f.sousTitre,
    teaser: (f.resumeExecutif && f.resumeExecutif[0]) || '',
    complexite: f.complexite,
    horizonMiseEnOeuvre: f.horizonMiseEnOeuvre,
    hasSimulateur: !!f.simulateurId,
    requiresHumanValidation: !!f.requiresHumanValidation,
    version: f.version,
    dateRevue: f.dateRevue,
  }));
  return json({
    total: STRATEGIES_CONTENT._meta?.cible || list.length,
    disponibles: list.length,
    unlocked: session.tier === 'premium' && session.has_strategies === true,
    fiches: list,
  });
}
async function handleStrategieDetail(slug, session, env) {
  const fiche = (await loadFiches(env)).find(f => f.slug === slug);
  if (!fiche) return json({ error: 'not_found' }, 404);
  const unlocked = session.tier === 'premium' && session.has_strategies === true;
  if (!unlocked) {
    return json({
      locked: true,
      slug: fiche.slug,
      categorie: fiche.categorie,
      titre: fiche.titre,
      sousTitre: fiche.sousTitre,
      teaser: (fiche.resumeExecutif && fiche.resumeExecutif[0]) || '',
    });
  }
  return json({ locked: false, ...fiche });
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
  const type = (b.type || '').toString().slice(0, 30);
  const score = (typeof b.score === 'number') ? b.score : null;
  const esc = s => (s == null ? '' : String(s)).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#1B2A4A">📨 Retour bêta IKCP</h2>
    <p><b>Priorité :</b> ${esc(prio)} &nbsp;·&nbsp; <b>Catégories :</b> ${esc(cats) || '—'}</p>
    <p style="background:#F4EFE7;border-left:3px solid #C9A96E;padding:12px 14px;white-space:pre-wrap">${esc(besoin)}</p>
    <p style="font-size:13px;color:#6B5D52"><b>De :</b> ${esc(email) || 'anonyme'} &nbsp;·&nbsp; <b>Page :</b> ${esc(page)} &nbsp;·&nbsp; <b>Source :</b> ${esc(source)}</p>
  </div>`;
  const sent = await sendEmail(env, { to: 'maxime@ikcp.fr', subject: `[IKCP Bêta] Retour ${prio}${cats ? ' · ' + cats : ''}`, html });
  // Accusé de réception automatique au prospect (demande d'invitation /decouvrir)
  if (source === 'decouvrir-invitation' && email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    // Stockage en base : la demande devient une candidature « pending » (visible dans la console → Bêta & invitations)
    try {
      await ensureGovernanceTables(env);
      const ex = await env.D1.prepare("SELECT id FROM member_applications WHERE email = ? AND status = 'pending'").bind(email).first();
      if (!ex) await env.D1.prepare("INSERT INTO member_applications (id, email, profile_json, status, created_at) VALUES (?, ?, ?, 'pending', ?)")
        .bind(crypto.randomUUID(), email, JSON.stringify({ source: 'decouvrir', message: besoin }), Date.now()).run();
    } catch (_) { /* table absente : la demande reste tracée par l'email + l'événement */ }
    const ack = `<div style="font-family:Georgia,serif;max-width:540px;margin:auto;background:#0E1729;color:#FAFAF8;border-radius:14px;padding:34px 30px">
      <p style="font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#E2C896;margin:0 0 14px">IKCP · Family Office augmenté</p>
      <h2 style="font-weight:500;font-size:22px;margin:0 0 12px">Votre demande est <em style="color:#E2C896">bien reçue.</em></h2>
      <p style="font-size:14px;line-height:1.65;color:rgba(250,250,248,.8)">Merci de votre intérêt pour la bêta — 50 familles fondatrices, accès sur invitation. Maxime étudie personnellement chaque demande et revient vers vous sous 48&nbsp;h.</p>
      <p style="font-size:14px;line-height:1.65;color:rgba(250,250,248,.8)">En attendant, la présentation de 90&nbsp;secondes&nbsp;: <a href="https://ikcp.eu/decouvrir" style="color:#E2C896">ikcp.eu/decouvrir</a></p>
      <p style="font-size:12px;color:rgba(250,250,248,.5);border-top:1px solid rgba(226,200,150,.25);padding-top:14px;margin-top:22px">Maxime Juveneton · CIF — ORIAS 23001568 · CNCEF Patrimoine · Données hébergées en France.</p>
    </div>`;
    await sendEmail(env, { to: email, subject: 'Votre demande d’invitation — IKCP Family Office', html: ack }).catch(() => {});
  }
  await emitEvent(env, null, 'beta_feedback', { categories: cats, priorite: prio, email, page, source }).catch(() => {});
  const notioned = await pushToNotion(env, { besoin, page, email, source, priorite: prio, type, score });
  return json({ ok: true, emailed: !!sent, notion: notioned });
}

// Miroir best-effort du feedback → base Notion « Bêta — Retours testeurs IKCP ».
// Sans NOTION_TOKEN configuré, no-op silencieux (ne bloque jamais le feedback).
async function pushToNotion(env, f) {
  if (!env.NOTION_TOKEN) return false;
  const DB = env.NOTION_FEEDBACK_DB || '287f73500d774c15a7b514d3b4b78966';
  const PRIO = { haute: 'P1 majeur', moyenne: 'P2 mineur', basse: 'P2 mineur' };
  const TYPE_CAT = { bug: 'Bug', idee: 'Idée / amélioration', manque: 'UX / parcours' };
  const cat = f.source === 'marcel-rating' ? 'Contenu' : (TYPE_CAT[f.type] || null);
  const title = (f.email || ('Retour ' + (f.source || 'app'))).slice(0, 90);
  const props = {
    'Testeur': { title: [{ text: { content: title } }] },
    'Verbatim complet': { rich_text: [{ text: { content: (f.besoin || '').slice(0, 1800) } }] },
    'Page concernée': { rich_text: [{ text: { content: (f.page || '').slice(0, 180) } }] },
    'Priorité': { select: { name: PRIO[f.priorite] || 'P2 mineur' } },
  };
  if (f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) props['Email'] = { email: f.email };
  if (cat) props['Catégorie'] = { multi_select: [{ name: cat }] };
  if (typeof f.score === 'number') props['NPS /10'] = { number: f.score };
  // Améliorations demandées par les utilisateurs → colonne dédiée « Ce qui pourrait être mieux ».
  if (f.type === 'idee') props['Ce qui pourrait être mieux'] = { rich_text: [{ text: { content: (f.besoin || '').slice(0, 1800) } }] };
  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: { database_id: DB }, properties: props }),
    });
    return r.ok;
  } catch (_) { return false; }
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
    console.error('[pappers lookup]', res.status, err.slice(0, 200));
    return json({ error: 'pappers_failed', status: res.status }, 502);
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
  // 3 paliers (verrouillés le 27/07/2026) : Découverte 0€ (pas de checkout),
  // Premium 9,99€/mois, Stratégies 249€/an (Premium + bibliothèque ~70 fiches).
  const priceMap = { monthly: env.STRIPE_PRICE_PREMIUM_MONTHLY, strategies: env.STRIPE_PRICE_STRATEGIES_ANNUAL };
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
  params.append('metadata[plan]', plan); // lu par le webhook pour distinguer premium simple / +stratégies

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) { console.error('[stripe checkout]', res.status, JSON.stringify(data).slice(0, 300)); return json({ error: 'stripe_failed' }, 502); } // H2 : réponse amont loggée serveur, pas renvoyée
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
  // Auto-réparation : la table d'idempotence doit exister avant toute lecture
  // (sinon le webhook 500 en boucle et le passage Premium n'arrive jamais).
  await env.D1.prepare('CREATE TABLE IF NOT EXISTS stripe_events (id TEXT PRIMARY KEY, type TEXT, payload_json TEXT, ts INTEGER, processed_at INTEGER)').run();
  const seen = await env.D1.prepare('SELECT id FROM stripe_events WHERE id = ?').bind(event.id).first();
  if (seen) return json({ received: true, idempotent: true });
  await env.D1.prepare('INSERT INTO stripe_events (id, type, payload_json, ts) VALUES (?, ?, ?, ?)')
    .bind(event.id, event.type, JSON.stringify(event), Date.now()).run();

  const obj = event.data?.object || {};
  const userId = obj.metadata?.user_id;

  switch (event.type) {
    case 'checkout.session.completed':
      if (userId) {
        await ensureUserColumns(env); // has_strategies peut manquer sur une base ancienne
        const hasStrategies = obj.metadata?.plan === 'strategies' ? 1 : 0;
        await env.D1.prepare('UPDATE users SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, has_strategies = MAX(has_strategies, ?) WHERE id = ?')
          .bind('premium', obj.customer, obj.subscription, hasStrategies, userId).run();
        await audit(env, userId, 'tier_upgraded', request, { from: 'free', to: 'premium', plan: obj.metadata?.plan || 'inconnu' });
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
  // CREDENTIALED (cookies + Authorization) : PAS de wildcard *.workers.dev/*.pages.dev
  // (sous-domaines tiers enregistrables par n'importe qui → CSRF / vol de session).
  // Les origines légitimes (ikcp.eu, www, ikcp-eu.pages.dev, worker chat, localhost)
  // sont déjà dans ALLOWED_ORIGINS ; on autorise en plus les sous-domaines *.ikcp.eu (nôtres).
  const ok = ALLOWED_ORIGINS.includes(o) || (o && o.endsWith('.ikcp.eu'));
  return {
    'Access-Control-Allow-Origin': ok ? (o || 'https://ikcp.eu') : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
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

// Comparaison en temps constant : ne court-circuite pas sur le 1er octet différent (anti oracle de timing).
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function verifyStripeSignature(body, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = {};
  for (const kv of sigHeader.split(',')) { const i = kv.indexOf('='); if (i > 0) { const k = kv.slice(0, i); if (!parts[k]) parts[k] = []; parts[k].push(kv.slice(i + 1)); } }
  const t = parts.t && parts.t[0];
  const v1s = parts.v1 || [];                                    // Stripe peut envoyer plusieurs v1
  if (!t || !v1s.length) return false;
  if (Math.abs(Date.now() - Number(t) * 1000) > 300000) return false; // C2 : tolérance 5 min → bloque le rejeu d'un webhook capté
  const signed = `${t}.${body}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return v1s.some(v => timingSafeEqual(hex, v));                 // C2 : comparaison constante sur tous les v1
}

async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.warn('[sendEmail] RESEND_API_KEY absent — email non envoyé');
    return false; // indique l'échec proprement
  }
  // Sender : noreply@ikcp.eu si domaine vérifié Resend, sinon fallback domaine test
  const from = env.RESEND_FROM || 'Marcel IA Patrimoniale <noreply@ikcp.eu>';
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
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:auto;padding:34px;background:#FAF8F4;color:#221E18;border:1px solid #E9E2D6;border-radius:12px">
    <div style="font-size:18px;font-weight:bold;color:#1B2A4A;margin-bottom:18px">Marcel <span style="color:#8B6F3F">IA</span></div>
    <h1 style="font-size:23px;color:#1B2A4A;margin:0 0 14px">Votre lien de connexion</h1>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Voici votre accès à votre espace <b>Marcel IA</b>. Lien valide <b>15 minutes</b>, à usage unique.</p>
    <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:#C9A96E;color:#20180c;text-decoration:none;border-radius:30px;margin:18px 0;font-weight:bold">Me connecter →</a>
    <p style="font-size:12px;color:#8A7E70">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    <hr style="border:none;border-top:1px solid #E9E2D6;margin:20px 0 12px">
    <p style="font-size:11px;color:#8A7E70;margin:0">Marcel IA — intelligence patrimoniale souveraine · IKCP · ORIAS 23001568</p>
  </div>`;
}
function emailTemplateWelcome() {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:auto;padding:34px;background:#FAF8F4;color:#221E18;border:1px solid #E9E2D6;border-radius:12px">
    <div style="font-size:18px;font-weight:bold;color:#1B2A4A;margin-bottom:18px">Marcel <span style="color:#8B6F3F">IA</span></div>
    <h1 style="font-size:23px;color:#1B2A4A;margin:0 0 14px">Bienvenue</h1>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Votre compte <b>Découverte</b> est activé : cartographie de votre société (registre officiel), simulateurs du dirigeant et Marcel en découverte.</p>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Pour aller plus loin — audit patrimonial 360° complet, schémas de stratégie, Marcel illimité : <a href="https://ikcp.eu/app/profil.html" style="color:#8B6F3F;font-weight:bold">Premium à 24 €/mois ou 240 €/an</a>.</p>
    <hr style="border:none;border-top:1px solid #E9E2D6;margin:20px 0 12px">
    <p style="font-size:11px;color:#8A7E70;margin:0">Marcel IA — intelligence patrimoniale souveraine · IKCP · ORIAS 23001568</p>
  </div>`;
}
function emailTemplatePremiumWelcome() {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:auto;padding:34px;background:#FAF8F4;color:#221E18;border:1px solid #E9E2D6;border-radius:12px">
    <div style="font-size:18px;font-weight:bold;color:#1B2A4A;margin-bottom:18px">Marcel <span style="color:#8B6F3F">IA</span></div>
    <h1 style="font-size:23px;color:#1B2A4A;margin:0 0 14px">Bienvenue en Premium</h1>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Votre espace est débloqué :</p>
    <ul style="font-size:14.5px;line-height:1.7;color:#5F5347;padding-left:20px"><li>Marcel illimité, nourri de la doctrine du cabinet</li><li>Audit patrimonial 360° complet + export PDF</li><li>Bibliothèque de schémas de stratégie (OBO, Dutreil, holding…)</li><li>Veille et alertes personnalisées</li></ul>
    <p style="font-size:13px;color:#8A7E70">Une question ? <a href="mailto:maxime@ikcp.fr" style="color:#8B6F3F">maxime@ikcp.fr</a></p>
    <hr style="border:none;border-top:1px solid #E9E2D6;margin:20px 0 12px">
    <p style="font-size:11px;color:#8A7E70;margin:0">Marcel IA — intelligence patrimoniale souveraine · IKCP · ORIAS 23001568</p>
  </div>`;
}
function emailTemplateAccessApproved() {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:auto;padding:34px;background:#FAF8F4;color:#221E18;border:1px solid #E9E2D6;border-radius:12px">
    <div style="font-size:18px;font-weight:bold;color:#1B2A4A;margin-bottom:18px">Marcel <span style="color:#8B6F3F">IA</span></div>
    <h1 style="font-size:23px;color:#1B2A4A;margin:0 0 14px">Votre accès est validé</h1>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Bienvenue. Votre demande d'accès à Marcel IA a été validée personnellement.</p>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Pour entrer : rendez-vous sur votre espace, saisissez votre e-mail, et votre lien de connexion arrive aussitôt.</p>
    <a href="https://ikcp.eu/app/" style="display:inline-block;padding:14px 28px;background:#C9A96E;color:#20180c;text-decoration:none;border-radius:30px;margin:14px 0;font-weight:bold">Accéder à mon espace →</a>
    <hr style="border:none;border-top:1px solid #E9E2D6;margin:20px 0 12px">
    <p style="font-size:11px;color:#8A7E70;margin:0">Marcel IA — intelligence patrimoniale souveraine · IKCP · ORIAS 23001568</p>
  </div>`;
}
function emailTemplateCancelRetention() {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:auto;padding:34px;background:#FAF8F4;color:#221E18;border:1px solid #E9E2D6;border-radius:12px">
    <div style="font-size:18px;font-weight:bold;color:#1B2A4A;margin-bottom:18px">Marcel <span style="color:#8B6F3F">IA</span></div>
    <h1 style="font-size:23px;color:#1B2A4A;margin:0 0 14px">On vous regrette</h1>
    <p style="font-size:15px;line-height:1.6;color:#5F5347">Vous repassez en compte Découverte. Votre historique est préservé.</p>
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
  // Réseau de partenaires (gestion de fortune) — CRM interne, publication contrôlée
  await env.D1.prepare(`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT,
      region TEXT, contact_email TEXT, contact_phone TEXT, website TEXT,
      points_forts TEXT,
      paid INTEGER DEFAULT 0,                     -- 1 = abonnement payé · 0 = curé/gratuit
      forfait TEXT,                               -- libellé forfait (ex: "Annuel 1200 €")
      status TEXT DEFAULT 'actif',                -- 'actif' | 'pending' | 'inactif'
      published INTEGER DEFAULT 0,                -- 1 = visible côté public (réseau de confiance)
      notes TEXT, created_at INTEGER, updated_at INTEGER
    )
  `).run();
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

  // ── DOCUMENTATION PATRIMONIALE : ajouter une fiche à la base de connaissances ──
  // La console n'a qu'UNE clé (x-admin-secret). Ce relais détient la clé RAG côté
  // serveur et la transmet à ikcp-rag : le jeton d'écriture de la doctrine ne
  // transite jamais par le navigateur.
  if (path === '/api/v1/admin/rag-ingest' && method === 'POST') {
    if (!env.RAG_ADMIN) return json({ error: 'rag_admin_missing', hint: 'Pose le secret RAG_ADMIN sur ikcp-client ET ikcp-rag (même valeur).' }, 503);
    const b = await request.json().catch(() => ({}));
    const text = String(b.text || '');
    if (text.length < 20) return json({ error: 'empty_text', hint: '20 caractères minimum.' }, 400);
    const source = String(b.source || 'console').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'console';
    try {
      const r = await fetch('https://ikcp-rag.maxime-ead.workers.dev/ingest-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': env.RAG_ADMIN },
        body: JSON.stringify({ text, source }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d.error || 'rag_error', status: r.status, hint: d.hint || null }, 502);
      return json(d);
    } catch (e) { return json({ error: 'rag_unreachable', message: e.message }, 502); }
  }

  // ── VEILLE : régénérer le digest du jour à la demande (hors cron 6h UTC) ──
  // La console n'a qu'UNE clé (x-admin-secret). Ce relais détient la clé
  // veille côté serveur et la transmet à ikcp-veille : sert à vérifier
  // qu'une correction fonctionne sans attendre le lendemain.
  if (path === '/api/v1/admin/veille-regenerate' && method === 'POST') {
    if (!env.VEILLE_ADMIN) return json({ error: 'veille_admin_missing', hint: 'Pose le secret VEILLE_ADMIN sur ikcp-client ET ikcp-veille (même valeur).' }, 503);
    try {
      const r = await fetch('https://ikcp-veille.maxime-ead.workers.dev/admin/regenerate', {
        method: 'POST',
        headers: { 'X-Admin-Token': env.VEILLE_ADMIN },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d.error || 'veille_error', status: r.status, hint: d.hint || null }, 502);
      return json(d);
    } catch (e) { return json({ error: 'veille_unreachable', message: e.message }, 502); }
  }
  if (path === '/api/v1/admin/veille-last-rejected' && method === 'GET') {
    if (!env.VEILLE_ADMIN) return json({ error: 'veille_admin_missing', hint: 'Pose le secret VEILLE_ADMIN sur ikcp-client ET ikcp-veille (même valeur).' }, 503);
    try {
      const r = await fetch('https://ikcp-veille.maxime-ead.workers.dev/admin/last-rejected', {
        headers: { 'X-Admin-Token': env.VEILLE_ADMIN },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d.error || 'veille_error', status: r.status }, 502);
      return json(d);
    } catch (e) { return json({ error: 'veille_unreachable', message: e.message }, 502); }
  }

  // ── POWENS : vérifier la poignée de main OAuth sandbox, sans membre réel ──
  if (path === '/api/v1/admin/powens-test-connect' && method === 'POST') {
    if (!env.POWENS_ADMIN) return json({ error: 'powens_admin_missing', hint: 'Pose le secret POWENS_ADMIN sur ikcp-client ET ikcp-powens (même valeur).' }, 503);
    try {
      const r = await fetch('https://ikcp-powens.maxime-ead.workers.dev/admin/test-connect', {
        method: 'POST',
        headers: { 'X-Admin-Token': env.POWENS_ADMIN },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d.error || 'powens_error', status: r.status, hint: d.hint || null }, 502);
      return json(d);
    } catch (e) { return json({ error: 'powens_unreachable', message: e.message }, 502); }
  }

  // ── ATELIER : lire / publier un fichier du dépôt depuis le navigateur ──
  // Le jeton GitHub vit UNIQUEMENT ici (secret worker), jamais côté client.
  // Garde-fou : seules les pages (.html) du site et de l'app + les feuilles de
  // style de l'app sont modifiables. JAMAIS workers/ (code serveur), .github/
  // (CI), .well-known/ (liaison Android) — pour qu'une erreur d'atelier ne
  // puisse jamais casser le backend, le déploiement ni l'app Android.
  if (path === '/api/v1/admin/file') {
    if (!env.GITHUB_TOKEN) return json({ error: 'github_token_missing', hint: 'Pose GITHUB_TOKEN (PAT fine-grained, Contents: Read and write) sur le worker ikcp-client.' }, 503);
    const REPO = env.GITHUB_REPO || 'Max51527/ikcp-site';
    const okPath = (p) => typeof p === 'string' && !p.includes('..') && (
      /^[A-Za-z0-9._-]+\.html$/.test(p) ||            // page du SITE (racine)
      /^app\/[A-Za-z0-9._-]+\.html$/.test(p) ||        // page de l'APP
      /^app\/css\/[A-Za-z0-9._-]+\.css$/.test(p)       // style de l'APP
    );
    const gh = (u, init) => fetch(u, { ...(init || {}), headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'ikcp-atelier', ...((init && init.headers) || {}) } });

    if (method === 'GET') {
      const p = new URL(request.url).searchParams.get('path') || '';
      if (!okPath(p)) return json({ error: 'path_not_allowed' }, 400);
      const r = await gh(`https://api.github.com/repos/${REPO}/contents/${encodeURI(p)}?ref=main`);
      if (!r.ok) return json({ error: 'github_read', status: r.status }, 502);
      const d = await r.json();
      const bytes = Uint8Array.from(atob(String(d.content || '').replace(/\n/g, '')), c => c.charCodeAt(0));
      return json({ path: p, sha: d.sha, content: new TextDecoder().decode(bytes) });
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const p = body.path, content = body.content, sha = body.sha;
      if (!okPath(p)) return json({ error: 'path_not_allowed' }, 400);
      if (typeof content !== 'string' || !sha) return json({ error: 'invalid' }, 400);
      const enc = new TextEncoder().encode(content);
      let bin = '';                                    // base64 par tranches (gros fichiers)
      for (let i = 0; i < enc.length; i += 0x8000) bin += String.fromCharCode.apply(null, enc.subarray(i, i + 0x8000));
      const r = await gh(`https://api.github.com/repos/${REPO}/contents/${encodeURI(p)}`, {
        method: 'PUT',
        body: JSON.stringify({ message: String(body.message || `atelier: maj ${p}`).slice(0, 120), content: btoa(bin), sha, branch: 'main' }),
      });
      if (!r.ok) return json({ error: 'github_write', status: r.status, detail: (await r.text()).slice(0, 200) }, 502);
      const d = await r.json();
      return json({ ok: true, commit: (d.commit && d.commit.sha ? d.commit.sha.slice(0, 7) : null) });
    }
    return json({ error: 'method_not_allowed' }, 405);
  }

  await ensureGovernanceTables(env);

  // Lister les candidatures
  if (path === '/api/v1/admin/applications' && method === 'GET') {
    const u = new URL(request.url);
    const status = u.searchParams.get('status') || 'pending';
    const rows = await env.D1.prepare('SELECT * FROM member_applications WHERE status = ? ORDER BY created_at DESC LIMIT 200').bind(status).all();
    return json(rows.results || []);
  }
  // ✦ TRI IA — renvoie la liste des demandes ; Marcel les classe côté console (browser → Marcel)
  if (path === '/api/v1/admin/triage' && method === 'GET') {
    await ensureGovernanceTables(env);
    const rows = (await env.D1.prepare("SELECT email, profile_json FROM member_applications WHERE status = 'pending' ORDER BY created_at DESC LIMIT 40").all()).results || [];
    const list = rows.map((r, i) => {
      let p = {}; try { p = JSON.parse(r.profile_json || '{}'); } catch (_) {}
      return `${i + 1}. ${r.email} — ${(p.message || p.objectif || 'objectif non précisé').replace(/\s+/g, ' ').slice(0, 200)}`;
    }).join('\n');
    return json({ count: rows.length, list });
  }
  // Décision sur une candidature (approve → accorde un tier bêta)
  const dm = path.match(/^\/api\/v1\/admin\/applications\/([a-f0-9-]+)\/decision$/);
  if (dm && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const decision = b.decision === 'approve' ? 'approved' : 'rejected';
    const grantTier = decision === 'approved'
      ? (['free', 'premium', 'fo'].includes(b.grant_tier) ? b.grant_tier : 'free')   // validation d'inscription = Découverte par défaut
      : null;
    const appRow = await env.D1.prepare('SELECT email FROM member_applications WHERE id = ?').bind(dm[1]).first();
    await env.D1.prepare('UPDATE member_applications SET status = ?, grant_tier = ?, note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?')
      .bind(decision, grantTier, b.note || null, Date.now(), 'maxime', dm[1]).run();
    if (decision === 'approved' && appRow?.email) {
      // Compte existant : upgrade éventuel du tier (jamais de downgrade via une approbation).
      const uRow = await env.D1.prepare('SELECT id, tier FROM users WHERE email = ?').bind(appRow.email).first();
      const rank = { free: 0, premium: 1, fo: 2 };
      if (uRow && grantTier && (rank[grantTier] || 0) > (rank[uRow.tier] || 0)) {
        await env.D1.prepare('UPDATE users SET tier = ? WHERE id = ?').bind(grantTier, uRow.id).run();
      }
      // Prévient le candidat : accès validé → il demande son lien sur /app.
      await sendEmail(env, { to: appRow.email, subject: 'Votre accès Marcel IA est validé', html: emailTemplateAccessApproved() }).catch(() => {});
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
    const revenu = premium * 24; // Premium 24€/mois (FO sur devis, non compté)
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
    } catch (e) { console.error('[admin/members]', e.message); return json({ error: 'members_failed' }, 500); }
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
  // ─── PARTENAIRES — réseau gestion de fortune (CRM interne admin) ───
  if (path === '/api/v1/admin/partners' && method === 'GET') {
    try {
      const rows = await env.D1.prepare('SELECT * FROM partners ORDER BY paid DESC, name ASC LIMIT 500').all();
      return json(rows.results || []);
    } catch (_) { return json([]); }
  }
  if (path === '/api/v1/admin/partners' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const name = (b.name || '').toString().trim();
    if (!name) return json({ error: 'name_required' }, 400);
    const now = Date.now();
    const id = (b.id || '').toString().trim() || crypto.randomUUID();
    const f = {
      category: (b.category || '').toString().slice(0, 60),
      region: (b.region || '').toString().slice(0, 80),
      contact_email: (b.contact_email || '').toString().slice(0, 254),
      contact_phone: (b.contact_phone || '').toString().slice(0, 40),
      website: (b.website || '').toString().slice(0, 254),
      points_forts: (b.points_forts || '').toString().slice(0, 600),
      paid: b.paid ? 1 : 0,
      forfait: (b.forfait || '').toString().slice(0, 80),
      status: (b.status || 'actif').toString().slice(0, 20),
      published: b.published ? 1 : 0,
      notes: (b.notes || '').toString().slice(0, 600),
    };
    await env.D1.prepare(`
      INSERT INTO partners (id, name, category, region, contact_email, contact_phone, website, points_forts, paid, forfait, status, published, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, region=excluded.region,
        contact_email=excluded.contact_email, contact_phone=excluded.contact_phone, website=excluded.website,
        points_forts=excluded.points_forts, paid=excluded.paid, forfait=excluded.forfait, status=excluded.status,
        published=excluded.published, notes=excluded.notes, updated_at=excluded.updated_at
    `).bind(id, name, f.category, f.region, f.contact_email, f.contact_phone, f.website,
      f.points_forts, f.paid, f.forfait, f.status, f.published, f.notes, now, now).run();
    return json({ ok: true, id });
  }
  if (path === '/api/v1/admin/partners/delete' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const id = (b.id || '').toString().trim();
    if (!id) return json({ error: 'id_required' }, 400);
    await env.D1.prepare('DELETE FROM partners WHERE id = ?').bind(id).run();
    return json({ ok: true });
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
  // Écriture essentielle (toujours), puis last_seen en best-effort (colonne optionnelle).
  await env.D1.prepare('UPDATE users SET profile_json = ?, prenom = COALESCE(?, prenom) WHERE id = ?')
    .bind(profile_json, prenom || null, session.user_id).run();
  try { await env.D1.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), session.user_id).run(); } catch (_) {}
  await audit(env, session.user_id, 'profile_save', request, { has_prenom: !!prenom });
  return json({ ok: true });
}

async function handleConsentsSave(request, session, env) {
  const body = await request.json().catch(() => ({}));
  const { consents } = body;
  if (typeof consents !== 'object' || consents === null) return json({ error: 'consents_required' }, 400);
  await env.D1.prepare('UPDATE users SET consents_json = ?, marketing_consent = ? WHERE id = ?')
    .bind(JSON.stringify(consents), consents.marketing ? 1 : 0, session.user_id).run();
  try { await env.D1.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), session.user_id).run(); } catch (_) {}
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
