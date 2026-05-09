/**
 * IKCP Family Office — univers de vie (v5).
 *
 * Pivot stratégique vs v4-live :
 *  v4-live → 10 expertises *techniques* (fiscal, juridique, transmission…)
 *  v5      → 8 *univers de vie* (voyages, voitures, art, vins, montres,
 *            yachts, immobilier prestige, chevaux & sport) — l'entrée
 *            émotionnelle d'un FO digital. Chaque univers a son comparateur
 *            d'APIs et Marcel répond comme conseiller-comparateur.
 *
 * Modèle freemium :
 *  - 3 questions gratuites par session (toutes thématiques confondues)
 *  - au-delà : gate "Devenez membre Family Office augmenté"
 *  - le slot "Conseil patrimonial premium" est locké d'emblée — accessible
 *    aux membres FO seulement, ouvre un mailto contact Maxime
 *
 * Côté backend : on appelle le même Worker Marcel (`ikcp-chat`) avec les
 * nouveaux `theme` keys (voyages, voitures, art_collection, vins, montres,
 * yachts, immo_prestige, chevaux). Marcel a les contextes correspondants
 * dans `workers/ikcp-marcel/worker.js` (THEME_CONTEXTS).
 */

const MARCEL_URL = (window.IKCP_MARCEL_URL || 'https://ikcp-chat.maxime-ead.workers.dev').replace(/\/$/, '');
const STREAM_DELAY_MS = 12;
const FREEMIUM_QUOTA = 3;
const FREEMIUM_KEY = 'ikcp_freemium_count_v1';

