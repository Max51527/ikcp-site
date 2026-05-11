/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4 · reproduction interdite
 *
 * IKCP — Reporting MCP server (3e sub-agent)
 *
 * Sub-agent qui génère les livrables réglementaires et clients :
 *  · DER (Document d'Entrée en Relation, MIF II)
 *  · Lettre de mission
 *  · Rapport d'Adéquation (RA)
 *  · DIPA (Document d'Information Précontractuel Assurance, DDA)
 *  · Bilan patrimonial trimestriel
 *
 * Tools exposés :
 *   - generate_der(user_id)            → PDF DER pré-rempli
 *   - generate_rapport_adequation(user_id, dossier_id) → RA pré-rempli
 *   - generate_bilan_trimestriel(user_id, quarter) → bilan PDF 18+ pages
 *   - render_template(template_id, data) → renders HTML → PDF (low-level)
 *
 * Architecture :
 *   · Récupère données client depuis D1 (binding DB)
 *   · Récupère templates depuis R2 (binding TEMPLATES_R2)
 *   · Compose HTML avec templates + données
 *   · Convertit HTML → PDF via DocRaptor / Gotenberg API
 *   · Stocke le PDF dans R2 ikcp-docs-private avec metadata
 *   · Met à jour D1 documents (generated=1)
 *   · File de signature Yousign / Universign à la demande
 *
 * Bindings :
 *   · DB             D1 ikcp-client-db (lecture user, files, dossiers)
 *   · TEMPLATES_R2   R2 ikcp-templates (lecture templates HTML)
 *   · DOCS_R2        R2 ikcp-docs-private (écriture PDF générés)
 *   · MCP_SHARED_SECRET  auth HMAC
 *   · DOCRAPTOR_API_KEY  (secret · pour HTML→PDF)
 *   · YOUSIGN_API_KEY    (secret · pour signature électronique, Phase 2)
 *
 * RGPD :
 *   · PDFs stockés R2 chiffré at-rest
 *   · Hash SHA-256 du PDF dans audit
 *   · Horodatage Universign en option (eIDAS qualifié)
 *   · Conservation 10 ans (NF Z42-013)
 */

const SUBAGENT_NAME = 'reporting';
const VERSION = '1.0.0-prototype';

// ─── Tools exposés ────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'generate_der',
    description: "Génère le Document d'Entrée en Relation (DER, obligation MIF II) pour un client. Pré-remplit avec les données D1 du client et retourne un PDF dans R2.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        require_signature: { type: 'boolean', description: 'Si true, file le PDF pour signature Yousign après génération' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'generate_rapport_adequation',
    description: "Génère le Rapport d'Adéquation (RA, obligation MIF II / DDA) après une recommandation. Pré-rempli avec données client + reco Marcel + sources.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        dossier_id: { type: 'string', description: 'Dossier patrimonial concerné' },
        recommendation: { type: 'string', description: 'Recommandation à formaliser' },
      },
      required: ['user_id', 'dossier_id', 'recommendation'],
    },
  },
  {
    name: 'generate_bilan_trimestriel',
    description: "Génère le bilan patrimonial trimestriel (~18 pages) : vue 360°, allocation, drift, échéances, arbitrages prêts, livrables, activité IA scorecard.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        quarter: { type: 'string', description: 'Format Q1-2026, Q2-2026, etc.' },
      },
      required: ['user_id', 'quarter'],
    },
  },
  {
    name: 'render_template',
    description: "Tool low-level : prend un template HTML R2 + données JSON, retourne un PDF stocké R2. Utilisé en interne par les autres tools, exposé pour cas avancés.",
    input_schema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Nom du template dans R2 templates/ (ex: der.html, ra.html, bilan-trim.html)' },
        data: { type: 'object', description: 'Données à injecter (variables Mustache-style {{key}})' },
        output_filename: { type: 'string', description: 'Nom du PDF généré (ex: der-2026-05.pdf)' },
        user_id: { type: 'string' },
      },
      required: ['template_id', 'data', 'output_filename', 'user_id'],
    },
  },
];

