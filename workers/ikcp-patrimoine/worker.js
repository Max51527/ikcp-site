/**
 * ikcp-patrimoine — API base patrimoniale + moteur d'opportunités · SOUVERAIN FR
 * ─────────────────────────────────────────────────────────────────────────────
 * RÔLE (une phrase) : lire/écrire le patrimoine d'un membre (D1 Paris), faire
 * tourner le MOTEUR D'OPPORTUNITÉS (matche les stratégies sur ses données), et
 * fournir à Marcel une SYNTHÈSE chiffrée pour qu'il explique avec du réel.
 *
 * LE PRINCIPE (blueprint §9) : on ne donne JAMAIS un conseil automatique. Le moteur
 * produit des HYPOTHÈSES argumentées (score + règle déclencheuse) ; Marcel les
 * EXPLIQUE (information/simulation) ; un humain CIF (ORIAS 23001568) les VALIDE.
 *
 * ENDPOINTS :
 *   GET  /health                  → vivant ? configuré ?
 *   GET  /patrimoine?user=ID      → données + bilan (brut/net) du membre
 *   POST /patrimoine?user=ID      → upsert (personnes, societes, actifs, dettes, objectifs, beneficiaires)
 *   POST /opportunites?user=ID    → lance le moteur, écrit strategies_eligibles, renvoie les matchs
 *   GET  /synthese?user=ID        → synthèse compacte pour le contexte de Marcel
 *
 * SÉCURITÉ : D1 = données client, jamais hors UE. Pas de secret dans ce fichier.
 */

import STRATS from './strategies.json'; // bundlé par wrangler (référentiel §10)

const ALLOWED = [
  'https://ikcp.eu', 'https://www.ikcp.eu', 'https://app.ikcp.eu',
  'https://ikcp-eu.pages.dev', 'http://localhost:5500', 'http://127.0.0.1:5500',
];
function cors(o) {
  const ok = ALLOWED.includes(o) || (o && (o.endsWith('.ikcp.eu') || o.endsWith('.workers.dev') || o.endsWith('.pages.dev')));
  return {
    'Access-Control-Allow-Origin': ok ? o : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}
function json(d, s = 200, o = '') {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(o) } });
}
const DISCLAIMER = "Information, pas un conseil personnalisé (art. L.541-1 CoMoFi). Les pistes ci-dessus sont des hypothèses à valider avec un conseiller CIF (ORIAS 23001568).";

// Tables qu'on accepte en écriture (upsert) — clé = nom de table, valeur = colonnes autorisées.
const WRITABLE = {
  personnes:     ['id', 'member_id', 'prenom', 'nom', 'date_naissance', 'role', 'residence_fiscale', 'regime_matrimonial', 'created_at', 'updated_at'],
  societes:      ['id', 'member_id', 'siren', 'nom', 'forme_juridique', 'is_holding', 'is_animatrice', 'regime_fiscal', 'capital_cents', 'code_naf', 'source_donnee', 'created_at', 'updated_at'],
  actifs:        ['id', 'member_id', 'proprietaire_type', 'proprietaire_id', 'categorie', 'libelle', 'valorisation_cents', 'devise', 'date_acquisition', 'regime_fiscal', 'regime_detention', 'liquidite', 'usage', 'source_donnee', 'powens_id', 'statut_verification', 'sensibilite', 'date_actualisation', 'created_at'],
  dettes:        ['id', 'member_id', 'emprunteur_type', 'emprunteur_id', 'type', 'capital_restant_cents', 'taux', 'echeance', 'mensualite_cents', 'source_donnee', 'created_at'],
  objectifs:     ['id', 'member_id', 'type', 'libelle', 'horizon_annees', 'priorite', 'cible_cents', 'created_at'],
  beneficiaires: ['id', 'member_id', 'actif_id', 'personne_id', 'libelle', 'rang', 'quotite_pct', 'type_droit', 'obsolete', 'created_at'],
};

// ── Charge tout le patrimoine d'un membre depuis D1 ──────────────────────────
async function loadMember(db, member) {
  const q = (t) => db.prepare(`SELECT * FROM ${t} WHERE member_id=?`).bind(member).all().then(r => r.results || []).catch(() => []);
  const [personnes, societes, actifs, dettes, objectifs, beneficiaires] = await Promise.all([
    q('personnes'), q('societes'), q('actifs'), q('dettes'), q('objectifs'), q('beneficiaires'),
  ]);
  return { personnes, societes, actifs, dettes, objectifs, beneficiaires };
}

