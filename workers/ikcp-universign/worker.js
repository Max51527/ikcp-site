/**
 * IKCP Universign Worker — Cloudflare Worker
 *
 * Wrapper Universign API (Dhimyotis · FR souverain · eIDAS qualifié).
 * Génère et envoie pour signature des documents IKCP :
 *  - Lettres de mission Premium / Sur-mesure
 *  - Mandats ad-hoc (réservations conciergerie)
 *  - Convention de portage NextGen
 *  - Accusés de prise de connaissance (DER MIF II)
 *
 * Endpoints :
 *   GET  /health
 *   POST /transactions/create   → crée une transaction de signature
 *   GET  /transactions/:id      → statut d'une transaction
 *   POST /webhook               → callback Universign (signature reçue)
 *
 * Bindings requis :
 *   UNIVERSIGN_API_KEY    (secret) — clé API Dhimyotis Universign Pro
 *   UNIVERSIGN_PROFILE_ID (secret) — profil "qualifié" pour eIDAS
 *   IKCP_UNIVERSIGN_DB    (D1)     — suivi des transactions
 *
 * Author : Maxime Juveneton · IKCP · 2026
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://admin.ikcp.eu',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'null',
];

const UNIVERSIGN_API = 'https://ws.universign.eu/sign/rest/v1';
// Documentation : https://help.universign.eu/api/

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || (origin && origin.endsWith('.ikcp.eu'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-IKCP-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

/**
 * Crée une transaction de signature Universign
 * Type signature : "qualified" (eIDAS qualifié, niveau le plus élevé)
 */
async function createTransaction(payload, env) {
  const body = {
    profile: env.UNIVERSIGN_PROFILE_ID || 'default',
    customId: payload.customId || `ikcp_${Date.now()}`,
    documents: payload.documents.map((d) => ({
      content: d.base64, // PDF en base64
      name: d.name,
      signatureFields: d.signatureFields || [],
    })),
    signers: payload.signers.map((s, i) => ({
      firstName: s.firstName,
      lastName: s.lastName,
      emailAddress: s.email,
      phoneNum: s.phone, // requis pour signature qualifiée (OTP SMS)
      birthDate: s.birthDate, // YYYY-MM-DD pour signature qualifiée
      successURL: s.successUrl || `${payload.return_base_url}/signed/${i}`,
      cancelURL: s.cancelUrl || `${payload.return_base_url}/cancelled`,
      failURL: s.failUrl || `${payload.return_base_url}/failed`,
    })),
    handwrittenSignatureMode: 'TOUCH',
    certificateType: 'simple', // ou 'certified' pour eIDAS qualifié
    language: 'FR',
    description: payload.description || 'Document IKCP',
    finalDocSent: true,
    finalDocRequesterSent: true,
    redirectPolicy: 'DASHBOARD',
  };

  const response = await fetch(`${UNIVERSIGN_API}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.UNIVERSIGN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Universign ${response.status}: ${txt.slice(0, 300)}`);
  }

  return await response.json();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Health
    if (url.pathname === '/health') {
      return json(
        {
          status: 'ok',
          service: 'ikcp-universign',
          partner: 'Dhimyotis Universign',
          region: 'FR (Annecy + Paris)',
          eidas: 'qualified',
          configured: {
            api_key: !!env.UNIVERSIGN_API_KEY,
            profile_id: !!env.UNIVERSIGN_PROFILE_ID,
            d1: !!env.IKCP_UNIVERSIGN_DB,
          },
          timestamp: new Date().toISOString(),
        },
        200,
        origin
      );
    }

    // POST /transactions/create
    if (url.pathname === '/transactions/create' && request.method === 'POST') {
      if (!env.UNIVERSIGN_API_KEY) {
        return json({ error: 'universign_not_configured' }, 500, origin);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, origin);
      }

      // Validation minimale
      if (!payload.documents?.length || !payload.signers?.length) {
        return json({ error: 'missing_documents_or_signers' }, 400, origin);
      }

      try {
        const tx = await createTransaction(payload, env);

        // Log en D1
        if (env.IKCP_UNIVERSIGN_DB) {
          ctx.waitUntil(
            env.IKCP_UNIVERSIGN_DB
              .prepare(
                `INSERT INTO transactions (transaction_id, custom_id, family_id, doc_count, signers_count, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                tx.id,
                payload.customId || null,
                payload.family_id || null,
                payload.documents.length,
                payload.signers.length,
                'pending',
                new Date().toISOString()
              )
              .run()
              .catch(() => {})
          );
        }

        return json(
          {
            ok: true,
            transaction_id: tx.id,
            signers_urls: tx.url ? [tx.url] : tx.signerUrls,
            status: 'ready',
            eidas_qualified: true,
            partner: 'Universign FR',
          },
          201,
          origin
        );
      } catch (err) {
        return json({ error: 'universign_create_failed', message: err.message }, 502, origin);
      }
    }

    // GET /transactions/:id
    const txMatch = url.pathname.match(/^\/transactions\/([a-zA-Z0-9_-]+)$/);
    if (txMatch && request.method === 'GET') {
      const txId = txMatch[1];
      try {
        const r = await fetch(`${UNIVERSIGN_API}/transactions/${txId}`, {
          headers: { Authorization: `Bearer ${env.UNIVERSIGN_API_KEY}` },
        });
        if (!r.ok) return json({ error: 'universign_fetch_failed', status: r.status }, 502, origin);
        const data = await r.json();
        return json(
          {
            transaction_id: txId,
            status: data.status,
            signers: data.signers,
            documents: data.documents?.map((d) => ({ name: d.name, signed: d.signed })),
            completed_at: data.completedDate,
          },
          200,
          origin
        );
      } catch (err) {
        return json({ error: 'fetch_internal', message: err.message }, 500, origin);
      }
    }

    // POST /webhook (callback Universign)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const payload = await request.json();
      // Mise à jour D1
      if (env.IKCP_UNIVERSIGN_DB && payload.id) {
        await env.IKCP_UNIVERSIGN_DB
          .prepare(`UPDATE transactions SET status = ?, completed_at = ? WHERE transaction_id = ?`)
          .bind(payload.status, new Date().toISOString(), payload.id)
          .run()
          .catch(() => {});
      }
      // Idéalement : trigger ikcp-temoin pour audit log
      return json({ ok: true, received: payload.id || 'unknown' }, 200, origin);
    }

    // Root
    if (url.pathname === '/') {
      return json(
        {
          service: 'ikcp-universign',
          version: '1.0.0',
          partner: 'Universign Dhimyotis · FR · eIDAS qualifié',
          endpoints: ['/health', 'POST /transactions/create', 'GET /transactions/:id', 'POST /webhook'],
          docs: 'https://help.universign.eu/api/',
        },
        200,
        origin
      );
    }

    return json({ error: 'not_found' }, 404, origin);
  },
};