// ─── Routing HTTP ───────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/mcp/health' && request.method === 'GET') {
      return Response.json({
        status: 'ok',
        subagent: SUBAGENT_NAME,
        version: VERSION,
        tools_count: TOOLS.length,
        configured: {
          db: !!env.DB,
          templates_r2: !!env.TEMPLATES_R2,
          docs_r2: !!env.DOCS_R2,
          shared_secret: !!env.MCP_SHARED_SECRET,
          docraptor: !!env.DOCRAPTOR_API_KEY,
          yousign: !!env.YOUSIGN_API_KEY,
        },
        note: 'PROTOTYPE — templates et endpoints de signature à finaliser Phase 2 P2',
      });
    }

    if (!env.MCP_SHARED_SECRET) return jsonError(503, 'mcp_secret_not_configured');
    const auth = await verifyAuth(request, env.MCP_SHARED_SECRET);
    if (!auth.ok) return jsonError(401, 'unauthorized', auth.reason);

    if (path === '/mcp/list_tools' && request.method === 'POST') {
      return Response.json({ tools: TOOLS });
    }

    if (path === '/mcp/call_tool' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return jsonError(400, 'invalid_json'); }
      const { name, arguments: args } = body || {};
      if (!TOOLS.find(t => t.name === name)) return jsonError(404, 'tool_not_found');
      const result = await callTool(name, args || {}, env);
      return Response.json({ result });
    }

    return jsonError(404, 'not_found');
  },
};

// ─── Tools dispatch ─────────────────────────────────────────────────────
async function callTool(name, args, env) {
  try {
    if (name === 'generate_der') return await generateDer(args.user_id, !!args.require_signature, env);
    if (name === 'generate_rapport_adequation') return await generateRA(args.user_id, args.dossier_id, args.recommendation, env);
    if (name === 'generate_bilan_trimestriel') return await generateBilan(args.user_id, args.quarter, env);
    if (name === 'render_template') return await renderTemplate(args.template_id, args.data, args.output_filename, args.user_id, env);
    return { error: 'unknown_tool', tool: name };
  } catch (e) {
    console.error('[reporting-mcp]', name, e);
    return { error: 'tool_execution_error', message: String(e.message || e).slice(0, 200) };
  }
}

// ─── generate_der ───────────────────────────────────────────────────────
async function generateDer(userId, requireSignature, env) {
  const user = await env.DB?.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return { error: 'user_not_found' };

  const data = {
    client_first: user.first_name || '',
    client_last: user.last_name || '',
    client_email: user.email,
    cgp_name: 'Maxime Juveneton',
    cgp_orias: '23001568',
    cgp_status: 'CIF — CNCEF Patrimoine · COA',
    date_etablissement: new Date().toLocaleDateString('fr-FR'),
    siren_ikcp: '947 972 436',
    address_ikcp: 'Saint-Marcel-lès-Annonay (07100), France',
    statuts: ['CIF (Conseiller en Investissements Financiers · CNCEF Patrimoine)', 'COA (Courtier en Opérations d\'Assurance)'],
    tarification: 'Forfait annuel transparent + commissions affichées MIF II',
    rcpro: 'MMA · couverture professionnelle conforme MIF II / DDA',
  };

  // Phase 1 prototype : retourne juste la structure, pas de PDF généré
  // Phase 2 : appel renderTemplate('der.html', data, 'der-<date>.pdf', userId)
  return {
    status: 'prototype',
    user_id: userId,
    template: 'der.html',
    data_preview: data,
    output_pdf_planned: `docs/${userId}/der-${new Date().toISOString().slice(0, 10)}.pdf`,
    require_signature: requireSignature,
    next_step: 'Phase 2 : implémenter renderTemplate avec template R2 + DocRaptor + signature Yousign si require_signature',
    sources: 'MIF II art. 24 · obligations entrée en relation',
  };
}

// ─── generate_rapport_adequation ────────────────────────────────────────
async function generateRA(userId, dossierId, recommendation, env) {
  const user = await env.DB?.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return { error: 'user_not_found' };

  const dossier = await env.DB?.prepare('SELECT * FROM dossiers WHERE id = ? AND user_id = ?').bind(dossierId, userId).first();
  if (!dossier) return { error: 'dossier_not_found' };

  return {
    status: 'prototype',
    user_id: userId,
    dossier_id: dossierId,
    template: 'ra.html',
    recommendation_summary: recommendation.slice(0, 200),
    output_pdf_planned: `docs/${userId}/ra-${dossierId}-${Date.now()}.pdf`,
    contains: [
      'Identité client et profil',
      'Situation patrimoniale (vue 360°)',
      'Objectifs et horizon',
      'Tolérance au risque',
      'Recommandation détaillée + sources MIF II / DDA',
      'Adéquation au profil (justification)',
      'Risques et alternatives',
      'Validation Maxime Juveneton (signature requise)',
    ],
    sources: 'MIF II art. 25 + DDA art. 30 · obligation rapport d\'adéquation',
    next_step: 'Phase 2 P2 : implémentation complète + intégration Yousign',
  };
}