const UNIVERS = [
  {
    key: 'voyages', icon: '✈', accent: '#9bb88f',
    title: "Voyages & vacances",
    pitch: "Jet privé · résidences · charters yacht · scolarité internationale.",
    apis: ['Amadeus', 'Skyscanner', 'NetJets', 'VistaJet', 'Booking Affiliate'],
    prompts: [
      "Jet privé vs first class Paris-NYC pour 4",
      "Charter yacht 1 semaine Sardaigne — budget 60 k€",
      "Comparer 3 résidences Combloux à louer août"
    ],
    preamble:
      "[Univers · Voyages & vacances] Compare options voyage premium : tarifs " +
      "indicatifs (jet privé NetJets Marquis card vs VistaJet vs first class " +
      "régulier), charters yacht (Yatco), résidences (Booking, Sotheby's Realty), " +
      "scolarité internationale. Donne le coût total + l'option Marcel recommanderait.",
    mock: {
      text: "Pour **Paris-NYC pour 4 personnes A/R en juillet** :\n\n• **Jet privé partagé** (NetJets Marquis Jet Card 25h) : ~58 000 € (forfait taillé pour 12 vols/an)\n• **Jet privé charter ad hoc** (VistaJet Global 6000) : ~42 000 € A/R, départ Le Bourget, 6h45 vol\n• **First class régulier** (Air France La Première CDG-JFK) : ~12 000 € × 4 = 48 000 €\n• **Business Air France** : ~3 800 € × 4 = 15 200 €\n\n*L'option charter ad hoc VistaJet sort gagnante en valeur* si vous voyagez < 8 fois/an. Au-delà, Marquis Jet rentabilise.\n\n**Fiscalité** : si voyage privé, aucun avantage fiscal. Si voyage mixte (ex: rendez-vous DupSoft à NYC), une partie peut être refacturée à la société (CGI 39 art. déductibilité raisonnable).\n\n*Préférences mémorisées : Le Bourget, départ matinal.*",
      sources: [{ name: 'Amadeus' }, { name: 'NetJets · grille 2026' }, { name: 'VistaJet quote' }, { name: 'CGI 39 — déductibilité' }]
    }
  },
  {
    key: 'voitures', icon: '🏎', accent: '#c97a6a',
    title: "Voitures de collection",
    pitch: "Cote, comparables, transmission. Marché classique + supercars.",
    apis: ['Hagerty Valuation', 'Classic.com', 'Artcurial Motorcars', 'RM Sothebys', 'Pebble Beach'],
    prompts: [
      "Estimer Porsche 911 2.7 RS 1973 état #2",
      "Ferrari F40 vs F50 — performance financière 10 ans",
      "Sortie de SARL en voiture de collection : fiscalité"
    ],
    preamble:
      "[Univers · Voitures de collection] Cote et comparables ventes (Hagerty pour " +
      "USA, Artcurial pour FR/EU). États #1 à #4. Fiscalité : objet de collection " +
      "(douane > 30 ans), TVA récupérable si achat société, sortie d'actif si " +
      "détenu en SARL. Donation possible (objet meuble).",
    mock: {
      text: "**Porsche 911 2.7 Carrera RS Touring 1973** — état #2 (concours-driver) :\n\n• Hagerty (USA) Q1 2026 : **620 000 - 780 000 $** (1500 exemplaires produits)\n• Artcurial Le Mans Classic 2025 : 645 k€ (lot 142, état #2)\n• RM Sotheby's Monterey 2024 : 720 k€ pour Lightweight\n\n**Tendance 12 mois** : -8% vs sommet 2022, stabilisation Q4 2025.\n\n*Fiscalité achat-détention France* : objet de collection > 30 ans → exonération droits douane intra-UE. Si détenu en SARL : TVA 20% récupérable mais sortie d'actif déclenche IS sur PV.\n\n*Cession* : régime objets précieux CGI 150 V bis = **6,5% du prix** (forfait), ou option PV régime général + abattement durée détention si conservation > 2 ans.\n\n*Transmission* : meuble — abattement 100 k€/15 ans CGI 779 I applicable.",
      sources: [{ name: 'Hagerty Valuation Tool' }, { name: 'Artcurial Motorcars' }, { name: 'CGI 150 V bis' }, { name: 'CGI 779 I' }]
    }
  },
  {
    key: 'art_collection', icon: '🎨', accent: '#d4a85a',
    title: "Œuvres d'art",
    pitch: "Comparables enchères · pré-vente · fiscalité collection · structuration.",
    apis: ['Artprice', 'Artnet', "Christie's", "Sotheby's", 'MutualArt'],
    prompts: [
      "Soulages 1959 100×81 cm — comparables 5 ans",
      "Pré-vente Christie's juin 2026 — sélection art moderne",
      "L'art entre-t-il dans l'IFI ?"
    ],
    preamble:
      "[Univers · Œuvres d'art] Comparables Artprice/Artnet, ventes Christie's/" +
      "Sotheby's, alertes pré-vente. Fiscalité : exclusion IFI (CGI 885 I), " +
      "taxation forfaitaire 6,5% (CGI 150 V bis) ou option PV régime général " +
      "(exo 22 ans), donation NP CGI 779. Si > 4 M€, structuration SC ou " +
      "fondation abritée.",
    mock: {
      text: "**Soulages 1959 huile sur toile 100×81 cm** — comparables 2022-2025 :\n\n• Médiane 14 ventes : **1,2 - 1,8 M€**\n• Max : 2,4 M€ (Christie's juin 2024)\n• Min : 1,02 M€ (Sotheby's Paris novembre 2024, plus petit format)\n\n**Marché Soulages** : très liquide pour l'huile 1957-1979 ; les outrenoir post-1979 atteignent davantage (2,5-4 M€). Tendance stable sur 36 mois.\n\n**Fiscalité IFI** : exclus de l'assiette (CGI 885 I) — avantage majeur vs immo.\n\n**Cession** : 6,5% du prix (CGI 150 V bis) ou option PV avec exonération totale après 22 ans.\n\n**> 4 M€** : SC familiale dédiée pour transmission progressive, ou fondation abritée pour œuvres muséales.",
      sources: [{ name: 'Artprice — 14 ventes' }, { name: "Christie's juin 2024" }, { name: 'CGI 885 I' }, { name: 'CGI 150 V bis' }]
    }
  },
  {
    key: 'vins', icon: '🍷', accent: '#a04545',
    title: "Vins & spiritueux",
    pitch: "Cave d'investissement · primeurs · cotes Liv-ex · fiscalité.",
    apis: ['Liv-ex', 'iDealwine', 'Wine-Searcher', 'Bordeaux primeurs', 'Hart Davis Hart'],
    prompts: [
      "Pétrus 2009 — cote actuelle marché secondaire",
      "Primeurs Bordeaux 2024 : top 10 valeur",
      "DRC Romanée-Conti — performance 10 ans"
    ],
    preamble:
      "[Univers · Vins & spiritueux] Cotes Liv-ex (USD/€), comparables iDealwine " +
      "(FR), primeurs Bordeaux campagne en cours. Fiscalité : exclusion IFI, " +
      "taxation cession 6,5% (CGI 150 V bis), conservation idéale 5-15 ans, " +
      "stockage entrepôt sous douane (TVA suspendue) ou cave perso.",
    mock: {
      text: "**Pétrus 2009** — référence marché Pomerol :\n\n• Liv-ex Mid-Price (mai 2026) : **48 000 €/caisse 12 btl** (4 000 €/btl)\n• iDealwine France : 4 200 €/btl, lots 6 btl 25 800 €\n• 10 ans de performance : +180% (vs +95% Liv-ex 1000)\n• Tendance 24 mois : +12% (rebond après correction 2023)\n\n**Comparables Bordeaux 2009 grands crus** : Mouton 1 800 €/btl, Lafite 1 950 €/btl, Margaux 1 850 €/btl, Latour 2 100 €/btl.\n\n**Fiscalité** : exclusion IFI. Cession : 6,5% prix (CGI 150 V bis). *Stockage* : entrepôt sous douane recommandé pour bouteilles d'investissement (TVA suspendue, traçabilité).\n\n**Primeurs Bordeaux 2024** : campagne en cours, à privilégier sur Pomerol/St-Émilion (millésime classique frais).",
      sources: [{ name: 'Liv-ex' }, { name: 'iDealwine' }, { name: 'CGI 150 V bis' }, { name: 'Bordeaux primeurs 2024' }]
    }
  },
  {
    key: 'montres', icon: '⌚', accent: '#7fae7d',
    title: "Montres",
    pitch: "Marché secondaire · listes d'attente · valorisation · transmission.",
    apis: ['Chrono24', 'WatchCharts', 'Phillips Watches', 'Antiquorum'],
    prompts: [
      "Patek 5711 vs AP RO 15500 — décote 2024-2026",
      "Liste d'attente Daytona céramique — alternatives",
      "Cote Patek 5167A 2018 état complet"
    ],
    preamble:
      "[Univers · Montres] Cotes Chrono24 et WatchCharts (marché secondaire), " +
      "ventes Phillips/Antiquorum (haute horlogerie vintage). Marché 2024-2026 : " +
      "correction post-bulle 2022 sur Rolex/Patek/AP, stabilisation depuis Q3 2025. " +
      "Fiscalité : objet de collection même règles que voitures (CGI 150 V bis).",
    mock: {
      text: "**Patek Philippe 5711/1A Nautilus** vs **AP Royal Oak 15500ST** (15400 fin 2021) — marché secondaire mai 2026 :\n\n| Modèle | Pic 2022 | Mai 2026 | Décote |\n|---|---|---|---|\n| Patek 5711/1A | 220 k€ | **130-145 k€** | **-37%** |\n| AP RO 15500ST | 95 k€ | **62-72 k€** | **-29%** |\n\n*Tendance Chrono24 12 mois* : stabilisation Q4 2025 après chute 2023-2024. Volume transactions +18% YoY (marché qui se reliquéfie).\n\n**Listes d'attente fabricants** : Patek 5711 toujours discontinué, AP 15500 dispo concession 4-6 mois (vs 0 dispo 2022).\n\n**Fiscalité** : objet de collection (CGI 150 V bis) → cession 6,5% prix forfait. Donation : meuble, abattement 100 k€/15 ans applicable.",
      sources: [{ name: 'Chrono24 — historique 24m' }, { name: 'WatchCharts' }, { name: 'CGI 150 V bis' }]
    }
  },
  {
    key: 'yachts', icon: '⛵', accent: '#5e8b9e',
    title: "Yachts",
    pitch: "Achat vs charter · coût d'exploitation · fiscalité · pavillon.",
    apis: ['Yatco', 'Yachtworld', 'Camper & Nicholsons', 'Burgess', 'Edmiston'],
    prompts: [
      "Ferretti 720 vs Princess Y72 — TCO 5 ans",
      "Charter Méditerranée 2 semaines août — budget 80 k€",
      "Pavillon malte vs Caïmans : implications fiscales"
    ],
    preamble:
      "[Univers · Yachts] Acquisition vs charter (NCB charter 12-18% du prix achat/" +
      "an), TCO complet (équipage, gestion, maintenance, port). Pavillons : Malte " +
      "(EU), Caïmans (offshore), France (lourd). DAFN (droit d'annuel francisation " +
      "et navigation) si pavillon FR. TVA : régime leasing si EU.",
    mock: {
      text: "**Achat vs charter** — yacht 22m motor (cible Ferretti 720 / Princess Y72) :\n\n**Achat Ferretti 720** :\n- Prix neuf : 4,8 M€ HT\n- Coût d'exploitation annuel : ~480 k€ (équipage 4 + maintenance + port + assurances + carburant 8 sem./an)\n- TVA : récupérable si schéma leasing maltais (TVA effective 5,4% sur durée use)\n- TCO 5 ans (achat + exploit) : **7,2 M€**, valeur résiduelle ~3 M€ → **net 4,2 M€**\n\n**Charter ad hoc** (8 semaines/an pendant 5 ans) :\n- Tarif Méditerranée premium 22m : ~180-220 k€/semaine\n- 8 sem × 200 k€ × 5 ans = **8 M€**, sans charges fixes\n\n*Acheter est gagnant* dès 6+ semaines/an d'usage. Sinon, charter.\n\n**Pavillons** : Malte recommandé (TVA leasing, EU, anglophone). Caïmans réservé à yachts > 40m (gouvernance, K&R).",
      sources: [{ name: 'Yatco' }, { name: 'Camper & Nicholsons' }, { name: 'Régime TVA Malte' }, { name: 'DAFN' }]
    }
  },
  {
    key: 'immo_prestige', icon: '🏛', accent: '#c4a273',
    title: "Immobilier prestige",
    pitch: "Off-market · résidences secondaires · fiscalité · valorisation.",
    apis: ["Sotheby's Realty", 'Knight Frank', 'BIEN Notaires', 'DVF', 'PriceHubble'],
    prompts: [
      "Acheter Combloux ou Megève — valorisation 5 ans",
      "Off-market Cap Ferrat 2026 — pipeline",
      "Convention IFI résidences secondaires multi-pays"
    ],
    preamble:
      "[Univers · Immobilier prestige] Off-market via réseau notaires + Sotheby's/" +
      "Knight Frank ; comparables DVF + BIEN ; valorisation PriceHubble. Fiscalité : " +
      "IFI (CGI 964 et suivants), abattement 30% RP, déductibilité intérêts emprunt " +
      "régime réel (CGI 31), conventions fiscales si bien à l'étranger.",
    mock: {
      text: "**Combloux vs Megève** — résidence secondaire chalet 250 m² :\n\n• Combloux centre, prix moyen Knight Frank 2026 : **9 200 €/m²** (chalet 4 ch.)\n• Megève centre Mont d'Arbois : **18 500 €/m²** (premium location station)\n• Combloux St-Nicolas-Véroce vue Mont-Blanc : **11 500 €/m²**\n\n**Performance 5 ans** :\n- Combloux : +24% (rattrapage)\n- Megève : +9% (saturation prix)\n\n**Pipeline off-market mai 2026** :\n• Combloux : maison contemporaine 380 m² 8 ch., 4,8 M€ (cf. dénicheur d'offres dashboard)\n• Megève Rochebrune : chalet 320 m² rénové 2024, 8,6 M€\n• Saint-Gervais (alternative budget) : 12 propositions 2-4 M€\n\n**IFI 2026** : CGI 964 — assiette = valeur vénale 1er janvier. Si bien étranger, convention fiscale ad hoc à analyser (USA, Suisse, UK).",
      sources: [{ name: 'Knight Frank' }, { name: "Sotheby's Realty" }, { name: 'BIEN Notaires' }, { name: 'CGI 964' }]
    }
  },
  {
    key: 'chevaux', icon: '🐎', accent: '#a08555',
    title: "Chevaux & sport",
    pitch: "Élevage · courses · polo · partenariats sportifs.",
    apis: ['France Galop', 'Goffs', 'Tattersalls', 'Equiratings', 'FFE'],
    prompts: [
      "Acheter un yearling à Deauville — budget 200 k€",
      "Pension chevaux Chantilly vs Compiègne",
      "Courses : SCEA d'élevage vs déclaration BNC"
    ],
    preamble:
      "[Univers · Chevaux & sport] Vente yearlings Deauville/Goffs France, pension " +
      "écuries Chantilly/Compiègne (3-4 k€/mois), Equiratings pour CSO. Fiscalité : " +
      "SCEA d'élevage (BIC agricole, déductibilité), ou détention privée (BNC " +
      "non-pro si activité accessoire).",
    mock: {
      text: "**Acheter un yearling à Deauville** — budget 200 k€ :\n\n• Vente Arqana **août 2026** (yearlings) : médiane 90-120 k€, top 30% 250-450 k€\n• Vente Goffs France **octobre 2026** : médiane 65-85 k€\n• Vente Tattersalls (UK) : conversion £ + 2,5% commission acheteur\n\n**À 200 k€** : accès Premium Yearlings Arqana (book 1 et 2). Privilégier les souches Galileo, Frankel, Dubawi pour valorisation.\n\n**Coûts annuels post-achat** :\n- Pension écurie d'entraînement Chantilly : **3 200 - 4 500 €/mois** (= 38-54 k€/an)\n- Engagements + jockey : ~15 k€/an\n- Vétérinaire : 5-10 k€/an\n- **Total exploitation** : 60-80 k€/an\n\n**Fiscalité SCEA d'élevage** : BIC agricole, déductibilité totale charges + amortissements. Régime micro si CA < 91 900 €. Recommandé dès 2+ chevaux.",
      sources: [{ name: 'Arqana — yearlings 2026' }, { name: 'Goffs France' }, { name: 'France Galop' }, { name: 'Régime SCEA — BOFIP-BA' }]
    }
  },
];

