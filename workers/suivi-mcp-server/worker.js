/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4 · reproduction interdite
 *
 * IKCP — Suivi MCP server (deuxième sub-agent)
 *
 * Sub-agent qui surveille en continu le patrimoine des clients et
 * déclenche des alertes / propositions d'arbitrage pour Maxime.
 *
 * Tools exposés :
 *   - next_deadline(user_id)        → prochaine échéance fiscale + rappel J-8
 *   - check_drift_allocation(user_id) → détection drift > seuil + arbitrage
 *   - schedule_reminder(user_id, ...) → programme un rappel D1
 *   - propose_arbitrage(user_id, ...) → crée une entrée file Maxime
 *
 * Cron triggers :
 *   - 0 7 * * *  : daily 7h UTC (9h Paris)
 *     · scan échéances dans les 8 jours pour tous les utilisateurs actifs
 *     · email/push si trouvé via Resend
 *   - 0 9 1 * *  : monthly 1er du mois 9h UTC
 *     · scan drift allocation tous les portefeuilles
 *     · génère arbitrages en attente Maxime si drift > 5%
 *
 * Architecture (cf. docs/CLAUDE-AGENT-SDK-INTEGRATION.md) :
 *   · MCP server HTTP standard (auth HMAC + tools whitelist)
 *   · Service binding service binding lecture D1 ikcp-client (echeances,
 *     patrimoine_snapshot, arbitrages)
 *   · Resend pour notifications email
 *   · Cron triggers Cloudflare pour scheduling
 *
 * Bindings :
 *   · DB                D1 binding vers ikcp-client-db
 *   · MCP_SHARED_SECRET (secret) auth HMAC avec Marcel/ikcp-client
 *   · RESEND_API_KEY    (secret) envoi emails
 *   · RESEND_FROM       (var)
 */

const SUBAGENT_NAME = 'suivi';
const VERSION = '1.0.0';

// ─── Tools exposés ────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'next_deadline',
    description: "Récupère la prochaine échéance fiscale ou patrimoniale d'un utilisateur, dans les 30 jours. Utilisé par Marcel pour répondre aux questions du type 'qu'est-ce qui m'attend ce mois-ci ?'.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        horizon_days: { type: 'number', description: 'Horizon en jours (défaut 30)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'check_drift_allocation',
    description: "Détecte si un patrimoine s'écarte significativement de son allocation cible (drift). Si écart > seuil (défaut 5 pts), propose 1-3 arbitrages de rebalancing. Maxime arbitre.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        seuil_pct: { type: 'number', description: 'Seuil de drift en points (défaut 5)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'schedule_reminder',
    description: "Programme un rappel pour un utilisateur (échéance fiscale, anniversaire AV, RDV partenaire). Le rappel est envoyé J-8 par défaut.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        date: { type: 'string', description: 'ISO YYYY-MM-DD' },
        label: { type: 'string' },
        montant: { type: 'number' },
        source: { type: 'string', description: 'DGFiP, Insee, IKCP suivi, etc.' },
      },
      required: ['user_id', 'date', 'label'],
    },
  },
  {
    name: 'propose_arbitrage',
    description: "Crée une proposition d'arbitrage dans la file de validation Maxime. L'arbitrage est en statut 'en_attente' jusqu'à validation humaine MIF II.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        titre: { type: 'string' },
        contexte: { type: 'string' },
        reco_marcel: { type: 'string' },
        sources: { type: 'array', items: { type: 'object' } },
        gain_estime: { type: 'number', description: 'Gain attendu en euros (optionnel)' },
        conv_id: { type: 'string', description: 'Conversation Marcel d\'origine (optionnel)' },
      },
      required: ['user_id', 'titre', 'reco_marcel'],
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
          shared_secret: !!env.MCP_SHARED_SECRET,
          resend: !!env.RESEND_API_KEY,
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
      if (!TOOLS.find(t => t.name === name)) return jsonError(404, 'tool_not_found');
      const result = await callTool(name, args || {}, env);
      return Response.json({ result });
    }

    return jsonError(404, 'not_found');
  },

  // ─── Cron triggers ───────────────────────────────────────────────────
  // Configure dans wrangler.toml : crons = ["0 7 * * *", "0 9 1 * *"]
  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDate();

    // Daily 7h UTC : check échéances J-8
    if (hour === 7) {
      ctx.waitUntil(runDailyDeadlineCheck(env));
    }

    // Monthly 1er 9h UTC : check drift allocations
    if (day === 1 && hour === 9) {
      ctx.waitUntil(runMonthlyDriftCheck(env));
    }
  },
};

