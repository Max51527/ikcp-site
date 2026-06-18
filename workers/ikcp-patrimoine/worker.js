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
  const brut = (d.actifs || []).reduce((s, a) => s + (a.valorisation_cents || 0), 0);
  const passif = (d.dettes || []).reduce((s, x) => s + (x.capital_restant_cents || 0), 0);
  return { actif_brut_cents: brut, passif_cents: passif, actif_net_cents: brut - passif };
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
      constat: `Net ${eur(b.actif_net_cents)} (brut ${eur(b.actif_brut_cents)}, passif ${eur(b.passif_cents)}).`,
      alerte: b.passif_cents > brut * 0.6 ? 'Effet de levier élevé' : null },
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
      return json(audit360(d), 200, o);
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