// Slot 9 : verrouillé — accessible aux membres FO
const PREMIUM_SLOT = {
  key: 'premium_advice', icon: '💼',
  title: "Conseil patrimonial premium",
  pitch: "Fiscal, juridique, transmission, PE — l'expertise complète. Réservé membres FO.",
  apis: ['Légifrance', 'BOFIP', 'Bigdata.com', 'Pappers', 'DVF'],
  locked: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// FREEMIUM — quota local

function getFreemiumCount() {
  return +(localStorage.getItem(FREEMIUM_KEY) || '0');
}
function incFreemium() {
  const n = getFreemiumCount() + 1;
  localStorage.setItem(FREEMIUM_KEY, String(n));
  updateFreemiumIndicator();
  return n;
}
function isFreemiumExceeded() {
  return getFreemiumCount() >= FREEMIUM_QUOTA;
}
function updateFreemiumIndicator() {
  const left = Math.max(0, FREEMIUM_QUOTA - getFreemiumCount());
  const el = document.getElementById('freemium-counter');
  if (el) {
    if (left > 0) {
      el.innerHTML = `<strong>${left}</strong> question${left > 1 ? 's' : ''} gratuite${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`;
    } else {
      el.innerHTML = `<strong>Quota gratuit atteint</strong> — devenez membre pour continuer`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu cartes univers

function renderUnivers() {
  const root = document.getElementById('univers');
  if (!root) return;

  UNIVERS.forEach(u => {
    const card = document.createElement('div');
    card.className = 'univers-card';
    card.dataset.univers = u.key;
    card.style.setProperty('--accent', u.accent);
    card.innerHTML = `
      <div class="univers-icon">${u.icon}</div>
      <div class="univers-title">${u.title}</div>
      <div class="univers-pitch">${u.pitch}</div>
      <div class="univers-apis">
        ${u.apis.slice(0, 4).map(a => `<span class="api-chip-mini">${a}</span>`).join('')}
        ${u.apis.length > 4 ? `<span class="api-chip-mini" style="opacity:0.6;">+${u.apis.length - 4}</span>` : ''}
      </div>
      <div class="univers-trigger">
        <span>Comparer avec Marcel</span>
        <span class="arrow">→</span>
      </div>
    `;
    card.addEventListener('click', () => togglePanel(u.key));
    root.appendChild(card);

    const panel = document.createElement('div');
    panel.className = 'univers-panel';
    panel.dataset.panel = u.key;
    panel.innerHTML = renderPanelHTML(u);
    root.appendChild(panel);
  });

  // Slot premium locké
  const lockedCard = document.createElement('div');
  lockedCard.className = 'univers-card locked';
  lockedCard.innerHTML = `
    <div class="univers-icon">${PREMIUM_SLOT.icon}</div>
    <div class="univers-title">${PREMIUM_SLOT.title}</div>
    <div class="univers-pitch">${PREMIUM_SLOT.pitch}</div>
    <div class="univers-apis">
      ${PREMIUM_SLOT.apis.map(a => `<span class="api-chip-mini">${a}</span>`).join('')}
    </div>
    <div class="univers-locked-tag">
      <span>🔒 Membres Family Office</span>
    </div>
  `;
  lockedCard.addEventListener('click', openMembershipGate);
  root.appendChild(lockedCard);

  UNIVERS.forEach(u => bindPanel(u));
  updateFreemiumIndicator();
}

function renderPanelHTML(u) {
  return `
    <div class="panel-head">
      <div>
        <div class="panel-univers-line">
          ${u.title} <span style="color:var(--ink-faint)">— Marcel comparateur</span>
        </div>
        <div class="panel-sub">3 questions gratuites par session. Au-delà : devenez membre Family Office.</div>
      </div>
      <button class="panel-close" data-close="${u.key}" aria-label="Fermer">Fermer ✕</button>
    </div>
    <div class="panel-prompts">
      ${u.prompts.map(p => `<button class="prompt-chip" data-prompt="${escapeAttr(p)}">${p}</button>`).join('')}
    </div>
    <div class="panel-input-row">
      <input class="panel-input" type="text" placeholder="Posez votre question…" data-input="${u.key}">
      <button class="panel-send" data-send="${u.key}">Envoyer</button>
    </div>
    <div class="panel-loader" data-loader="${u.key}">
      <span class="pulse"></span>
      <span>Marcel interroge les comparateurs…</span>
    </div>
    <div class="panel-response" data-response="${u.key}"></div>
    <div class="panel-sources" data-sources="${u.key}">
      <span class="panel-sources-label">Sources —</span>
    </div>
    <div class="panel-footer">
      <div class="panel-footer-note">
        Réponse <em>indicative</em>, basée sur APIs comparateurs. Pour un accompagnement personnalisé, prenez contact.
      </div>
      <a href="#tarifs" class="panel-cta-membre" data-cta="${u.key}">
        Devenir membre Family Office →
      </a>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ─────────────────────────────────────────────────────────────────────────────

function togglePanel(key) {
  const card = document.querySelector(`.univers-card[data-univers="${key}"]`);
  const panel = document.querySelector(`.univers-panel[data-panel="${key}"]`);
  if (!card || !panel) return;
  const wasOpen = panel.classList.contains('open');
  document.querySelectorAll('.univers-card.open').forEach(c => c.classList.remove('open'));
  document.querySelectorAll('.univers-panel.open').forEach(p => p.classList.remove('open'));
  if (!wasOpen) {
    card.classList.add('open');
    panel.classList.add('open');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    const input = panel.querySelector('input.panel-input');
    if (input) setTimeout(() => input.focus(), 350);
  }
}

function bindPanel(u) {
  const panel = document.querySelector(`.univers-panel[data-panel="${u.key}"]`);
  if (!panel) return;
  panel.querySelector(`[data-close="${u.key}"]`).addEventListener('click', e => {
    e.stopPropagation(); togglePanel(u.key);
  });
  panel.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = panel.querySelector('input.panel-input');
      input.value = chip.dataset.prompt;
      submitQuestion(u);
    });
  });
  panel.querySelector(`[data-send="${u.key}"]`).addEventListener('click', () => submitQuestion(u));
  panel.querySelector(`[data-input="${u.key}"]`).addEventListener('keydown', e => {
    if (e.key === 'Enter') submitQuestion(u);
  });
}

async function submitQuestion(u) {
  // Freemium gate AVANT l'appel
  if (isFreemiumExceeded()) {
    openMembershipGate();
    return;
  }

  const panel = document.querySelector(`.univers-panel[data-panel="${u.key}"]`);
  const input = panel.querySelector('input.panel-input');
  const sendBtn = panel.querySelector(`[data-send="${u.key}"]`);
  const loader = panel.querySelector(`[data-loader="${u.key}"]`);
  const responseEl = panel.querySelector(`[data-response="${u.key}"]`);
  const sourcesEl = panel.querySelector(`[data-sources="${u.key}"]`);
  const q = input.value.trim();
  if (!q) { input.focus(); return; }

  sendBtn.disabled = true;
  loader.classList.add('visible');
  responseEl.classList.remove('visible');
  sourcesEl.classList.remove('visible');
  responseEl.textContent = '';
  sourcesEl.querySelectorAll('.source-chip').forEach(c => c.remove());

  let result;
  try {
    result = await askMarcel(u, q);
    incFreemium();
  } catch (err) {
    console.warn('[IKCP] Marcel KO, fallback mock', err);
    result = u.mock;
  }

  loader.classList.remove('visible');
  sendBtn.disabled = false;
  await streamText(responseEl, result.text);
  renderSources(sourcesEl, result.sources || []);

  // Si c'était la 3e question, ouvrir le gate après lecture
  if (isFreemiumExceeded()) {
    setTimeout(() => {
      const cta = panel.querySelector(`[data-cta="${u.key}"]`);
      if (cta) cta.style.background = 'var(--gold)';
      openMembershipGate();
    }, 4000);
  }
}

async function askMarcel(u, q) {
  const message = `${u.preamble}\n\nQuestion : ${q}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  let res;
  try {
    res = await fetch(MARCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: [], theme: u.key }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.reply) throw new Error('reply vide');
  return { text: json.reply, sources: extractSources(json.reply, u) };
}

function extractSources(text, u) {
  const found = new Set();
  const patterns = [
    /\b(CGI\s+\d+(?:[-\s]\w+)?)\b/gi,
    /\b(BOFIP-[A-Z\-\d]+)\b/gi,
    /\b(Artprice|Hagerty|Liv-ex|Chrono24|Yatco|Knight Frank|Sotheby's|Christie's|Goffs|France Galop|NetJets|Amadeus)\b/g,
  ];
  patterns.forEach(p => { let m; while ((m = p.exec(text)) !== null) found.add(m[1]); });
  if (found.size === 0) return u.apis.slice(0, 4).map(name => ({ name }));
  return [...found].slice(0, 6).map(name => ({ name }));
}

async function streamText(el, text) {
  el.classList.add('visible');
  el.innerHTML = '';
  const html = mdLite(text);
  const plain = stripMd(text);
  let i = 0;
  await new Promise(resolve => {
    const tick = () => {
      i += Math.max(1, Math.floor(plain.length / 200));
      el.textContent = plain.slice(0, i);
      if (i >= plain.length) { el.innerHTML = html; resolve(); return; }
      setTimeout(tick, STREAM_DELAY_MS);
    };
    tick();
  });
}

function renderSources(el, sources) {
  if (!sources.length) return;
  el.classList.add('visible');
  sources.forEach(s => {
    const chip = document.createElement('span');
    chip.className = 'source-chip';
    chip.textContent = s.name;
    el.appendChild(chip);
  });
}

function mdLite(text) {
  const html = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/<!--[\s\S]*?-->/g, '');
  return (typeof window !== 'undefined' && window.IKCP_linkify) ? window.IKCP_linkify(html) : html;
}

function stripMd(text) {
  return String(text).replace(/\*\*/g, '').replace(/\*/g, '').replace(/<!--[\s\S]*?-->/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Membership gate

function openMembershipGate() {
  const overlay = document.getElementById('member-gate');
  if (overlay) overlay.classList.add('show');
}
function closeMembershipGate() {
  const overlay = document.getElementById('member-gate');
  if (overlay) overlay.classList.remove('show');
}
window.openMembershipGate = openMembershipGate;
window.closeMembershipGate = closeMembershipGate;

// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderUnivers();
  document.getElementById('member-gate-close')?.addEventListener('click', closeMembershipGate);
  document.getElementById('member-gate')?.addEventListener('click', e => {
    if (e.target.id === 'member-gate') closeMembershipGate();
  });
  document.getElementById('reset-freemium')?.addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem(FREEMIUM_KEY);
    updateFreemiumIndicator();
    closeMembershipGate();
  });
});