// ── Bilan patrimonial simple (§7.1) : brut, passif, net ─────────────────────
function bilan(d) {
  const actifs = d.actifs || [];
  const brut = actifs.reduce((s, a) => s + (a.valorisation_cents || 0), 0);
  const passif = (d.dettes || []).reduce((s, x) => s + (x.capital_restant_cents || 0), 0);
  // null ≠ 0 : un actif réel mais non valorisé fausse le bilan ET masque les alertes (faux « RAS »).
  const nonValorises = actifs.filter(a => a.valorisation_cents == null).length;
  return { actif_brut_cents: brut, passif_cents: passif, actif_net_cents: brut - passif, actifs_non_valorises: nonValorises, actifs_total: actifs.length };
}

// ── MOTEUR D'OPPORTUNITÉS (§9) ───────────────────────────────────────────────
// 1) on dérive des "features" normalisées depuis les données du membre,
// 2) on évalue les règles de chaque fiche, 3) score = somme des poids matchés.
function buildFeatures(d) {
  const actifs = d.actifs || [];
  const sum = (cats) => actifs.filter(a => cats.includes(a.categorie)).reduce((s, a) => s + (a.valorisation_cents || 0), 0);
  return {
    'personnes.role': new Set((d.personnes || []).map(p => p.role)),
    'societes.regime_fiscal': new Set((d.societes || []).map(s => s.regime_fiscal)),
    'societes.is_holding': (d.societes || []).some(s => Number(s.is_holding) === 1) ? 1 : 0,
    'actifs.tresorerie_pm.valorisation_cents': sum(['tresorerie_pm']),
    'actifs.immobilier|participation.valorisation_cents': sum(['immobilier', 'participation', 'scpi']),
    'foyer.nombre_enfants': (d.personnes || []).filter(p => p.role === 'enfant').length,
    'beneficiaires.obsolete': (d.beneficiaires || []).some(b => Number(b.obsolete) === 1) ? 1 : 0,
  };
}
function evalRegle(f, r) {
  const v = f[r.champ];
  if (v === undefined) return false;
  if (v instanceof Set) return r.op === '=' ? v.has(r.valeur) : false; // appartenance
  const a = Number(v), b = Number(r.valeur);
  switch (r.op) {
    case '=':  return a === b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '<':  return a < b;
    case '<=': return a <= b;
    default:   return false;
  }
}
function runMoteur(d) {
  const f = buildFeatures(d);
  const out = [];
  for (const s of (STRATS.strategies || [])) {
    const regles = (s.score_eligibilite && s.score_eligibilite.regles) || [];
    let score = 0, declencheur = null;
    for (const r of regles) {
      if (evalRegle(f, r)) { score += (r.poids || 0); if (!declencheur) declencheur = `${r.champ} ${r.op} ${r.valeur}`; }
    }
    if (score >= 0.5) out.push({ strategie_key: s.id, nom: s.nom, famille: s.famille, score: Math.round(score * 100) / 100, declencheur, vigilance: s.vigilance_conformite });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ── AUDIT 360° (blueprint §6.2 / §7) ─────────────────────────────────────────
// Photo patrimoniale multi-dimensions à partir des données CONSOLIDÉES (Powens
// pro+perso + saisie client). Règles déterministes → constats + alertes. Chaque
// dimension DÉSIGNE l'agent Mistral qui l'approfondit (structure rapide & pas chère,
// la profondeur LLM se déclenche à la demande). MIF II : information, pas de reco.
function audit360(d) {
  const b = bilan(d);
  const f = buildFeatures(d);
  const A = d.actifs || [];
  const sum = (c) => A.filter(a => c.includes(a.categorie)).reduce((s, a) => s + (a.valorisation_cents || 0), 0);
  const brut = b.actif_brut_cents || 1;
  const immo = sum(['immobilier', 'scpi']);
  const treso = sum(['tresorerie_pm']);
  const societe = sum(['participation', 'tresorerie_pm']);
  const finance = sum(['assurance_vie', 'pea', 'cto', 'per', 'compte', 'livret']);
  const eur = (c) => (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  const pct = (x) => Math.round(x / brut * 100);
  const roles = f['personnes.role'];
  const isDir = roles instanceof Set && roles.has('dirigeant');

  const dimensions = [
    { cle: 'bilan', titre: 'Bilan patrimonial', agent: 'batisseur',
      constat: `Net ${eur(b.actif_net_cents)} (brut ${eur(b.actif_brut_cents)}, passif ${eur(b.passif_cents)}).`
        + (b.actifs_non_valorises > 0 ? ` ${b.actifs_non_valorises} actif(s) non chiffré(s) — bilan partiel.` : ''),
      alerte: b.actifs_non_valorises > 0
        ? `${b.actifs_non_valorises} actif(s) sans valorisation : bilan et ratios partiels (à compléter avant conclusion)`
        : (b.passif_cents > brut * 0.6 ? 'Effet de levier élevé' : null) },
    { cle: 'structure', titre: 'Structure juridique', agent: 'codex',
      constat: `${(d.societes || []).length} société(s)${f['societes.is_holding'] === 1 ? ', dont holding' : ''}.`,
      alerte: (treso > 10000000 && f['societes.is_holding'] !== 1) ? 'Trésorerie élevée sans holding patrimoniale' : null },
    { cle: 'fiscalite', titre: 'Fiscalité', agent: 'codex',
      constat: `Immobilier ${eur(immo)}.`,
      alerte: immo >= 130000000 ? 'Seuil IFI (1,3 M€) potentiellement dépassé' : null },
    { cle: 'social', titre: 'Social du dirigeant', agent: 'camille',
      constat: isDir ? 'Statut dirigeant détecté — prévoyance & retraite à cadrer.' : 'Statut social à préciser.',
      alerte: null },
    { cle: 'transmission', titre: 'Transmission', agent: 'hermes',
      constat: `${f['foyer.nombre_enfants']} enfant(s).`,
      alerte: f['beneficiaires.obsolete'] === 1 ? 'Clause(s) bénéficiaire(s) à actualiser'
        : (f['foyer.nombre_enfants'] >= 1 && (immo + societe) > 50000000 ? 'Transmission à anticiper' : null) },
    { cle: 'tresorerie', titre: "Trésorerie d'entreprise", agent: 'stratege',
      constat: `Trésorerie société ${eur(treso)}.`,
      alerte: treso > 10000000 ? 'Trésorerie dormante à faire travailler' : null },
    { cle: 'allocation', titre: 'Allocation & risque', agent: 'stratege',
      constat: `Société ${pct(societe)}% · Immo ${pct(immo)}% · Financier ${pct(finance)}%.`,
      alerte: pct(societe) > 50 ? "Concentration forte sur la société d'exploitation" : null },
    { cle: 'objectifs', titre: 'Objectifs de vie', agent: 'batisseur',
      constat: (d.objectifs || []).length ? `${(d.objectifs || []).length} objectif(s) définis.` : 'Objectifs à définir.',
      alerte: !(d.objectifs || []).length ? 'Aucun objectif renseigné — point de départ du conseil' : null },
  ];
  const alertes = dimensions.filter(x => x.alerte);
  const opportunites = runMoteur(d);
  const synthese = `Audit 360° : patrimoine net ${eur(b.actif_net_cents)} · ${alertes.length} point(s) de vigilance · ${opportunites.length} levier(s) détecté(s).`;
  return { bilan: b, dimensions, nb_alertes: alertes.length, opportunites, synthese, disclaimer: DISCLAIMER };
}

// ── SANTÉ SOCIÉTÉ — moteur financier déterministe (souverain, 0 IA, 0 US) ────
// Repris de l'artefact audit dirigeant : ratios + ALERTE LÉGALE capitaux propres
// (L.223-42 SARL/EURL · L.225-248 SA/SAS). Aucune reco perso (MIF II).
function companyFinance(e) {
  e = e || {};
  const n = (v) => { if (v === null || v === undefined) return null; if (typeof v === 'string' && v.trim() === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; }; // null ≠ 0 : une saisie vide/blanche ne devient PAS 0 €
  const ca = n(e.ca), ebe = n(e.ebe), rn = n(e.rn), cp = n(e.cp), dettes = n(e.dettes),
        treso = n(e.treso), capital = n(e.capital), remu = n(e.remu), div = n(e.div);
  const d = (a, b) => (a !== null && b && b !== 0 ? a / b : null);
  const margeNette = d(rn, ca), tauxEBE = d(ebe, ca),
        roe = (cp !== null && cp > 0) ? d(rn, cp) : null,
        gearing = (cp !== null && cp > 0) ? d(dettes, cp) : null,
        autonomie = (cp !== null && cp > 0 && dettes !== null && (cp + dettes) > 0) ? cp / (cp + dettes) : null, // CP<0 → '—' (l'alerte capitaux propres négatifs prend le relais), jamais un ratio trompeur
        tresoCA = d(treso, ca), poidsRemu = d(remu, ebe),
        payout = (rn !== null && rn > 0) ? d(div, rn) : null;
  let alertCapital = null;
  if (cp !== null && cp < 0)
    alertCapital = { level: 'alert', msg: 'Capitaux propres NÉGATIFS. Régularisation impérative (incorporation de compte courant, réduction/augmentation de capital, ou apport).' };
  else if (cp !== null && capital !== null && capital > 0) {
    if (cp < capital / 2) alertCapital = { level: 'alert', msg: "Capitaux propres < moitié du capital social → obligation de consulter les associés sur la dissolution (L.223-42 SARL/EURL, L.225-248 SA/SAS) dans les 4 mois, régularisation sous 2 exercices." };
    else if (cp < capital) alertCapital = { level: 'warn', msg: 'Capitaux propres inférieurs au capital social — érosion à surveiller.' };
  }
  const p = (x) => (x === null || !isFinite(x)) ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %';
  const ratios = [
    { k: 'Marge nette', v: p(margeNette), ref: 'RN/CA' },
    { k: 'Taux de marge EBE', v: p(tauxEBE), ref: 'EBE/CA' },
    { k: 'Rentabilité capitaux propres', v: p(roe), ref: 'RN/CP' },
    { k: 'Autonomie financière', v: p(autonomie), ref: 'CP/(CP+dettes)' },
    { k: 'Gearing (levier)', v: gearing === null ? '—' : gearing.toFixed(2).replace('.', ','), ref: 'Dettes/CP' },
    { k: 'Trésorerie / CA', v: p(tresoCA), ref: 'Tréso/CA' },
    { k: 'Poids rémunération / EBE', v: p(poidsRemu), ref: 'Rému/EBE' },
    { k: 'Taux de distribution', v: p(payout), ref: 'Div/RN' },
  ];
  return { ratios, alertCapital };
}

// ── OCR souverain : bilan/CR → Mistral OCR → extraction chiffrée (FR/UE, ZÉRO US) ──
// Le document n'est jamais stocké ; il transite vers Mistral (UE) le temps de la lecture.
async function ocrFinance(b, env) {
  const data = String(b.file || '');
  if (!data || data.length < 30) throw new Error('fichier manquant');
  const isImg = /^data:image\//.test(data) || /^image\//.test(b.mime || '');
  const document = isImg ? { type: 'image_url', image_url: data } : { type: 'document_url', document_url: data };
  // 1) OCR du document
  const r1 = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + env.MISTRAL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'mistral-ocr-latest', document }),
  });
  if (!r1.ok) throw new Error('ocr ' + r1.status + ' ' + (await r1.text()).slice(0, 120));
  const d1 = await r1.json();
  const text = (d1.pages || []).map(p => p.markdown || '').join('\n').slice(0, 12000);
  if (!text.trim()) throw new Error('document illisible');
  // 2) Extraction des montants en JSON strict (Mistral small, souverain)
  const sys = "Tu extrais des montants comptables EN EUROS depuis un bilan ou compte de résultat français. "
    + "Réponds UNIQUEMENT par un objet JSON avec ces clés (entier en euros, sans espaces ni symbole ; null si absent) : "
    + "ca (chiffre d'affaires), ebe (excédent brut d'exploitation), rn (résultat net), cp (capitaux propres), "
    + "capital (capital social), dettes (dettes financières), treso (trésorerie/disponibilités), "
    + "remu (rémunération du dirigeant), div (dividendes distribués).";
  const r2 = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + env.MISTRAL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'mistral-small-latest', temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: text }] }),
  });
  if (!r2.ok) throw new Error('extract ' + r2.status);
  const d2 = await r2.json();
  let parsed = {}; try { parsed = JSON.parse(((d2.choices || [])[0] || {}).message.content || '{}'); } catch (_) {}
  const out = { ocr: true };
  ['ca', 'ebe', 'rn', 'cp', 'capital', 'dettes', 'treso', 'remu', 'div'].forEach(k => {
    const v = parsed[k]; out[k] = (v === null || v === undefined || isNaN(v)) ? null : Math.round(Number(v));
  });
  return out;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const o = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(o) });
    const db = env.PATRIMOINE_DB;
    const member = url.searchParams.get('user') || '';

    if (url.pathname === '/health') {
      return json({ status: 'ok', service: 'ikcp-patrimoine', db: db ? 'bound' : 'absent', strategies: (STRATS.strategies || []).length, region: 'EU/FR' }, 200, o);
    }

    // ── BÊTA TEST — capture d'usage produit (table beta_events, D1 Paris). ──
    // POST /beta {tool, action?, siren?, label?, data?, email?} : ouvert (analytics produit).
    if (url.pathname === '/beta' && req.method === 'POST') {
      if (!db) return json({ ok: false, error: 'no_db' }, 200, o);
      let b = {}; try { b = await req.json(); } catch (_) { return json({ error: 'bad_json' }, 400, o); }
      // Validation stricte (zéro trust implicite) : allowlist des outils + format email.
      const TOOLS = ['audit', 'marcel', 'cockpit', 'simulateur'];
      const tool = String(b.tool || '').toLowerCase();
      if (!TOOLS.includes(tool)) return json({ error: 'invalid_tool' }, 422, o);
      const action = (String(b.action || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 32)) || null;
      const email = String(b.email || '').slice(0, 160);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid_email' }, 422, o);
      // Minimisation RGPD : on ne stocke PAS le User-Agent brut (empreinte), seulement le type d'appareil.
      const ua = req.headers.get('User-Agent') || '';
      const device = /mobi|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
      try {
        await db.prepare('INSERT INTO beta_events (tool, action, siren, label, data, email, ua) VALUES (?,?,?,?,?,?,?)')
          .bind(tool, action, String(b.siren || '').replace(/\D/g, '').slice(0, 14) || null,
                String(b.label || '').slice(0, 160) || null, b.data ? JSON.stringify(b.data).slice(0, 4000) : null,
                email || null, device).run();
        // Purge RGPD : conservation 90 jours max (best-effort, sans CRON qui échoue sur ce compte).
        try { await db.prepare("DELETE FROM beta_events WHERE created_at < datetime('now','-90 days')").run(); } catch (_) {}
        return json({ ok: true }, 200, o);
      } catch (e) { console.error('[beta] insert', e.message); return json({ error: 'insert_failed' }, 500, o); }
    }

    // ── STUDIO — configuration no-code de l'app (table app_config, D1 Paris). ──
    // Réglages que Maxime modifie sans coder ; le front les lit pour s'afficher.
    const CONFIG_DEF = { hero: 'Tout part de votre entreprise.', tagline: 'Intelligence patrimoniale pour dirigeant(e)s & professions libérales', premium_eur: 59, gating_360_only: true };
    // GET /config : lecture PUBLIQUE (le front a besoin de la config sans secret).
    if (url.pathname === '/config' && req.method === 'GET') {
      if (!db) return json(CONFIG_DEF, 200, o);
      try { const row = await db.prepare("SELECT data FROM app_config WHERE id='main'").first(); return json(row && row.data ? JSON.parse(row.data) : CONFIG_DEF, 200, o); }
      catch (_) { return json(CONFIG_DEF, 200, o); }
    }
    // PUT /config : écriture réservée au PROPRIÉTAIRE — via sa connexion membre (zéro secret à retenir).
    if (url.pathname === '/config' && req.method === 'PUT') {
      if (!db) return json({ error: 'no_db' }, 503, o);
      // Empreintes (SHA-256) des emails propriétaires — privé, jamais l'email en clair dans le repo public.
      const OWNER_HASHES = [
        'c363eb19abba013b797cb98a4f5298485560d16d0ecbd5ba70c991dcb172d1a3', // pro .fr
        'cdf3440f43feeaab6e08910642d2e85e3e6b7b4be5e2a702951691d324f8f030', // pro .eu
        'd4c01e9f986be2d7c2c27d180463d6b5b528e6324f1555985043bdac8c832543', // perso
      ];
      let authed = false;
      // 1) Connexion membre propriétaire : Bearer → ikcp-client /me → empreinte email autorisée.
      const auth = req.headers.get('Authorization') || '';
      if (auth.startsWith('Bearer ')) {
        try {
          const me = await fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/me', { headers: { 'Authorization': auth } });
          if (me.ok) {
            const u = await me.json();
            if (u && u.email) {
              const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(u.email).trim().toLowerCase()));
              const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
              if (OWNER_HASHES.includes(hex)) authed = true;
            }
          }
        } catch (_) {}
      }
      // 2) Fallback : secret admin (console), si un jour posé.
      if (!authed) {
        const tok = req.headers.get('x-admin-secret') || url.searchParams.get('token') || '';
        if (env.BETA_ADMIN && tok && tok === env.BETA_ADMIN) authed = true;
        else if (tok) { try { const vr = await fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/admin/applications?status=pending', { headers: { 'x-admin-secret': tok } }); authed = vr.ok; } catch (_) {} }
      }
      if (!authed) return json({ error: 'unauthorized', hint: 'Connectez-vous avec votre email propriétaire.' }, 401, o);
      let b = {}; try { b = await req.json(); } catch (_) { return json({ error: 'bad_json' }, 400, o); }
      try {
        await db.prepare("CREATE TABLE IF NOT EXISTS app_config (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT)").run();
        await db.prepare("INSERT INTO app_config (id, data, updated_at) VALUES ('main', ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").bind(JSON.stringify(b).slice(0, 8000)).run();
        return json({ ok: true }, 200, o);
      } catch (e) { console.error('[config] save', e.message); return json({ error: 'save_failed' }, 500, o); }
    }

    // GET /beta/list?token=…&tool=… : lecture admin.
    // Auth SANS NOUVEAU SECRET : on délègue à l'admin existant (ikcp-client /api/v1/admin).
    // Maxime utilise le MÊME secret que /app/console → rien à poser. (BETA_ADMIN reste accepté en option.)
    if (url.pathname === '/beta/list' && req.method === 'GET') {
      if (!db) return json({ error: 'no_db' }, 503, o);
      const tok = url.searchParams.get('token') || req.headers.get('x-admin-secret') || '';
      let authed = !!(env.BETA_ADMIN && tok && tok === env.BETA_ADMIN);
      if (!authed && tok) {
        try { const vr = await fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/admin/applications?status=pending', { headers: { 'x-admin-secret': tok } }); authed = vr.ok; } catch (_) {}
      }
      if (!authed) return json({ error: 'unauthorized', hint: 'Entrez le secret admin (celui de /app/console).' }, 401, o);
      try {
        const tool = (String(url.searchParams.get('tool') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24)) || null;
        const ev = tool
          ? await db.prepare('SELECT * FROM beta_events WHERE tool=? ORDER BY id DESC LIMIT 300').bind(tool).all()
          : await db.prepare('SELECT * FROM beta_events ORDER BY id DESC LIMIT 300').all();
        const st = await db.prepare("SELECT tool, COUNT(*) n, MAX(created_at) last FROM beta_events GROUP BY tool ORDER BY n DESC").all();
        return json({ ok: true, stats: st.results, events: ev.results }, 200, o);
      } catch (e) { console.error('[beta/list]', e.message); return json({ error: 'server_error' }, 500, o); }
    }

    // ── POST /opportunites/preview : moteur SANS persistance (marche sans D1) ──
    // Le cockpit envoie les données du membre dans le corps ; on renvoie les pistes.
    // Stateless = rien n'est stocké (RGPD : la donnée ne quitte pas l'appel).
    if (url.pathname === '/opportunites/preview' && req.method === 'POST') {
      let d = {}; try { d = await req.json(); } catch (_) {}
      return json({ opportunites: runMoteur(d), bilan: bilan(d), disclaimer: DISCLAIMER }, 200, o);
    }

    // ── POST /audit360 : audit patrimonial 360° (stateless, marche sans D1) ──
    // Reçoit le patrimoine consolidé (Powens /wealth mappé + saisie client) ;
    // renvoie la photo multi-dimensions + l'agent Mistral qui approfondit chaque axe.
    if (url.pathname === '/audit360' && req.method === 'POST') {
      let d = {}; try { d = await req.json(); } catch (_) {}
      const res = audit360(d);
      if (d.entreprise) res.finance = companyFinance(d.entreprise); // santé société si chiffres fournis
      return json(res, 200, o);
    }

    // ── POST /finance : ratios société + ALERTE légale capitaux propres (souverain) ──
    if (url.pathname === '/finance' && req.method === 'POST') {
      let e = {}; try { e = await req.json(); } catch (_) {}
      return json({ ...companyFinance(e), disclaimer: DISCLAIMER }, 200, o);
    }

    // ── POST /ocr : bilan/CR → Mistral OCR → extraction chiffres (souverain FR/UE). Gated. ──
    if (url.pathname === '/ocr' && req.method === 'POST') {
      if (!env.MISTRAL_API_KEY) return json({ error: 'ocr_unconfigured', hint: 'pose MISTRAL_API_KEY sur ikcp-patrimoine (wrangler secret put)' }, 503, o);
      let b = {}; try { b = await req.json(); } catch (_) {}
      try { return json(await ocrFinance(b, env), 200, o); }
      catch (e) { return json({ error: 'ocr_failed', message: String(e.message || e).slice(0, 160) }, 502, o); }
    }

    if (!db) return json({ error: 'no_db', hint: 'Crée la D1 ikcp-patrimoine-db (--location weur), exécute schema.sql, bind PATRIMOINE_DB.' }, 503, o);
    if (!member) return json({ error: 'missing_user' }, 400, o);

    // ── GET /patrimoine : la photo patrimoniale + bilan ──
    if (url.pathname === '/patrimoine' && req.method === 'GET') {
      const d = await loadMember(db, member);
      return json({ member, bilan: bilan(d), ...d }, 200, o);
    }

    // ── POST /patrimoine : upsert des entités envoyées ──
    if (url.pathname === '/patrimoine' && req.method === 'POST') {
      let body = {}; try { body = await req.json(); } catch (_) {}
      const now = new Date().toISOString();
      let written = 0;
      for (const [table, cols] of Object.entries(WRITABLE)) {
        const rows = Array.isArray(body[table]) ? body[table] : [];
        for (const raw of rows) {
          const row = { ...raw, member_id: member };
          if (!row.id) row.id = crypto.randomUUID();
          if (!row.created_at) row.created_at = now;
          const use = cols.filter(c => row[c] !== undefined);
          const ph = use.map(() => '?').join(',');
          try {
            await db.prepare(`INSERT OR REPLACE INTO ${table} (${use.join(',')}) VALUES (${ph})`).bind(...use.map(c => row[c])).run();
            written++;
          } catch (e) { /* ligne ignorée si invalide — best-effort */ }
        }
      }
      return json({ ok: true, written }, 200, o);
    }

    // ── POST /opportunites : moteur d'opportunités → strategies_eligibles ──
    if (url.pathname === '/opportunites' && req.method === 'POST') {
      const d = await loadMember(db, member);
      const matchs = runMoteur(d);
      const now = new Date().toISOString();
      for (const m of matchs) {
        try {
          await db.prepare('INSERT OR REPLACE INTO strategies_eligibles (id, member_id, strategie_key, score, declencheur, statut, detected_at) VALUES (?,?,?,?,?,?,?)')
            .bind(`${member}:${m.strategie_key}`, member, m.strategie_key, m.score, m.declencheur, 'detectee', now).run();
        } catch (_) {}
      }
      return json({ member, opportunites: matchs, disclaimer: DISCLAIMER }, 200, o);
    }

    // ── GET /synthese : contexte compact pour Marcel (à injecter dans son prompt) ──
    if (url.pathname === '/synthese' && req.method === 'GET') {
      const d = await loadMember(db, member);
      const b = bilan(d);
      const eur = (c) => (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
      const matchs = runMoteur(d);
      const synthese = [
        `Patrimoine net estimé : ${eur(b.actif_net_cents)} (brut ${eur(b.actif_brut_cents)}, passif ${eur(b.passif_cents)}).`,
        `${(d.societes || []).length} société(s), ${(d.actifs || []).length} actif(s).`,
        matchs.length ? `Pistes détectées : ${matchs.map(m => m.nom).join(', ')}.` : 'Aucune piste prioritaire détectée pour l’instant.',
      ].join(' ');
      return json({ member, bilan: b, synthese, opportunites: matchs, disclaimer: DISCLAIMER }, 200, o);
    }

    return json({ error: 'not_found', path: url.pathname }, 404, o);
  },
};
