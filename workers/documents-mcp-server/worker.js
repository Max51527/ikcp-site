/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4 · reproduction interdite
 *
 * IKCP — Documents MCP server (premier prototype)
 *
 * Sub-agent qui classifie et extrait les données structurées de documents
 * patrimoniaux uploadés par les clients (avis IR, K-bis, actes notariés,
 * contrats AV, relevés PEA, etc.).
 *
 * Tools exposés :
 *   - classify_document(r2_key)   → { type, year?, summary, fields, confidence }
 *   - extract_structured(r2_key)  → { fields_typed_per_doc_type }
 *   - ocr_pdf(r2_key)             → { text, pages, ocr_engine }
 *
 * Architecture :
 *   - Récupère le doc depuis R2 (binding DOCS_R2)
 *   - Encode en base64
 *   - Appelle Anthropic Claude (vision API) pour OCR + structuration
 *   - Retourne JSON typé selon le type détecté
 *
 * RGPD :
 *   - Hash SHA-256 du doc loggé dans audit (pas le contenu)
 *   - Anthropic DPA signé (data processing addendum requis avant beta)
 *   - Conservation Anthropic 30 j max (configuré côté compte Anthropic)
 *   - Pas de retraining sur données client (clause Anthropic standard)
 *   - Suppression possible : worker ikcp-client expose DELETE /api/docs/:id
 *
 * Bindings requis (wrangler.toml) :
 *   - DOCS_R2          (R2 bucket ikcp-docs-private)
 *   - ANTHROPIC_API_KEY (secret)
 *   - MCP_SHARED_SECRET (secret partagé avec ikcp-marcel)
 *
 * Auth : HMAC-SHA256 sur body (header X-IKCP-Signature)
 */

const SUBAGENT_NAME = 'documents';
const VERSION = '1.0.0';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';  // sonnet 4.6 pour OCR + raisonnement structuré

// ─── Catalogue des types de documents reconnus ──────────────────────────
const DOC_TYPES = {
  avis_ir: {
    label: 'Avis d\'imposition sur le revenu',
    fields: ['annee_revenus', 'foyer_fiscal_parts', 'revenu_imposable', 'impot_du', 'tmi'],
  },
  avis_ifi: {
    label: 'Avis IFI',
    fields: ['annee', 'patrimoine_immo_brut', 'patrimoine_taxable', 'ifi_du'],
  },
  kbis: {
    label: 'Extrait K-bis',
    fields: ['siren', 'denomination', 'forme_juridique', 'capital', 'siege', 'dirigeant'],
  },
  statuts: {
    label: 'Statuts de société',
    fields: ['denomination', 'forme_juridique', 'date_creation', 'objet_social'],
  },
  acte_donation: {
    label: 'Acte de donation',
    fields: ['date_acte', 'donateur', 'donataire', 'montant', 'nature_biens', 'demembrement'],
  },
  acte_notarie: {
    label: 'Acte notarié (autre)',
    fields: ['date_acte', 'notaire', 'parties', 'objet'],
  },
  av_contrat: {
    label: 'Contrat assurance-vie',
    fields: ['assureur', 'numero_contrat', 'souscripteur', 'date_souscription', 'beneficiaires'],
  },
  releve_pea: {
    label: 'Relevé PEA',
    fields: ['banque', 'numero_compte', 'date_releve', 'valeur_titres', 'valeur_liquidites'],
  },
  taxe_fonciere: {
    label: 'Avis taxe foncière',
    fields: ['annee', 'commune', 'reference_cadastrale', 'montant_tf'],
  },
  cfe: {
    label: 'Avis CFE',
    fields: ['annee', 'siret', 'commune', 'montant_cfe'],
  },
  bilan_compta: {
    label: 'Bilan comptable',
    fields: ['exercice', 'denomination', 'total_bilan', 'resultat_net'],
  },
  compromis: {
    label: 'Compromis / promesse de vente',
    fields: ['date_signature', 'vendeur', 'acquereur', 'bien', 'prix', 'date_acte_authentique'],
  },
  bail: {
    label: 'Bail (location)',
    fields: ['date_signature', 'bailleur', 'preneur', 'bien', 'loyer_mensuel', 'duree'],
  },
  attestation: {
    label: 'Attestation diverse',
    fields: ['emetteur', 'date', 'objet', 'montant'],
  },
  autre: {
    label: 'Document non classifié',
    fields: [],
  },
};

