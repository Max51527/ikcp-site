/**
 * IKCP Prospect Worker v1.3
 *
 * v1.3 (2026-05-01) :
 * - NEW endpoint Marcel synthèse : type='marcel_synthesis_request'
 *   → envoie 2 emails Resend (visiteur + Maxime)
 * - Calendly URL retirée du mail prospect → mailto:maxime@ikcp.fr
 * - Type 'marcel_send_to_maxime' supporté (notif Maxime)
 *
 * v1.2 :
 * - BCC maxime@ikcp.eu sur le mail prospect
 * - Mail interne enrichi (briefing 7 blocs)
 * - Endpoint /bilan/:id (KV 30j)
 *
 * Bindings attendus :
 * - NOTION_TOKEN, NOTION_DB_ID  (secrets)
 * - RESEND_API_KEY              (secret)
 * - NOTIFY_EMAIL                (var, defaut maxime@ikcp.eu)
 * - IDEMPOTENCY                 (KV namespace)
 * - RATE_LIMIT                  (KV namespace, optionnel)
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://ikcp.fr',
  'https://www.ikcp.fr'
];

const RATE_LIMIT = { window: 60, max: 5 };
const IDEMPOTENCY_TTL = 300;
const BILAN_TTL = 60 * 60 * 24 * 30;
const CONSENT_VERSION = 'v1-2026-04';

const MAILTO_MAXIME = 'mailto:maxime@ikcp.fr?subject=Demande%20d%27%C3%A9change%20%E2%80%94%20IKCP&body=Bonjour%20Maxime%2C%0D%0A%0D%0AContexte%20de%20ma%20demande%20%3A%20%0D%0A%0D%0A';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return corsPreflight(origin);
    if (url.pathname === '/health') return json({ status: 'ok', version: '1.3', ts: new Date().toISOString() }, 200, origin);

    if (url.pathname.startsWith('/bilan/') && request.method === 'GET') {
      return handleBilanPage(url.pathname.slice(7), env);
    }

    if (request.method === 'GET') {
      return json({ status: 'ok', service: 'ikcp-prospect', version: '1.3' }, 200, origin);
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    // Route POST par type (pour Marcel) sinon flux diagnostic classique
    let payload = null;
    try {
      const text = await request.clone().text();
      payload = text ? JSON.parse(text) : {};
    } catch (e) { payload = {}; }

    if (payload && payload.type === 'marcel_synthesis_request') {
      return handleMarcelSynthesis(request, env, ctx, origin, payload);
    }
    if (payload && payload.type === 'marcel_send_to_maxime') {
      return handleMarcelSendToMaxime(request, env, ctx, origin, payload);
    }
    return handleDiagnostic(request, env, ctx, origin);
  }
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function corsPreflight(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

// ────────────────────────────────────────────────────────────────────
// NOUVEAU — Marcel synthèse : envoie 2 emails (visiteur + Maxime)
// ────────────────────────────────────────────────────────────────────
async function handleMarcelSynthesis(request, env, ctx, origin, data) {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return json({ success: false, error: 'Origin not allowed' }, 403, origin);
  }

  // Validation minimale (visitor_email obligatoire)
  const email = (data.visitor_email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, error: 'Email invalide' }, 400, origin);
  }
  if (!data.body || data.body.length < 50) {
    return json({ success: false, error: 'Body trop court' }, 400, origin);
  }

  // Rate limit
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlOk = await checkRateLimit(env, ip);
  if (!rlOk) return json({ success: false, error: 'Too many requests' }, 429, origin);

  const profile = data.profile || {};
  const firstName = (profile.first_name || '').slice(0, 60);
  const subject = data.subject || `Votre synthèse IKCP — ${new Date().toLocaleDateString('fr-FR')}`;
  const transcriptText = String(data.body).slice(0, 50000);

  ctx.waitUntil(Promise.all([
    // Mail au visiteur (synthèse complète + signature Maxime)
    sendResend(env, {
      to: [email],
      bcc: [env.NOTIFY_EMAIL || 'maxime@ikcp.eu'],
      subject: subject,
      html: renderMailVisitorSynthesis(firstName, transcriptText, profile, data.questionsHistory || []),
      tags: [{ name: 'type', value: 'marcel_synthesis_visitor' }]
    }).catch(e => console.error('[Synth visitor]', e.message)),

    // Mail à Maxime (alerte lead qualifié)
    sendResend(env, {
      to: [env.NOTIFY_EMAIL || 'maxime@ikcp.eu'],
      subject: `🤖 Lead Marcel — ${firstName || email} a demandé sa synthèse`,
      html: renderMailMaximeMarcelLead(email, firstName, profile, transcriptText, data.questionsHistory || [], data.page || ''),
      tags: [{ name: 'type', value: 'marcel_synthesis_maxime' }]
    }).catch(e => console.error('[Synth maxime]', e.message))
  ]));

  console.log('[Marcel synthesis]', { email, firstName, profile_keys: Object.keys(profile) });
  return json({ success: true, type: 'marcel_synthesis_sent' }, 200, origin);
}

// ────────────────────────────────────────────────────────────────────
// NOUVEAU — Marcel send-to-maxime (notif uniquement, le mailto fait le mail visiteur côté client)
// ────────────────────────────────────────────────────────────────────
async function handleMarcelSendToMaxime(request, env, ctx, origin, data) {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return json({ success: false, error: 'Origin not allowed' }, 403, origin);
  }
  const profile = data.profile || {};
  const subject = (data.subject || 'Conversation Marcel').slice(0, 200);
  const body = (data.body || '').slice(0, 50000);

  ctx.waitUntil(sendResend(env, {
    to: [env.NOTIFY_EMAIL || 'maxime@ikcp.eu'],
    subject: `📨 Marcel — ${profile.first_name || 'Prospect'} a envoyé sa conversation`,
    html: renderMailMaximeSendIntent(profile, body, data.questionsHistory || [], data.page || ''),
    tags: [{ name: 'type', value: 'marcel_send_intent' }]
  }).catch(e => console.error('[Marcel send-to-maxime]', e.message)));

  return json({ success: true, type: 'marcel_send_intent_logged' }, 200, origin);
}

// ────────────────────────────────────────────────────────────────────
// FLUX DIAGNOSTIC (existant — inchangé sauf URLs Calendly → mailto)
// ────────────────────────────────────────────────────────────────────
async function handleDiagnostic(request, env, ctx, origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return json({ success: false, error: 'Origin not allowed' }, 403, origin);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);

  const rlOk = await checkRateLimit(env, ip);
  if (!rlOk) return json({ success: false, error: 'Too many requests' }, 429, origin);

  let data;
  try { data = await request.json(); }
  catch(e) { return json({ success: false, error: 'Invalid JSON' }, 400, origin); }

  const v = validatePayload(data);
  if (!v.valid) return json({ success: false, error: 'Validation failed', details: v.errors }, 400, origin);

  if (data.requestId && env.IDEMPOTENCY) {
    const cached = await env.IDEMPOTENCY.get(data.requestId);
    if (cached) {
      console.log('[Idempotence][KV]', data.requestId);
      return json(JSON.parse(cached), 200, origin);
    }
  }

  try {
    if (data.requestId) {
      const existing = await findProspectByRequestId(env, data.requestId);
      if (existing) {
        const resp = { success: true, prospectId: existing, deduped: true };
        if (env.IDEMPOTENCY) ctx.waitUntil(env.IDEMPOTENCY.put(data.requestId, JSON.stringify(resp), { expirationTtl: IDEMPOTENCY_TTL }));
        return json(resp, 200, origin);
      }
    }

    const diag = recalculateDiagnostic(data);
    const consent = {
      version: CONSENT_VERSION,
      timestamp: data.consentTimestamp || new Date().toISOString(),
      ip, ua
    };

    const prospectId = await createNotionProspect(env, data, diag, consent);
    const bilanId = prospectId.replace(/-/g, '');
    if (env.IDEMPOTENCY) {
      ctx.waitUntil(env.IDEMPOTENCY.put(`bilan:${bilanId}`, JSON.stringify({ data, diag, consent, createdAt: new Date().toISOString() }), { expirationTtl: BILAN_TTL }));
    }
    const bilanUrl = `https://ikcp-prospect.maxime-ead.workers.dev/bilan/${bilanId}`;

    ctx.waitUntil(Promise.all([
      sendMailProspect(env, data, diag, bilanUrl).catch(e => console.error('[Resend prospect]', e.message)),
      sendMailInternal(env, data, diag, prospectId, bilanUrl).catch(e => console.error('[Resend internal]', e.message))
    ]));

    const response = {
      success: true,
      prospectId,
      score: diag.score,
      diagnostic: {
        score: diag.score,
        patrimoineNet: diag.patrimoineNet,
        droitsSans: diag.droitsSans,
        droitsAvec: diag.droitsAvec,
        ecart: diag.ecart
      },
      bilanUrl
    };

    if (data.requestId && env.IDEMPOTENCY) {
      ctx.waitUntil(env.IDEMPOTENCY.put(data.requestId, JSON.stringify(response), { expirationTtl: IDEMPOTENCY_TTL }));
    }

    console.log('[Success]', { prospectId, email: data.email, score: diag.score });
    return json(response, 200, origin);
  } catch(err) {
    console.error('[Fatal]', err.message, err.stack);
    return json({ success: false, error: 'Internal error', message: err.message }, 500, origin);
  }
}

function validatePayload(data) {
  const errors = [];
  if (!data.prenom || typeof data.prenom !== 'string' || data.prenom.length < 2) errors.push('prenom invalide');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('email invalide');
  if (/<script|javascript:|on\w+=/i.test(data.prenom || '') || /<script|javascript:|on\w+=/i.test(data.email || '')) errors.push('contenu non autorise');
  if ((data.prenom || '').length > 100) errors.push('prenom trop long');
  if ((data.email || '').length > 200) errors.push('email trop long');
  return { valid: errors.length === 0, errors };
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT) return true;
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT.window;
  try {
    const raw = await env.RATE_LIMIT.get(key);
    const ts = raw ? JSON.parse(raw).filter(t => t > windowStart) : [];
    if (ts.length >= RATE_LIMIT.max) return false;
    ts.push(now);
    await env.RATE_LIMIT.put(key, JSON.stringify(ts), { expirationTtl: RATE_LIMIT.window * 2 });
    return true;
  } catch(e) { return true; }
}

function recalculateDiagnostic(data) {
  const ABATTEMENT_ENFANT = 100000;
  const ABATTEMENT_AV = 152500;
  const nbEnfants = Number(data.enfants) || 0;
  const age = Number(data.age) || 0;
  const s = String(data.situation || '').toLowerCase();
  const marie = s === 'marié' || s === 'marié(e)' || s === 'marie' || s === 'pacsé' || s === 'pacsé(e)' || s === 'pacse';

  const patrimoineNet =
    (Number(data.rpValeur) || 0) - (Number(data.rpCredit) || 0) +
    (Number(data.immoLocatif) || 0) - (Number(data.creditLoc) || 0) +
    (Number(data.epargne) || 0) + (Number(data.av) || 0) +
    (Number(data.pea) || 0) + (Number(data.per) || 0) +
    (Number(data.patrimoinePro) || 0);

  const partEnfant = nbEnfants > 0 ? (marie ? patrimoineNet * 0.75 : patrimoineNet) / nbEnfants : 0;
  const partTaxable = Math.max(0, partEnfant - ABATTEMENT_ENFANT);
  const droitsSans = nbEnfants > 0 ? calculerDroits(partTaxable) * nbEnfants : 0;

  const donation = nbEnfants * ABATTEMENT_ENFANT;
  const av = age < 70 ? nbEnfants * ABATTEMENT_AV : 0;
  const patrimoineOpt = Math.max(0, patrimoineNet - donation - av);
  const partEnfantOpt = nbEnfants > 0 ? (marie ? patrimoineOpt * 0.75 : patrimoineOpt) / nbEnfants : 0;
  const partTaxableOpt = Math.max(0, partEnfantOpt - ABATTEMENT_ENFANT);
  const droitsAvec = nbEnfants > 0 ? calculerDroits(partTaxableOpt) * nbEnfants : 0;

  let score = 50;
  if (data.testament) score += 10;
  if (data.prevoyance) score += 10; else score -= 10;
  if (data.per > 0) score += 8;
  if (data.av > 0) score += 8;
  if (data.statut === 'TNS' && !data.prevoyance) score -= 12;
  if (nbEnfants >= 2 && !data.testament) score -= 8;
  score = Math.max(0, Math.min(100, score));

  return { score, patrimoineNet, droitsSans, droitsAvec, ecart: droitsSans - droitsAvec };
}

function calculerDroits(m) {
  const t = [[8072,.05],[12109,.10],[15932,.15],[552324,.20],[902838,.30],[1805677,.40],[Infinity,.45]];
  let r = Math.max(0, m), d = 0, p = 0;
  for (const [c, taux] of t) {
    if (r <= 0) break;
    const dd = Math.min(r, c - p);
    d += dd * taux;
    r -= dd;
    p = c;
  }
  return Math.round(d);
}

async function findProspectByRequestId(env, requestId) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) return null;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: 'RequestId', rich_text: { equals: requestId } },
        page_size: 1
      })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.results?.[0]?.id || null;
  } catch(e) { return null; }
}

function normalizeSituationFamiliale(situation) {
  const s = String(situation || '').toLowerCase().trim();
  if (s === 'marié' || s === 'marie' || s === 'married') return 'Marié(e)';
  if (s === 'pacsé' || s === 'pacse' || s === 'pacsé(e)') return 'Pacsé(e)';
  if (s === 'célibataire' || s === 'celibataire' || s === 'single') return 'Célibataire';
  if (s === 'divorcé' || s === 'divorce' || s === 'divorcé(e)') return 'Divorcé(e)';
  if (s === 'veuf' || s === 'veuve' || s === 'veuf/veuve') return 'Veuf/Veuve';
  return 'Célibataire';
}

function normalizeTMI(tmi) {
  const n = Number(tmi);
  if (n === 0 || n === 0.00) return '0%';
  if (n === 11 || n === 0.11) return '11%';
  if (n === 30 || n === 0.30) return '30%';
  if (n === 41 || n === 0.41) return '41%';
  if (n === 45 || n === 0.45) return '45%';
  return '30%';
}

function normalizeSource(source) {
  const valid = ['Site IKCP — Bilan', 'Site IKCP — Simulateur', 'Newsletter UPPERCUT', 'Recommandation', 'LinkedIn', 'Autre', 'Diagnostic IKCP', 'Diagnostic patrimonial IKCP'];
  return valid.includes(source) ? source : 'Diagnostic patrimonial IKCP';
}

async function createNotionProspect(env, data, diag, consent) {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) throw new Error('Notion secrets manquants');
  const score = diag.score;
  const niveau = score >= 70 ? 'Solide' : score >= 45 ? 'À optimiser' : 'Vigilance';

  const body = {
    parent: { database_id: env.NOTION_DB_ID },
    properties: {
      'Nom': { title: [{ text: { content: `${data.prenom} — Score ${score}/100` } }] },
      'Prénom': { rich_text: [{ text: { content: data.prenom } }] },
      'Email': { email: data.email },
      'Téléphone': { phone_number: data.tel || null },
      'Score': { number: score },
      'Niveau': { select: { name: niveau } },
      'Statut': { select: { name: '🆕 Nouveau' } },
      'Source': { select: { name: normalizeSource(data.source) } },
      'Situation familiale': { select: { name: normalizeSituationFamiliale(data.situation) } },
      'TMI estimée': { select: { name: normalizeTMI(data.tmi) } },
      'Statut pro': { rich_text: [{ text: { content: String(data.statut || '') } }] },
      'Âge': { number: Number(data.age) || 0 },
      'Enfants': { number: Number(data.enfants) || 0 },
      'Patrimoine net': { number: Math.round(diag.patrimoineNet) },
      'IR estimé': { number: Math.round(Number(data.ir) || 0) },
      'Droits succession': { number: Math.round(diag.droitsSans) },
      'Droits succession estimés': { number: Math.round(diag.droitsSans) },
      'Capital retraite estimé': { number: Math.round(Number(data.capitalRetraite) || 0) },
      'Valeur RP': { number: Math.round(Number(data.rpValeur) || 0) },
      'Crédit RP restant': { number: Math.round(Number(data.rpCredit) || 0) },
      'Valeur immo locatif': { number: Math.round(Number(data.immoLocatif) || 0) },
      'Crédit locatif restant': { number: Math.round(Number(data.creditLoc) || 0) },
      'Montant AV': { number: Math.round(Number(data.av) || 0) },
      'Montant PER': { number: Math.round(Number(data.per) || 0) },
      'Montant PEA': { number: Math.round(Number(data.pea) || 0) },
      'Patrimoine pro': { number: Math.round(Number(data.patrimoinePro) || 0) },
      'Épargne disponible': { number: Math.round(Number(data.epargne) || 0) },
      'Effort mensuel épargne': { number: Math.round(Number(data.effortMensuel) || 0) },
      'Revenu conjoint': { number: Math.round(Number(data.revenuConj) || 0) },
      'Revenu locatif': { number: Math.round(Number(data.revenuLoc) || 0) },
      'Prévoyance': { checkbox: !!data.prevoyance },
      'Testament': { checkbox: !!data.testament },
      'Alertes détectées': { rich_text: [{ text: { content: String(data.alertes || '').slice(0, 2000) } }] },
      'Leviers recommandés': { rich_text: [{ text: { content: String(data.leviers || '').slice(0, 2000) } }] },
      'Commentaire libre': { rich_text: [{ text: { content: `${diag.droitsSans}€ sans / ${diag.droitsAvec}€ avec / économie ${diag.ecart}€`.slice(0, 2000) } }] },
      'RequestId': { rich_text: [{ text: { content: String(data.requestId || '') } }] },
      'Consentement RGPD': { rich_text: [{ text: { content: `${consent.version} · ${consent.timestamp} · IP:${consent.ip}` } }] },
      'Date': { date: { start: new Date().toISOString().split('T')[0] } },
      'Email envoyé': { checkbox: true }
    }
  };

  Object.keys(body.properties).forEach(k => { if (body.properties[k] === undefined) delete body.properties[k]; });

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).id;
}

async function sendResend(env, opts) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY manquant');
  const body = { from: 'Maxime IKCP <maxime@ikcp.eu>', to: opts.to, subject: opts.subject, html: opts.html, tags: opts.tags };
  if (opts.bcc) body.bcc = opts.bcc;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function sendMailProspect(env, data, diag, bilanUrl) {
  return sendResend(env, {
    to: [data.email],
    bcc: [env.NOTIFY_EMAIL || 'maxime@ikcp.eu'],
    subject: `${data.prenom}, votre diagnostic patrimonial IKCP (score ${diag.score}/100)`,
    html: renderMailProspect(data, diag, bilanUrl),
    tags: [{ name: 'type', value: 'prospect_mail_1' }]
  });
}

async function sendMailInternal(env, data, diag, pid, bilanUrl) {
  const fmt = n => Math.round(n || 0).toLocaleString('fr-FR');
  return sendResend(env, {
    to: [env.NOTIFY_EMAIL || 'maxime@ikcp.eu'],
    subject: `🎯 Briefing RDV — ${data.prenom} · Score ${diag.score} · ${fmt(diag.patrimoineNet)}€`,
    html: renderMailInternal(data, diag, pid, bilanUrl),
    tags: [{ name: 'type', value: 'internal_briefing' }]
  });
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function suggestFirstQuestion(data, diag) {
  const n = Number(data.enfants) || 0;
  if (!data.testament && n >= 2) return `« Avez-vous déjà envisagé un testament ou une donation-partage pour organiser la transmission entre vos ${n} enfants ? »`;
  if (data.statut === 'TNS' && !data.prevoyance) return `« En tant que TNS, comment protégez-vous aujourd'hui vos revenus en cas d'arrêt de travail prolongé ? »`;
  if (!data.per && diag.score < 70 && Number(data.revenuNet) > 80000) return `« Avez-vous déjà étudié le PER comme levier de défiscalisation ? À votre TMI, l'impact serait significatif. »`;
  if (Number(data.av) === 0 && Number(data.age) < 70) return `« L'assurance-vie est-elle absente par choix stratégique ou juste pas encore prioritaire ? Avant 70 ans, c'est un levier majeur. »`;
  if (Number(data.immoLocatif) > 0 && !data.testament) return `« Votre immobilier locatif est dans la base successorale — avez-vous pensé au démembrement pour optimiser la transmission ? »`;
  return `« Qu'est-ce qui vous a motivé à faire ce diagnostic aujourd'hui ? Quelle est votre priorité patrimoniale à 12 mois ? »`;
}

// ────────────────────────────────────────────────────────────────────
// TEMPLATES MAIL
// ────────────────────────────────────────────────────────────────────
function renderMailProspect(data, diag, bilanUrl) {
  const fmt = n => Math.round(n || 0).toLocaleString('fr-FR');
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const scoreColor = diag.score >= 70 ? '#15803d' : diag.score >= 45 ? '#b45309' : '#b91c1c';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="background:#f9f6f0;font-family:Georgia,serif"><div style="max-width:560px;margin:32px auto;background:#1f1a16;padding:28px;text-align:center;border-radius:16px 16px 0 0"><div style="color:#b8956e;font-size:26px;font-weight:bold;letter-spacing:3px">IKCP.</div><div style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:2px;margin-top:4px">DIAGNOSTIC PATRIMONIAL · ${date}</div></div><div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e5ded2;border-top:none"><p style="font-size:17px">Bonjour <strong>${esc(data.prenom)}</strong>,</p><p style="font-size:15px;line-height:1.7;color:#6d5c4a">Merci d'avoir utilisé le <strong>Diagnostic Patrimonial IKCP</strong>. Voici vos résultats calculés sur la base des barèmes officiels 2026.</p><div style="background:#f9f6f0;border-radius:12px;padding:20px;text-align:center;margin:20px 0"><div style="font-size:10px;font-weight:bold;color:#b8956e;letter-spacing:1.5px">SCORE PATRIMONIAL</div><div style="font-size:48px;font-weight:bold;color:${scoreColor};margin:6px 0">${diag.score}<span style="font-size:22px;color:#a0938a">/100</span></div></div><div style="background:#fef2f2;padding:16px 20px;border-radius:12px;border:1px solid #fecaca;margin-bottom:10px"><div style="font-size:11px;font-weight:bold;color:#dc2626">⚠ SANS ANTICIPATION</div><div style="font-size:28px;font-weight:bold;color:#dc2626">${fmt(diag.droitsSans)} €</div><div style="font-size:11px;color:#9e9080">droits à payer par vos ${data.enfants || 0} enfant${(data.enfants || 0) > 1 ? 's' : ''}</div></div><div style="background:#f0fdf4;padding:16px 20px;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px"><div style="font-size:11px;font-weight:bold;color:#16a34a">✓ AVEC STRATÉGIE PATRIMONIALE</div><div style="font-size:28px;font-weight:bold;color:#16a34a">${fmt(diag.droitsAvec)} €</div></div><div style="background:#1f1a16;padding:20px;border-radius:12px;text-align:center;margin-bottom:24px"><div style="font-size:10px;color:#b8956e;font-weight:bold;letter-spacing:2px">ÉCONOMIE POTENTIELLE</div><div style="font-size:34px;font-weight:bold;color:#fff">${fmt(diag.ecart)} €</div></div><p style="font-size:12px;color:#9e9080;font-style:italic">Patrimoine estimé : ${fmt(diag.patrimoineNet)} € · Résultats indicatifs - barèmes CGI 2026. Ne constitue pas un conseil en investissement au sens MIF II.</p><p style="text-align:center;margin:28px 0"><a href="${MAILTO_MAXIME}" style="display:inline-block;background:#1f1a16;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:bold">Demander un échange →</a></p><p style="text-align:center;font-size:11px;color:#9e9080;font-style:italic;margin-top:-12px">Sur recommandation ou suite à un bilan patrimonial.</p><p style="text-align:center;margin:12px 0"><a href="${bilanUrl}" style="color:#b8956e;font-size:13px">📄 Consulter le détail de votre bilan (imprimable)</a></p><p style="font-size:15px;font-weight:bold;margin:0">Maxime Juveneton</p><p style="font-size:13px;color:#b8956e;margin:2px 0">Fondateur - IKCP</p><p style="font-size:12px;color:#9e9080">ORIAS 23001568 · <a href="https://ikcp.eu" style="color:#b8956e">ikcp.eu</a></p></div><div style="max-width:560px;margin:0 auto;padding:20px 32px;text-align:center;border:1px solid #e5ded2;border-top:none;border-radius:0 0 16px 16px"><p style="font-size:10px;color:#9e9080;margin:0">IKCP · SIREN 947 972 436 · ORIAS 23001568</p><p style="font-size:10px;color:#c8bfb5">Droits RGPD : <a href="mailto:maxime@ikcp.eu" style="color:#b8956e">maxime@ikcp.eu</a></p></div></body></html>`;
}

function renderMailInternal(data, diag, pid, bilanUrl) {
  const fmt = n => Math.round(n || 0).toLocaleString('fr-FR');
  const notionUrl = `https://www.notion.so/${pid.replace(/-/g, '')}`;
  const scoreColor = diag.score >= 70 ? '#15803d' : diag.score >= 45 ? '#b45309' : '#b91c1c';
  const alertes = (data.alertes || '').split(' | ').filter(Boolean);
  const leviers = (data.leviers || '').split(' | ').filter(Boolean);
  const premiereQ = suggestFirstQuestion(data, diag);
  const row = (label, value, unit = '') => `<tr><td style="padding:4px 8px 4px 0;color:#6d5c4a;font-size:12px;width:45%">${label}</td><td style="padding:4px 0;font-weight:bold;font-size:12px">${value}${unit ? ' ' + unit : ''}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background:#f9f6f0;font-family:Georgia,serif;padding:20px"><div style="max-width:640px;margin:0 auto;background:#fff"><div style="background:#1f1a16;padding:24px 32px;text-align:center"><div style="color:#b8956e;font-size:20px;font-weight:bold;letter-spacing:3px">IKCP.</div><div style="color:rgba(255,255,255,0.4);font-size:10px;margin-top:4px">🎯 BRIEFING RDV PROSPECT</div></div><div style="padding:24px 32px;border-bottom:1px solid #e5ded2"><table width="100%"><tr><td style="vertical-align:middle;width:35%"><div style="background:#f9f6f0;border-radius:12px;padding:16px;text-align:center"><div style="font-size:10px;color:#9e9080;font-weight:bold">SCORE</div><div style="font-size:40px;font-weight:bold;color:${scoreColor}">${diag.score}</div><div style="font-size:10px;color:#9e9080">/100</div></div></td><td style="vertical-align:top;padding-left:16px;padding-top:4px"><div style="font-size:22px;font-weight:bold">${esc(data.prenom)}</div><div style="font-size:13px"><a href="mailto:${esc(data.email)}" style="color:#b8956e">${esc(data.email)}</a></div>${data.tel ? `<div style="font-size:13px;color:#6d5c4a">${esc(data.tel)}</div>` : ''}<div style="font-size:12px;color:#9e9080;margin-top:8px">${data.age || '-'} ans · ${esc(data.situation || '-')} · ${data.enfants || 0} enfants · ${esc(data.statut || '-')}</div></td></tr></table></div><div style="padding:20px 32px;border-bottom:1px solid #e5ded2"><div style="font-size:12px;font-weight:bold;color:#b8956e;letter-spacing:1.5px;margin-bottom:10px">🏛 PATRIMOINE DÉTAILLÉ</div><table width="100%">${row('Résidence principale', fmt(data.rpValeur), '€')}${row('↳ crédit restant', '-' + fmt(data.rpCredit), '€')}${row('Immobilier locatif', fmt(data.immoLocatif), '€')}${row('↳ crédit restant', '-' + fmt(data.creditLoc), '€')}${row('Épargne disponible', fmt(data.epargne), '€')}${row('Assurance-vie', fmt(data.av), '€')}${row('PER', fmt(data.per), '€')}${row('PEA', fmt(data.pea), '€')}${row('Patrimoine pro', fmt(data.patrimoinePro), '€')}<tr><td colspan="2" style="padding-top:10px;border-top:1px solid #e5ded2"><strong style="font-size:14px">PATRIMOINE NET TOTAL : <span style="color:#1f1a16">${fmt(diag.patrimoineNet)} €</span></strong></td></tr></table></div><div style="padding:20px 32px;border-bottom:1px solid #e5ded2"><div style="font-size:12px;font-weight:bold;color:#b8956e;letter-spacing:1.5px;margin-bottom:10px">💰 REVENUS &amp; CAPACITÉ</div><table width="100%">${row('Revenu net annuel', fmt(data.revenuNet), '€')}${data.revenuConj ? row('Revenu conjoint', fmt(data.revenuConj), '€') : ''}${data.revenuLoc ? row('Revenus locatifs', fmt(data.revenuLoc), '€') : ''}${row('Effort mensuel épargne', fmt(data.effortMensuel), '€')}${row('TMI estimée', (data.tmi || '-'), '%')}${row('IR estimé', fmt(data.ir), '€')}${row('Capital retraite estimé', fmt(data.capitalRetraite), '€')}</table></div><div style="padding:20px 32px;border-bottom:1px solid #e5ded2"><div style="font-size:12px;font-weight:bold;color:#b8956e;letter-spacing:1.5px;margin-bottom:10px">👨‍👩‍👧 PROTECTION &amp; TRANSMISSION</div><table width="100%">${row('Prévoyance', data.prevoyance ? '✓ Oui' : '❌ Non')}${row('Testament', data.testament ? '✓ Oui' : '❌ Non')}${row('Droits sans strat.', fmt(diag.droitsSans), '€')}${row('Droits avec strat.', fmt(diag.droitsAvec), '€')}<tr><td colspan="2" style="padding-top:8px"><strong style="color:#16a34a">Économie potentielle : ${fmt(diag.ecart)} €</strong></td></tr></table></div>${alertes.length ? `<div style="padding:20px 32px;background:#fef2f2;border-left:4px solid #ef4444"><div style="font-size:12px;font-weight:bold;color:#991b1b;margin-bottom:8px">⚡ ALERTES DÉTECTÉES</div>${alertes.map(a => `<div style="font-size:13px;color:#7f1d1d;padding:3px 0">• ${esc(a)}</div>`).join('')}</div>` : ''}${leviers.length ? `<div style="padding:20px 32px;background:#f0fdf4;border-left:4px solid #22c55e"><div style="font-size:12px;font-weight:bold;color:#166534;margin-bottom:8px">💡 LEVIERS IDENTIFIÉS</div>${leviers.map(l => `<div style="font-size:13px;color:#14532d;padding:3px 0">• ${esc(l)}</div>`).join('')}</div>` : ''}<div style="padding:20px 32px;background:#fdf6e3;border-left:4px solid #b8956e"><div style="font-size:12px;font-weight:bold;color:#6d5c4a;letter-spacing:1.5px;margin-bottom:8px">🎤 PREMIÈRE QUESTION SUGGÉRÉE</div><div style="font-size:14px;color:#4d3f33;font-style:italic;line-height:1.5">${esc(premiereQ)}</div></div><div style="padding:24px 32px;background:#fff"><table width="100%"><tr><td width="33%" style="text-align:center;padding-right:4px"><a href="${notionUrl}" style="display:block;background:#1f1a16;color:#b8956e;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px">Notion →</a></td><td width="33%" style="text-align:center;padding:0 4px"><a href="${bilanUrl}" style="display:block;background:#b8956e;color:#1f1a16;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px">Bilan complet →</a></td><td width="33%" style="text-align:center;padding-left:4px"><a href="mailto:${esc(data.email)}" style="display:block;background:#f9f6f0;color:#1f1a16;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px;border:1px solid #e5ded2">Répondre →</a></td></tr></table></div></div></body></html>`;
}

// ─── NOUVEAU : Synthèse Marcel pour le visiteur ───
function renderMailVisitorSynthesis(firstName, transcriptText, profile, questionsHistory) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const greeting = firstName ? `Bonjour ${esc(firstName)}` : 'Bonjour';
  // Convertit le transcript texte en HTML lisible
  const transcriptHtml = esc(transcriptText)
    .replace(/\n\n═══════════════════════════════════════\n\n/g, '<hr style="border:0;border-top:1px solid #e5ded2;margin:20px 0">')
    .replace(/\nVOUS:\s/g, '<br><br><strong style="color:#1f1a16">Vous : </strong>')
    .replace(/\nMARCEL:\s/g, '<br><br><strong style="color:#b8956e">Marcel : </strong>')
    .replace(/^VOUS:\s/, '<strong style="color:#1f1a16">Vous : </strong>')
    .replace(/^MARCEL:\s/, '<strong style="color:#b8956e">Marcel : </strong>')
    .replace(/\n/g, '<br>');
  const questionsList = (questionsHistory || []).slice(-5).map(q => `<li style="padding:4px 0">${esc(q)}</li>`).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="background:#f9f6f0;font-family:Georgia,serif;margin:0;padding:0">
<div style="max-width:600px;margin:32px auto;background:#1f1a16;padding:28px;text-align:center;border-radius:16px 16px 0 0">
<div style="color:#b8956e;font-size:26px;font-weight:bold;letter-spacing:3px">IKCP.</div>
<div style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:2px;margin-top:4px">SYNTHÈSE MARCEL · ${date}</div>
</div>
<div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e5ded2;border-top:none">
<p style="font-size:17px;margin:0 0 16px">${greeting},</p>
<p style="font-size:14px;line-height:1.6;color:#6d5c4a;margin:0 0 16px">
Merci pour cet échange avec <strong>Marcel</strong>, l'agent patrimonial IKCP. Voici la synthèse de notre conversation pour que vous puissiez la relire à tête reposée.
</p>
${questionsList ? `<div style="background:#f9f6f0;border-radius:10px;padding:14px 18px;margin:16px 0">
<div style="font-size:11px;font-weight:bold;color:#b8956e;letter-spacing:1.5px;margin-bottom:8px">VOS QUESTIONS</div>
<ul style="margin:0;padding-left:20px;font-size:13px;color:#3a2f24">${questionsList}</ul>
</div>` : ''}
<div style="background:#fffaf2;border:1px solid #ece6da;border-radius:10px;padding:18px;margin:18px 0;font-size:13px;line-height:1.7;color:#3a2f24">
${transcriptHtml}
</div>
<div style="background:#1f1a16;padding:24px;border-radius:12px;margin:24px 0;text-align:center">
<div style="color:#b8956e;font-size:11px;letter-spacing:2px;font-weight:bold;margin-bottom:8px">POUR ALLER PLUS LOIN</div>
<div style="color:#fff;font-size:14px;line-height:1.6;margin-bottom:16px">
Si votre situation patrimoniale mérite une analyse personnalisée,<br>
écrivez-moi en répondant à cet email.
</div>
<a href="${MAILTO_MAXIME}" style="display:inline-block;background:#b8956e;color:#1f1a16;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">
Échanger avec Maxime →
</a>
<div style="color:rgba(255,255,255,0.5);font-size:10px;margin-top:10px;font-style:italic">
Sur recommandation ou suite à un bilan patrimonial.
</div>
</div>
<p style="font-size:11px;color:#9e9080;font-style:italic;line-height:1.5;margin:16px 0">
Marcel apporte un éclairage général à partir des barèmes officiels et du Code général des impôts. Il ne remplace pas un professionnel ; pour une recommandation adaptée à votre situation, contactez Maxime.
</p>
<p style="font-size:14px;margin:20px 0 0">Maxime Juveneton</p>
<p style="font-size:12px;color:#b8956e;margin:2px 0">Fondateur — IKCP</p>
<p style="font-size:11px;color:#9e9080;margin:2px 0">ORIAS 23001568 · <a href="https://ikcp.eu" style="color:#b8956e">ikcp.eu</a></p>
</div>
<div style="max-width:600px;margin:0 auto;padding:18px 32px;text-align:center;border:1px solid #e5ded2;border-top:none;border-radius:0 0 16px 16px;background:#fafafa">
<p style="font-size:10px;color:#9e9080;margin:0">IKCP · SIREN 947 972 436 · ORIAS 23001568</p>
<p style="font-size:10px;color:#c8bfb5;margin:4px 0 0">Cet email a été envoyé suite à votre demande sur ikcp.eu. Droits RGPD : <a href="mailto:maxime@ikcp.eu" style="color:#b8956e">maxime@ikcp.eu</a></p>
</div>
</body></html>`;
}

// ─── NOUVEAU : Alerte Maxime quand Marcel reçoit demande de synthèse ───
function renderMailMaximeMarcelLead(email, firstName, profile, transcriptText, questionsHistory, page) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const profileEntries = Object.entries(profile || {}).filter(([k, v]) => v && k !== 'email').map(([k, v]) => `<tr><td style="padding:3px 8px 3px 0;color:#6d5c4a;font-size:12px">${esc(k)}</td><td style="padding:3px 0;font-weight:bold;font-size:12px">${esc(String(v).slice(0, 100))}</td></tr>`).join('');
  const questionsList = (questionsHistory || []).map(q => `<li style="padding:3px 0;font-size:12px">${esc(q)}</li>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background:#f9f6f0;font-family:Georgia,serif;padding:20px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#1f1a16;padding:20px 28px;text-align:center">
<div style="color:#b8956e;font-size:18px;font-weight:bold;letter-spacing:3px">IKCP.</div>
<div style="color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;margin-top:4px">🤖 LEAD MARCEL — DEMANDE DE SYNTHÈSE</div>
</div>
<div style="padding:24px 28px">
<p style="font-size:14px;color:#6d5c4a;margin:0 0 12px">Un visiteur a demandé sa synthèse de conversation avec Marcel et a renseigné son email — <strong>lead qualifié</strong> à recontacter.</p>
<table width="100%" style="background:#f9f6f0;border-radius:10px;padding:16px;margin:16px 0">
<tr><td style="padding:4px 8px 4px 0;color:#6d5c4a;font-size:12px;width:30%">Email</td><td style="padding:4px 0;font-weight:bold;font-size:13px"><a href="mailto:${esc(email)}" style="color:#b8956e">${esc(email)}</a></td></tr>
<tr><td style="padding:4px 8px 4px 0;color:#6d5c4a;font-size:12px">Prénom</td><td style="padding:4px 0;font-weight:bold;font-size:12px">${esc(firstName || '—')}</td></tr>
<tr><td style="padding:4px 8px 4px 0;color:#6d5c4a;font-size:12px">Date</td><td style="padding:4px 0;font-weight:bold;font-size:12px">${date}</td></tr>
${page ? `<tr><td style="padding:4px 8px 4px 0;color:#6d5c4a;font-size:12px">Page</td><td style="padding:4px 0;font-size:11px"><a href="${esc(page)}" style="color:#b8956e">${esc(page)}</a></td></tr>` : ''}
</table>
${profileEntries ? `<div style="margin:16px 0">
<div style="font-size:11px;font-weight:bold;color:#b8956e;letter-spacing:1.5px;margin-bottom:6px">PROFIL DÉTECTÉ</div>
<table width="100%">${profileEntries}</table>
</div>` : ''}
${questionsList ? `<div style="margin:16px 0">
<div style="font-size:11px;font-weight:bold;color:#b8956e;letter-spacing:1.5px;margin-bottom:6px">QUESTIONS POSÉES</div>
<ul style="margin:0;padding-left:18px;color:#3a2f24">${questionsList}</ul>
</div>` : ''}
<div style="background:#fffaf2;border:1px solid #ece6da;border-radius:8px;padding:14px;margin:16px 0;font-size:12px;line-height:1.6;color:#3a2f24;white-space:pre-wrap">${esc(transcriptText.slice(0, 8000))}</div>
<div style="text-align:center;margin:20px 0 0">
<a href="mailto:${esc(email)}?subject=Suite%20%C3%A0%20votre%20%C3%A9change%20avec%20Marcel%20%E2%80%94%20IKCP" style="display:inline-block;background:#1f1a16;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Répondre directement →</a>
</div>
</div>
</div>
</body></html>`;
}

// ─── NOUVEAU : Alerte Maxime sur intent send-to-maxime ───
function renderMailMaximeSendIntent(profile, body, questionsHistory, page) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background:#f9f6f0;font-family:Georgia,serif;padding:20px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#1f1a16;padding:20px 28px;text-align:center">
<div style="color:#b8956e;font-size:18px;font-weight:bold;letter-spacing:3px">IKCP.</div>
<div style="color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;margin-top:4px">📨 MARCEL — SEND-TO-MAXIME INTENT</div>
</div>
<div style="padding:24px 28px">
<p style="font-size:13px;color:#6d5c4a;margin:0 0 12px">Le visiteur <strong>${esc(profile.first_name || 'Inconnu')}</strong> a cliqué sur "Envoyer ma conversation" — le mailto va aussi t'arriver mais voici la trace côté Worker.</p>
<div style="font-size:11px;color:#9e9080;margin:8px 0">${date}${page ? ' · ' + esc(page) : ''}</div>
<div style="background:#fffaf2;border:1px solid #ece6da;border-radius:8px;padding:14px;margin:16px 0;font-size:12px;line-height:1.6;color:#3a2f24;white-space:pre-wrap">${esc(body.slice(0, 8000))}</div>
${profile.email ? `<div style="text-align:center;margin:16px 0 0"><a href="mailto:${esc(profile.email)}" style="display:inline-block;background:#1f1a16;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px">Répondre →</a></div>` : ''}
</div>
</div>
</body></html>`;
}

// ────────────────────────────────────────────────────────────────────
// Bilan page (existant)
// ────────────────────────────────────────────────────────────────────
async function handleBilanPage(bilanId, env) {
  if (!env.IDEMPOTENCY) return new Response('KV not bound', { status: 500 });
  if (!/^[a-f0-9]{20,40}$/i.test(bilanId)) return new Response('Invalid bilan id', { status: 400 });
  const raw = await env.IDEMPOTENCY.get(`bilan:${bilanId}`);
  if (!raw) return new Response('Bilan introuvable ou expiré (conservé 30 jours)', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { data, diag, consent, createdAt } = JSON.parse(raw);
  const html = renderBilanPage(data, diag, consent, createdAt);
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } });
}

function renderBilanPage(data, diag, consent, createdAt) {
  const fmt = n => Math.round(n || 0).toLocaleString('fr-FR');
  const date = new Date(createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const scoreColor = diag.score >= 70 ? '#15803d' : diag.score >= 45 ? '#b45309' : '#b91c1c';
  const alertes = (data.alertes || '').split(' | ').filter(Boolean);
  const leviers = (data.leviers || '').split(' | ').filter(Boolean);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bilan IKCP — ${esc(data.prenom)}</title><style>@media print{.no-print{display:none}body{font-size:10pt}}body{font-family:Georgia,serif;background:#f9f6f0;color:#1f1a16;margin:0;padding:20px}.page{max-width:800px;margin:0 auto;background:#fff;padding:48px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}h1{font-size:28px;letter-spacing:3px;margin:0 0 4px}h2{font-size:18px;color:#b8956e;border-bottom:2px solid #e5ded2;padding-bottom:6px;margin-top:32px}.meta{font-size:11px;color:#9e9080;letter-spacing:1px;text-transform:uppercase}.score-box{background:#f9f6f0;border-radius:12px;padding:24px;text-align:center;margin:24px 0}.score{font-size:56px;font-weight:bold;color:${scoreColor};line-height:1}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:8px 0;font-size:13px;border-bottom:1px solid #f0ebe3}td:first-child{color:#6d5c4a}td:last-child{text-align:right;font-weight:bold}.box-red{background:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:12px 0;border-radius:0 8px 8px 0}.box-green{background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;margin:12px 0;border-radius:0 8px 8px 0}.box-dark{background:#1f1a16;color:#fff;padding:20px;border-radius:12px;text-align:center;margin:20px 0}.box-dark .val{font-size:32px;font-weight:bold}.footer{margin-top:48px;padding-top:20px;border-top:1px solid #e5ded2;font-size:10px;color:#9e9080}.print-btn{position:fixed;top:16px;right:16px;background:#1f1a16;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-family:Georgia,serif;font-size:13px;font-weight:bold}</style></head><body><a href="javascript:window.print()" class="print-btn no-print">🖨️ Imprimer / PDF</a><div class="page"><header><div style="color:#b8956e;font-size:10px;letter-spacing:2px">IKCP.</div><h1>Bilan patrimonial</h1><div class="meta">${esc(data.prenom)} · ${date}</div></header><div class="score-box"><div class="meta">Score patrimonial</div><div class="score">${diag.score}<span style="font-size:24px;color:#9e9080">/100</span></div><div style="font-size:13px;color:#6d5c4a;margin-top:8px">${diag.score >= 70 ? 'Patrimoine solide' : diag.score >= 45 ? 'Optimisations identifiées' : 'Vigilance recommandée'}</div></div><h2>Profil</h2><table><tr><td>Âge</td><td>${data.age || '-'} ans</td></tr><tr><td>Situation familiale</td><td>${esc(data.situation || '-')}</td></tr><tr><td>Enfants</td><td>${data.enfants || 0}</td></tr><tr><td>Statut professionnel</td><td>${esc(data.statut || '-')}</td></tr><tr><td>TMI</td><td>${data.tmi || '-'}%</td></tr></table><h2>Patrimoine détaillé</h2><table><tr><td>Résidence principale (valeur)</td><td>${fmt(data.rpValeur)} €</td></tr><tr><td>Crédit RP restant</td><td style="color:#b91c1c">-${fmt(data.rpCredit)} €</td></tr><tr><td>Immobilier locatif</td><td>${fmt(data.immoLocatif)} €</td></tr><tr><td>Crédit locatif restant</td><td style="color:#b91c1c">-${fmt(data.creditLoc)} €</td></tr><tr><td>Épargne disponible</td><td>${fmt(data.epargne)} €</td></tr><tr><td>Assurance-vie</td><td>${fmt(data.av)} €</td></tr><tr><td>PER</td><td>${fmt(data.per)} €</td></tr><tr><td>PEA</td><td>${fmt(data.pea)} €</td></tr><tr><td>Patrimoine professionnel</td><td>${fmt(data.patrimoinePro)} €</td></tr><tr style="background:#f9f6f0"><td><strong>Patrimoine net total</strong></td><td><strong style="font-size:16px">${fmt(diag.patrimoineNet)} €</strong></td></tr></table><h2>Revenus</h2><table><tr><td>Revenu net annuel</td><td>${fmt(data.revenuNet)} €</td></tr>${data.revenuConj ? `<tr><td>Revenu conjoint</td><td>${fmt(data.revenuConj)} €</td></tr>` : ''}${data.revenuLoc ? `<tr><td>Revenus locatifs</td><td>${fmt(data.revenuLoc)} €</td></tr>` : ''}<tr><td>Effort mensuel épargne</td><td>${fmt(data.effortMensuel)} €</td></tr><tr><td>IR estimé</td><td>${fmt(data.ir)} €</td></tr></table><h2>Protection &amp; transmission</h2><table><tr><td>Prévoyance</td><td>${data.prevoyance ? '✓ Oui' : '❌ Non'}</td></tr><tr><td>Testament</td><td>${data.testament ? '✓ Oui' : '❌ Non'}</td></tr><tr><td>Capital retraite estimé</td><td>${fmt(data.capitalRetraite)} €</td></tr></table><h2>Simulation succession</h2><div class="box-red"><div class="meta" style="color:#dc2626">⚠ Sans anticipation</div><div style="font-size:24px;font-weight:bold;color:#dc2626">${fmt(diag.droitsSans)} €</div><div style="font-size:11px;color:#9e9080">droits à payer par vos ${data.enfants || 0} enfant${(data.enfants || 0) > 1 ? 's' : ''}</div></div><div class="box-green"><div class="meta" style="color:#16a34a">✓ Avec stratégie patrimoniale</div><div style="font-size:24px;font-weight:bold;color:#16a34a">${fmt(diag.droitsAvec)} €</div></div><div class="box-dark"><div style="color:#b8956e;font-size:11px;letter-spacing:2px;font-weight:bold">ÉCONOMIE POTENTIELLE</div><div class="val">${fmt(diag.ecart)} €</div></div>${alertes.length ? `<h2>Alertes détectées</h2><ul>${alertes.map(a => `<li style="margin:6px 0">${esc(a)}</li>`).join('')}</ul>` : ''}${leviers.length ? `<h2>Leviers identifiés</h2><ul>${leviers.map(l => `<li style="margin:6px 0">${esc(l)}</li>`).join('')}</ul>` : ''}<div class="footer"><p>Bilan indicatif - barèmes CGI 2026. Ne constitue pas un conseil en investissement au sens de l'art. L533-13 CMF.</p><p><strong>IKCP</strong> · SIREN 947 972 436 · ORIAS 23001568 · <a href="https://ikcp.eu" style="color:#b8956e">ikcp.eu</a> · <a href="mailto:maxime@ikcp.eu" style="color:#b8956e">maxime@ikcp.eu</a></p><p style="font-size:9px;color:#c8bfb5">Conservé 30 jours · Consentement ${esc(consent.version)} · ${esc(consent.timestamp)}</p></div></div></body></html>`;
}