// ─── Tools dispatch ─────────────────────────────────────────────────────
async function callTool(name, args, env) {
  try {
    if (name === 'next_deadline') return await nextDeadline(args.user_id, args.horizon_days || 30, env);
    if (name === 'check_drift_allocation') return await checkDriftAllocation(args.user_id, args.seuil_pct || 5, env);
    if (name === 'schedule_reminder') return await scheduleReminder(args, env);
    if (name === 'propose_arbitrage') return await proposeArbitrage(args, env);
    return { error: 'unknown_tool', tool: name };
  } catch (e) {
    console.error('[suivi-mcp]', name, e);
    return { error: 'tool_execution_error', message: String(e.message || e).slice(0, 200) };
  }
}

// ─── next_deadline ──────────────────────────────────────────────────────
async function nextDeadline(userId, horizonDays, env) {
  if (!env.DB) return { error: 'db_unavailable' };
  const horizonSec = Math.floor(Date.now() / 1000) + horizonDays * 86400;
  const horizonIso = new Date(horizonSec * 1000).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  const { results = [] } = await env.DB.prepare(
    'SELECT * FROM echeances WHERE user_id = ? AND date >= ? AND date <= ? AND status != ? ORDER BY date ASC LIMIT 5'
  ).bind(userId, todayIso, horizonIso, 'termine').all();

  if (results.length === 0) {
    return { user_id: userId, next: null, message: `Aucune échéance dans les ${horizonDays} prochains jours.` };
  }

  const next = results[0];
  const daysUntil = Math.round((new Date(next.date).getTime() - Date.now()) / 86400000);
  return {
    user_id: userId,
    next: {
      date: next.date,
      label: next.label,
      montant: next.montant,
      source: next.source,
      status: next.status,
      days_until: daysUntil,
      urgent: !!next.urgent,
    },
    other: results.slice(1).map(e => ({
      date: e.date, label: e.label, days_until: Math.round((new Date(e.date).getTime() - Date.now()) / 86400000),
    })),
    sources: 'D1 echeances · maintenu par suivi-agent + saisies Maxime',
  };
}

// ─── check_drift_allocation ─────────────────────────────────────────────
async function checkDriftAllocation(userId, seuilPct, env) {
  if (!env.DB) return { error: 'db_unavailable' };

  const snap = await env.DB.prepare(
    'SELECT * FROM patrimoine_snapshot WHERE user_id = ? ORDER BY asof DESC LIMIT 1'
  ).bind(userId).first();
  if (!snap) return { error: 'no_snapshot', message: 'Aucun snapshot patrimonial — patrimoine à créer.' };

  const classes = safeJSON(snap.classes_json) || [];
  const cible = safeJSON(snap.allocation_cible_json) || {};
  const drifts = classes.map(c => ({
    key: c.key,
    label: c.label,
    actual_pct: c.pct,
    cible_pct: cible[c.key] || 0,
    drift_pts: +(c.pct - (cible[c.key] || 0)).toFixed(1),
    valeur_nette: c.valeur_nette,
  }));
  const major = drifts.filter(d => Math.abs(d.drift_pts) >= seuilPct);

  if (major.length === 0) {
    return {
      user_id: userId,
      drift_severity: 'none',
      max_drift_pts: Math.max(...drifts.map(d => Math.abs(d.drift_pts))),
      message: 'Allocation conforme à la cible (drift < ' + seuilPct + ' pts).',
      sources: 'D1 patrimoine_snapshot',
    };
  }

  // Suggestion d'arbitrages : par classe en sur/sous-pondération
  const propositions = major.map(d => {
    if (d.drift_pts > 0) return `Alléger ${d.label} (${d.actual_pct}% → cible ${d.cible_pct}%) · libère ${Math.round(Math.abs(d.drift_pts) * snap.net_worth / 100).toLocaleString('fr-FR')} €`;
    return `Renforcer ${d.label} (${d.actual_pct}% → cible ${d.cible_pct}%) · alloue ${Math.round(Math.abs(d.drift_pts) * snap.net_worth / 100).toLocaleString('fr-FR')} €`;
  });

  return {
    user_id: userId,
    drift_severity: major.length > 2 ? 'high' : 'moderate',
    max_drift_pts: Math.max(...major.map(d => Math.abs(d.drift_pts))),
    classes_drift: major,
    propositions,
    next_action: 'Soumettre l\'arbitrage à Maxime via propose_arbitrage()',
    sources: 'D1 patrimoine_snapshot · seuil ' + seuilPct + ' pts',
  };
}

// ─── schedule_reminder ──────────────────────────────────────────────────
async function scheduleReminder({ user_id, date, label, montant, source }, env) {
  if (!env.DB) return { error: 'db_unavailable' };
  const id = 'ech_' + crypto.randomUUID().slice(0, 12);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO echeances (id, user_id, date, label, source, montant, status, urgent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user_id, date, label.slice(0, 200), source || 'IKCP suivi', montant || null, 'a_venir', 0, now).run();

  return {
    success: true,
    echeance_id: id,
    rappel_planifie_pour: dateMinusDays(date, 8),
    message: `Échéance ajoutée. Rappel programmé J-8 (${dateMinusDays(date, 8)}).`,
  };
}

