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

// Barre d'onglets de l'app (bottom tab bar) — auto-injectée sur les pages
// membres éligibles. Import à effet de bord : se filtre lui-même par page.
import './appnav.js';

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

// ─── Studio design : applique le thème choisi (polices + couleur d'accent) ──
// Le Studio (/app/studio.html) écrit 'ikcp_theme' ; toutes les pages membre qui
// importent api.js l'appliquent en direct → "je teste, je vois sur le site".
(function applyTheme() {
  try {
    if (typeof document === 'undefined') return;
    const t = JSON.parse(localStorage.getItem('ikcp_theme') || 'null');
    if (!t) return;
    const fams = [t.titleFont, t.bodyFont].filter(Boolean).map(f => f.replace(/ /g, '+'));
    if (fams.length) {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap';
      document.head.appendChild(l);
    }
    const css = [];
    if (t.bodyFont)  css.push(`body{font-family:'${t.bodyFont}',sans-serif !important}`);
    if (t.titleFont) css.push(`h1,h2,h3,h4,.app-h1,.app-brand,.chat-head h1,.section-label,.wordmark{font-family:'${t.titleFont}',serif !important}`);
    if (css.length) { const s = document.createElement('style'); s.id = 'ikcp-theme-style'; s.textContent = css.join('\n'); document.head.appendChild(s); }
    if (t.accent) document.documentElement.style.setProperty('--accent', t.accent);
  } catch (_) {}
})();