const TOOLS = [
  {
    name: 'classify_document',
    description: "Classifie un document patrimonial uploadé en R2 (avis IR, K-bis, acte notarié, AV, etc.) et extrait les champs clés. Utiliser dès qu'un client uploade un document pour le ranger automatiquement.",
    input_schema: {
      type: 'object',
      properties: {
        r2_key: { type: 'string', description: "Clé du document dans R2 (ex: docs/cli_001/abc.pdf)" },
        hint: { type: 'string', description: "Type pressenti par le client (optionnel)" },
      },
      required: ['r2_key'],
    },
  },
  {
    name: 'extract_structured',
    description: "Extrait des champs structurés selon le type de document détecté. Appeler après classify_document si on veut un parsing plus profond.",
    input_schema: {
      type: 'object',
      properties: {
        r2_key: { type: 'string' },
        doc_type: {
          type: 'string',
          enum: Object.keys(DOC_TYPES),
          description: "Type connu du document (issu de classify_document)",
        },
      },
      required: ['r2_key', 'doc_type'],
    },
  },
  {
    name: 'ocr_pdf',
    description: "OCR brut d'un PDF ou image en R2 — retourne le texte page par page. À utiliser quand classify ou extract ne suffisent pas (ex: lecture manuelle, recherche full-text).",
    input_schema: {
      type: 'object',
      properties: { r2_key: { type: 'string' } },
      required: ['r2_key'],
    },
  },
];

// ─── Routing HTTP MCP ───────────────────────────────────────────────────
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
          r2: !!env.DOCS_R2,
          anthropic: !!env.ANTHROPIC_API_KEY,
          shared_secret: !!env.MCP_SHARED_SECRET,
        },
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
      if (!TOOLS.find(t => t.name === name)) {
        return jsonError(404, 'tool_not_found');
      }

      const result = await callTool(name, args || {}, env);
      return Response.json({ result });
    }

    return jsonError(404, 'not_found');
  },
};

// ─── Tools dispatch ─────────────────────────────────────────────────────
async function callTool(name, args, env) {
  try {
    if (name === 'classify_document') {
      return await classifyDocument(args.r2_key, args.hint, env);
    }
    if (name === 'extract_structured') {
      return await extractStructured(args.r2_key, args.doc_type, env);
    }
    if (name === 'ocr_pdf') {
      return await ocrPdf(args.r2_key, env);
    }
    return { error: 'unknown_tool', tool: name };
  } catch (e) {
    console.error('[documents-mcp]', name, e);
    return { error: 'tool_execution_error', message: String(e.message || e).slice(0, 200) };
  }
}

// ─── classify_document ──────────────────────────────────────────────────
async function classifyDocument(r2Key, hint, env) {
  const obj = await fetchR2Doc(r2Key, env);
  if (obj.error) return obj;

  const types = Object.entries(DOC_TYPES)
    .filter(([k]) => k !== 'autre')
    .map(([k, v]) => `· ${k} : ${v.label}`)
    .join('\n');

  const systemPrompt =
    "Tu es un agent de classification de documents patrimoniaux français. " +
    "Tu reçois un document (PDF ou image) et tu retournes un JSON strict avec :\n" +
    "  { \"type\": <clé enum>, \"confidence\": 0-1, \"summary\": <2-3 phrases>, " +
    "\"key_fields\": { ... champs clés selon le type } }\n\n" +
    "Types connus :\n" + types + "\n· autre : tout autre document\n\n" +
    "Règles :\n" +
    "1. Si confidence < 0.6, retourne type=autre.\n" +
    "2. Pour avis_ir : extraire année revenus, parts, revenu imposable, impôt dû.\n" +
    "3. Pour kbis : SIREN, dénomination, forme, capital, siège, dirigeant.\n" +
    "4. Pour acte_donation : date, donateur, donataire, montant, démembrement (true/false).\n" +
    "5. Pour av_contrat : assureur, n° contrat, date souscription, bénéficiaires.\n" +
    "6. Aucune information personnelle non présente dans le document. Pas d'hallucination.\n" +
    "7. Réponds UNIQUEMENT le JSON, rien d'autre. Pas de markdown, pas de prose.";

  const userMessage = hint
    ? `Le client suggère que c'est un document de type "${hint}". Vérifie et classifie.`
    : "Classifie ce document et extrait les champs clés.";

  const response = await callAnthropicVision(env, systemPrompt, userMessage, obj.base64, obj.mimeType);
  const parsed = extractJson(response);

  return {
    r2_key: r2Key,
    sha256: obj.sha256,  // pour audit
    classification: parsed || { type: 'autre', confidence: 0, summary: 'Échec de classification', key_fields: {} },
    raw_response_preview: response.slice(0, 200),
    sources: 'Anthropic Claude vision · ' + ANTHROPIC_MODEL,
  };
}

