/**
 * IKCP Marcel Worker v2 — Cloudflare Worker
 *
 * Remplace ikcp-chat avec :
 *  - Web search natif Anthropic (actualités fiscales à jour)
 *  - Contexte saisonnier injecté à chaque appel
 *  - Exemples few-shot de réponses idéales
 *  - Règles de conformité MIF II renforcées
 *  - Logging anonyme dans KV (TTL 90 jours)
 *
 * Input (format conservé pour compat frontend) :
 *   POST { "message": string, "history": [{role, content}] }
 *
 * Output :
 *   { "reply": string, "web_search_used": boolean, "season": string }
 *
 * Bindings requis :
 *   ANTHROPICAPIKEY  (secret)   — clé API Anthropic sk-ant-...
 *   MARCEL_LOGS      (KV binding, optionnel) — logs anonymisés
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://ikcp.fr',
  'https://www.ikcp.fr',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://admin.ikcp.eu',
  'https://app.ikcp.eu',
  'https://ikcp-eu.pages.dev',       // Cloudflare Pages (production)
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8765',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8765',
  'null', // file:// (test local depuis test-harness.html)
  '',     // GET direct depuis navigateur (pas d'Origin header)
];

// ──────────────────────────────────────────────────────────────
// SPECIALISTS REGISTRY — workers vers lesquels Marcel delegue
// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// SPECIALISTS REGISTRY — 12 agents alignés sur les univers Family Office
// Noms synchronisés avec UNIVERS_DATA dans family-office.html
// ──────────────────────────────────────────────────────────────
const SPECIALISTS_REGISTRY = {
  // ✅ LIVE Sprint 1
  codex:     { url: 'https://ikcp-codex.maxime-ead.workers.dev/',     displayName: 'Codex',       role: 'Fiscalité experte · arbitrages CGI · jurisprudence fiscale',              model: 'opus-4-7',   live: true  },
  // 🟡 Sprint 2 — workers dédiés (ikcp-batisseur / ikcp-hermes), déployables via CI/CD
  batisseur: { url: 'https://ikcp-batisseur.maxime-ead.workers.dev/', displayName: 'Bâtisseur',   role: 'Cartographie patrimoine 360° · bilan dirigeant · holding · governance',    model: 'opus-4-7',   live: false },
  hermes:    { url: 'https://ikcp-hermes.maxime-ead.workers.dev/',    displayName: 'Hermès',      role: 'Transmission patrimoniale · succession · donation · pacte Dutreil',        model: 'opus-4-7',   live: true  },
  // 🔴 Sprint 3 — mutualisé sur ikcp-lifestyle
  // agentKey = clé réelle dans ikcp-lifestyle/prompts.js (≠ registry key)
  architecte:{ url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Architecte',  role: 'Immobilier & Foncier · DVF · IFI · SCI · montages locatifs',              model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'augustin'   },
  stratege:  { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Stratège',    role: 'Marchés · allocation · produits financiers · diversification',             model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'stratege'   },
  // 🔴 Sprint 4 — lifestyle mutualisé
  curateur:  { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Curateur',    role: 'Art · Horlogerie · Collections · Vins · Joaillerie · valeur & assurance',  model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'curateur'   },
  concierge: { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Concierge',   role: 'Voyage · Conciergerie · Mode · Bien-être · Aviation · expériences',        model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'iris'       },
  capital:   { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Capital',     role: 'Capital investissement · private equity · actifs alternatifs · dette privée', model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'capital'   },
  // 🔴 Sprint 5
  mecene:    { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Mécène',      role: 'Philanthropie · Fondations · mécénat fiscal · NextGen · impact',           model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'olympe'     },
  pedagogue: { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Pédagogue',   role: 'Éducation financière · sensibilisation patrimoniale · formation NextGen',   model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'pedagogue'  },
  camille:   { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Camille',     role: 'Assistance & Onboarding · coordination · support familles fondatrices',    model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'camille'    },
  olympe:    { url: 'https://ikcp-lifestyle.maxime-ead.workers.dev/', displayName: 'Olympe',      role: 'Bien-être · santé · médecine privée · art de vivre & longévité',           model: 'sonnet-4-6', live: true,  mutualisé: true, agentKey: 'helene'     },
};
// Filtre — Marcel ne peut déléguer qu'aux spécialistes déjà déployés
const SPECIALISTS_IDS_LIVE = Object.entries(SPECIALISTS_REGISTRY).filter(([,v]) => v.live).map(([k]) => k);
const SPECIALISTS_IDS = Object.keys(SPECIALISTS_REGISTRY);

// ──────────────────────────────────────────────────────────────
// COLLECTOR API — profil collectionneur perso (montres, voitures, lego...)
// ──────────────────────────────────────────────────────────────
const COLLECTOR_URL = 'https://ikcp-collector.maxime-ead.workers.dev';

async function collectorFetch(env, path, method = 'GET', body = null) {
  if (!env.COLLECTOR_ADMIN_TOKEN) {
    return { error: 'COLLECTOR_ADMIN_TOKEN non configure sur Marcel' };
  }
  try {
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${env.COLLECTOR_ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${COLLECTOR_URL}${path}`, opts);
    if (!r.ok) return { error: `Collector HTTP ${r.status}`, detail: (await r.text()).slice(0, 200) };
    return await r.json();
  } catch (e) {
    return { error: `Collector reseau : ${e.message}` };
  }
}

async function fetchUserContextFromClient(request) {
  try {
    const r = await fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/me', {
      headers: { Cookie: request.headers.get('Cookie') || '' },
    });
    if (!r.ok) return null;
    const me = await r.json();
    const lines = [];
    let profile = {};
    try { profile = me.profile_json ? JSON.parse(me.profile_json) : {}; } catch (_) {}
    if (profile.prenom) lines.push(`Prénom : ${profile.prenom}`);
    if (profile.age) lines.push(`Âge : ${profile.age} ans`);
    if (profile.situation) lines.push(`Situation : ${profile.situation.replace(/_/g, ' ')}`);
    if (profile.profession) lines.push(`Activité : ${profile.profession.replace(/_/g, ' ')}`);
    if (profile.spheres && profile.spheres.length) lines.push(`Univers favoris : ${profile.spheres.join(', ')}`);
    if (me.sirens && me.sirens.length) {
      lines.push(`Sociétés rattachées (${me.sirens.length}) :`);
      me.sirens.slice(0, 3).forEach(s => lines.push(`  • ${s.nom_societe} · ${s.siren} · ${s.forme_juridique || ''}`));
    }
    if (me.tier) lines.push(`Tier abonnement : ${me.tier}`);
    return lines.length ? lines.join('\n') : null;
  } catch (_) { return null; }
}

async function delegateToSpecialist(agentId, question, context) {
  const spec = SPECIALISTS_REGISTRY[agentId];
  if (!spec) return { error: `Specialiste inconnu : ${agentId}. Disponibles : ${SPECIALISTS_IDS_LIVE.join(', ')}` };
  // Guard — bloquer délégation vers workers pas encore déployés
  if (!spec.live) return { error: `Specialiste ${agentId} (${spec.role}) n'est pas encore déployé (Sprint 3-5). Traite la question directement.` };
  try {
    // Pour les workers mutualisés (ikcp-lifestyle), utiliser agentKey (clé dans PROMPTS)
    // sinon agentId — évite les mismatch si le registry key ≠ clé dans prompts.js
    const body = spec.mutualisé
      ? { agent: spec.agentKey || agentId, question, context }
      : { question, context };
    const r = await fetch(spec.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errTxt = await r.text().catch(() => '');
      return { error: `Specialiste ${agentId} indisponible (${r.status})`, detail: errTxt.slice(0, 200) };
    }
    const data = await r.json();
    return {
      specialiste: data.agent || agentId,
      role: data.role || spec.role,
      reponse: data.reply || '',
      model: data.model,
    };
  } catch (e) {
    return { error: `Erreur reseau vers ${agentId}: ${e.message}` };
  }
}

// ──────────────────────────────────────────────────────────────
// TOOL DEFINITIONS — calculs déterministes (pas de hallucination LLM)
// ──────────────────────────────────────────────────────────────
const TOOLS_FISCAL = [
  {
    name: 'calc_impot_revenu',
    description: "Calcule l'impôt sur le revenu (IR) 2026 selon le barème progressif officiel (LF 2026, revenus 2025). Utilise cet outil chaque fois que l'utilisateur demande un calcul d'IR, une estimation d'impôt, ou une simulation de tranche marginale.",
    input_schema: {
      type: 'object',
      properties: {
        revenu_imposable: { type: 'number', description: 'Revenu net imposable annuel (en euros)' },
        parts: { type: 'number', description: 'Nombre de parts fiscales (1 célibataire, 2 couple, +0.5 par enfant)' },
      },
      required: ['revenu_imposable', 'parts'],
    },
  },
  {
    name: 'calc_droits_succession',
    description: "Calcule les droits de succession en ligne directe (enfants) 2026. Applique l'abattement de 100 000€ par enfant (art. 779 I CGI) et l'exonération assurance-vie avant 70 ans 152 500€/bénéficiaire (art. 990 I CGI). Utilise cet outil pour toute estimation de droits de succession.",
    input_schema: {
      type: 'object',
      properties: {
        patrimoine_net: { type: 'number', description: 'Patrimoine net transmissible (après dettes) en euros' },
        nb_enfants: { type: 'number', description: "Nombre d'enfants héritiers (ligne directe)" },
        assurance_vie: { type: 'number', description: "Montant d'assurance-vie versée avant 70 ans (0 si aucune)" },
      },
      required: ['patrimoine_net', 'nb_enfants'],
    },
  },
  {
    name: 'get_user_profile',
    description: "Lit le profil collectionneur de l'utilisateur (montres détenues, voitures wishlist, Lego, vins, art, voyages, sport, NextGen). Utilise ce tool dès qu'une question touche aux PASSIONS PERSONNELLES de l'utilisateur ou pour personnaliser une réponse selon ses goûts.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "Identifiant utilisateur (par défaut 'max')" },
      },
      required: [],
    },
  },
  {
    name: 'get_user_watches',
    description: "Liste les items que l'utilisateur surveille sur les marchés collectionneurs (montres, voitures, Lego, vins, art, sneakers, yachts). Filtre optionnel par marché.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "Identifiant utilisateur (par défaut 'max')" },
        market: { type: 'string', description: "Filtrer par marché (chrono24, classic, bricklink, idealwine, stockx, etc.)" },
      },
      required: [],
    },
  },
  {
    name: 'get_user_alerts',
    description: "Liste les alertes générées par l'agent collecteur (opportunités, baisses de prix, nouvelles listings, enchères imminentes). Filtre optionnel sur les non-lues.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "Identifiant utilisateur (par défaut 'max')" },
        unread: { type: 'boolean', description: "Si true, ne renvoie que les alertes non encore vues" },
      },
      required: [],
    },
  },
  {
    name: 'add_user_watch',
    description: "Ajoute un nouvel item à surveiller pour l'utilisateur. Le collecteur scrutera ce marché chaque jour 7h Paris et alertera si correspondance. Utilise ce tool quand l'utilisateur exprime un souhait d'acquisition ou demande à suivre un item.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "Identifiant utilisateur (par défaut 'max')" },
        market: { type: 'string', description: "Marché : chrono24, classic, bricklink, idealwine, stockx, artprice, yachtworld, histovec, etc." },
        category: { type: 'string', description: "Catégorie : montre, voiture, lego, vin, art, sneaker, yacht, etc." },
        query: { type: 'string', description: "Recherche précise (ex: 'Patek 5711A', 'Porsche 964 RS', '10497-1')" },
        target_price: { type: 'number', description: "Prix cible en EUR — alerte si listing < target_price" },
      },
      required: ['market', 'category', 'query'],
    },
  },
  {
    name: 'delegate_to_specialist',
    description: `Délègue à un spécialiste de l'équipe Family Office IKCP. RÈGLE : délègue AUTOMATIQUEMENT dès que la question dépasse tes outils de calcul déterministe.

DÉLÉGUER OBLIGATOIREMENT à :
- codex : fiscalité experte (arbitrage multi-articles CGI, jurisprudence Cass./CE, comparaison apport-cession vs donation vs démembrement, Dutreil, CEHR)
- hermes : transmission patrimoniale (succession hors ligne directe, pacte Dutreil complexe, donation-partage, SCI familiale + transmission)
- batisseur : cartographie patrimoine 360° (bilan multi-entités dirigeant, restructuration holding, analyse Pappers complète)
- architecte : immobilier & foncier (DVF précis, SCI IS/IR, plus-value immo complexe, LMNP/LMP, nue-propriété)
- stratege : marchés & allocation (questions produits financiers, allocation d'actifs, diversification, private equity)
- curateur : art/horlogerie/collections/vins/joaillerie (valeur, assurance, cession, fiscalité œuvres d'art)
- concierge : lifestyle (voyage, aviation, mode, conciergerie, expériences luxe)
- capital : capital investissement (private equity, dette privée, actifs alternatifs, club deals)
- mecene : philanthropie (fondations, mécénat fiscal art. 238 bis, NextGen, impact investing)
- pedagogue : éducation financière (formation NextGen, sensibilisation patrimoniale)
- camille : onboarding & support (aide utilisation plateforme, questions générales FO)
- olympe : bien-être & santé (médecine privée, art de vivre, longévité, bien-être senior)

NE PAS déléguer pour : calculs IR simple, IFI de base, abattements donation standard → utilise tes tools déterministes directement.
Tu peux déléguer à PLUSIEURS spécialistes simultanément.`,
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['codex','hermes','batisseur','architecte','stratege','curateur','concierge','capital','mecene','pedagogue','camille','olympe'],
          description: 'Identifiant du spécialiste (doit être dans SPECIALISTS_REGISTRY)',
        },
        question: { type: 'string', description: 'Question précise à transmettre au spécialiste — formule clairement le besoin' },
        context: { type: 'string', description: "Contexte client utile : situation familiale, données Pappers, patrimoine estimé, calculs déjà faits" },
      },
      required: ['agent', 'question'],
    },
  },
  {
    name: 'consult_veille',
    description: "Lance une veille approfondie via Perplexity Pro sur un sujet patrimonial, fiscal, marché ou actualité récente. Utilise cet outil quand l'utilisateur demande une veille spécifique, les dernières actualités fiscales, l'évolution d'un marché ou une recherche documentaire récente (< 30 jours).",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Requête de recherche précise (en français de préférence)" },
        mode: { type: 'string', enum: ['quick', 'deep'], description: "'quick' pour une info rapide (< 10s), 'deep' pour une analyse approfondie (30-60s)" },
      },
      required: ['query'],
    },
  },
];

// Barème IR 2026 (LF 2026, revenus 2025)
const IR_BRACKETS = [
  { max: 11600, rate: 0 },
  { max: 29579, rate: 0.11 },
  { max: 84577, rate: 0.30 },
  { max: 181917, rate: 0.41 },
  { max: Infinity, rate: 0.45 },
];

function calcIR(revenuImposable, parts) {
  if (parts <= 0) parts = 1;
  const quotient = revenuImposable / parts;
  let impot = 0;
  let prev = 0;
  for (const b of IR_BRACKETS) {
    if (quotient <= b.max) {
      impot += (quotient - prev) * b.rate;
      break;
    }
    impot += (b.max - prev) * b.rate;
    prev = b.max;
  }
  impot = Math.round(impot * parts);
  // TMI
  let tmi = 0;
  for (let i = IR_BRACKETS.length - 1; i >= 0; i--) {
    const lower = i === 0 ? 0 : IR_BRACKETS[i - 1].max;
    if (quotient > lower) { tmi = IR_BRACKETS[i].rate; break; }
  }
  return {
    impot_estime: impot,
    revenu_imposable: revenuImposable,
    parts,
    quotient_familial: Math.round(quotient),
    tranche_marginale_pct: Math.round(tmi * 100),
    taux_effectif_pct: revenuImposable > 0 ? +(impot / revenuImposable * 100).toFixed(2) : 0,
    source: 'Barème IR 2026 — LF 2026 art. 2',
  };
}

// Barème succession ligne directe (art. 777 CGI, inchangé depuis 2014)
const SUCC_BRACKETS = [
  { max: 8072, rate: 0.05 },
  { max: 12109, rate: 0.10 },
  { max: 15932, rate: 0.15 },
  { max: 552324, rate: 0.20 },
  { max: 902838, rate: 0.30 },
  { max: 1805677, rate: 0.40 },
  { max: Infinity, rate: 0.45 },
];

function calcSuccession(patrimoineNet, nbEnfants, avVal) {
  if (nbEnfants <= 0) {
    return { droits_total: 0, note: 'Aucun enfant : calcul non applicable en ligne directe. Consulter Maxime.' };
  }
  const avExonere = Math.min(avVal || 0, 152500 * nbEnfants);
  const abattement = 100000 * nbEnfants;
  const baseTaxable = Math.max(0, patrimoineNet - avExonere - abattement);
  const parEnfant = baseTaxable / nbEnfants;
  let droitsParEnfant = 0;
  let prev = 0;
  for (const b of SUCC_BRACKETS) {
    if (parEnfant <= b.max) {
      droitsParEnfant += (parEnfant - prev) * b.rate;
      break;
    }
    droitsParEnfant += (b.max - prev) * b.rate;
    prev = b.max;
  }
  const droitsTotal = Math.round(droitsParEnfant * nbEnfants);
  return {
    droits_total: droitsTotal,
    droits_par_enfant: Math.round(droitsParEnfant),
    patrimoine_net: patrimoineNet,
    abattement_total: abattement,
    assurance_vie_exoneree: avExonere,
    base_taxable: Math.round(baseTaxable),
    sources: 'art. 779 I CGI (abattement) · art. 990 I CGI (AV) · art. 777 CGI (barème)',
  };
}

function executeTool(name, input) {
  try {
    if (name === 'calc_impot_revenu') {
      return calcIR(+input.revenu_imposable || 0, +input.parts || 1);
    }
    if (name === 'calc_droits_succession') {
      return calcSuccession(+input.patrimoine_net || 0, +input.nb_enfants || 0, +input.assurance_vie || 0);
    }
    return { error: 'Unknown tool: ' + name };
  } catch (e) {
    return { error: 'Tool execution error: ' + e.message };
  }
}

function getCurrentContext() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dateStr = now.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Paris',
  });
  let season;
  if (month >= 3 && month <= 6) season = 'declaration_revenus';
  else if (month >= 7 && month <= 8) season = 'ete';
  else if (month >= 9 && month <= 10) season = 'rentree_fiscale';
  else if (month === 11 || month === 12) season = 'fin_annee';
  else season = 'nouvelle_annee';
  return { dateStr, season, month };
}

function buildSystemPrompt(ctx) {
  const seasonalNote = {
    declaration_revenus: `CONTEXTE SAISONNIER : Période de déclaration des revenus (mars-juin). Les visiteurs ont souvent des questions sur leur déclaration (frais réels, pensions alimentaires, revenus fonciers, dons, crédits d'impôt). Sois particulièrement attentif à ces sujets.`,
    ete: `CONTEXTE SAISONNIER : Été. Période fiscalement calme — bon moment pour prendre du recul, faire un point stratégique, anticiper la rentrée.`,
    rentree_fiscale: `CONTEXTE SAISONNIER : Rentrée fiscale. La loi de finances de l'année suivante est en discussion au Parlement. Pour toute question sur des mesures nouvelles/en discussion, utilise impérativement le web search pour vérifier le statut.`,
    fin_annee: `CONTEXTE SAISONNIER : Fin d'année. Dernière ligne droite pour les versements déductibles (plan d'épargne retraite, dons aux associations) avant le 31 décembre.`,
    nouvelle_annee: `CONTEXTE SAISONNIER : Début d'année. Bon moment pour planifier, prendre date, démarrer une stratégie progressive.`,
  };

  // Génère la liste des spécialistes avec leurs noms d'affichage et rôles
  const specialistsList = Object.values(SPECIALISTS_REGISTRY)
    .map(s => `${s.displayName} (${s.role})`)
    .join(', ');

  return `Tu t'appelles Marcel. Tu es le chef d'orchestre du Family Office augmenté d'IKCP — IKIGAÏ Conseil Patrimonial, fondé par Maxime Juveneton. IKCP est un cabinet indépendant CIF (ORIAS 23001568) qui propose le **premier Family Office français 100 % digital et augmenté par intelligence souveraine**. Tu orchestres 12 spécialistes IA : ${specialistsList}. Tu mobilises l'humain (Maxime) uniquement sur demande explicite du client.

DATE DU JOUR : ${ctx.dateStr}
${seasonalNote[ctx.season]}

POSITIONNEMENT : IKCP se spécialise dans la PROTECTION PATRIMONIALE. La question centrale est toujours : "Si demain il vous arrive quelque chose, que se passe-t-il pour vos proches et votre patrimoine ?"

PUBLICS CIBLES :
- Parents & jeunes parents : écart de revenus dans le couple, décès/invalidité du conjoint principal, protection des enfants mineurs
- Entrepreneurs & TNS : décès du dirigeant, impact sur l'entreprise, séparation patrimoine pro/perso
- Préparation de la transmission : succession non anticipée = droits élevés, famille recomposée, donation-partage
- Investisseurs immobiliers : location meublée et impact successoral, assurance emprunteur, liquidité

APPROCHE :
- Pluridisciplinaire : travail en coordination avec notaires, avocats, experts-comptables
- Triple dimension : juridique + financière + fiscale dans chaque recommandation
- 100% indépendant : aucun lien capitalistique avec banque ou assureur
- Rémunération alignée : IKCP gagne quand le client gagne, 0% frais d'entrée

BARÈMES 2026 (revenus 2025, LF 2026) :
- IR : 0-11 600€ (0%) / 11 601-29 579€ (11%) / 29 580-84 577€ (30%) / 84 578-181 917€ (41%) / >181 917€ (45%)
- Succession ligne directe : abattement 100 000€ par enfant (art. 779 I CGI), barème 5-45% progressif
- Assurance-vie avant 70 ans : 152 500€/bénéficiaire exonérés (art. 990 I CGI)
- Conjoint survivant : exonéré de droits de succession (art. 796-0 bis CGI)
- Donation tous les 15 ans : 100 000€/enfant (art. 779 I CGI) + 31 865€ don familial de sommes d'argent (art. 790 G CGI)
- Don logement neuf/rénovation (jusqu'au 31/12/2026) : +100 000€ supplémentaires exonérés (art. 790 A bis CGI)
- IFI : seuil 1 300 000€ de patrimoine immobilier net, abattement 30% résidence principale (art. 964 CGI)

OUTILS DE CALCUL — UTILISATION OBLIGATOIRE POUR LES CHIFFRES EXACTS :
Tu as accès à 2 calculateurs déterministes :
- **calc_impot_revenu** : calcule l'IR 2026 exact (revenu imposable + nombre de parts)
- **calc_droits_succession** : calcule les droits de succession exacts (patrimoine + enfants + AV avant 70 ans)

UTILISE CES OUTILS SYSTÉMATIQUEMENT dès que :
- L'utilisateur donne ou demande un calcul chiffré (IR, succession)
- L'utilisateur pose une question du type "combien je paierais...", "quel serait l'impôt...", "quels droits pour..."

N'utilise JAMAIS ton propre calcul mental pour ces chiffres — utilise toujours le tool. Les résultats du tool sont exacts et incluent les sources juridiques. Présente le résultat dans ta réponse avec ses chiffres ET ses sources.

Si l'utilisateur ne précise pas les paramètres (ex: parts, enfants), pose UNE question pour les obtenir, puis utilise le tool.

ÉQUIPE DE SPÉCIALISTES — TOOL delegate_to_specialist :
Tu n'es PAS seul. Tu peux mobiliser douze sub-agents Family Office en parallèle quand la question dépasse tes compétences générales :

| agent_id   | Spécialité                             | Modèle    | Statut  | Quand l'appeler AUTOMATIQUEMENT |
|------------|----------------------------------------|-----------|---------|----------------------------------|
| codex      | Fiscalité experte multi-articles CGI   | Opus 4.7  | ✅ LIVE | Dès que : arbitrage 2+ dispositifs, jurisprudence CE/Cass., Dutreil, CEHR, requalification LMNP/LMP, apport-cession |
| batisseur  | Cartographie patrimoine 360°           | Opus 4.7  | 🔴 bientôt | Bilan multi-entités, holding, SIREN complexe |
| architecte | Immobilier & Foncier                   | Sonnet 4.6| 🔴 bientôt | DVF précis, SCI IS/IR, plus-value complexe |
| hermes     | Transmission patrimoniale              | Opus 4.7  | 🔴 bientôt | Succession hors ligne directe, pacte Dutreil, donation-partage |
| stratege   | Marchés & Allocation                   | Sonnet 4.6| 🔴 bientôt | Produits financiers, allocation, private equity |
| curateur   | Art/Horlogerie/Collections             | Sonnet 4.6| 🔴 bientôt | Valeur œuvres, montres, vins, assurance collections |
| concierge  | Lifestyle & Conciergerie               | Sonnet 4.6| 🔴 bientôt | Voyage, aviation, expériences luxe |

POUR LES SPÉCIALISTES PAS ENCORE LIVE : traite directement avec tes connaissances + web_search.

VEILLE AUGMENTÉE — TOOL consult_veille :
Utilise **consult_veille** quand l'utilisateur demande une veille récente : "actualités sur X", "qu'est-ce qui a changé sur Y depuis 2 mois ?", "dernières jurisprudences sur Z", "évolution du marché de l'horlogerie cette semaine". Ce tool passe par Perplexity Pro (mode quick = réponse rapide, mode deep = analyse approfondie). S'il échoue, bascule sur tes connaissances + web_search.

COLLECTOR PERSONNEL — TOOLS get_user_profile / get_user_watches / get_user_alerts / add_user_watch :
L'utilisateur peut avoir un PROFIL COLLECTIONNEUR enregistré (montres, voitures, sneakers, Lego, jeux, vins, art, voyage, sport, yachts, NextGen). Un agent collecteur scrute chaque jour les marchés correspondants et génère des alertes.

QUAND UTILISER CES TOOLS :
- **get_user_profile** : dès qu'une question touche aux PASSIONS PERSONNELLES ("ma collection de montres", "mes voitures", "mes Lego", "quel chalet à Megève cette année"). Permet de personnaliser sans demander.
- **get_user_watches** : si l'utilisateur demande "qu'est-ce que je surveille en ce moment ?", ou pour citer ses recherches en cours.
- **get_user_alerts** : si l'utilisateur demande "quoi de neuf sur mes marchés ?" / "des opportunités cette semaine ?". Filtrer unread=true par défaut.
- **add_user_watch** : si l'utilisateur dit "j'aimerais une Patek 5711", "je cherche un Porsche 964 RS sous 250 k€", "alerte-moi sur le Lego UCS Galaxy Explorer si baisse". Confirme TOUJOURS avant d'ajouter ("Je vais ajouter X à votre veille — c'est bien cela ?").

RÈGLES COLLECTOR :
- Ne propose JAMAIS de "lire ton profil" si la question est purement pédagogique (ex : "c'est quoi le PER ?"). Réserve ces tools aux questions personnelles.
- Si un tool collector retourne une erreur, informe poliment sans mentionner la mécanique technique.
- Le profil est PRIVÉ et SOUVERAIN FR (D1 Paris).

RÈGLES DE DÉLÉGATION — à appliquer strictement :
1. **DÉLÉGATION AUTOMATIQUE À CODEX** (seul specialist LIVE) — déclencheurs obligatoires :
   - La question croise 2 articles CGI ou plus (ex. 150-0 B ter + 885 O bis)
   - La question cite/implique une jurisprudence (Cass. com., CE, CAA)
   - L'utilisateur compare 3+ schémas ou dispositifs fiscaux
   - Mots-clés déclencheurs : "apport-cession", "Dutreil", "démembrement", "CEHR", "requalification", "plus-value report", "holding", "pacte"
2. Pour les autres spécialistes (pas encore live) : traite directement, informe si pertinent que l'équipe sera mobilisée prochainement.
3. Passe du CONTEXTE au spécialiste : composition famille, données Pappers, patrimoine estimé.
4. SYNTHÉTISE la réponse des spécialistes — ne copie pas. Articule leurs apports.
5. N'ÉVOQUE JAMAIS la mécanique au client ("je délègue à Codex") — présente ta réponse naturellement.
6. Si un spécialiste retourne une erreur, informe poliment et propose une approche alternative.

RECHERCHE WEB :
Tu as un outil de recherche web. UTILISE-LE quand :
- Question sur une actualité récente (loi promulguée ces derniers mois, décision, jurisprudence)
- L'utilisateur cite un chiffre/seuil dont tu n'es pas certain qu'il soit à jour
- Question sur un dispositif nouveau ou en évolution
- Mots-clés : "actualité", "nouveau", "dernière loi", "2026", "récent"
N'UTILISE PAS pour les barèmes listés ci-dessus ou les mécanismes stables.
Limite : 2 recherches max. Privilégie service-public.fr, impots.gouv.fr, economie.gouv.fr, legifrance.gouv.fr. Cite les sources utilisées.

CABINET :
- Family Office augmenté 100 % digital · couverture France entière
- Bureaux secondaires : Lyon, Annonay, Megève (mentions discrètes uniquement, jamais comme ancrage commercial)
- CALENDLY (sur initiative client uniquement) : https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial
- ORIAS : 23001568 | SIREN : 947 972 436

PHILOSOPHIE PRODUIT (NON NÉGOCIABLE) :
- "Vous pilotez. Vous décidez. Sans démarche commerciale non sollicitée."
- Tu n'évoques JAMAIS de toi-même un RDV ou un appel. Le client décide seul de demander à voir Maxime.
- Tu ne te présentes JAMAIS comme "en Ardèche" ou rattaché à un territoire. Tu es un Family Office DIGITAL accessible partout en France.
- Tu mentionnes Annonay UNIQUEMENT si le client te parle d'Annonay en direct (ex: voyage, immobilier local).

RÈGLES ABSOLUES — CONFORMITÉ MIF II (mise à jour 2026-05-15 alignée Ligne directrice AMF IA 7 avril 2026) :

NIVEAU 2 AUTORISÉ — tu peux donner :
- Information factuelle sourcée sur un titre / entreprise / classe d'actifs (cours, P/E, capitalisation, marges, contexte macro)
- Analyse neutre multi-scénarios ("scénario A si X, scénario B si Y")
- Comparaison structurée entre instruments (caractéristiques, frais, fiscalité)
- Question de cadrage finale qui renvoie au client sa décision

INTERDITS ABSOLUS — tu ne dis JAMAIS :
- "Je pense que [titre] est intéressant / cher / sous-valorisé"
- "Achetez", "vendez", "attendez", "renforcez"
- Allocation suggérée chiffrée ("mettez X % de Tesla dans votre PEA")
- Verdict comparatif ("préférez A à B")
- Recommandation personnalisée tenant compte de la situation patrimoniale du client

AUTRES RÈGLES :
1. Tu ne nommes JAMAIS un produit spécifique (pas de nom de contrat, assureur, fonds).
2. CITATION DES SOURCES — OBLIGATOIRE : tout chiffre/barème/seuil doit être sourcé ("art. 779 I CGI", "barème LF 2026"). Si incertain, dis "selon la législation en vigueur".
3. Vouvoiement systématique.
4. Un terme technique = une brève explication entre parenthèses au 1er usage (ex: "plan d'épargne retraite (enveloppe de capitalisation pour la retraite)").
5. Hors sujet patrimonial = recentrage poli.
6. Pas de formulation commerciale racoleuse ("30 min offertes", "gratuit", etc.).

DISCLAIMER ENRICHI — OBLIGATOIRE en fin de chaque réponse à enjeu :
"Cette information ne constitue pas un conseil en investissement personnalisé au sens de l'art. L.541-1 du Code monétaire et financier. Vous interagissez avec un assistant IA — Maxime Juveneton, conseiller humain CIF (ORIAS 23001568), peut intervenir à votre demande."

EXEMPLE NIVEAU 2 (question titre type "Que pensez-vous d'acheter Tesla à 250 $ ?") :
- Tu donnes : faits Tesla (cours, marges, P/E, contexte sectoriel), 2 scénarios neutres (croissance AV vs concurrence chinoise), une question de cadrage ("Quels critères font partie de votre décision : horizon, conviction marché, diversification ?")
- Tu termines : disclaimer enrichi
- Tu ne dis JAMAIS si c'est "intéressant" ou pas — ce serait un conseil personnalisé.

TON & IDENTITÉ :
- Expert pédagogue, jamais condescendant, accessible
- Comme un médecin qui explique — pas qui prescrit
- Logo : une montgolfière (vision d'ensemble). Évoque cette métaphore UNE SEULE FOIS par conversation, subtilement.
- Réponses structurées, aérées, jamais de pavé de texte.

PÉDAGOGIE — structure OBLIGATOIRE pour toute question un peu technique :

**1. TL;DR en italique au tout début** (15 mots max, l'essentiel en 10 secondes)
   ex : *"L'essentiel : au-delà de 15 000 € de loyers, le régime réel devient souvent plus avantageux si vous avez un emprunt."*

**2. Explication des termes techniques** — au premier usage, ajoute une mini-parenthèse
   ex : "le micro-foncier *(régime simplifié sans calcul de charges)*", "le démembrement *(séparer usufruit et nue-propriété)*"

**3. Cas concret chiffré** — après la théorie, un exemple avec des chiffres réels
   ex : *"Cas concret : 30 000 € de loyers, 12 000 € d'intérêts d'emprunt, 3 000 € de travaux → le régime réel économise ~2 100 €/an vs micro-foncier (TMI 30%)."*

**4. Piste de réflexion personnalisée** — 2-3 questions que le visiteur doit se poser
   > **Dans votre situation, 3 questions à vous poser :**
   > - Vos charges réelles dépassent-elles 30% des loyers ?
   > - Prévoyez-vous des travaux importants dans les 3 ans ?
   > - Avez-vous un crédit immobilier en cours ?

**5. À ÉVITER ABSOLUMENT** :
   - Phrases impersonnelles ("il convient de", "il est à noter que")
   - Jargon sans explication (PEA, TMI, TNS seuls)
   - Pavés de texte sans aération
   - Recommandations directes ("vous devriez" → INTERDIT)

FORMAT MARKDOWN :
- **Gras** pour les chiffres/seuils/pourcentages clés
- Tableaux pour comparer (colonnes "Sans anticipation / Avec stratégie")
- Listes à puces pour étapes/dispositifs
- > pour phrases à retenir absolument
- ## pour sections quand la réponse est longue
- Conclusion : **Piste de réflexion :** (jamais une recommandation directe)

SUGGESTIONS DE SUIVI — OBLIGATOIRE À LA FIN DE CHAQUE RÉPONSE :
Termine TOUJOURS ta réponse (APRÈS le disclaimer MIF II) par un bloc invisible au format exact :
<!--follow_ups:["Question courte n°1","Question courte n°2","Question courte n°3"]-->

Ces 3 questions sont des suivis naturels que le visiteur pourrait poser. Elles sont courtes (max 50 caractères), concrètes, et explorent une facette différente du sujet abordé. Exemples :
- Si tu as expliqué la donation : "Et pour un petit-enfant ?" / "Combien pour un couple marié ?" / "Que se passe-t-il après 15 ans ?"
- Si tu as expliqué la succession : "Et si on est pacsé ?" / "Et avec un enfant handicapé ?" / "Comment réduire ces droits ?"
- Si tu as expliqué l'IFI : "Démembrement, ça marche ?" / "Et les crédits immobiliers ?" / "Quand faut-il déclarer ?"

Le bloc HTML commentaire sera parsé côté frontend et transformé en boutons cliquables. N'ajoute JAMAIS de texte visible du type "voici des questions de suivi" — seulement le commentaire HTML.

MINI-BILAN GUIDÉ :
Si le visiteur demande un mini-bilan patrimonial, propose un parcours en 5 questions POSÉES UNE PAR UNE :
1. Âge ?
2. Situation familiale (marié/pacsé/célibataire, nombre d'enfants) ?
3. Statut pro (salarié, TNS, dirigeant, retraité) ?
4. Patrimoine net global estimé (fourchette) ?
5. Principal enjeu (transmission, fiscalité, protection, retraite, investissement) ?

Tu poses UNE question, tu attends la réponse, tu passes à la suivante. À la fin : synthèse 4-5 lignes identifiant 2-3 leviers + invitation diagnostic complet ou Maxime.

EXEMPLES DE RÉPONSES IDÉALES (few-shot) :

=== Exemple 1 — Donation ===
Q : "Combien je peux donner à mes enfants sans payer de droits ?"
R :
Chaque parent peut donner à chaque enfant, en franchise de droits :
- **100 000 €** tous les 15 ans (art. 779 I CGI)
- **31 865 €** en don familial de sommes d'argent, si vous avez moins de 80 ans et l'enfant est majeur (art. 790 G CGI)
- **+100 000 €** pour financer un logement neuf ou une rénovation énergétique, jusqu'au 31/12/2026 (art. 790 A bis CGI)

> Un couple avec 2 enfants peut transmettre jusqu'à **527 460 €** sans droits sur un cycle de 15 ans.

Ces abattements se renouvellent tous les 15 ans — d'où l'intérêt de commencer tôt.

**Piste de réflexion :** la donation s'articule souvent avec l'assurance-vie et le démembrement de propriété pour optimiser la transmission globale.

Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II. Pour une analyse de votre situation, Maxime peut vous accompagner.

=== Exemple 2 — Protection décès ===
Q : "On a 3 enfants, si je meurs demain que se passe-t-il pour ma femme ?"
R :
Sans anticipation, voici ce qui se passe pour votre conjointe :
- Elle reçoit **1/4 en pleine propriété** OU **la totalité en usufruit** (choix à faire, art. 757 Code civil)
- Les 3/4 restants vont à vos 3 enfants — sous contrôle du juge des tutelles s'ils sont mineurs
- Le conjoint survivant est exonéré de droits (art. 796-0 bis CGI), mais les enfants paient sur leur part (abattement 100 000 € chacun, art. 779 I CGI)

Plusieurs outils permettent de mieux protéger : donation au dernier vivant, testament sur-mesure, clause bénéficiaire d'assurance-vie adaptée, mandat de protection future, prévoyance complémentaire.

**Piste de réflexion :** le coût de ces outils est souvent très faible (quelques centaines d'euros) au regard de l'impact sur la sérénité familiale.

Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II. Pour une analyse de votre situation, Maxime peut vous accompagner.

=== Exemple 3 — IFI ===
Q : "C'est quoi l'IFI et est-ce que je suis concerné ?"
R :
L'Impôt sur la Fortune Immobilière (IFI) concerne les patrimoines immobiliers nets supérieurs à **1 300 000 €** (art. 964 CGI).

Sont pris en compte :
- Résidence principale (avec abattement de 30%)
- Résidences secondaires, immobilier locatif direct ou via société civile immobilière
- Parts de sociétés à prépondérance immobilière

Sont exclus :
- Immobilier professionnel (outil de travail)
- Dettes liées à l'immobilier (crédits en cours)

Barème progressif de 0,5% à 1,5% selon la tranche (art. 977 CGI).

**Piste de réflexion :** le démembrement de propriété ou la détention via des structures adaptées peuvent réduire l'assiette imposable — à condition d'anticiper.

Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II. Pour une analyse de votre situation, Maxime peut vous accompagner.`;
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD ADMIN — affiche les questions récentes et stats
// ──────────────────────────────────────────────────────────────
async function renderDashboard(env) {
  if (!env.MARCEL_LOGS) {
    return new Response('<h1>MARCEL_LOGS non configuré</h1>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Liste les clés (max 1000) et charge les valeurs
  const list = await env.MARCEL_LOGS.list({ limit: 500 });
  const entries = await Promise.all(
    list.keys.map(async k => {
      try {
        const v = await env.MARCEL_LOGS.get(k.name);
        return v ? JSON.parse(v) : null;
      } catch { return null; }
    })
  );
  const logs = entries.filter(Boolean).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

  // Stats agrégées
  const total = logs.length;
  const webCount = logs.filter(l => l.web).length;
  const seasons = {};
  logs.forEach(l => { if (l.season) seasons[l.season] = (seasons[l.season] || 0) + 1; });
  const last7d = logs.filter(l => new Date(l.ts).getTime() > Date.now() - 7 * 86400000).length;

  // Top sujets (mots-clés simples)
  const topics = {
    'Succession': /success|h[ée]rit|transm/i,
    'Donation': /donat|don familial/i,
    'IFI / Immobilier': /ifi|immobili[èe]re|fonci/i,
    'Retraite / PER': /retrait|per |plan d[\'`]?[ée]pargne/i,
    'Assurance-vie': /assurance[- ]vie/i,
    'Protection conjoint': /conjoint|d[ée]c[eè]s|pr[ée]voyan/i,
    'Dirigeant / TNS': /dirigeant|entreprise|tns|ind[ée]pendant/i,
    'Impôt revenu': /imp[ôo]t.*revenu|\bir\b|tranche|tmi/i,
  };
  const topicCounts = {};
  Object.keys(topics).forEach(t => { topicCounts[t] = logs.filter(l => topics[t].test(l.q || '')).length; });
  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);

  const rows = logs.slice(0, 100).map(l => {
    const d = new Date(l.ts);
    const dStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const q = (l.q || '').replace(/</g, '&lt;').slice(0, 180);
    const web = l.web ? '🌐' : '—';
    return `<tr><td>${dStr}</td><td class="q">${q}</td><td style="text-align:center">${web}</td><td><span class="sb sb-${l.season}">${l.season || '—'}</span></td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Marcel Dashboard — IKCP</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f9f6f0;color:#1f1a16;padding:28px;min-height:100vh}h1{font-family:Georgia,serif;font-weight:500;color:#1f1a16;margin-bottom:4px;font-size:28px}.sub{color:#b8956e;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:30px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:30px}.card{background:white;border:1px solid #e5ded2;border-radius:10px;padding:16px}.card .val{font-family:Georgia,serif;font-size:30px;font-weight:500;color:#1f1a16}.card .lbl{font-size:11px;color:#b8956e;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-top:4px}.section{background:white;border:1px solid #e5ded2;border-radius:10px;padding:20px;margin-bottom:20px}.section h2{font-family:Georgia,serif;font-size:18px;color:#1f1a16;margin-bottom:14px;font-weight:500}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;padding:10px 8px;border-bottom:2px solid #b8956e;color:#b8956e;text-transform:uppercase;letter-spacing:1px;font-size:10px;font-weight:600}td{padding:10px 8px;border-bottom:1px solid #f0ebe0;vertical-align:top}td.q{color:#2e2520}.bar{display:flex;align-items:center;gap:12px;margin-bottom:8px}.bar-label{width:150px;font-size:13px;color:#1f1a16;font-weight:500}.bar-track{flex:1;height:18px;background:#f0ebe0;border-radius:4px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#b8956e,#d4b888);border-radius:4px;transition:width 0.5s}.bar-count{width:50px;text-align:right;font-size:12px;color:#907b65;font-weight:600}.sb{font-size:10px;padding:2px 8px;border-radius:10px;display:inline-block;font-weight:600}.sb-declaration_revenus{background:#fef3c7;color:#92400e}.sb-ete{background:#dbeafe;color:#1e40af}.sb-rentree_fiscale{background:#fce7f3;color:#9f1239}.sb-fin_annee{background:#dcfce7;color:#166534}.sb-nouvelle_annee{background:#e0e7ff;color:#3730a3}@media print{body{background:white}}
</style></head><body>
<h1>Dashboard Marcel</h1><div class="sub">IKCP · Analyse des conversations anonymes · TTL 90 jours</div>
<div class="cards">
<div class="card"><div class="val">${total}</div><div class="lbl">Total questions (90j)</div></div>
<div class="card"><div class="val">${last7d}</div><div class="lbl">7 derniers jours</div></div>
<div class="card"><div class="val">${webCount}</div><div class="lbl">Web search utilisé</div></div>
<div class="card"><div class="val">${total > 0 ? Math.round(webCount / total * 100) : 0}%</div><div class="lbl">Taux web search</div></div>
</div>
<div class="section"><h2>Top sujets abordés</h2>
${sortedTopics.map(([t, c]) => {
  const max = sortedTopics[0][1] || 1;
  return `<div class="bar"><div class="bar-label">${t}</div><div class="bar-track"><div class="bar-fill" style="width:${c/max*100}%"></div></div><div class="bar-count">${c}</div></div>`;
}).join('')}
</div>
<div class="section"><h2>Répartition saisonnière</h2>
${Object.entries(seasons).map(([s, c]) => `<div class="bar"><div class="bar-label">${s}</div><div class="bar-track"><div class="bar-fill" style="width:${c/total*100}%"></div></div><div class="bar-count">${c}</div></div>`).join('') || '<p style="color:#907b65;font-size:12px">Aucune donnée</p>'}
</div>
<div class="section"><h2>100 dernières questions</h2>
<table><thead><tr><th>Date</th><th>Question (anonyme)</th><th>Web</th><th>Saison</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#907b65">Aucune conversation enregistrée pour le moment</td></tr>'}</tbody></table>
</div>
<p style="text-align:center;margin-top:30px;font-size:11px;color:#9e9080;font-style:italic">Données anonymisées · aucune information personnelle identifiable n'est stockée · purge automatique après 90 jours</p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // Autorise les origines listées + tout sous-domaine ikcp.eu + déploiements Pages
  const isAllowed = ALLOWED_ORIGINS.includes(origin)
    || origin.endsWith('.ikcp.eu')
    || origin.endsWith('.ikcp-eu.pages.dev')
    || origin.endsWith('.workers.dev');
  const allowed = isAllowed ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

async function logQuestion(env, userMessage, responseText, ctx, webSearchUsed) {
  if (!env.MARCEL_LOGS) return;
  try {
    const key = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      ts: new Date().toISOString(),
      season: ctx.season,
      q: userMessage.slice(0, 500),
      r_preview: (responseText || '').slice(0, 200),
      web: webSearchUsed,
    };
    await env.MARCEL_LOGS.put(key, JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
  } catch (e) {
    console.error('KV log error:', e);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // ADMIN DASHBOARD : pas de check origin, juste token
    // (accessible depuis n'importe quel navigateur privé)
    const urlEarly = new URL(request.url);
    if (request.method === 'GET' && urlEarly.pathname === '/admin') {
      const token = urlEarly.searchParams.get('token') || '';
      const expected = env.ADMIN_TOKEN || '';
      if (!expected || token !== expected) {
        return new Response('Unauthorized', { status: 401 });
      }
      return renderDashboard(env);
    }

    const origin = request.headers.get('Origin') || '';
    const originOk = ALLOWED_ORIGINS.includes(origin)
      || origin.endsWith('.ikcp.eu')
      || origin.endsWith('.ikcp-eu.pages.dev')
      || origin.endsWith('.workers.dev');
    if (!originOk) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'ikcp-marcel-proxy',
        version: '2.3',
        model: 'claude-sonnet-4-6',
        features: ['web_search', 'seasonal_context', 'few_shot_examples', 'kv_logging', 'tool_calling', 'prompt_caching', 'follow_ups', 'admin_dashboard'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }

    try {
      const { message, history, document_pdf } = await request.json();

      if ((!message || typeof message !== 'string' || message.trim() === '') && !document_pdf) {
        return new Response(JSON.stringify({ error: 'Empty message' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
        });
      }

      // Build messages array (compat: { message, history })
      const messages = [];
      if (Array.isArray(history)) {
        for (const h of history.slice(-8)) {
          if (h.role === 'user' || h.role === 'assistant') {
            messages.push({
              role: h.role,
              content: String(h.content || '').slice(0, 2000),
            });
          }
        }
      }

      // Si un PDF est uploadé, on construit un message multi-content
      if (document_pdf && typeof document_pdf === 'string') {
        // document_pdf = base64 string (sans data:...prefix)
        // Limite : Anthropic accepte jusqu'à 32MB, mais on cap à 5MB pour protéger le worker
        if (document_pdf.length > 5 * 1024 * 1024 * 1.4) { // base64 ~1.4x taille réelle
          return new Response(JSON.stringify({ error: 'PDF trop volumineux (max 5 MB)' }), {
            status: 413,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
          });
        }
        messages.push({
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: document_pdf },
            },
            { type: 'text', text: (message || 'Peux-tu analyser ce document et m\'aider à comprendre ma situation ?').slice(0, 2000) },
          ],
        });
      } else {
        messages.push({ role: 'user', content: message.slice(0, 2000) });
      }

      const ctx = getCurrentContext();
      let systemPromptText = buildSystemPrompt(ctx);

      // ── Mémoire conversationnelle Sprint 2 ──
      // Si l'utilisateur est authentifié (cookie session), on enrichit
      // le system prompt avec son profil + ses sociétés. Marcel se souvient.
      const cookieHeader = request.headers.get('Cookie') || '';
      if (cookieHeader.includes('ikcp_session')) {
        try {
          const userCtx = await fetchUserContextFromClient(request);
          if (userCtx) {
            systemPromptText += `\n\n# CLIENT CONNECTÉ — MÉMOIRE PERSISTANTE\n` + userCtx + `\nTu connais ce client. Salue-le par son prénom si pertinent. Ne lui demande JAMAIS d'informations déjà connues (situation familiale, profession, sociétés rattachées). Adapte tes réponses à son profil.`;
          }
        } catch (_) { /* mémoire non bloquante */ }
      }

      // Prompt caching : le system prompt est stable, on le marque pour cache
      // (cache TTL 5 min côté Anthropic, ~90% de réduction du coût input après)
      const systemParam = [{
        type: 'text',
        text: systemPromptText,
        cache_control: { type: 'ephemeral' },
      }];

      const tools = [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 2 },
        ...TOOLS_FISCAL,
      ];

      const workingMessages = messages.slice(); // copie pour loop tool_use
      let data;
      let totalIterations = 0;
      const MAX_ITER = 4; // sécurité : max 4 tours de tool calling

      while (totalIterations < MAX_ITER) {
        totalIterations++;
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPICAPIKEY,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
            system: systemParam,
            messages: workingMessages,
            tools,
          }),
        });

        if (!anthropicRes.ok) {
          const errText = await anthropicRes.text();
          console.error('Anthropic error:', anthropicRes.status, errText);
          return new Response(JSON.stringify({
            reply: "Un problème technique est survenu. Vous pouvez réessayer ou échanger directement avec Maxime.",
            error: `API ${anthropicRes.status}`,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
          });
        }

        data = await anthropicRes.json();

        // Gérer les tool_use calls côté client :
        //  - calc_impot_revenu, calc_droits_succession (sync, déterministe local)
        //  - delegate_to_specialist (async, fetch worker spécialiste)
        // Web search est server-side : Anthropic le gère, pas nous
        const CLIENT_TOOLS = new Set([
          'calc_impot_revenu',
          'calc_droits_succession',
          'delegate_to_specialist',
          'get_user_profile',
          'get_user_watches',
          'get_user_alerts',
          'add_user_watch',
          'consult_veille',
        ]);
        const toolUses = (data.content || []).filter(
          b => b.type === 'tool_use' && CLIENT_TOOLS.has(b.name)
        );

        if (toolUses.length === 0 || data.stop_reason !== 'tool_use') break;

        // Ajoute la réponse de l'assistant avec tool_use à l'historique
        workingMessages.push({ role: 'assistant', content: data.content });

        // Exécute chaque tool — en PARALLELE (Promise.all) pour latence min
        const toolResults = await Promise.all(toolUses.map(async tu => {
          let result;
          const i = tu.input || {};
          if (tu.name === 'delegate_to_specialist') {
            result = await delegateToSpecialist(i.agent, i.question, i.context);
          } else if (tu.name === 'get_user_profile') {
            result = await collectorFetch(env, `/profile?user_id=${encodeURIComponent(i.user_id || 'max')}`);
          } else if (tu.name === 'get_user_watches') {
            const q = `?user_id=${encodeURIComponent(i.user_id || 'max')}${i.market ? `&market=${encodeURIComponent(i.market)}` : ''}`;
            result = await collectorFetch(env, `/watches${q}`);
          } else if (tu.name === 'get_user_alerts') {
            const q = `?user_id=${encodeURIComponent(i.user_id || 'max')}${i.unread ? '&unread=1' : ''}`;
            result = await collectorFetch(env, `/alerts${q}`);
          } else if (tu.name === 'add_user_watch') {
            result = await collectorFetch(env, '/watches', 'POST', {
              user_id: i.user_id || 'max',
              market: i.market,
              category: i.category,
              query: i.query,
              target_price: i.target_price,
            });
          } else if (tu.name === 'consult_veille') {
            // Appel veille augmentée (worker ikcp-veille proxy)
            try {
              const vr = await fetch('https://ikcp-veille.maxime-ead.workers.dev/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: i.query,
                  mode: i.mode || 'quick',
                  user_id: 'marcel_internal',
                  tier: 'fo', // Marcel a accès en interne
                }),
              });
              if (!vr.ok) {
                const errBody = await vr.text();
                result = { error: 'veille_unavailable', status: vr.status, detail: errBody.slice(0, 200) };
              } else {
                result = await vr.json();
              }
            } catch (err) {
              result = { error: 'veille_network', message: err.message };
            }
          } else {
            result = executeTool(tu.name, i);
          }
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          };
        }));
        workingMessages.push({ role: 'user', content: toolResults });
      }

      // Concat text blocks (web search retourne plusieurs blocks)
      const textBlocks = (data.content || []).filter(c => c.type === 'text');
      let fullText = textBlocks.map(c => c.text).join('\n\n')
        || "Je n'ai pas pu traiter votre demande.";

      // Extraire les follow-ups du bloc commentaire HTML
      let followUps = [];
      const followUpsMatch = fullText.match(/<!--\s*follow_ups\s*:\s*(\[[\s\S]*?\])\s*-->/i);
      if (followUpsMatch) {
        try {
          const parsed = JSON.parse(followUpsMatch[1]);
          if (Array.isArray(parsed)) {
            followUps = parsed.filter(q => typeof q === 'string' && q.length > 0 && q.length < 120).slice(0, 3);
          }
        } catch (e) { /* ignore malformed */ }
        // Retirer le commentaire du texte visible
        fullText = fullText.replace(followUpsMatch[0], '').trim();
      }
      const reply = fullText;

      const webSearchUsed = (data.content || []).some(
        b => b.type === 'web_search_tool_use' || b.type === 'server_tool_use'
      );

      // Log anonyme (non bloquant)
      await logQuestion(env, message, reply, ctx, webSearchUsed);

      return new Response(JSON.stringify({
        reply,
        follow_ups: followUps,
        web_search_used: webSearchUsed,
        season: ctx.season,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({
        reply: "Un problème technique est survenu. Vous pouvez réessayer ou échanger directement avec Maxime.",
        error: err.message,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }
  },
};
