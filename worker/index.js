/**
 * IKCP Prospect Worker — Cloudflare Workers
 * Pipeline : Diagnostic ikcp.eu → Notion DB → Email Maxime + Email Prospect
 *
 * Secrets Cloudflare (Settings → Variables and Secrets) :
 *   NOTION_TOKEN     = ntn_xxxxxxxxxxxxxxxxxxxx
 *   NOTION_DB_ID     = 47283ea3419f4d1b80cade61d7b65791
 *   NOTIFY_EMAIL     = maxime@ikcp.eu
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, isAllowed) });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', service: 'ikcp-prospect-worker' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, isAllowed) },
      });
    }

    if (request.method === 'POST') {
      let data;
      try { data = await request.json(); }
      catch { return errorResponse('Invalid JSON', 400, origin, isAllowed); }

      if (!data.email || !data.prenom) {
        return errorResponse('Champs requis manquants (prenom, email)', 422, origin, isAllowed);
      }

      const results = await Promise.allSettled([
        pushToNotion(data, env),
        sendNotificationMaxime(data, env),
        sendEmailProspect(data, env),
      ]);

      const notionOk  = results[0].status === 'fulfilled';
      const notifOk   = results[1].status === 'fulfilled';
      const prospectOk = results[2].status === 'fulfilled';

      return new Response(JSON.stringify({
        success: notionOk,
        notion: notionOk ? 'ok' : `error: ${results[0].reason?.message}`,
        notification_maxime: notifOk ? 'sent' : 'skipped',
        email_prospect: prospectOk ? 'sent' : 'skipped',
        prospect: { prenom: data.prenom, score: data.score },
      }), {
        status: notionOk ? 200 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, isAllowed) },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

// ─────────────────────────────────────────────────────────
// NOTION
// ─────────────────────────────────────────────────────────
async function pushToNotion(data, env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) throw new Error('Secrets Notion manquants');
  const score = parseInt(data.score) || 0;
  const niveau = score >= 70 ? 'Solide' : score >= 45 ? 'À optimiser' : 'Vigilance';

  const body = {
    parent: { database_id: env.NOTION_DB_ID },
    properties: {
      'Nom':               { title: [{ text: { content: `${data.prenom} — Score ${score}/100` } }] },
      'Email':             { email: data.email },
      'Prénom':            { rich_text: [{ text: { content: data.prenom || '' } }] },
      'Score':             { number: score },
      'Niveau':            { select: { name: niveau } },
      'Statut':            { select: { name: 'Nouveau' } },
      'Patrimoine net':    { number: parseInt(data.patrimoineNet) || 0 },
      'IR estimé':         { number: parseInt(data.ir) || 0 },
      'TMI':               { rich_text: [{ text: { content: data.tmi ? `${Math.round(data.tmi * 100)}%` : '' } }] },
      'Droits succession': { number: parseInt(data.succession) || 0 },
      'Âge':               { number: parseInt(data.age) || 0 },
      'Situation':         { select: { name: data.situation || 'Non renseigné' } },
      'Statut pro':        { rich_text: [{ text: { content: data.statut || '' } }] },
      'Enfants':           { number: parseInt(data.enfants) || 0 },
      'Alertes':           { rich_text: [{ text: { content: data.alertes || '' } }] },
      'Leviers':           { rich_text: [{ text: { content: data.leviers || '' } }] },
      'Source':            { select: { name: data.source || 'Diagnostic IKCP' } },
      'Date':              { date: { start: new Date().toISOString().split('T')[0] } },
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

  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ─────────────────────────────────────────────────────────
// EMAIL ALERTE → MAXIME (notification immédiate)
// ─────────────────────────────────────────────────────────
async function sendNotificationMaxime(data, env) {
  const to = env.NOTIFY_EMAIL || 'maxime@ikcp.eu';
  const score = parseInt(data.score) || 0;
  const emoji = score >= 70 ? '🟢' : score >= 45 ? '🟡' : '🔴';
  const scoreColor = score >= 70 ? '#15803d' : score >= 45 ? '#b45309' : '#b91c1c';
  const scoreBg    = score >= 70 ? '#dcfce7' : score >= 45 ? '#fef3c7' : '#fee2e2';

  const alertes = (data.alertes || '').split(' | ').filter(Boolean);
  const leviers = (data.leviers || '').split(' | ').filter(Boolean);
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f9f6f0;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#1f1a16;padding:24px 32px;border-radius:16px 16px 0 0;text-align:center">
    <div style="color:#b8956e;font-size:24px;font-weight:bold;letter-spacing:3px">IKCP.</div>
    <div style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">${emoji} Nouveau prospect — Alerte immédiate</div>
  </td></tr>

  <!-- SCORE HERO -->
  <tr><td style="background:#fff;padding:28px 32px 0;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2">
    <table width="100%"><tr>
      <td style="background:${scoreBg};border-radius:12px;padding:20px;text-align:center;width:48%">
        <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:${scoreColor}">Score patrimonial</div>
        <div style="font-size:42px;font-weight:bold;color:${scoreColor};line-height:1.1">${score}</div>
        <div style="font-size:12px;color:${scoreColor}">/ 100</div>
      </td>
      <td style="width:4%"></td>
      <td style="vertical-align:top;padding-top:8px;width:48%">
        <div style="font-size:20px;font-weight:bold;color:#1f1a16">${data.prenom}</div>
        <div style="font-size:13px;color:#b8956e;margin-top:2px">${data.email}</div>
        <div style="font-size:12px;color:#9e9080;margin-top:8px">${data.age || '?'} ans · ${data.situation || 'N/R'}</div>
        <div style="font-size:12px;color:#9e9080">${data.statut || 'N/R'} · ${data.enfants || 0} enfant${data.enfants > 1 ? 's' : ''}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- CHIFFRES CLÉS -->
  <tr><td style="background:#fff;padding:20px 32px;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#f9f6f0;border-radius:10px;padding:14px;text-align:center;width:23%">
          <div style="font-size:9px;color:#9e9080;text-transform:uppercase;letter-spacing:1px">Patrimoine</div>
          <div style="font-size:16px;font-weight:bold;color:#1f1a16;margin-top:4px">${fmt(data.patrimoineNet)} €</div>
        </td>
        <td style="width:2%"></td>
        <td style="background:#f9f6f0;border-radius:10px;padding:14px;text-align:center;width:23%">
          <div style="font-size:9px;color:#9e9080;text-transform:uppercase;letter-spacing:1px">IR estimé</div>
          <div style="font-size:16px;font-weight:bold;color:#1f1a16;margin-top:4px">${fmt(data.ir)} €</div>
        </td>
        <td style="width:2%"></td>
        <td style="background:#f9f6f0;border-radius:10px;padding:14px;text-align:center;width:23%">
          <div style="font-size:9px;color:#9e9080;text-transform:uppercase;letter-spacing:1px">TMI</div>
          <div style="font-size:16px;font-weight:bold;color:#1f1a16;margin-top:4px">${data.tmi ? Math.round(data.tmi*100)+'%' : 'N/R'}</div>
        </td>
        <td style="width:2%"></td>
        <td style="background:#fee2e2;border-radius:10px;padding:14px;text-align:center;width:23%">
          <div style="font-size:9px;color:#991b1b;text-transform:uppercase;letter-spacing:1px">Succession</div>
          <div style="font-size:16px;font-weight:bold;color:#b91c1c;margin-top:4px">${fmt(data.succession)} €</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ALERTES -->
  ${alertes.length ? `<tr><td style="background:#fff;padding:0 32px 16px;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2">
    <div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 16px">
      <div style="font-size:10px;font-weight:bold;color:#991b1b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">⚡ Alertes détectées</div>
      ${alertes.map(a => `<div style="font-size:12px;color:#7f1d1d;padding:2px 0">• ${a}</div>`).join('')}
    </div>
  </td></tr>` : ''}

  <!-- LEVIERS -->
  ${leviers.length ? `<tr><td style="background:#fff;padding:0 32px 16px;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2">
    <div style="background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 16px">
      <div style="font-size:10px;font-weight:bold;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">💡 Leviers identifiés</div>
      ${leviers.map(l => `<div style="font-size:12px;color:#14532d;padding:2px 0">• ${l}</div>`).join('')}
    </div>
  </td></tr>` : ''}

  <!-- CTA -->
  <tr><td style="background:#fff;padding:16px 32px 28px;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2;text-align:center">
    <a href="https://www.notion.so/ikcp/47283ea3419f4d1b80cade61d7b65791" style="display:inline-block;background:#1f1a16;color:#b8956e;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;margin-right:8px">Voir dans Notion →</a>
    <a href="mailto:${data.email}" style="display:inline-block;background:#b8956e;color:#1f1a16;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Répondre →</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f9f6f0;padding:16px 32px;border-radius:0 0 16px 16px;border:1px solid #e5ded2;border-top:none;text-align:center">
    <div style="font-size:10px;color:#9e9080">IKCP · ikcp.eu · ${new Date().toLocaleDateString('fr-FR')} · ORIAS 23001568</div>
  </td></tr>

</table></td></tr></table></body></html>`;

  return sendEmail({
    to: { email: to, name: 'Maxime Juveneton' },
    from: { email: 'noreply@ikcp.eu', name: 'IKCP Prospects' },
    subject: `${emoji} Nouveau prospect — ${data.prenom} · ${score}/100 · ${fmt(data.patrimoineNet)} €`,
    html,
  });
}

// ─────────────────────────────────────────────────────────
// EMAIL PROSPECT (bilan SANS/AVEC stratégie)
// ─────────────────────────────────────────────────────────
async function sendEmailProspect(data, env) {
  if (!data.email) return null;

  const score = parseInt(data.score) || 0;
  const patrimoineNet = parseInt(data.patrimoineNet) || 0;
  const succession = parseInt(data.succession) || 0;
  const enfants = parseInt(data.enfants) || 0;
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');

  // Calcul SANS stratégie = droits succession bruts
  const sansDroits = succession;

  // Calcul AVEC stratégie = estimation optimisée
  // Assurance-vie : jusqu'à 152 500€/bénéficiaire exonérés
  const avExo = Math.min(patrimoineNet * 0.3, 152500 * Math.max(enfants, 1));
  // Donations : abattement 100k/enfant
  const donAbattement = 100000 * Math.max(enfants, 1);
  // Base taxable optimisée
  const baseTaxableAvec = Math.max(0, patrimoineNet - avExo - donAbattement);
  // Droits sur base optimisée (barème simplifié ligne directe)
  const avecDroits = Math.round(calculDroitsSimplifie(baseTaxableAvec, enfants));
  const economie = Math.max(0, sansDroits - avecDroits);

  const alertes = (data.alertes || '').split(' | ').filter(Boolean);
  const leviers = (data.leviers || '').split(' | ').filter(Boolean);

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9f6f0;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#1f1a16;padding:28px 32px;text-align:center;border-radius:16px 16px 0 0">
    <div style="color:#b8956e;font-size:26px;font-weight:bold;letter-spacing:3px">IKCP.</div>
    <div style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:2.5px;text-transform:uppercase;margin-top:4px">Cabinet spécialisé en Protection &amp; Transmission du Patrimoine</div>
    <div style="color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:3px;margin-top:4px">Ardèche · Combloux · Megève</div>
  </td></tr>

  <!-- CORPS -->
  <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2">

    <p style="font-size:17px;color:#4d3f33;margin:0 0 16px">Bonjour <strong>${data.prenom}</strong>,</p>

    <p style="font-size:15px;color:#6d5c4a;line-height:1.7;margin:0 0 24px">Merci d'avoir utilisé le <strong style="color:#4d3f33">Diagnostic Patrimonial IKCP</strong>. Voici vos résultats calculés sur la base des barèmes officiels 2026, ainsi que les pistes de réflexion identifiées.</p>

    <!-- SCORE -->
    <table width="100%" style="margin-bottom:20px"><tr>
      <td style="background:#f9f6f0;border-radius:12px;padding:16px 20px;text-align:center">
        <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:#b8956e">Score patrimonial</div>
        <div style="font-size:40px;font-weight:bold;color:${score>=70?'#15803d':score>=45?'#b45309':'#b91c1c'};line-height:1.1;margin:6px 0">${score}<span style="font-size:20px">/100</span></div>
        <div style="font-size:12px;color:#9e9080">${score>=70?'Patrimoine solide':score>=45?'Optimisations possibles':'Points d\'attention identifiés'}</div>
      </td>
    </tr></table>

    <!-- SUCCESSION SANS/AVEC -->
    ${succession > 0 ? `
    <p style="font-size:14px;font-weight:bold;color:#1f1a16;margin:0 0 12px">Votre succession estimée</p>

    <table width="100%" style="margin-bottom:10px"><tr>
      <td style="background:#fef2f2;padding:16px 20px;border-radius:12px;border:1px solid #fecaca">
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#dc2626">Sans anticipation</div>
        <div style="font-size:28px;font-weight:bold;color:#dc2626">${fmt(sansDroits)} €</div>
        <div style="font-size:11px;color:#9e9080;margin-top:4px">de droits à payer par vos héritiers</div>
      </td>
    </tr></table>

    <table width="100%" style="margin-bottom:10px"><tr>
      <td style="background:#f0fdf4;padding:16px 20px;border-radius:12px;border:1px solid #bbf7d0">
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#16a34a">Avec stratégie patrimoniale</div>
        <div style="font-size:28px;font-weight:bold;color:#16a34a">${fmt(avecDroits)} €</div>
        <div style="font-size:11px;color:#9e9080;margin-top:4px">assurance-vie + donations progressives + démembrement</div>
      </td>
    </tr></table>

    <table width="100%" style="margin-bottom:24px"><tr>
      <td style="background:#1f1a16;padding:20px;border-radius:12px;text-align:center">
        <div style="font-size:10px;color:#b8956e;text-transform:uppercase;letter-spacing:2px;font-weight:bold">Économie potentielle</div>
        <div style="font-size:34px;font-weight:bold;color:#ffffff">${fmt(economie)} €</div>
      </td>
    </tr></table>

    <p style="font-size:12px;color:#9e9080;line-height:1.6;margin:0 0 24px;font-style:italic">Patrimoine estimé : ${fmt(patrimoineNet)} € · ${enfants} enfant${enfants>1?'s':''}<br>Résultats indicatifs — barèmes CGI 2026. Chaque situation a ses spécificités.</p>
    ` : ''}

    <!-- SÉPARATEUR -->
    <table width="100%" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5ded2"></td></tr></table>

    <!-- ALERTES -->
    ${alertes.length ? `
    <p style="font-size:14px;font-weight:bold;color:#1f1a16;margin:0 0 12px">⚡ Points d'attention identifiés</p>
    <div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px">
      ${alertes.map(a => `<div style="font-size:13px;color:#7f1d1d;padding:3px 0">• ${a}</div>`).join('')}
    </div>` : ''}

    <!-- PISTES DE RÉFLEXION -->
    ${leviers.length ? `
    <p style="font-size:14px;font-weight:bold;color:#1f1a16;margin:0 0 12px">💡 Pistes de réflexion personnalisées</p>
    ${leviers.map(l => `
    <div style="background:#f9f6f0;border-left:3px solid #b8956e;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px">
      <div style="font-size:13px;color:#4d3f33;font-weight:bold">${l}</div>
      <div style="font-size:11px;color:#9e9080;margin-top:4px">Analyse complète lors de votre échange avec Maxime.</div>
    </div>`).join('')}
    <div style="margin-bottom:24px"></div>` : ''}

    <!-- SÉPARATEUR -->
    <table width="100%" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5ded2"></td></tr></table>

    <!-- CTA -->
    <p style="font-size:18px;color:#1f1a16;font-weight:bold;margin:0 0 8px">Et si on regardait votre situation en détail ?</p>
    <p style="font-size:14px;color:#6d5c4a;line-height:1.6;margin:0 0 24px">Régime matrimonial, assurance-vie existante, donations déjà réalisées, structure du patrimoine... une analyse complète révèle d'autres leviers. Aucun engagement.</p>

    <table width="100%" style="margin-bottom:28px"><tr><td align="center">
      <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" style="display:inline-block;background:#1f1a16;color:#ffffff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px;font-family:Georgia,serif">Échanger avec Maxime →</a>
    </td></tr></table>

    <!-- SÉPARATEUR -->
    <table width="100%" style="margin-bottom:20px"><tr><td style="border-top:1px solid #e5ded2"></td></tr></table>

    <!-- SIGNATURE -->
    <p style="font-size:15px;font-weight:bold;color:#1f1a16;margin:0">Maxime Juveneton</p>
    <p style="font-size:13px;color:#b8956e;margin:2px 0 0">Fondateur — IKCP</p>
    <p style="font-size:12px;color:#9e9080;margin:4px 0 0">ORIAS 23001568 · 100% indépendant · <a href="https://ikcp.eu" style="color:#b8956e;text-decoration:none">ikcp.eu</a></p>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 32px;text-align:center;border-radius:0 0 16px 16px;border-left:1px solid #e5ded2;border-right:1px solid #e5ded2;border-bottom:1px solid #e5ded2">
    <p style="font-size:10px;color:#9e9080;margin:0">IKCP — SIREN 947 972 436 · <a href="https://ikcp.eu" style="color:#b8956e;text-decoration:none">ikcp.eu</a></p>
    <p style="font-size:10px;color:#c8bfb5;margin:4px 0 0">Ce message est envoyé suite à votre utilisation du diagnostic patrimonial sur ikcp.eu.<br>Résultats indicatifs — ne constitue pas un conseil en investissement au sens MIF II.</p>
  </td></tr>

</table></td></tr></table></body></html>`;

  return sendEmail({
    to: { email: data.email, name: data.prenom },
    from: { email: 'noreply@ikcp.eu', name: 'Maxime Juveneton — IKCP' },
    subject: `Votre diagnostic patrimonial IKCP — ${data.prenom}`,
    html,
  });
}

// ─────────────────────────────────────────────────────────
// HELPER : calcul droits succession simplifié (barème 2026)
// ─────────────────────────────────────────────────────────
function calculDroitsSimplifie(base, nbEnfants) {
  if (nbEnfants < 1 || base <= 0) return 0;
  const partParEnfant = base / nbEnfants;
  const tranches = [
    { max: 8072,    taux: 0.05 },
    { max: 12109,   taux: 0.10 },
    { max: 15932,   taux: 0.15 },
    { max: 552324,  taux: 0.20 },
    { max: 902838,  taux: 0.30 },
    { max: 1805677, taux: 0.40 },
    { max: Infinity, taux: 0.45 },
  ];
  let droitsParEnfant = 0, prev = 0;
  for (const t of tranches) {
    if (partParEnfant <= prev) break;
    droitsParEnfant += (Math.min(partParEnfant, t.max) - prev) * t.taux;
    prev = t.max;
  }
  return droitsParEnfant * nbEnfants;
}

// ─────────────────────────────────────────────────────────
// HELPER : envoi email via MailChannels
// ─────────────────────────────────────────────────────────
async function sendEmail({ to, from, subject, html }) {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [to] }],
      from,
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok && res.status !== 202) console.error('MailChannels error:', res.status);
  return res.status;
}

// ─────────────────────────────────────────────────────────
// HELPERS CORS
// ─────────────────────────────────────────────────────────
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
