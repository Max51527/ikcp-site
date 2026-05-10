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
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

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
    name: 'calc_donation',
    description: "Calcule les droits de donation parent → enfant en 2026 (art. 779 I CGI abattement 100 000€/15 ans, barème art. 777 CGI). Utilise pour toute simulation de donation. Tient compte de l'antériorité (donation < 15 ans qui consomme l'abattement).",
    input_schema: {
      type: 'object',
      properties: {
        montant: { type: 'number', description: 'Montant de la donation envisagée (en euros)' },
        donation_anterieure: { type: 'number', description: "Montant déjà donné par le même parent au même enfant dans les 15 dernières années (0 si aucune)" },
        don_familial_31865: { type: 'boolean', description: "Cumul du don familial 31 865€ (CGI 790 G) — uniquement si parent < 80 ans + enfant majeur. Défaut false." },
      },
      required: ['montant'],
    },
  },
  {
    name: 'calc_ifi',
    description: "Calcule l'IFI 2026 (art. 964 et suivants CGI). Seuil 1 300 000€ de patrimoine immobilier net, abattement 30% résidence principale, barème progressif 0,5% à 1,5%. Utilise pour toute estimation IFI.",
    input_schema: {
      type: 'object',
      properties: {
        patrimoine_immo_brut: { type: 'number', description: "Patrimoine immobilier brut (résidence principale + secondaire + locatif + parts SCI)" },
        residence_principale: { type: 'number', description: "Valeur de la résidence principale (avant abattement 30%) — 0 si pas de RP" },
        dettes_immo: { type: 'number', description: "Dettes immobilières en cours (crédits restant dus)" },
      },
      required: ['patrimoine_immo_brut'],
    },
  },
  {
    name: 'calc_plus_value_immo',
    description: "Calcule la plus-value immobilière de cession et les abattements pour durée de détention (CGI 150 U). Exonération IR à 22 ans, prélèvements sociaux à 30 ans. Surtaxe PV élevée éventuelle (CGI 1609 nonies G).",
    input_schema: {
      type: 'object',
      properties: {
        prix_acquisition: { type: 'number', description: "Prix d'acquisition initial (en euros)" },
        prix_cession: { type: 'number', description: 'Prix de cession (en euros)' },
        annees_detention: { type: 'number', description: 'Années de détention complètes' },
        residence_principale: { type: 'boolean', description: 'Cession de la résidence principale (exonération totale CGI 150 U II 1°). Défaut false.' },
        travaux_justifies: { type: 'number', description: 'Travaux effectivement réalisés et justifiés (en euros) — pour majorer le prix d\'acquisition. Défaut 0.' },
      },
      required: ['prix_acquisition', 'prix_cession', 'annees_detention'],
    },
  },
  {
    name: 'calc_demembrement',
    description: "Calcule la valeur de la nue-propriété et de l'usufruit selon le barème fiscal art. 669 CGI (en fonction de l'âge de l'usufruitier). Utile pour donation en NP, démembrement viager, donation-partage avec démembrement.",
    input_schema: {
      type: 'object',
      properties: {
        valeur_pleine_propriete: { type: 'number', description: 'Valeur du bien en pleine propriété (en euros)' },
        age_usufruitier: { type: 'number', description: "Âge de l'usufruitier au moment du démembrement (années révolues)" },
      },
      required: ['valeur_pleine_propriete', 'age_usufruitier'],
    },
  },
  {
    name: 'calc_exit_tax',
    description: "Calcule l'exit tax (CGI 167 bis) pour un résident fiscal français qui transfère son domicile à l'étranger. S'applique aux titres détenus > 50% d'une société ou portefeuille > 800 k€ avec PV latente. PFU 30% (12,8% IR + 17,2% PS). Sursis automatique 6 ans si départ vers UE/EEE.",
    input_schema: {
      type: 'object',
      properties: {
        valeur_titres: { type: 'number', description: 'Valeur des titres au moment du départ (en euros)' },
        prix_acquisition: { type: 'number', description: "Prix d'acquisition (apport ou achat) — pour calculer la PV latente" },
        pays_destination: { type: 'string', description: 'Pays de destination (EU/EEE = sursis automatique 6 ans, hors UE = sursis sur garantie)' },
        controle_majoritaire: { type: 'boolean', description: 'Contrôle > 50% société ? (active CGI 167 bis sans plafond)' },
      },
      required: ['valeur_titres', 'prix_acquisition'],
    },
  },
  {
    name: 'compare_holding_jurisdictions',
    description: "Compare la fiscalité d'une holding pour détenir des participations selon 4 juridictions : France (SAS/SARL holding), Luxembourg (SOPARFI), Suisse (SA), Pays-Bas (BV). Donne IS effectif sur dividendes reçus, PV cession, et fiscalité de remontée vers actionnaire personne physique française.",
    input_schema: {
      type: 'object',
      properties: {
        type_actif: { type: 'string', description: 'Type d\'actif détenu : participations_op (sociétés opérationnelles), pe_funds, immo, ip_marques' },
        valeur_participation: { type: 'number', description: 'Valeur de la participation (en euros)' },
        actionnaire_resident_fr: { type: 'boolean', description: 'L\'actionnaire ultime est-il résident fiscal français ?' },
      },
      required: ['type_actif'],
    },
  },
  {
    name: 'calc_forfait_suisse',
    description: "Calcule l'imposition d'après la dépense (forfait fiscal suisse) — réservé aux non-actifs en Suisse, non-résidents pendant 5 ans précédents. Base : 5-7× valeur locative ou loyer payé selon canton, minimum 400 k CHF de dépense imposable depuis 2016 (Vaud, Genève, Valais).",
    input_schema: {
      type: 'object',
      properties: {
        loyer_ou_valeur_locative: { type: 'number', description: 'Loyer annuel payé ou valeur locative (en CHF)' },
        canton: { type: 'string', description: 'Canton de résidence (vd, ge, vs, fr, ti — exemples). Détermine le taux cantonal.' },
      },
      required: ['loyer_ou_valeur_locative'],
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

// Barème DMTG ligne directe 2026 (art. 777 CGI) — même grille que succession
const DMTG_BRACKETS = SUCC_BRACKETS;

function calcDonation(montant, donationAnterieure = 0, donFamilial31865 = false) {
  const ABATTEMENT = 100000; // CGI 779 I
  const DON_FAMILIAL = 31865; // CGI 790 G
  const abattementResiduel = Math.max(0, ABATTEMENT - (donationAnterieure || 0));
  const donFamilialApplicable = donFamilial31865 ? DON_FAMILIAL : 0;
  const baseTaxable = Math.max(0, montant - abattementResiduel - donFamilialApplicable);

  let droits = 0;
  let prev = 0;
  for (const b of DMTG_BRACKETS) {
    if (baseTaxable <= b.max) {
      droits += (baseTaxable - prev) * b.rate;
      break;
    }
    droits += (b.max - prev) * b.rate;
    prev = b.max;
  }
  droits = Math.round(droits);
  return {
    droits_dus: droits,
    montant_donation: montant,
    abattement_applique: abattementResiduel,
    abattement_consomme_15ans: donationAnterieure || 0,
    don_familial_cumule: donFamilialApplicable,
    base_taxable: Math.round(baseTaxable),
    montant_net_recu: montant - droits,
    sources: 'art. 779 I CGI (abattement 100k€/15 ans) · art. 790 G CGI (don familial) · art. 777 CGI (barème DMTG)',
  };
}

// IFI 2026 — barème art. 977 CGI (inchangé depuis 2018)
const IFI_BRACKETS = [
  { max: 800000, rate: 0 },
  { max: 1300000, rate: 0.005 }, // tranche 800k-1,3M : 0,5% mais déclenchement à 1,3M
  { max: 2570000, rate: 0.007 },
  { max: 5000000, rate: 0.01 },
  { max: 10000000, rate: 0.0125 },
  { max: Infinity, rate: 0.015 },
];

function calcIFI(patrimoineImmoBrut, residencePrincipale = 0, dettesImmo = 0) {
  const SEUIL = 1300000;
  const ABATTEMENT_RP_PCT = 0.30;
  const rpAbattue = (residencePrincipale || 0) * (1 - ABATTEMENT_RP_PCT);
  const horsRP = Math.max(0, patrimoineImmoBrut - (residencePrincipale || 0));
  const assietteBrute = rpAbattue + horsRP;
  const assietteNette = Math.max(0, assietteBrute - (dettesImmo || 0));

  if (assietteNette < SEUIL) {
    return {
      ifi_du: 0,
      assiette_nette: Math.round(assietteNette),
      seuil_assujettissement: SEUIL,
      assujetti: false,
      note: `Patrimoine immobilier net ${Math.round(assietteNette).toLocaleString('fr-FR')}€ inférieur au seuil 1 300 000€ — non assujetti à l'IFI 2026.`,
      sources: 'art. 964 CGI (seuil) · art. 977 CGI (barème)',
    };
  }

  let ifi = 0;
  let prev = 0;
  for (const b of IFI_BRACKETS) {
    if (assietteNette <= b.max) {
      ifi += (assietteNette - prev) * b.rate;
      break;
    }
    ifi += (b.max - prev) * b.rate;
    prev = b.max;
  }
  // Décote (CGI 977-bis) entre 1,3M et 1,4M
  if (assietteNette >= SEUIL && assietteNette < 1400000) {
    const decote = 17500 - 1.25 * assietteNette / 100;
    ifi = Math.max(0, ifi - decote);
  }
  ifi = Math.round(ifi);
  return {
    ifi_du: ifi,
    assiette_nette: Math.round(assietteNette),
    residence_principale_apres_abattement: Math.round(rpAbattue),
    abattement_rp_30pct_applique: residencePrincipale ? Math.round((residencePrincipale || 0) * ABATTEMENT_RP_PCT) : 0,
    dettes_deduites: dettesImmo || 0,
    sources: 'art. 964 CGI (seuil 1,3M€) · art. 968 CGI (RP -30%) · art. 977 CGI (barème) · art. 977-bis CGI (décote)',
  };
}

// Abattements PV immo CGI 150 V C — barème depuis 2014
function calcPlusValueImmo(prixAcq, prixCess, annees, rp = false, travauxJustifies = 0) {
  if (rp) {
    return {
      pv_brute: 0,
      impot_du: 0,
      exoneration: 'Résidence principale exonérée totalement',
      sources: 'art. 150 U II 1° CGI',
    };
  }
  // Frais d'acquisition forfait 7,5% (ou réels si prouvés)
  const fraisAcq = prixAcq * 0.075;
  const acqMajore = prixAcq + fraisAcq + (travauxJustifies || 0);
  const pvBrute = Math.max(0, prixCess - acqMajore);
  if (pvBrute === 0) {
    return { pv_brute: 0, impot_du: 0, note: 'Aucune plus-value', sources: 'art. 150 U CGI' };
  }
  // Abattement IR : 6%/an de 6 à 21, 4% à 22 → exo 22 ans
  let abIR = 0;
  if (annees >= 22) abIR = 1;
  else if (annees > 5) abIR = Math.min(1, (annees - 5) * 0.06 + (annees >= 21 ? 0.04 : 0));
  // Recalcul propre :
  abIR = 0;
  for (let y = 6; y <= Math.min(annees, 21); y++) abIR += 0.06;
  if (annees >= 22) abIR += 0.04;
  abIR = Math.min(1, abIR);

  // Abattement PS : 1,65%/an 6-21, 1,60% à 22, 9% par an 23-30 → exo 30 ans
  let abPS = 0;
  for (let y = 6; y <= Math.min(annees, 21); y++) abPS += 0.0165;
  if (annees >= 22) abPS += 0.016;
  for (let y = 23; y <= Math.min(annees, 30); y++) abPS += 0.09;
  abPS = Math.min(1, abPS);

  const pvIR = pvBrute * (1 - abIR);
  const pvPS = pvBrute * (1 - abPS);
  const ir = pvIR * 0.19;
  const ps = pvPS * 0.172;
  const totalImpot = Math.round(ir + ps);

  // Surtaxe PV élevée (CGI 1609 nonies G) si pvIR > 50 000
  let surtaxe = 0;
  if (pvIR > 50000) {
    if (pvIR <= 100000) surtaxe = (pvIR - 50000) * 0.02;
    else if (pvIR <= 150000) surtaxe = 1000 + (pvIR - 100000) * 0.03;
    else if (pvIR <= 200000) surtaxe = 2500 + (pvIR - 150000) * 0.04;
    else if (pvIR <= 250000) surtaxe = 4500 + (pvIR - 200000) * 0.05;
    else surtaxe = 7000 + (pvIR - 250000) * 0.06;
  }

  return {
    pv_brute: Math.round(pvBrute),
    pv_apres_abattement_ir: Math.round(pvIR),
    pv_apres_abattement_ps: Math.round(pvPS),
    abattement_ir_pct: Math.round(abIR * 100),
    abattement_ps_pct: Math.round(abPS * 100),
    impot_ir_19pct: Math.round(ir),
    prelevements_sociaux_172pct: Math.round(ps),
    surtaxe_pv_elevee: Math.round(surtaxe),
    impot_du: totalImpot + Math.round(surtaxe),
    annees_detention: annees,
    sources: 'art. 150 U CGI · art. 150 V C CGI (abattements) · art. 1609 nonies G CGI (surtaxe PV élevée)',
  };
}

// Démembrement — barème art. 669 CGI
const USUFRUIT_BAREME = [
  { ageMax: 20, usufruit: 0.90 },
  { ageMax: 30, usufruit: 0.80 },
  { ageMax: 40, usufruit: 0.70 },
  { ageMax: 50, usufruit: 0.60 },
  { ageMax: 60, usufruit: 0.50 },
  { ageMax: 70, usufruit: 0.40 },
  { ageMax: 80, usufruit: 0.30 },
  { ageMax: 90, usufruit: 0.20 },
  { ageMax: Infinity, usufruit: 0.10 },
];

function calcDemembrement(valeurPP, ageUsufruitier) {
  const tranche = USUFRUIT_BAREME.find(t => ageUsufruitier <= t.ageMax);
  const usuPct = tranche.usufruit;
  const npPct = 1 - usuPct;
  return {
    valeur_pleine_propriete: valeurPP,
    age_usufruitier: ageUsufruitier,
    valeur_usufruit: Math.round(valeurPP * usuPct),
    valeur_nue_propriete: Math.round(valeurPP * npPct),
    usufruit_pct: Math.round(usuPct * 100),
    nue_propriete_pct: Math.round(npPct * 100),
    note: `À ${ageUsufruitier} ans, l'usufruit vaut ${Math.round(usuPct * 100)}% et la NP ${Math.round(npPct * 100)}% (barème fiscal). En donation NP, seule la NP est taxée — l'usufruit revient gratuitement à la NP au décès de l'usufruitier (CGI 1133).`,
    sources: 'art. 669 CGI (barème usufruit) · art. 1133 CGI (extinction usufruit)',
  };
}

// ──────────────────────────────────────────────────────────────
// Exit tax — CGI 167 bis (transfert domicile fiscal hors France)
// PFU 30% sur PV latente · sursis automatique 6 ans pour UE/EEE
// ──────────────────────────────────────────────────────────────
const EU_EEE = ['allemagne','autriche','belgique','bulgarie','chypre','croatie','danemark','espagne','estonie','finlande','grece','hongrie','irlande','italie','lettonie','lituanie','luxembourg','malte','pays-bas','pologne','portugal','republique tcheque','roumanie','slovaquie','slovenie','suede','islande','liechtenstein','norvege'];

function calcExitTax(valeurTitres, prixAcq, paysDest = '', controleMaj = false) {
  const pv = Math.max(0, valeurTitres - prixAcq);
  if (pv === 0) {
    return { exit_tax_due: 0, note: 'Aucune plus-value latente — exit tax non applicable.', sources: 'art. 167 bis CGI' };
  }
  const ir = pv * 0.128; // PFU IR
  const ps = pv * 0.172; // prélèvements sociaux
  const total = Math.round(ir + ps);

  const paysClean = (paysDest || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const sursisUE = EU_EEE.includes(paysClean);
  const sursis = {
    automatique: sursisUE,
    duree: sursisUE ? '6 ans (sursis automatique UE/EEE — CGI 167 bis II.1)' : 'Sursis sur garantie hors UE/EEE (constitution d\'une garantie auprès du Trésor)',
    extinction: 'PV purgée si conservation des titres > 6 ans après le départ + retour en France (sinon imposition définitive au terme)',
  };

  const seuilPlafond = 800000;
  const sousSeuil = !controleMaj && valeurTitres < seuilPlafond;

  return {
    exit_tax_due: total,
    plus_value_latente: Math.round(pv),
    ir_12_8_pct: Math.round(ir),
    prelevements_sociaux_17_2_pct: Math.round(ps),
    sursis,
    sous_seuil_800k: sousSeuil,
    note: sousSeuil
      ? 'Patrimoine titres < 800 k€ et pas de contrôle majoritaire → exit tax non applicable (CGI 167 bis I.1).'
      : 'Exit tax applicable. Sursis recommandé. Obligations déclaratives au départ + chaque année du sursis.',
    sources: 'art. 167 bis CGI · BOFIP-RPPM-PVBMI-50 · convention bilatérale destination',
  };
}

// ──────────────────────────────────────────────────────────────
// Comparatif holdings — France vs Luxembourg vs Suisse vs Pays-Bas
// Données indicatives 2026 (à valider par juriste fiscaliste)
// ──────────────────────────────────────────────────────────────
function compareHoldingJurisdictions(typeActif = 'participations_op', valeurParticipation = 0, actionnaireFr = true) {
  const grilles = {
    france: {
      label: 'France (SAS/SARL holding)',
      is_dividendes_recus: '0% (régime mère-fille CGI 145 sous condition 5% + 2 ans, quote-part frais 5%)',
      is_pv_cession: '0% (long terme, titres de participation > 2 ans, quote-part 12% — CGI 219 I a quinquies)',
      remontee_actionnaire_fr: 'PFU 30% (12,8% IR + 17,2% PS) sur dividendes versés',
      cout_setup: '1-3 k€',
      avantage: 'Aucun droit de douane/TVA, simplicité, conventions FR-130+ pays',
      inconvenient: 'CSG-CRDS sur PV future à la sortie',
    },
    luxembourg: {
      label: 'Luxembourg SOPARFI',
      is_dividendes_recus: '0% (régime participation exemption — LIR art. 166, 10% détention ou 1,2 M€ + 1 an)',
      is_pv_cession: '0% (mêmes conditions que dividendes)',
      remontee_actionnaire_fr: 'Retenue source 0% à 15% selon convention LUX-FR (5/15% standard) + PFU FR 30% avec crédit d\'impôt',
      cout_setup: '15-30 k€ (constitution + domiciliation + admin annuelle 8-15 k€)',
      avantage: 'Régulation fiable, RAIF possible pour structures PE, gouvernance souple SCA',
      inconvenient: 'Substance économique exigée (real activity test), coûts récurrents, BEPS / ATAD',
    },
    suisse: {
      label: 'Suisse SA / Sàrl holding',
      is_dividendes_recus: '95% exonération (réduction holding — capital ≥ 100 k CHF + détention ≥ 10%)',
      is_pv_cession: 'Exonération sur PV de participation (impôt cantonal et fédéral)',
      remontee_actionnaire_fr: 'Retenue source CH 35% — récupérable via convention CH-FR à 15% + PFU 30%',
      cout_setup: '20-40 k€ (constitution SA capital 100 k CHF, admin 10-20 k€/an)',
      avantage: 'Stabilité juridique, secret bancaire dégressif mais gouvernance privée préservée, AVS distincte',
      inconvenient: 'Coût constitution SA, fiscalité cantonale variable (à choisir : Zoug, Zurich, Genève)',
    },
    pays_bas: {
      label: 'Pays-Bas BV holding',
      is_dividendes_recus: '0% (participation exemption — détention ≥ 5%)',
      is_pv_cession: '0% (mêmes conditions)',
      remontee_actionnaire_fr: 'Retenue source NL 15% conventionnel, récupérable à 15% via crédit FR + PFU 30%',
      cout_setup: '8-15 k€',
      avantage: 'Réseau de conventions, holding active flexibility, position sortie EU favorable',
      inconvenient: 'Substance test renforcé depuis 2024, ATAD III en discussion',
    },
  };

  const recommandation = (() => {
    if (typeActif === 'participations_op' && valeurParticipation > 5000000) {
      return 'Pour > 5 M€ de participations opérationnelles, privilégier France (simple) ou Luxembourg (si réseau international). Suisse pertinente si actionnaire envisage résidence fiscale CH.';
    }
    if (typeActif === 'pe_funds') {
      return 'Pour PE/VC, Luxembourg RAIF ou SCA est l\'option standard (réservé professionnels, fiscalité 0% IS sous conditions).';
    }
    if (typeActif === 'immo') {
      return 'Pour l\'immobilier, attention : la plupart des juridictions prélèvent dans le pays de situation (lex rei sitae). Holding pertinente surtout pour structurer la gouvernance, moins pour optimiser fiscalement.';
    }
    if (typeActif === 'ip_marques') {
      return 'Pour la propriété intellectuelle, Luxembourg ou Pays-Bas avec leurs régimes IP-box (taux IS effectif réduit ~5-9% sous BEPS 5).';
    }
    return 'Recommandation à affiner avec juriste fiscaliste international + audit BEPS/ATAD.';
  })();

  return {
    type_actif: typeActif,
    valeur_participation: valeurParticipation,
    juridictions: grilles,
    recommandation,
    avertissement: 'Comparatif indicatif. Une décision de structuration internationale doit être validée par un juriste fiscaliste, en tenant compte de la substance économique exigée (BEPS, ATAD, convention bilatérale, GAAR).',
    sources: 'CGI 145, 219 I a quinquies (FR) · LIR 166 (LUX) · LIFD 69 (CH) · Wet Vpb (NL) · Modèle OCDE',
  };
}

// ──────────────────────────────────────────────────────────────
// Forfait fiscal Suisse — imposition d'après la dépense
// Loi sur l'imposition d'après la dépense (LFID 2014, applicable 2016+)
// ──────────────────────────────────────────────────────────────
const CANTONS_FORFAIT = {
  // Cantons qui acceptent encore le forfait (depuis 2016)
  vd: { label: 'Vaud', taux_eff_estime: 0.32, dispo: true, min_chf: 415000 },
  vs: { label: 'Valais', taux_eff_estime: 0.30, dispo: true, min_chf: 400000 },
  ge: { label: 'Genève', taux_eff_estime: 0.40, dispo: true, min_chf: 400000 },
  fr: { label: 'Fribourg', taux_eff_estime: 0.30, dispo: true, min_chf: 400000 },
  ti: { label: 'Tessin', taux_eff_estime: 0.30, dispo: true, min_chf: 400000 },
  ne: { label: 'Neuchâtel', taux_eff_estime: 0.32, dispo: true, min_chf: 400000 },
  ju: { label: 'Jura', taux_eff_estime: 0.30, dispo: true, min_chf: 400000 },
  be: { label: 'Berne', taux_eff_estime: 0.34, dispo: true, min_chf: 400000 },
  // Cantons qui ont aboli le forfait
  zh: { label: 'Zurich', dispo: false, raison: 'Aboli par votation 2009' },
  bs: { label: 'Bâle-Ville', dispo: false, raison: 'Aboli 2010' },
  sh: { label: 'Schaffhouse', dispo: false, raison: 'Aboli 2014' },
  ar: { label: 'Appenzell RE', dispo: false, raison: 'Aboli 2014' },
};

function calcForfaitSuisse(loyerOuVL, canton = 'vd') {
  const c = CANTONS_FORFAIT[canton.toLowerCase()];
  if (!c || !c.dispo) {
    return {
      eligible: false,
      canton: c ? c.label : canton,
      raison: c ? c.raison : 'Canton inconnu',
      sources: 'LFID 2014 · Loi sur l\'imposition d\'après la dépense',
    };
  }

  // Base imposable : 7× loyer/valeur locative depuis 2016, plancher cantonal
  const baseFromHousing = loyerOuVL * 7;
  const baseImposable = Math.max(baseFromHousing, c.min_chf);
  const impotEstime = Math.round(baseImposable * c.taux_eff_estime);

  return {
    eligible: true,
    canton: c.label,
    base_imposable_chf: Math.round(baseImposable),
    methode_calcul: `7 × loyer/valeur locative (${Math.round(baseFromHousing).toLocaleString('fr-CH')} CHF) ou plancher cantonal (${c.min_chf.toLocaleString('fr-CH')} CHF) — le plus élevé`,
    impot_total_estime_chf: impotEstime,
    taux_effectif_estime_pct: Math.round(c.taux_eff_estime * 100),
    conditions: 'Non actif en Suisse (pas d\'activité professionnelle CH) · non-résident CH 5 ans précédents · ressortissant non-suisse',
    note: 'Estimation indicative. Le calcul réel intègre fédéral (taux progressif jusqu\'à 11,5%) + cantonal + communal. Validation par fiscaliste local recommandée.',
    sources: 'LFID 2014 · LIFD 14 · pratique cantonale ' + c.label,
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
    if (name === 'calc_donation') {
      return calcDonation(+input.montant || 0, +input.donation_anterieure || 0, !!input.don_familial_31865);
    }
    if (name === 'calc_ifi') {
      return calcIFI(+input.patrimoine_immo_brut || 0, +input.residence_principale || 0, +input.dettes_immo || 0);
    }
    if (name === 'calc_plus_value_immo') {
      return calcPlusValueImmo(+input.prix_acquisition || 0, +input.prix_cession || 0, +input.annees_detention || 0, !!input.residence_principale, +input.travaux_justifies || 0);
    }
    if (name === 'calc_demembrement') {
      return calcDemembrement(+input.valeur_pleine_propriete || 0, +input.age_usufruitier || 0);
    }
    if (name === 'calc_exit_tax') {
      return calcExitTax(+input.valeur_titres || 0, +input.prix_acquisition || 0, input.pays_destination || '', !!input.controle_majoritaire);
    }
    if (name === 'compare_holding_jurisdictions') {
      return compareHoldingJurisdictions(input.type_actif || 'participations_op', +input.valeur_participation || 0, input.actionnaire_resident_fr !== false);
    }
    if (name === 'calc_forfait_suisse') {
      return calcForfaitSuisse(+input.loyer_ou_valeur_locative || 0, input.canton || 'vd');
    }
    return { error: 'Unknown tool: ' + name };
  } catch (e) {
    return { error: 'Tool execution error: ' + e.message };
  }
}

// ──────────────────────────────────────────────────────────────
// CONTEXTES THÉMATIQUES — injectés dans le system prompt quand le front
// envoie un `theme` (page family-office). Permet à Marcel de focaliser sa
// réponse sur la bonne expertise, sans changer l'identité ni les règles MIF II.
// ──────────────────────────────────────────────────────────────
const THEME_CONTEXTS = {
  art:
    "FOCUS THÉMATIQUE — MARCHÉ DE L'ART. Tu réponds avec : (1) ordre de grandeur d'estimation " +
    "si la question le permet (cite Artprice/Artnet/maisons de vente comme référentiel), (2) régime " +
    "fiscal applicable (exclusion IFI art. 885 I CGI, taxation forfaitaire 6,5% du prix de cession " +
    "art. 150 V bis CGI, exonération PV générale après 22 ans). (3) Si patrimoine art > 1 M€, mentionne " +
    "1-2 schémas de structuration (SC dédiée, fondation abritée, OBO art via holding).",
  markets:
    "FOCUS THÉMATIQUE — MARCHÉS FINANCIERS. Tu donnes des éléments de cadrage (multiples indicatifs, " +
    "fiscalité par enveloppe : PEA art. 150-0 D CGI, AV art. 125-0 A et 990 I CGI, PER art. 163 " +
    "quatervicies CGI). Tu ne nommes JAMAIS de produit ou fonds spécifique. Tu rappelles que la " +
    "sélection de valeurs/UC relève de la recommandation personnalisée — donc validation Maxime obligatoire.",
  fiscal:
    "FOCUS THÉMATIQUE — INGÉNIERIE FISCALE. Utilise SYSTÉMATIQUEMENT tes tools (calc_impot_revenu, " +
    "calc_droits_succession, calc_donation, calc_ifi, calc_plus_value_immo, calc_demembrement). " +
    "Cite l'article CGI applicable et le millésime du barème.",
  juridique:
    "FOCUS THÉMATIQUE — JURIDIQUE & SUCCESSION. Réponds en citant le Code civil, le CGI et la " +
    "jurisprudence pertinente. Pour le pacte Dutreil (art. 787 B CGI), rappelle les 4 conditions " +
    "(engagement collectif 2 ans / engagement individuel 4 ans / fonction de direction 3 ans / " +
    "holding animatrice si pertinent — Cass. com. 2024 a durci l'appréciation).",
  immo:
    "FOCUS THÉMATIQUE — ACTIFS IMMOBILIERS. Pour les estimations, indique que la source est DVF " +
    "(api.gouv.fr — données officielles ventes). Utilise calc_ifi et calc_plus_value_immo dès qu'un " +
    "calcul est possible. Cite art. 964 CGI (IFI), art. 150 U CGI (PV), art. 31 CGI (déductibilité).",
  pe:
    "FOCUS THÉMATIQUE — PRIVATE EQUITY. Maîtrise art. 150-0 B ter CGI (apport-cession holding), " +
    "art. 199 terdecies-0 A CGI (IR-PME), art. 219 I a quinquies CGI (exonération PV holding). " +
    "Pour les FPCI, mentionne les conditions 75% titres éligibles non cotés, durée minimale 5 ans.",
  transmission:
    "FOCUS THÉMATIQUE — TRANSMISSION D'ENTREPRISE. Pour toute valorisation > 1 M€, présente 4 " +
    "schémas comparés : (A) cession 100% à un tiers — PFU 30%, (B) donation-cession enfants avant " +
    "cession — purge PV pour la part donnée, (C) holding apport CGI 150-0 B ter — report PV, (D) " +
    "Dutreil familial complet CGI 787 B — abattement 75%. Chiffre l'impact fiscal de chacun.",
  financement:
    "FOCUS THÉMATIQUE — FINANCEMENT. Pour le Lombard, base les taux indicatifs sur OAT 10y + spread " +
    "bancaire (90-110 pb private banking) ; LTV typique 60-65%. Mentionne risque margin call. Cite " +
    "art. 31 CGI (déductibilité intérêts emprunt locatif).",
  philanthropie:
    "FOCUS THÉMATIQUE — PHILANTHROPIE. Compare fonds de dotation (loi 2008-776) / fondation abritée " +
    "/ FRUP. Cite la fiscalité dotateur : art. 200 CGI (IR 66%), art. 978 CGI (IFI 75%), art. 238 " +
    "bis CGI (IS 60%).",
  admin:
    "FOCUS THÉMATIQUE — CONCIERGERIE & ADMINISTRATIF. Calendrier fiscal du trimestre en cours, " +
    "rappels d'échéances, classement de courrier sensible. Pour la conciergerie (voyage, scolarité), " +
    "indique que IKCP coordonne avec un prestataire white-label — pas d'auto-booking direct.",

  // ─── UNIVERS LIFESTYLE (page family-office-v5-univers freemium) ───
  voyages:
    "FOCUS UNIVERS — VOYAGES & VACANCES. Compare options voyage premium : jet privé partagé " +
    "(NetJets Marquis Card) vs ad hoc (VistaJet, Flexjet) vs first class régulier ; charters " +
    "yacht (Yatco, Camper & Nicholsons) ; résidences secondaires premium (Sotheby's Realty, " +
    "Knight Frank). Donne tarifs indicatifs et coût total. Mentionne fiscalité si voyage mixte " +
    "(refacturation société CGI 39 — déductibilité raisonnable).",
  voitures:
    "FOCUS UNIVERS — VOITURES DE COLLECTION. Cote Hagerty Valuation Tool (USA), comparables " +
    "Artcurial Motorcars (FR/EU), RM Sotheby's. États #1 à #4. Fiscalité : objet de collection " +
    "(douane > 30 ans), CGI 150 V bis (taxation cession 6,5% prix forfait), TVA si schéma " +
    "société, sortie d'actif déclenche IS sur PV. Donation : meuble — abattement 100k€/15 ans " +
    "CGI 779 I applicable.",
  art_collection:
    "FOCUS UNIVERS — ŒUVRES D'ART (collection). Comparables Artprice/Artnet, ventes Christie's/" +
    "Sotheby's, alertes pré-vente. Fiscalité : exclusion IFI (CGI 885 I), taxation forfaitaire " +
    "6,5% (CGI 150 V bis) ou option PV régime général (exo 22 ans). > 4 M€ : SC familiale ou " +
    "fondation abritée.",
  vins:
    "FOCUS UNIVERS — VINS & SPIRITUEUX. Cotes Liv-ex (référence internationale, USD/€), iDealwine " +
    "(France), Wine-Searcher. Primeurs Bordeaux campagne en cours. Fiscalité : exclusion IFI, " +
    "taxation cession 6,5% (CGI 150 V bis). Stockage : entrepôt sous douane (TVA suspendue) " +
    "recommandé pour bouteilles d'investissement.",
  montres:
    "FOCUS UNIVERS — MONTRES. Cotes Chrono24 + WatchCharts (marché secondaire), Phillips/" +
    "Antiquorum (haute horlogerie vintage). Marché 2024-2026 : correction post-bulle 2022 sur " +
    "Rolex/Patek/AP, stabilisation depuis Q3 2025. Fiscalité : objet de collection (CGI 150 V " +
    "bis) ; donation meuble — abattement 100k€/15 ans CGI 779 I.",
  yachts:
    "FOCUS UNIVERS — YACHTS. Acquisition vs charter (NCB charter ~12-18% du prix achat/an), TCO " +
    "complet (équipage 4-12 selon taille, maintenance, port, assurances, carburant). Pavillons : " +
    "Malte (EU, anglophone, leasing TVA), Caïmans (offshore, > 40m), France (DAFN coûteux). " +
    "Régime leasing maltais : TVA effective 5,4% sur durée use.",
  immo_prestige:
    "FOCUS UNIVERS — IMMOBILIER PRESTIGE. Off-market via réseau notaires + Sotheby's Realty / " +
    "Knight Frank ; comparables DVF (api.gouv.fr) + BIEN Notaires ; valorisation PriceHubble. " +
    "Fiscalité : IFI (CGI 964 et suivants), abattement 30% RP, déductibilité intérêts emprunt " +
    "régime réel (CGI 31), conventions fiscales si bien à l'étranger.",
  chevaux:
    "FOCUS UNIVERS — CHEVAUX & SPORT. Vente yearlings Arqana (Deauville août), Goffs France " +
    "(octobre), Tattersalls (UK). Pension écuries Chantilly/Compiègne 3,2-4,5 k€/mois. Fiscalité : " +
    "SCEA d'élevage (BIC agricole, déductibilité totale charges + amortissements, micro si CA < " +
    "91 900 €), ou détention privée (BNC non-pro accessoire).",

  // ─── DROIT DES AFFAIRES & DROIT DES SOCIÉTÉS ───
  droit_affaires:
    "FOCUS DROIT DES AFFAIRES. Tu maîtrises : contrats commerciaux (clauses essentielles, " +
    "limitation de responsabilité, force majeure), distribution (concession, franchise, agence " +
    "commerciale CGI L134-1), propriété intellectuelle (marques INPI, brevets, dessins, droit " +
    "d'auteur logiciel CPI L113-9), restructuring (mandat ad hoc, conciliation, sauvegarde Code " +
    "de commerce L611 et suivants), procédures collectives. Cite le Code de commerce et le CPI.",
  droit_societes:
    "FOCUS DROIT DES SOCIÉTÉS. Tu maîtrises : choix de la forme sociale (SARL / SAS / SA / SCI " +
    "/ SNC / SCP), constitution (apports en numéraire / nature / industrie, libération du capital), " +
    "gouvernance (direction, conseil, AG ordinaire/extraordinaire), pactes d'actionnaires (clauses " +
    "leaver, drag-along, tag-along, anti-dilution, préemption, non-concurrence), opérations sur " +
    "capital (augmentation, réduction, fusion-absorption, scission, apport partiel), transmission " +
    "(donation parts/actions, holding apport CGI 150-0 B ter, Dutreil CGI 787 B). Cite le Code de " +
    "commerce L210 et suivants.",

  // ─── DROIT INTERNATIONAL — JURIDICTIONS ───
  international_lux:
    "FOCUS INTERNATIONAL — LUXEMBOURG. Tu maîtrises : SOPARFI (société de participations " +
    "financières — exonération PV cession + dividendes à 95%/100% sous conditions LIR art. 166), " +
    "SCA (société en commandite par actions — gouvernance familiale), RAIF (Reserved Alternative " +
    "Investment Fund — fonds réservé professionnels, 0% IS sous conditions), SICAR, Family Wealth " +
    "Management. Convention fiscale FR-LUX 1958 modifiée 2018 (élimine résidence Luxembourg passive). " +
    "Cite legilux.public.lu et la convention bilatérale.",
  international_ch:
    "FOCUS INTERNATIONAL — SUISSE. Tu maîtrises : forfait fiscal (résidence fiscale calculée sur " +
    "5-7× valeur locative ou loyer payé — réservé non-actifs en CH, non-résidents 5 ans précédents, " +
    "conditions cantonales : Vaud, Valais, Genève via accords), Sàrl + SA suisses (impôt fédéral 8,5% " +
    "+ cantonal/communal 10-22%), résidence fiscale CH (présence > 90 j sans activité ou 30 j avec), " +
    "AVS et Pillar 3a, trust-equivalent CH (fondation de famille). Convention fiscale FR-CH 1966 " +
    "modifiée 2014 — taxation des fonctions à éviter pour les frontaliers. Cite admin.ch/fedlex.",
  international_uk:
    "FOCUS INTERNATIONAL — ROYAUME-UNI. Tu maîtrises : non-dom status (résident UK non-domicilié — " +
    "règle des 15 ans de résidence depuis 2017 puis deemed dom, remittance basis taxation), Family " +
    "Investment Company (FIC — alternative aux trusts post-Inheritance Tax), trust law UK (resident " +
    "trustee, beneficiary deemed dom), Brexit (libre circulation des capitaux préservée par convention). " +
    "Convention fiscale FR-UK 2008. Cite gov.uk/government et HMRC.",
  international_us:
    "FOCUS INTERNATIONAL — ÉTATS-UNIS. Tu maîtrises : LLC Delaware vs LLC New York (gouvernance, " +
    "fiscalité passe-partout pour PE), C-Corp vs S-Corp (residency dependent), FATCA (déclaration " +
    "comptes USA pour résidents fiscaux français — formulaire 8938), exit tax US (covered expatriate " +
    "test), conventions FR-USA 1994 modifiée 2009 et 2018 (estate tax, dividendes 5/15%, plus-values), " +
    "trust US et impact en France (transparence fiscale française). Cite irs.gov et le Treasury.",
  convention_fiscale:
    "FOCUS CONVENTIONS FISCALES. Tu maîtrises : modèle OCDE (art. 4 résidence, art. 7 entreprise, " +
    "art. 10 dividendes, art. 11 intérêts, art. 12 redevances, art. 13 plus-values, art. 21 autres " +
    "revenus, art. 23 méthodes d'élimination — exemption ou crédit d'impôt), tie-breaker rules (foyer " +
    "permanent → centre des intérêts économiques → résidence habituelle → nationalité). Convention " +
    "multilatérale BEPS 2017 (MLI) et impacts. Liste des conventions FR : 130+ pays. Cite OCDE et " +
    "impots.gouv.fr/portail/conventions-fiscales-internationales.",
};

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

function buildSystemPrompt(ctx, theme) {
  const themeNote = (theme && THEME_CONTEXTS[theme]) ? `\n\n${THEME_CONTEXTS[theme]}\n` : '';
  const seasonalNote = {
    declaration_revenus: `CONTEXTE SAISONNIER : Période de déclaration des revenus (mars-juin). Les visiteurs ont souvent des questions sur leur déclaration (frais réels, pensions alimentaires, revenus fonciers, dons, crédits d'impôt). Sois particulièrement attentif à ces sujets.`,
    ete: `CONTEXTE SAISONNIER : Été. Période fiscalement calme — bon moment pour prendre du recul, faire un point stratégique, anticiper la rentrée.`,
    rentree_fiscale: `CONTEXTE SAISONNIER : Rentrée fiscale. La loi de finances de l'année suivante est en discussion au Parlement. Pour toute question sur des mesures nouvelles/en discussion, utilise impérativement le web search pour vérifier le statut.`,
    fin_annee: `CONTEXTE SAISONNIER : Fin d'année. Dernière ligne droite pour les versements déductibles (plan d'épargne retraite, dons aux associations) avant le 31 décembre.`,
    nouvelle_annee: `CONTEXTE SAISONNIER : Début d'année. Bon moment pour planifier, prendre date, démarrer une stratégie progressive.`,
  };

  return `Tu t'appelles Marcel. Tu es l'assistant patrimonial d'IKCP — IKIGAÏ Conseil Patrimonial, cabinet fondé par Maxime Juveneton, conseiller en gestion de patrimoine indépendant implanté à Saint-Marcel-lès-Annonay en Ardèche.

DATE DU JOUR : ${ctx.dateStr}
${seasonalNote[ctx.season]}${themeNote}

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
Tu as accès à 9 calculateurs déterministes (résultats exacts, sources juridiques incluses) :
- **calc_impot_revenu** : IR 2026 (revenu imposable + parts)
- **calc_droits_succession** : droits de succession ligne directe (patrimoine + enfants + AV avant 70 ans)
- **calc_donation** : droits de donation parent → enfant (montant + antériorité 15 ans + don familial 31 865€)
- **calc_ifi** : IFI 2026 (patrimoine immo brut + RP + dettes immo)
- **calc_plus_value_immo** : PV immobilière de cession + abattements durée détention + surtaxe PV élevée
- **calc_demembrement** : valeur usufruit / nue-propriété selon barème art. 669 CGI (âge usufruitier)
- **calc_exit_tax** : exit tax CGI 167 bis pour transfert domicile fiscal hors France (PFU 30% + sursis UE/EEE 6 ans)
- **compare_holding_jurisdictions** : comparatif fiscal France / Luxembourg SOPARFI / Suisse SA / Pays-Bas BV pour holdings de participations
- **calc_forfait_suisse** : imposition d'après la dépense (forfait fiscal CH) selon canton — Vaud, Valais, Genève, Tessin, etc.

UTILISE CES OUTILS SYSTÉMATIQUEMENT dès que :
- L'utilisateur donne ou demande un calcul chiffré (IR, succession, donation, IFI, PV immo, démembrement)
- L'utilisateur pose une question du type "combien je paierais...", "quel serait l'impôt...", "quels droits pour..."

N'utilise JAMAIS ton propre calcul mental pour ces chiffres — utilise toujours le tool. Les résultats du tool sont exacts et incluent les sources juridiques. Présente le résultat dans ta réponse avec ses chiffres ET ses sources.

Si l'utilisateur ne précise pas les paramètres (ex: parts, enfants), pose UNE question pour les obtenir, puis utilise le tool.

RECHERCHE WEB :
Tu as un outil de recherche web. UTILISE-LE quand :
- Question sur une actualité récente (loi promulguée ces derniers mois, décision, jurisprudence)
- L'utilisateur cite un chiffre/seuil dont tu n'es pas certain qu'il soit à jour
- Question sur un dispositif nouveau ou en évolution
- Mots-clés : "actualité", "nouveau", "dernière loi", "2026", "récent"
N'UTILISE PAS pour les barèmes listés ci-dessus ou les mécanismes stables.
Limite : 2 recherches max. Privilégie service-public.fr, impots.gouv.fr, economie.gouv.fr, legifrance.gouv.fr. Cite les sources utilisées.

CABINET :
- Bureau principal : Saint-Marcel-lès-Annonay, Ardèche (07)
- Présent à Combloux et Megève (déplacements sur RDV)
CALENDLY : https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial
ORIAS : 23001568 | SIREN : 947 972 436

RÈGLES ABSOLUES — CONFORMITÉ MIF II :
1. Tu n'es PAS un conseiller — tu es un assistant PÉDAGOGIQUE. Pas de recommandation personnalisée.
2. Tu ne dis JAMAIS "je vous conseille", "vous devriez", "dans votre cas il faut".
3. Tu informes, expliques, poses des questions, sensibilises. Tu ne prescris pas.
4. Tu ne nommes JAMAIS un produit spécifique (pas de nom de contrat, assureur, fonds).
5. CITATION DES SOURCES — OBLIGATOIRE : tout chiffre/barème/seuil doit être sourcé ("art. 779 I CGI", "barème LF 2026"). Si incertain, dis "selon la législation en vigueur".
6. Vouvoiement systématique.
7. Un terme technique = une brève explication entre parenthèses au 1er usage (ex: "plan d'épargne retraite (enveloppe de capitalisation pour la retraite)").
8. Hors sujet patrimonial = recentrage poli.
9. Pas de formulation commerciale racoleuse ("30 min offertes", "gratuit", etc.).
10. Conclusion des réponses à enjeu : "Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II. Pour une analyse de votre situation, Maxime peut vous accompagner."

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
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
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
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'ikcp-marcel-proxy',
        version: '2.1',
        model: 'claude-sonnet-4-20250514',
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
      const { message, history, document_pdf, theme } = await request.json();

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
      // `theme` est optionnel : page family-office l'envoie pour focaliser la
      // réponse sur l'expertise (art / markets / fiscal / juridique / immo / pe /
      // transmission / financement / philanthropie / admin). Cf. THEME_CONTEXTS.
      const safeTheme = (typeof theme === 'string' && THEME_CONTEXTS[theme]) ? theme : null;
      const systemPromptText = buildSystemPrompt(ctx, safeTheme);

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
            model: 'claude-sonnet-4-20250514',
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

        // Gérer les tool_use calls côté client (tous les calc_*)
        // Web search est server-side : Anthropic le gère, pas nous
        const CLIENT_TOOLS = new Set([
          'calc_impot_revenu',
          'calc_droits_succession',
          'calc_donation',
          'calc_ifi',
          'calc_plus_value_immo',
          'calc_demembrement',
          'calc_exit_tax',
          'compare_holding_jurisdictions',
          'calc_forfait_suisse',
        ]);
        const toolUses = (data.content || []).filter(
          b => b.type === 'tool_use' && CLIENT_TOOLS.has(b.name)
        );

        if (toolUses.length === 0 || data.stop_reason !== 'tool_use') break;

        // Ajoute la réponse de l'assistant avec tool_use à l'historique
        workingMessages.push({ role: 'assistant', content: data.content });

        // Exécute chaque tool et ajoute les résultats
        const toolResults = toolUses.map(tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(executeTool(tu.name, tu.input || {})),
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