// ─── Helper fetch JSON avec timeout 45 s ────────────────────────
async function jsonFetch(url, options = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), options.timeout || 45000);
  const tok = getToken();
  // Le jeton de session n'est envoyé QU'aux workers qui le valident et
  // l'autorisent en CORS (client = auth/tiers ; chat = Marcel pour le tier).
  // Les autres workers (Pappers, veille directe…) n'autorisent pas l'en-tête
  // Authorization → l'ajouter casserait le pré-vol CORS ("Société introuvable").
  const authScope = (url.indexOf(ENDPOINTS.client) === 0 || url.indexOf(ENDPOINTS.chat) === 0);
  const sendAuth = tok && authScope;
  try {
    const r = await fetch(url, {
      // cookie de secours UNIQUEMENT pour client/chat (workers qui renvoient
      // Access-Control-Allow-Credentials). Les workers publics (Pappers, veille,
      // codex…) ne l'autorisent pas → credentials:'include' casserait leur CORS
      // avec un "Failed to fetch" silencieux ("cartographie indisponible").
      ...(authScope ? { credentials: 'include' } : {}),
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

// Catégorie juridique INSEE (code) → libellé court, pour le repli gouv quand Pappers est indispo.
function formeFromCodeINSEE(c) {
  c = String(c || ''); const p = c.slice(0, 2);
  const m = { '10': 'Entrepreneur individuel', '54': 'SARL', '55': 'Société anonyme (SA)', '56': 'Société par actions', '57': 'SAS', '62': 'GIE', '65': 'Société civile', '69': 'Personne morale de droit privé' };
  return m[p] || (c ? ('Société (code ' + c + ')') : '');
}

// ═══════════════════════════════════════════════════════════════════════
// Member Experience Layer — brique 1 : priorités patrimoniales
// ═══════════════════════════════════════════════════════════════════════
//
// @typedef {'critical'|'high'|'medium'|'low'} PriorityUrgency
// @typedef {'high'|'medium'|'low'} PriorityImpact
// @typedef {'detected'|'to_analyze'|'simulation_ready'|'decision_ready'|'in_progress'|'completed'} PriorityStatus
//
// @typedef {Object} PatrimonialPriority
// @property {string} id
// @property {string} title
// @property {string} category            - 'financier' | 'juridique' | 'fiscal' | 'social'
// @property {PriorityUrgency} urgency
// @property {PriorityImpact} impact
// @property {string} horizon              - ex. "0-90 jours", "3-18 mois"
// @property {PriorityStatus} status
// @property {string} explanation          - en clair, sans jargon
// @property {string} whyNow                - pourquoi cette priorité, maintenant
// @property {string[]} requiredDocuments
// @property {string|null} linkedSimulatorId
// @property {string|null} nextActionLabel
// @property {'marcel'|'simulateur'|'document'|'profil'} nextActionType
// @property {number} createdAt

// Mêmes clés localStorage que app/bilan.html / app/dashboard.html — on lit
// les VRAIES données du membre, jamais une seconde source de vérité.
function _readSocieteME() { try { return JSON.parse(localStorage.getItem('ikcp_societe') || 'null'); } catch (_) { return null; } }
function _readPatrimoineME() { try { return JSON.parse(localStorage.getItem('ikcp_patrimoine') || 'null'); } catch (_) { return null; } }
function _readRecueilME() { try { return JSON.parse(localStorage.getItem('ikcp_recueil') || 'null'); } catch (_) { return null; } }

const PER_PLAFOND_2026 = 88911;
const IFI_SEUIL_2026 = 1_300_000;

// Profil de démonstration (Thomas Martin) — affiché UNIQUEMENT si le membre
// n'a strictement rien renseigné (aucun SIREN relié, aucun bien déclaré) :
// sert d'aperçu de ce que produit la page, jamais présenté comme ses vraies données.
function _demoPriorities() {
  const now = Date.now();
  return [
    { id: 'demo-liquidite', title: 'Répartir vos liquidités entre rémunération, investissements et holding', category: 'financier', urgency: 'high', impact: 'high', horizon: '0-90 jours', status: 'to_analyze', explanation: "Un exemple : président de SAS avec holding, trésorerie qui dort sur le compte de la société.", whyNow: "Exemple illustratif — reliez votre société (SIREN) pour voir VOS priorités réelles.", requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'Relier ma société →', nextActionType: 'profil', createdAt: now },
    { id: 'demo-protection', title: 'Consolider la protection du dirigeant en cas d\'arrêt de travail', category: 'social', urgency: 'high', impact: 'high', horizon: '0-90 jours', status: 'detected', explanation: "Exemple : la prévoyance TNS/Madelin est souvent sous-dimensionnée face au train de vie réel.", whyNow: "Exemple illustratif.", requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'Voir un exemple', nextActionType: 'marcel', createdAt: now },
    { id: 'demo-transmission', title: 'Préparer la transmission de la holding et de l\'entreprise', category: 'juridique', urgency: 'medium', impact: 'high', horizon: '5 ans et plus', status: 'detected', explanation: "Exemple : le pacte Dutreil exonère jusqu'à 75 % de l'assiette taxable, sous engagement de conservation.", whyNow: "Exemple illustratif.", requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'Voir un exemple', nextActionType: 'marcel', createdAt: now },
  ];
}

// Règles déterministes — MÊMES signaux que app/bilan.html, reformulés en
// PatrimonialPriority. Aucune IA ici : c'est intentionnellement lisible et
// vérifiable. Les agents Marcel (diagnostic/rémunération/holding/protection/
// transmission) viendront enrichir cette liste plus tard, sans changer la forme.
function _derivePriorities() {
  const soc = _readSocieteME();
  const pat = _readPatrimoineME();
  const rec = _readRecueilME();
  const out = [];
  const now = Date.now();

  if (!soc && !pat) return _demoPriorities();

  // ── Financier : concentration + liquidités dormantes ──
  if (pat && typeof pat === 'object') {
    const map = { tresorerie: 'liquidites', passion: 'collection' };
    const byCat = {};
    let brut = 0;
    Object.keys(pat).forEach((k) => { if (k === 'passif') return; const v = +pat[k] || 0; if (v > 0) { const c = map[k] || k; byCat[c] = (byCat[c] || 0) + v; brut += v; } });
    const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    if (cats.length && brut) {
      const top = cats[0], topShare = Math.round((byCat[top] / brut) * 100);
      if (topShare >= 50) {
        out.push({ id: 'concentration', title: `Réduire la concentration sur ${top}`, category: 'financier', urgency: 'medium', impact: 'high', horizon: '3-18 mois', status: 'detected', explanation: `${topShare} % de votre patrimoine déclaré repose sur un seul poste — un choc sur cet actif toucherait l'essentiel de votre patrimoine.`, whyNow: 'Détecté à partir de votre recueil patrimonial.', requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'En discuter avec Marcel →', nextActionType: 'marcel', createdAt: now });
      }
      const liq = byCat.liquidites || 0;
      if (liq > 0 && liq / brut > 0.25) {
        out.push({ id: 'liquidites-dormantes', title: 'Faire travailler vos liquidités disponibles', category: 'financier', urgency: 'medium', impact: 'medium', horizon: '0-90 jours', status: 'to_analyze', explanation: `Vos liquidités représentent ${Math.round((liq / brut) * 100)} % de votre patrimoine déclaré. Au-delà d'une réserve de précaution, elles perdent de la valeur face à l'inflation.`, whyNow: 'Détecté à partir de votre recueil patrimonial.', requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'Explorer les pistes →', nextActionType: 'marcel', createdAt: now });
      }
    }
    const localPassif = +pat.passif || 0;
    if (localPassif > 0 && brut > 0 && localPassif / brut > 0.6) {
      out.push({ id: 'endettement', title: 'Faire le point sur votre niveau d\'endettement', category: 'financier', urgency: 'high', impact: 'high', horizon: '0-90 jours', status: 'detected', explanation: `Votre passif déclaré représente une part importante de votre actif brut — un point de vigilance avant tout nouvel engagement.`, whyNow: 'Détecté à partir de votre recueil patrimonial.', requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'En discuter avec Marcel →', nextActionType: 'marcel', createdAt: now });
    }
  }

  // ── Juridique : société → Dutreil / holding ──
  if (soc && soc.nom) {
    out.push({ id: 'holding-dutreil', title: 'Structurer la transmission de vos titres', category: 'juridique', urgency: 'medium', impact: 'high', horizon: '5 ans et plus', status: 'detected', explanation: `Le pacte Dutreil peut exonérer jusqu'à 75 % de l'assiette taxable sur la transmission de ${soc.nom}, sous engagement de conservation (art. 787 B CGI).`, whyNow: `Détecté via votre société reliée (${soc.nom}).`, requiredDocuments: ['Statuts de la société', 'Répartition du capital'], linkedSimulatorId: 'dutreil', nextActionLabel: 'Simuler l\'économie →', nextActionType: 'simulateur', createdAt: now });
  }

  // ── Fiscal : arbitrage rémunération, PER, IFI ──
  if (soc && soc.resultat != null && soc.resultat > 0) {
    out.push({ id: 'arbitrage-remuneration', title: 'Arbitrer rémunération, dividendes et holding', category: 'fiscal', urgency: 'high', impact: 'high', horizon: '0-90 jours', status: 'to_analyze', explanation: 'La façon de sortir le bénéfice de votre société change fortement votre net perçu — l\'écart se chiffre souvent en dizaines de milliers d\'euros par an.', whyNow: `Détecté via le résultat de ${soc.nom || 'votre société'}.`, requiredDocuments: ['Dernier bilan comptable'], linkedSimulatorId: 'remuneration', nextActionLabel: 'Simuler l\'arbitrage →', nextActionType: 'simulateur', createdAt: now });
  }
  out.push({ id: 'per', title: 'Utiliser votre plafond de déduction PER', category: 'fiscal', urgency: 'low', impact: 'medium', horizon: '0-90 jours', status: 'detected', explanation: `Vous pouvez déduire jusqu'à ${PER_PLAFOND_2026.toLocaleString('fr-FR')} € de votre revenu imposable 2026 (plafonds des 3 dernières années reportables).`, whyNow: 'Levier disponible chaque année, à activer avant le 31 décembre.', requiredDocuments: [], linkedSimulatorId: 'per', nextActionLabel: 'Simuler →', nextActionType: 'simulateur', createdAt: now });
  const immoTotal = pat && typeof pat === 'object' ? (+pat.immobilier || 0) : 0;
  if (immoTotal >= IFI_SEUIL_2026) {
    out.push({ id: 'ifi', title: 'Piloter votre exposition à l\'IFI', category: 'fiscal', urgency: 'high', impact: 'high', horizon: '3-18 mois', status: 'detected', explanation: `Votre immobilier déclaré (${immoTotal.toLocaleString('fr-FR')} €) dépasse le seuil d'assujettissement de ${IFI_SEUIL_2026.toLocaleString('fr-FR')} €.`, whyNow: 'Détecté à partir de votre recueil patrimonial.', requiredDocuments: [], linkedSimulatorId: 'ifi', nextActionLabel: 'Simuler mon IFI →', nextActionType: 'simulateur', createdAt: now });
  }

  // ── Social/protection : régime matrimonial, mandat, prévoyance (recueil) ──
  if (rec && rec.juridique) {
    const J = rec.juridique;
    if (J.testament !== 'oui' || J.mandatProtection !== 'oui' || J.prevoyance !== 'oui') {
      out.push({ id: 'protection-famille', title: 'Compléter votre protection personnelle et familiale', category: 'social', urgency: 'high', impact: 'high', horizon: '0-90 jours', status: 'to_analyze', explanation: 'Testament, mandat de protection future, prévoyance dirigeant : des éléments déclarés absents ou à vérifier dans votre recueil.', whyNow: 'Détecté à partir de votre recueil patrimonial (volet juridique).', requiredDocuments: [], linkedSimulatorId: null, nextActionLabel: 'Compléter mon recueil →', nextActionType: 'profil', createdAt: now });
    }
  }

  return out.length ? out : _demoPriorities();
}

function memberExperienceApi() {
  return {
    /** @returns {Promise<PatrimonialPriority[]>} */
    async getPriorities() {
      // Étape 1 (aujourd'hui) : règles déterministes locales, décrites plus haut.
      // Étape 2 (à venir) : GET /api/v1/me/priorities côté ikcp-client, une fois
      // les agents Marcel branchés — cette fonction changera de source, jamais
      // de forme (même objet PatrimonialPriority), donc rien à changer côté UI.
      return _derivePriorities();
    },
    /** @returns {Promise<PatrimonialPriority|null>} La priorité la plus urgente, pour le dashboard. */
    async getNextBestAction() {
      const list = await this.getPriorities();
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return list.slice().sort((a, b) => (rank[a.urgency] ?? 9) - (rank[b.urgency] ?? 9))[0] || null;
    },
  };
}

// ─── API publique ──────────────────────────────────────────────
export const Marcel = {

  // 1. Chat avec Marcel (chef d'orchestre)
  async chat(message, history = []) {
    return jsonFetch(ENDPOINTS.chat, {
      method: 'POST',
      body: JSON.stringify({ message, history }),
      timeout: 70000, // Opus + recherche web temps réel peut dépasser 45 s
    });
  },

  // 1bis. Chat en STREAMING (SSE) — affichage des tokens en direct (vitesse perçue ~2×).
  // onToken(token, accumulated) est appelé à chaque morceau reçu.
  // Retourne { reply, follow_ups, provider, streamed:true } en succès,
  // ou { __fallback:true } si la question requiert un outil (veille/spécialiste)
  // ou si le flux n'est pas disponible → l'appelant rebascule sur chat().
  async chatStream(message, history = [], onToken) {
    const tok = getToken();
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 70000);
    try {
      const r = await fetch(ENDPOINTS.chat + '?stream=1', {
        method: 'POST',
        credentials: 'include',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(tok ? { 'Authorization': 'Bearer ' + tok } : {}),
        },
        body: JSON.stringify({ message, history }),
      });
      // Pas un flux (quota atteint, erreur, ?stream ignoré…) → repli propre.
      if (!r.ok || !r.body || !((r.headers.get('content-type') || '').includes('event-stream'))) {
        return { __fallback: true };
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '', acc = '', meta = null, fellBack = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          let j; try { j = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
          if (j.fallback) { fellBack = true; break; }
          if (typeof j.token === 'string') { acc += j.token; if (onToken) { try { onToken(j.token, acc); } catch (_) {} } }
          if (j.done) { meta = j; }
        }
        if (fellBack) break;
      }
      if (fellBack) return { __fallback: true };
      const reply = (meta && meta.reply) || acc;
      if (!reply.trim()) return { __fallback: true };
      return { reply, follow_ups: (meta && meta.follow_ups) || [], provider: (meta && meta.provider) || 'mistral-souverain', streamed: true };
    } catch (e) {
      return { __fallback: true };
    } finally {
      clearTimeout(tid);
    }
  },

  // 2. Cartographie SIREN — identité (Pappers, souverain) + FINANCES réelles
  //    (API gouv recherche-entreprises = comptes déposés RNE/INPI, appelée CÔTÉ NAVIGATEUR :
  //     l'IP de l'utilisateur évite le 429 que subit l'IP partagée des Workers).
  //    Résilient : si Pappers tombe, l'API gouv sert aussi de repli identité.
  async cartographie(siren) {
    const s = String(siren).replace(/\s+/g, '');
    if (!/^\d{9}$/.test(s)) throw new Error('SIREN invalide (9 chiffres)');
    const [pap, gov] = await Promise.all([
      jsonFetch(`${ENDPOINTS.pappers}/entreprise/${s}/short`).catch(() => null),
      fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${s}&per_page=1`, { headers: { Accept: 'application/json' } })
        .then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const gv = (gov && gov.results && gov.results[0]) || null;
    if (!pap && !gv) throw new Error('Société introuvable');
    // Finances (gouv, dernier exercice déposé)
    let ca = null, resultat = null, finances_annee = null;
    if (gv && gv.finances) {
      const ys = Object.keys(gv.finances).filter(y => gv.finances[y]).sort();
      const ly = ys[ys.length - 1];
      if (ly) { ca = gv.finances[ly].ca; resultat = gv.finances[ly].resultat_net; finances_annee = ly; }
    }
    // Fusion normalisée (champs à plat) : Pappers prioritaire, gouv en repli
    const out = pap ? { ...pap } : { siren: s };
    out.nom = out.nom || (gv && gv.nom_complet) || 'Société';
    // L'API gouv renvoie parfois « NOM (NOM) » (sigle = nom) — on déduplique pour l'affichage
    out.nom = String(out.nom).replace(/^(.+?)\s*\(\s*\1\s*\)\s*$/, '$1');
    out.forme_juridique = out.forme_juridique || (gv ? formeFromCodeINSEE(gv.nature_juridique) : '');
    out.ville = (pap && pap.siege && pap.siege.ville) || (gv && gv.siege && gv.siege.libelle_commune) || '';
    out.code_naf = out.code_naf || (gv && gv.activite_principale) || '';
    out.date_creation = out.date_creation || (gv && gv.date_creation) || null;
    if (!out.dirigeant && gv && gv.dirigeants && gv.dirigeants[0]) {
      const g0 = gv.dirigeants[0];
      out.dirigeant = { nom: g0.nom_complet || g0.nom || '', prenom: g0.prenoms || '' };
    }
    if (ca != null) out.chiffre_affaires = ca;
    if (resultat != null) out.resultat = resultat;
    if (finances_annee) out.finances_annee = finances_annee;
    out.finances_source = (ca != null || resultat != null) ? 'RNE/INPI (comptes déposés)' : null;
    return out;
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
  async veille(query, mode = 'quick', userId, tier = 'free') {
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
    /** Connexion par mot de passe (sans email). Renvoie {token} → session 30 j. */
    async login(email, password) {
      const r = await jsonFetch(`${ENDPOINTS.client}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (r && r.token) { try { localStorage.setItem(TOKEN_KEY, r.token); } catch (_) {} }
      return r;
    },
    /** Définit / change son mot de passe (utilisateur déjà connecté). */
    async setPassword(password) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
    async logout() {
      try { await jsonFetch(`${ENDPOINTS.client}/auth/logout`, { method: 'GET' }); } catch (_) {}
      clearToken();
      location.href = '/app/index.html';
    },
    async me() {
      const data = await jsonFetch(`${ENDPOINTS.client}/api/v1/me`);
      // Thème par tier : on cache le tier + on l'applique sur <html data-tier>
      try {
        if (data && data.tier) {
          localStorage.setItem('ikcp_tier', data.tier);
          if (typeof document !== 'undefined') document.documentElement.setAttribute('data-tier', data.tier);
        }
      } catch (_) {}
      return data;
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
    // Mémoire conversationnelle Marcel (Premium/FO) — {messages, memory}
    async getMemory() {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/memory`);
    },
    async saveMemory(messages) {
      return jsonFetch(`${ENDPOINTS.client}/api/v1/me/memory`, {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
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

  // ─── Vos priorités patrimoniales (Member Experience Layer, brique 1) ──
  // Aujourd'hui : règles déterministes sur les VRAIES données du membre
  // (mêmes signaux que app/bilan.html : concentration, liquidités dormantes,
  // Dutreil/holding, arbitrage rémunération, PER, IFI, régime matrimonial).
  // Demain : ces mêmes priorités pourront être produites par les agents
  // Marcel (diagnostic, rémunération, holding, protection, transmission) —
  // la forme des objets ne change pas, seule la source change.
  MemberExperience: memberExperienceApi(),

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

// ─── Détection automatique d'une nouvelle version ───────────────────────────
// Charge une fois le numéro de la version en ligne (/version.json, écrit par le
// déploiement). À chaque retour sur l'app (focus / onglet visible), on relit ce
// numéro : s'il a changé, une nouvelle version est en ligne → on met à jour le
// service worker et on propose un rafraîchissement en un geste.
// C'est ce qui remplace le « fermer/rouvrir l'app deux fois ».
(function versionWatch() {
  if (typeof window === 'undefined' || typeof fetch !== 'function' || typeof document === 'undefined') return;
  let loadedSha = null;
  let checking = false;

  const readSha = async () => {
    try {
      const r = await fetch('/version.json', { cache: 'no-store' });
      if (!r.ok) return null;
      const d = await r.json();
      return d && d.sha ? String(d.sha) : null;
    } catch (_) { return null; }
  };

  const showBanner = () => {
    if (document.getElementById('ikcpUpdate')) return;
    const bar = document.createElement('div');
    bar.id = 'ikcpUpdate';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9999;display:flex;gap:10px;align-items:center;background:#1B2A4A;color:#FAF8F4;border:1px solid rgba(226,200,150,.5);border-radius:99px;padding:9px 10px 9px 16px;box-shadow:0 16px 34px -14px rgba(14,23,41,.6);font-family:Outfit,system-ui,sans-serif;font-size:13px;max-width:92vw';
    const txt = document.createElement('span');
    txt.textContent = 'Nouvelle version disponible';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Actualiser';
    btn.style.cssText = 'background:linear-gradient(120deg,#E2C896,#C9A96E);color:#20180c;border:0;border-radius:99px;padding:7px 14px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap';
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = '…';
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.update().catch(() => {})));
        }
      } catch (_) {}
      location.reload();
    });
    bar.appendChild(txt); bar.appendChild(btn);
    document.body.appendChild(bar);
  };

  const check = async () => {
    if (checking || document.hidden) return;
    checking = true;
    const sha = await readSha();
    checking = false;
    if (!sha) return;
    if (!loadedSha) { loadedSha = sha; return; }   // première lecture = version de référence
    if (sha !== loadedSha) showBanner();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  else check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('focus', check);
})();
