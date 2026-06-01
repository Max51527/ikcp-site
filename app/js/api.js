/**
 * Marcel API — wrapper unifié pour tous les workers Cloudflare
 * Cabinet IKCP · ORIAS 23001568 · région Cloudflare WEUR Paris
 *
 * Usage :
 *   import { Marcel } from './api.js';
 *   const r = await Marcel.chat("Pacte Dutreil sur ma holding ?");
 *   const c = await Marcel.cartographie("947972436");
 *
 * Architecture (Sprint 2) :
 *   ikcp-chat    → Marcel chef d'orchestre (Sonnet 4.6) · LIVE
 *   ikcp-codex   → Codex fiscal expert (Opus 4.7) · LIVE
 *   ikcp-client  → Auth magic link + espace membre · À déployer
 *   ikcp-pappers → Cartographie SIREN RNE · LIVE
 *   ikcp-temoin  → Audit log MIF II · LIVE
 *   ikcp-veille  → Veille Perplexity Pro · Sprint 2
 *   ikcp-batisseur / ikcp-hermes / ikcp-lifestyle → Sprint 2
 */

const ENDPOINTS = {
  chat:        'https://ikcp-chat.maxime-ead.workers.dev',
  pappers:     'https://ikcp-pappers.maxime-ead.workers.dev',
  codex:       'https://ikcp-codex.maxime-ead.workers.dev',
  batisseur:   'https://ikcp-batisseur.maxime-ead.workers.dev', // Sprint 2
  hermes:      'https://ikcp-hermes.maxime-ead.workers.dev',    // Sprint 2
  lifestyle:   'https://ikcp-lifestyle.maxime-ead.workers.dev',
  veille:      'https://ikcp-veille.maxime-ead.workers.dev',
  collector:   'https://ikcp-collector.maxime-ead.workers.dev',
  temoin:      'https://ikcp-temoin.maxime-ead.workers.dev',
  client:      'https://ikcp-client.maxime-ead.workers.dev',
};