// ─── propose_arbitrage ──────────────────────────────────────────────────
async function proposeArbitrage(args, env) {
  if (!env.DB) return { error: 'db_unavailable' };
  const id = 'arb_' + crypto.randomUUID().slice(0, 12);
  const now = Date.now();
  const sourcesJson = JSON.stringify(args.sources || []);

  await env.DB.prepare(`
    INSERT INTO arbitrages (id, user_id, conv_id, titre, contexte, reco_marcel, sources_json, gain_estime, status, prepared_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)
  `).bind(
    id, args.user_id, args.conv_id || null,
    args.titre.slice(0, 200), args.contexte || '', args.reco_marcel,
    sourcesJson, args.gain_estime || null, now,
  ).run();

  // Log dans events pour le journal d'activité dashboard
  try {
    await env.DB.prepare(
      'INSERT INTO events (user_id, who, what, ref_type, ref_id, ts) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(args.user_id, 'Suivi-agent', `Arbitrage préparé : ${args.titre}`, 'arbitrage', id, now).run();
  } catch (e) { /* table events optionnelle */ }

  return {
    success: true,
    arbitrage_id: id,
    status: 'en_attente',
    message: 'Arbitrage placé dans la file de validation Maxime.',
    next_action: 'Maxime décide en visio mensuelle ou via dashboard admin.',
  };
}

// ─── Cron jobs ──────────────────────────────────────────────────────────
async function runDailyDeadlineCheck(env) {
  if (!env.DB) return;
  const today = new Date();
  const j8 = dateMinusDays(today.toISOString().slice(0, 10), -8); // J+8 vu de today

  // Toutes les échéances qui tombent à J+8 et qui n'ont pas encore été notifiées
  const { results = [] } = await env.DB.prepare(
    'SELECT * FROM echeances WHERE date = ? AND rappel_sent_at IS NULL AND status = "a_venir"'
  ).bind(j8).all();

  for (const e of results) {
    // Récupère email user
    const user = await env.DB.prepare('SELECT email, first_name FROM users WHERE id = ?').bind(e.user_id).first();
    if (!user || !user.email) continue;

    // Envoi email Resend
    try {
      await sendReminderEmail(env, user, e);
      await env.DB.prepare('UPDATE echeances SET rappel_sent_at = ? WHERE id = ?').bind(Date.now(), e.id).run();
    } catch (err) {
      console.error('[suivi-cron] reminder fail', e.id, err);
    }
  }

  console.log(`[suivi-cron] daily check : ${results.length} reminders sent`);
}

async function runMonthlyDriftCheck(env) {
  if (!env.DB) return;
  // Tous les utilisateurs ayant un snapshot récent (< 90j)
  const { results = [] } = await env.DB.prepare(
    'SELECT DISTINCT user_id FROM patrimoine_snapshot WHERE asof > ?'
  ).bind(Date.now() - 90 * 86400000).all();

  let propositionsCreated = 0;
  for (const row of results) {
    const drift = await checkDriftAllocation(row.user_id, 5, env);
    if (drift.drift_severity && drift.drift_severity !== 'none') {
      // Crée un arbitrage en attente Maxime
      await proposeArbitrage({
        user_id: row.user_id,
        titre: `Drift ${drift.drift_severity} détecté · ${drift.max_drift_pts} pts`,
        contexte: `Détection automatique mensuelle. Classes en drift : ` +
          drift.classes_drift.map(c => `${c.label} ${c.actual_pct}% vs cible ${c.cible_pct}%`).join(' · '),
        reco_marcel: drift.propositions.join('\n'),
        sources: [{ name: 'D1 patrimoine_snapshot' }, { name: 'Cron suivi-agent' }],
        gain_estime: 0,
      }, env);
      propositionsCreated++;
    }
  }

  console.log(`[suivi-cron] monthly drift : ${propositionsCreated} arbitrages proposés`);
}

async function sendReminderEmail(env, user, echeance) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const subject = `IKCP — rappel échéance J-8 : ${echeance.label}`;
  const body = `<p>Bonjour ${user.first_name || ''},</p>
    <p>Votre échéance approche dans 8 jours :</p>
    <p><strong>${echeance.label}</strong><br>
    Date : ${echeance.date}${echeance.montant ? `<br>Montant indicatif : ${echeance.montant.toLocaleString('fr-FR')} €` : ''}<br>
    Source : ${echeance.source || 'IKCP suivi'}</p>
    <p>Connectez-vous à votre espace client pour voir le détail.</p>
    <p>— L'équipe IKCP</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'IKCP <maxime@ikcp.eu>',
      to: [user.email],
      subject,
      html: body,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────
function safeJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function dateMinusDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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
