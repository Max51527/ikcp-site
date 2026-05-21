/**
 * Marcel API — wrapper unifié pour tous les workers
 * Cabinet IKCP · ORIAS 23001568 · région Cloudflare WEUR Paris
 *
 * Usage :
 *   import { Marcel } from './api.js';
 *   const r = await Marcel.chat("Pacte Dutreil sur ma holding ?");
 *   const c = await Marcel.cartographie("947972436");
 *
 * ikcp-agents (Python FastAPI — Anthropic Managed Agents SDK) :
 *   const r = await Marcel.agentChat("Quel est mon IFI ?", "user-123");
 *   // → routing auto Marcel / Codex / Hermès / Olympe / Auguste
 *   // → { message, domain, specialist, meta }
 *
 *   // Streaming SSE
 *   await Marcel.agentStream("Mon patrimoine foncier…", "user-123", chunk => console.log(chunk));
 *
 * ⚠  AGENTS_URL est éphémère (localhost.run) tant que la clé Anthropic n'est pas définie.
 *    Remplacer par une URL stable (Cloudflare Tunnel / Railway / Fly.io) une fois opérationnel.
 */

// ── URL du backend Python ikcp-agents ─────────────────────────────────────
// → Mettre à jour ici quand le tunnel change, ou pointer vers l'URL de prod.
const AGENTS_URL = 'https://13a77103bd38dc.lhr.life';

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

// ─── Helper fetch JSON avec timeout 45 s ────────────────────────
async function jsonFetch(url, options = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), options.timeout || 45000);
  try {
    const r = await fetch(url, {
      credentials: 'include', // session cookie *.ikcp.eu
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
  async veille(query, mode = 'quick', userId, tier = 'premium_fo') {
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
      await jsonFetch(`${ENDPOINTS.client}/auth/logout`, { method: 'GET' });
      location.href = '/app/index.html';
    },
    async me() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me`);
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

  // ─── ikcp-agents : Anthropic Managed Agents (Marcel + 4 spécialistes) ───
  //     Routing automatique par domaine : fiscal / patrimoine / marchés / lifestyle
  //     Session persistante par user_id côté serveur Python.

  // Chat synchrone — attend la réponse complète
  async agentChat(message, userId = 'anonymous') {
    return jsonFetch(`${AGENTS_URL}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, user_id: userId }),
    });
    // Retourne : { message, domain, specialist, meta: { agent_id, channel } }
  },

  // Chat streaming SSE — callback appelé pour chaque chunk de texte
  async agentStream(message, userId = 'anonymous', onChunk, onDone) {
    const resp = await fetch(`${AGENTS_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, user_id: userId }),
    });
    if (!resp.ok) throw new Error(`ikcp-agents stream ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { onDone?.(); return; }
        try {
          const obj = JSON.parse(payload);
          if (obj.text && onChunk) onChunk(obj.text);
          if (obj.error) throw new Error(obj.error);
        } catch (e) { /* JSON parse error on partial chunk → skip */ }
      }
    }
    onDone?.();
  },

  // Health check ikcp-agents
  async agentHealth() {
    return jsonFetch(`${AGENTS_URL}/api/health`);
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