// ─── Session par JETON (robuste cross-domaine, contourne cookies tiers) ──
// Au retour du lien magique, le worker redirige vers .../dashboard.html#s=<token>.
// On capte le token du fragment, on le stocke, et on le retire de l'URL.
const TOKEN_KEY = 'ikcp_token';
(function captureToken() {
  try {
    if (typeof location === 'undefined') return;
    const m = (location.hash || '').match(/[#&]s=([^&]+)/);
    if (m) {
      localStorage.setItem(TOKEN_KEY, decodeURIComponent(m[1]));
      // retire le token de l'URL (sans recharger)
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch (_) {}
})();
function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } }
function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (_) {} }

// ─── Helper fetch JSON avec timeout 45 s ────────────────────────
async function jsonFetch(url, options = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), options.timeout || 45000);
  const tok = getToken();
  // Le jeton de session n'est envoyé QU'aux workers qui le valident et
  // l'autorisent en CORS (client = auth/tiers ; chat = Marcel pour le tier).
  // Les autres workers (Pappers, veille directe…) n'autorisent pas l'en-tête
  // Authorization → l'ajouter casserait le pré-vol CORS ("Société introuvable").
  const sendAuth = tok && (url.indexOf(ENDPOINTS.client) === 0 || url.indexOf(ENDPOINTS.chat) === 0);
  try {
    const r = await fetch(url, {
      credentials: 'include', // cookie de secours (si api.ikcp.eu un jour)
      ...options,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(sendAuth ? { 'Authorization': 'Bearer ' + tok } : {}),
        ...(options.headers || {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`API ${r.status}: ${txt.slice(0, 200)}`);
    }
    return r.json();
  } finally {
    clearTimeout(tid);
  }
}

// ─── API publique ──────────────────────────────────────────────
export const Marcel = {

  // 1. Chat avec Marcel (chef d'orchestre)
  async chat(message, history = []) {
    return jsonFetch(ENDPOINTS.chat, {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  // 2. Cartographie SIREN (Pappers)
  async cartographie(siren) {
    const s = String(siren).replace(/\s+/g, '');
    if (!/^\d{9}$/.test(s)) throw new Error('SIREN invalide (9 chiffres)');
    return jsonFetch(`${ENDPOINTS.pappers}/entreprise/${s}/short`);
  },

  // 3. Codex — expertise fiscale directe (premium uniquement, Marcel délègue normalement)
  async codex(question, context = '') {
    return jsonFetch(ENDPOINTS.codex, {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    });
  },

  // 4. Bâtisseur — patrimoine 360° multi-entités (Sprint 2)
  async batisseur(question, context = '') {
    return jsonFetch(ENDPOINTS.batisseur, {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    });
  },

  // 5. Hermès — transmission patrimoniale (Sprint 2)
  async hermes(question, context = '') {
    return jsonFetch(ENDPOINTS.hermes, {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    });
  },

  // 5. Lifestyle — sub-agent au choix
  async lifestyle(agent, question, context = '') {
    return jsonFetch(ENDPOINTS.lifestyle, {
      method: 'POST',
      body: JSON.stringify({ agent, question, context }),
    });
  },

  // 6. Veille augmentée (Premium)
  async veille(query, mode = 'quick', userId, tier = 'fo') {
    return jsonFetch(`${ENDPOINTS.veille}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, mode, user_id: userId, tier }),
    });
  },

  // ─── Auth + utilisateur ─────────────────────────────────────
  Auth: {
    async requestMagicLink(email) {
      return jsonFetch(`${ENDPOINTS.client}/auth/send`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    async logout() {
      try { await jsonFetch(`${ENDPOINTS.client}/auth/logout`, { method: 'GET' }); } catch (_) {}
      clearToken();
      location.href = '/app/index.html';
    },
    async me() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me`);
    },
  },

  // ─── Abonnement (Stripe Checkout hébergé) ──────────────────
  Billing: {
    // plan = 'monthly' | 'yearly' → renvoie une URL Stripe à ouvrir
    async checkout(plan = 'monthly') {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/stripe/checkout`, {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
    },
    // Portail client Stripe (gérer / résilier l'abonnement)
    async portal() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/stripe/portal`, { method: 'POST' });
    },
  },

  // ─── Données utilisateur (toutes routes /api/v1/me/*) ──────
  Me: {
    async sirens() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/sirens`);
    },
    async addSiren(siren) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/sirens`, {
        method: 'POST',
        body: JSON.stringify({ siren }),
      });
    },
    async conversations() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/conversations`);
    },
    async contacts() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/contacts`);
    },
    async addContact(payload) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/contacts`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async deleteContact(id) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/contacts/${id}`, { method: 'DELETE' });
    },
    async alerts(unread = false) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/alerts${unread ? '?unread=1' : ''}`);
    },
    async documents() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/documents`);
    },
    async watches() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/watches`);
    },
    async addWatch(payload) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/watches`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async referralCode() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/referral`);
    },
    async collections() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/collections`);
    },
    async addCollectionItem(payload) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/collections`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async deleteCollectionItem(id) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/collections/${id}`, { method: 'DELETE' });
    },
    async exportRgpd() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/export`);
    },
    async saveProfile(profile_json, prenom) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/profile`, {
        method: 'POST',
        body: JSON.stringify({ profile_json, prenom }),
      });
    },
    async saveConsents(consents) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/consents`, {
        method: 'POST',
        body: JSON.stringify({ consents }),
      });
    },
    async auditLog() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/audit-log`);
    },
    async deleteAccount() {
      const ok = confirm('Supprimer définitivement votre compte et toutes vos données ? Action irréversible.');
      if (!ok) return false;
      await jsonFetch(`${ENDPOINTS.client}/api/v1/me`, { method: 'DELETE' });
      return true;
    },
  },

  // ─── Accès gouverné : invitation / parrainage (public) ──────
  Invite: {
    async check(code) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/invite/check`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
    async apply(payload) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/invite/apply`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // ─── Helpers utilitaires ────────────────────────────────────
  Utils: {
    formatEUR(n) { return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n); },
    formatDate(iso) { return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); },
    pingHealth() {
      return Promise.allSettled(
        Object.entries(ENDPOINTS).map(([name, url]) =>
          fetch(`${url}/health`).then(r => ({ name, ok: r.ok, status: r.status }))
        )
      );
    },
  },
};

// Expose globalement pour debug console
if (typeof window !== 'undefined') window.Marcel = Marcel;