// ─── extract_structured ─────────────────────────────────────────────────
async function extractStructured(r2Key, docType, env) {
  const obj = await fetchR2Doc(r2Key, env);
  if (obj.error) return obj;

  const config = DOC_TYPES[docType];
  if (!config) return { error: 'unknown_doc_type', doc_type: docType };

  const fieldsSpec = config.fields.length === 0
    ? 'aucun champ standard — extrais ce qui est pertinent.'
    : config.fields.map(f => `· ${f}`).join('\n');

  const systemPrompt =
    `Tu es un agent d'extraction de données pour des documents de type "${config.label}". ` +
    "Tu retournes un JSON avec les champs suivants si présents dans le document :\n" +
    fieldsSpec + "\n\n" +
    "Règles :\n" +
    "1. Champ absent du document → null (pas inventer).\n" +
    "2. Montants : nombres en euros (centimes en décimal), pas de string formaté.\n" +
    "3. Dates : ISO YYYY-MM-DD.\n" +
    "4. SIREN : 9 chiffres sans espaces. SIRET : 14 chiffres.\n" +
    "5. Réponds UNIQUEMENT le JSON, rien d'autre.";

  const response = await callAnthropicVision(
    env, systemPrompt,
    `Extrais les champs structurés de ce document de type ${docType}.`,
    obj.base64, obj.mimeType
  );
  const parsed = extractJson(response);

  return {
    r2_key: r2Key,
    sha256: obj.sha256,
    doc_type: docType,
    fields: parsed || {},
    sources: 'Anthropic Claude vision · ' + ANTHROPIC_MODEL,
  };
}

// ─── ocr_pdf ────────────────────────────────────────────────────────────
async function ocrPdf(r2Key, env) {
  const obj = await fetchR2Doc(r2Key, env);
  if (obj.error) return obj;

  const systemPrompt =
    "Tu es un agent OCR. Tu transcris fidèlement le contenu textuel d'un PDF ou d'une image, " +
    "page par page, sans interprétation, sans reformulation. Retourne le texte brut, " +
    "préserver les structures (tableaux, listes) en markdown léger.";

  const response = await callAnthropicVision(
    env, systemPrompt,
    "Transcris ce document fidèlement. Sépare les pages par '\\n\\n--- Page N ---\\n\\n'.",
    obj.base64, obj.mimeType
  );

  // Approximatif — Anthropic ne retourne pas vraiment des pages séparées
  const pages = response.split(/\n--- Page \d+ ---\n/).filter(p => p.trim()).length || 1;

  return {
    r2_key: r2Key,
    sha256: obj.sha256,
    text: response,
    pages,
    char_count: response.length,
    ocr_engine: 'anthropic-vision-' + ANTHROPIC_MODEL,
  };
}

// ─── Helpers R2 + Anthropic ─────────────────────────────────────────────
async function fetchR2Doc(r2Key, env) {
  if (!env.DOCS_R2) return { error: 'r2_binding_missing' };
  if (!r2Key || typeof r2Key !== 'string') return { error: 'invalid_r2_key' };

  const obj = await env.DOCS_R2.get(r2Key);
  if (!obj) return { error: 'doc_not_found', r2_key: r2Key };

  // Cap taille — anti-abus
  const MAX_SIZE = 10 * 1024 * 1024;  // 10 MB
  if (obj.size > MAX_SIZE) return { error: 'doc_too_large', size: obj.size, max: MAX_SIZE };

  const arrayBuffer = await obj.arrayBuffer();
  const base64 = bufToBase64(new Uint8Array(arrayBuffer));
  const sha256 = await sha256Hex(arrayBuffer);
  const mimeType = obj.httpMetadata?.contentType || 'application/pdf';

  return { base64, sha256, mimeType, size: obj.size };
}

async function callAnthropicVision(env, systemPrompt, userMessage, docBase64, mimeType) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');

  const isPdf = mimeType === 'application/pdf';
  const content = [
    {
      type: isPdf ? 'document' : 'image',
      source: {
        type: 'base64',
        media_type: isPdf ? 'application/pdf' : mimeType,
        data: docBase64,
      },
    },
    { type: 'text', text: userMessage },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

function bufToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Auth HMAC (identique au template) ──────────────────────────────────
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