// ─── generate_bilan_trimestriel ─────────────────────────────────────────
async function generateBilan(userId, quarter, env) {
  if (!env.DB) return { error: 'db_unavailable' };

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return { error: 'user_not_found' };

  // Récupère snapshot patrimonial le plus récent
  const snap = await env.DB.prepare(
    'SELECT * FROM patrimoine_snapshot WHERE user_id = ? ORDER BY asof DESC LIMIT 1'
  ).bind(userId).first();

  // Compte arbitrages, échéances, livrables récents
  const counts = {};
  for (const tbl of ['arbitrages', 'echeances', 'documents']) {
    try {
      const r = await env.DB.prepare(`SELECT COUNT(*) as c FROM ${tbl} WHERE user_id = ?`).bind(userId).first();
      counts[tbl] = r ? r.c : 0;
    } catch { counts[tbl] = 0; }
  }

  return {
    status: 'prototype',
    user_id: userId,
    quarter,
    template: 'bilan-trim.html',
    output_pdf_planned: `docs/${userId}/bilan-${quarter}.pdf`,
    pages_planned: 18,
    sections: [
      'Couverture + signature client + Maxime',
      'Synthèse exécutive · 1 page',
      'Vue 360° patrimoine consolidé · 2 pages',
      'Allocation par classe + drift vs cible · 1 page',
      'Échéances trimestrielles + alertes · 1 page',
      'Livrables Reporting/DER/RA générés · 1 page',
      'Conversations Marcel marquantes · 1 page',
      'Arbitrages préparés + statut Maxime · 2 pages',
      'Activité IA scorecard (questions, docs, optims) · 1 page',
      'Univers personnels (voitures, art, vins, immo) · 2-3 pages',
      'Dénicheur d\'offres pertinentes · 1-2 pages',
      'Calendrier prochains 3 mois · 1 page',
      'Disclaimers MIF II / DDA · 1 page',
    ],
    data_summary: {
      net_worth: snap?.net_worth || null,
      drift_severity: snap?.drift_severity || 'unknown',
      arbitrages_total: counts.arbitrages,
      echeances_total: counts.echeances,
      documents_total: counts.documents,
    },
    next_step: 'Phase 2 P2 : template R2 bilan-trim.html + DocRaptor + signature Yousign',
    sources: 'D1 patrimoine_snapshot · echeances · arbitrages · documents',
  };
}

// ─── render_template (low-level) ────────────────────────────────────────
async function renderTemplate(templateId, data, outputFilename, userId, env) {
  if (!env.TEMPLATES_R2) return { error: 'templates_r2_unavailable' };
  if (!env.DOCS_R2) return { error: 'docs_r2_unavailable' };

  const tplObj = await env.TEMPLATES_R2.get(`templates/${templateId}`);
  if (!tplObj) return { error: 'template_not_found', template_id: templateId };

  const template = await tplObj.text();
  const html = renderMustache(template, data);

  // Phase 1 prototype : on ne convertit pas réellement HTML→PDF
  // Phase 2 : appel DocRaptor API
  if (!env.DOCRAPTOR_API_KEY) {
    return {
      status: 'html_only_prototype',
      html_preview: html.slice(0, 500),
      note: 'PROTOTYPE — DOCRAPTOR_API_KEY non configurée. HTML rendu mais pas converti en PDF.',
    };
  }

  // Phase 2 — code réel à activer
  /*
  const pdfRes = await fetch('https://docraptor.com/docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_credentials: env.DOCRAPTOR_API_KEY,
      doc: { document_content: html, type: 'pdf', name: outputFilename },
    }),
  });
  if (!pdfRes.ok) return { error: 'docraptor_failed' };
  const pdfBytes = await pdfRes.arrayBuffer();
  const r2Key = `docs/${userId}/${outputFilename}`;
  await env.DOCS_R2.put(r2Key, pdfBytes, { httpMetadata: { contentType: 'application/pdf' } });
  const sha = await sha256Hex(pdfBytes);
  return { success: true, r2_key: r2Key, sha256: sha, size_bytes: pdfBytes.byteLength };
  */

  return { status: 'phase2_pending', message: 'Implémentation finale Phase 2 P2' };
}

// ─── Helpers ────────────────────────────────────────────────────────────
function renderMustache(template, data) {
  // Mustache léger : {{key}} et {{#array}}...{{/array}}
  let html = template;
  // Variables simples
  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const val = data[key];
    return val == null ? '' : String(val);
  });
  return html;
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAuth(request, secret) {
  const sig = request.headers.get('X-IKCP-Signature');
  if (!sig) return { ok: false, reason: 'missing_signature' };
  const body = request.method === 'POST' ? await request.clone().text() : 'list_tools';
  const expected = await hmacSha256(body, secret);
  if (!constantTimeEqual(sig, expected)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true };
}

async function hmacSha256(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function jsonError(status, error, detail) {
  return new Response(JSON.stringify({ error, detail }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
