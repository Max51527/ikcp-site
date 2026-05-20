/**
 * ikcp-feedback — Collecte des attentes bêta fondateurs IKCP
 *
 * Fonctions :
 *   POST /feedback       — Soumettre un feedback
 *   GET  /feedbacks      — Lister tous les feedbacks (admin, secret requis)
 *   GET  /health         — Statut worker
 *
 * Secrets requis (npx wrangler secret put) :
 *   BREVO_API_KEY        — Notifications email (Brevo / Sendinblue)
 *   ANTHROPIC_API_KEY    — Résumé IA du besoin (optionnel mais recommandé)
 *   ADMIN_SECRET         — Header x-admin-secret pour GET /feedbacks
 *
 * Bindings wrangler.toml (optionnel mais recommandé) :
 *   FEEDBACK_DB          — D1 SQLite Paris (persistance long terme)
 *
 * Déploiement :
 *   cd workers/ikcp-feedback
 *   npx wrangler d1 create ikcp-feedback-db --location weur
 *   # copier l'ID dans wrangler.toml, puis :
 *   npx wrangler d1 execute ikcp-feedback-db --remote --file=schema.sql
 *   npx wrangler secret put BREVO_API_KEY
 *   npx wrangler secret put ANTHROPIC_API_KEY
 *   npx wrangler secret put ADMIN_SECRET
 *   npx wrangler deploy
 *
 * © 2026 IKCP · ORIAS 23001568 · RGPD souverain France (Cloudflare WEUR)
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'null', '',
];

function corsHeaders(origin) {
  const ok =
    ALLOWED_ORIGINS.includes(origin) ||
    origin?.endsWith('.ikcp.eu') ||
    origin?.endsWith('.pages.dev') ||
    origin?.endsWith('.workers.dev');
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── Health check ─────────────────────────────────────
    if (url.pathname === '/health') {
      return json({
        status: 'ok',
        service: 'ikcp-feedback',
        weur: true,
        configured: {
          brevo:     !!env.BREVO_API_KEY,
          anthropic: !!env.ANTHROPIC_API_KEY,
          d1:        !!env.FEEDBACK_DB,
        },
      }, 200, origin);
    }

    // ── POST /feedback ────────────────────────────────────
    if (url.pathname === '/feedback' && request.method === 'POST') {
      return handleFeedback(request, env, origin);
    }

    // ── GET /feedbacks (admin) ────────────────────────────
    if (url.pathname === '/feedbacks' && request.method === 'GET') {
      return handleListFeedbacks(request, env, origin);
    }

    return json({ error: 'not_found' }, 404, origin);
  },
};

// ══════════════════════════════════════════════════════════
//  HANDLER PRINCIPAL — Enregistrer un feedback
// ══════════════════════════════════════════════════════════
async function handleFeedback(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON invalide' }, 400, origin);
  }

  const { besoin, categories, priorite, email, page } = body;

  // Validation basique
  if (!besoin || besoin.trim().length < 10) {
    return json({ ok: false, error: 'Description trop courte (min. 10 caractères)' }, 400, origin);
  }

  const id  = 'FB-' + Date.now().toString(36).toUpperCase();
  const ts  = new Date().toISOString();
  const catsStr = Array.isArray(categories) ? categories.join(', ') : (categories || '—');
  const prio    = priorite || '—';
  const emailSafe = (email || '').substring(0, 254);
  const pageSafe  = (page || '').substring(0, 200);

  // ── 1. Stockage D1 ───────────────────────────────────
  if (env.FEEDBACK_DB) {
    try {
      await env.FEEDBACK_DB.prepare(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id       TEXT PRIMARY KEY,
          ts       TEXT NOT NULL,
          besoin   TEXT NOT NULL,
          categories TEXT,
          priorite TEXT,
          email    TEXT,
          page     TEXT
        )
      `).run();

      await env.FEEDBACK_DB.prepare(
        `INSERT INTO feedbacks (id, ts, besoin, categories, priorite, email, page)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, ts, besoin.trim(), catsStr, prio, emailSafe, pageSafe).run();
    } catch (err) {
      console.error('[D1]', err.message);
      // Non bloquant — on continue avec email
    }
  }

  // ── 2. Résumé IA (Claude Haiku) ───────────────────────
  let aiSummary = '';
  if (env.ANTHROPIC_API_KEY) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 80,
          messages: [{
            role: 'user',
            content: `Feedback bêta testeur Family Office IKCP.
En 1 courte phrase (12 mots max), résume le besoin fonctionnel clé :
"${besoin.substring(0, 400)}"`,
          }],
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        aiSummary = aiData.content?.[0]?.text?.trim() || '';
      }
    } catch (err) {
      console.error('[AI]', err.message);
    }
  }

  // ── 3. Notification email (Brevo) ─────────────────────
  if (env.BREVO_API_KEY) {
    try {
      const catBadges = catsStr.split(',').map(c =>
        `<span style="display:inline-block;background:#f4efe7;border:1px solid #e0d9d0;border-radius:12px;padding:3px 10px;font-size:12px;margin:2px">${c.trim()}</span>`
      ).join(' ');

      const htmlBody = `
        <div style="font-family:'Outfit',sans-serif;max-width:600px;margin:0 auto;background:#fff">
          <div style="background:#1B2A4A;padding:22px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;color:#fff;font-size:17px;font-weight:600">
              💬 Feedback Bêta IKCP — ${id}
            </h2>
            <p style="margin:5px 0 0;color:rgba(255,255,255,.6);font-size:12px">
              ${new Date(ts).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} · ${pageSafe || 'family-office.html'}
            </p>
          </div>
          <div style="background:#FAFAF8;padding:24px;border:1px solid #e0d9d0;border-radius:0 0 8px 8px">
            ${aiSummary ? `
            <div style="background:#fff;border-left:3px solid #C9A96E;padding:10px 14px;margin-bottom:20px;border-radius:0 6px 6px 0">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8B6F3F">🤖 Résumé IA</span><br>
              <span style="font-size:14px;color:#2C2418;font-style:italic">${aiSummary}</span>
            </div>` : ''}
            <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1B2A4A;margin:0 0 8px">Besoin exprimé</p>
            <blockquote style="margin:0 0 20px;padding:12px 16px;background:#fff;border:1px solid #e0d9d0;border-left:3px solid #1B2A4A;border-radius:0 6px 6px 0;color:#2C2418;font-size:14px;line-height:1.7">
              ${besoin.trim().replace(/</g,'&lt;').replace(/\n/g,'<br>')}
            </blockquote>
            <table style="font-size:13px;width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:8px 12px 8px 0;color:#6B5D52;width:110px;vertical-align:top">Catégories</td>
                <td style="padding:8px 0">${catBadges}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px 8px 0;color:#6B5D52">Priorité</td>
                <td style="padding:8px 0"><b>${prio}</b></td>
              </tr>
              <tr>
                <td style="padding:8px 12px 8px 0;color:#6B5D52">Contact</td>
                <td style="padding:8px 0">${emailSafe ? `<a href="mailto:${emailSafe}" style="color:#8B6F3F">${emailSafe}</a>` : '<span style="color:#999">—</span>'}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px 8px 0;color:#6B5D52">ID</td>
                <td style="padding:8px 0"><code style="font-size:12px;color:#6B5D52">${id}</code></td>
              </tr>
            </table>
          </div>
          <p style="font-size:11px;color:#999;text-align:center;padding:12px;margin:0">
            IKCP IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · Hébergement WEUR Paris
          </p>
        </div>
      `;

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender:  { name: 'IKCP Feedback', email: 'maxime@ikcp.fr' },
          to:      [{ email: 'maxime@ikcp.fr', name: 'Maxime Juveneton' }],
          subject: `[Feedback Bêta] ${id} · ${catsStr.split(',')[0]?.trim() || 'Général'}`,
          htmlContent: htmlBody,
        }),
      });
    } catch (err) {
      console.error('[Brevo]', err.message);
    }
  }

  return json({
    ok: true,
    id,
    message: 'Merci pour votre retour — Maxime lit chaque feedback personnellement.',
  }, 200, origin);
}

// ══════════════════════════════════════════════════════════
//  HANDLER ADMIN — Lister les feedbacks
// ══════════════════════════════════════════════════════════
async function handleListFeedbacks(request, env, origin) {
  const secret = request.headers.get('x-admin-secret');
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: 'Non autorisé' }, 401, origin);
  }
  if (!env.FEEDBACK_DB) {
    return json({ error: 'D1 non configurée — aucun feedback stocké' }, 503, origin);
  }
  try {
    const url    = new URL(request.url);
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const rows   = await env.FEEDBACK_DB.prepare(
      `SELECT * FROM feedbacks ORDER BY ts DESC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();
    const count  = await env.FEEDBACK_DB.prepare('SELECT COUNT(*) as n FROM feedbacks').first();
    return json({ ok: true, total: count?.n, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ error: err.message }, 500, origin);
  }
}
