/**
 * IKCP Prospect Worker — Cloudflare Workers
 * Pipeline : Diagnostic IKCP → Notion DB → Notification email
 * 
 * Variables d'environnement à configurer dans Cloudflare Dashboard :
 *   NOTION_TOKEN     = secret_xxxxxxxxxxxxxxxxxxxx
 *   NOTION_DB_ID     = 47283ea3419f4d1b80cade61d7b65791
 *   NOTIFY_EMAIL     = maxime@ikcp.eu  (optionnel — pour notif via MailChannels)
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, isAllowed),
      });
    }

    // ── Health check ──
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', service: 'ikcp-prospect-worker' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, isAllowed) },
      });
    }

    // ── POST : traitement prospect ──
    if (request.method === 'POST') {
      let data;
      try {
        data = await request.json();
      } catch {
        return errorResponse('Invalid JSON', 400, origin, isAllowed);
      }

      // Validation minimale
      if (!data.email || !data.prenom) {
        return errorResponse('Champs requis manquants (prenom, email)', 422, origin, isAllowed);
      }

      const results = await Promise.allSettled([
        pushToNotion(data, env),
        sendNotification(data, env),
      ]);

      const notionOk  = results[0].status === 'fulfilled';
      const notifOk   = results[1].status === 'fulfilled';
      const notionErr = results[0].reason?.message || null;

      return new Response(JSON.stringify({
        success: notionOk,
        notion: notionOk ? 'ok' : `error: ${notionErr}`,
        notification: notifOk ? 'sent' : 'skipped',
        prospect: { prenom: data.prenom, score: data.score },
      }), {
        status: notionOk ? 200 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, isAllowed) },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

// ────────────────────────────────────────────────
// NOTION : créer une page dans la DB prospects
// ────────────────────────────────────────────────
async function pushToNotion(data, env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) {
    throw new Error('NOTION_TOKEN ou NOTION_DB_ID non configurés');
  }

  // Score → statut automatique
  const score = parseInt(data.score) || 0;
  const niveau = score >= 70 ? 'Solide' : score >= 45 ? 'À optimiser' : 'Vigilance';

  const body = {
    parent: { database_id: env.NOTION_DB_ID },
    properties: {
      // ── Titre (nom de la page) ──
      'Nom': {
        title: [{ text: { content: `${data.prenom} — Score ${score}/100` } }]
      },
      // ── Coordonnées ──
      'Email': {
        email: data.email
      },
      'Prénom': {
        rich_text: [{ text: { content: data.prenom || '' } }]
      },
      // ── Score & profil ──
      'Score': {
        number: score
      },
      'Niveau': {
        select: { name: niveau }
      },
      'Statut': {
        select: { name: 'Nouveau' }
      },
      // ── Données patrimoniales ──
      'Patrimoine net': {
        number: parseInt(data.patrimoineNet) || 0
      },
      'IR estimé': {
        number: parseInt(data.ir) || 0
      },
      'TMI': {
        rich_text: [{ text: { content: data.tmi ? `${Math.round(data.tmi * 100)}%` : '' } }]
      },
      'Droits succession': {
        number: parseInt(data.succession) || 0
      },
      // ── Profil ──
      'Âge': {
        number: parseInt(data.age) || 0
      },
      'Situation': {
        select: { name: data.situation || 'Non renseigné' }
      },
      'Statut pro': {
        rich_text: [{ text: { content: data.statut || '' } }]
      },
      'Enfants': {
        number: parseInt(data.enfants) || 0
      },
      // ── Alertes & leviers ──
      'Alertes': {
        rich_text: [{ text: { content: data.alertes || '' } }]
      },
      'Leviers': {
        rich_text: [{ text: { content: data.leviers || '' } }]
      },
      // ── Source & date ──
      'Source': {
        select: { name: data.source || 'Diagnostic IKCP' }
      },
      'Date': {
        date: { start: new Date().toISOString().split('T')[0] }
      },
    },
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API ${res.status}: ${err}`);
  }

  return await res.json();
}

// ────────────────────────────────────────────────
// NOTIFICATION : email via MailChannels (gratuit sur Cloudflare Workers)
// ────────────────────────────────────────────────
async function sendNotification(data, env) {
  const to = env.NOTIFY_EMAIL;
  if (!to) return null; // optionnel

  const score = parseInt(data.score) || 0;
  const emoji = score >= 70 ? '🟢' : score >= 45 ? '🟡' : '🔴';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;padding:20px;background:#f9f6f0;border-radius:10px;">
      <h2 style="color:#1f1a16;border-bottom:2px solid #b8956e;padding-bottom:8px;">
        ${emoji} Nouveau prospect IKCP
      </h2>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#907b65;width:140px;">Prénom</td><td style="font-weight:bold;">${data.prenom}</td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">Email</td><td><a href="mailto:${data.email}">${data.email}</a></td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">Score</td><td style="font-weight:bold;color:${score>=70?'#15803d':score>=45?'#b45309':'#b91c1c'};">${score}/100</td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">Patrimoine net</td><td>${Number(data.patrimoineNet||0).toLocaleString('fr-FR')} €</td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">TMI</td><td>${data.tmi ? Math.round(data.tmi*100)+'%' : 'N/R'}</td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">Droits succession</td><td>${Number(data.succession||0).toLocaleString('fr-FR')} €</td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">Statut pro</td><td>${data.statut || 'N/R'}</td></tr>
        <tr><td style="padding:6px 0;color:#907b65;">Âge</td><td>${data.age || 'N/R'} ans</td></tr>
      </table>
      ${data.alertes ? `<div style="margin-top:12px;padding:10px;background:#fee2e2;border-radius:6px;font-size:12px;"><strong>Alertes :</strong> ${data.alertes}</div>` : ''}
      <div style="margin-top:16px;text-align:center;">
        <a href="https://www.notion.so/ikcp/47283ea3419f4d1b80cade61d7b65791" 
           style="background:#1f1a16;color:#b8956e;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">
          Voir dans Notion →
        </a>
      </div>
      <p style="font-size:10px;color:#907b65;margin-top:16px;text-align:center;">IKCP · ikcp.eu · ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
  `;

  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, name: 'Maxime IKCP' }] }],
      from: { email: 'noreply@ikcp.eu', name: 'IKCP Prospects' },
      subject: `${emoji} Nouveau prospect — ${data.prenom} (${score}/100)`,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!res.ok && res.status !== 202) {
    // Non bloquant — on loggue juste
    console.error('MailChannels error:', res.status);
  }

  return res.status;
}

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────
function corsHeaders(origin, isAllowed) {
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function errorResponse(message, status, origin, isAllowed) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, isAllowed) },
  });
}
