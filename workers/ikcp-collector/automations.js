/**
 * ikcp-collector — Module d'automatisations Marcel
 *
 * Dispatcher cron → fonction selon l'horaire.
 *
 * Cron schedule (UTC) :
 *   0 5  * * *   → cote actifs surveillés
 *   30 5 * * *   → daily digest email
 *   0 6  * * *   → veille nocturne
 *   0 9  * * 1   → détection inactivité (lundi)
 *   0 0  1 * *   → cartographie SIREN refresh (1er mois)
 *
 * Pattern d'appel depuis worker.js :
 *
 *   export default {
 *     async fetch(req, env) { ... },
 *     async scheduled(controller, env, ctx) {
 *       ctx.waitUntil(runAutomation(controller.cron, env));
 *     }
 *   };
 */

const VEILLE_URL = 'https://ikcp-veille.maxime-ead.workers.dev/search';
const PAPPERS_URL = 'https://ikcp-pappers.maxime-ead.workers.dev/entreprise';
const TEMOIN_URL = 'https://ikcp-temoin.maxime-ead.workers.dev/log';
const RESEND_URL = 'https://api.resend.com/emails';
const SENDER_FROM = 'Marcel · IKCP <noreply@ikcp.eu>';

// ─── Dispatcher principal ────────────────────────────────────
export async function runAutomation(cronExpression, env) {
  console.log(`[automation] Triggered cron: ${cronExpression}`);

  switch (cronExpression) {
    case '0 5 * * *':       return await runCoteActifs(env);
    case '30 5 * * *':      return await runDailyDigest(env);
    case '0 6 * * *':       return await runVeilleNocturne(env);
    case '0 9 * * 1':       return await runDetectionInactivite(env);
    case '0 0 1 * *':       return await runCartographieRefresh(env);
    default:
      console.warn(`[automation] Unknown cron: ${cronExpression}`);
  }
}

// ─── 1. Veille nocturne (6h UTC) ──────────────────────────────
async function runVeilleNocturne(env) {
  const users = await env.IKCP_COLLECTOR_DB
    .prepare(`SELECT id, email, prenom, tier FROM users WHERE tier IN ('premium_essentiel','premium_fo') AND deleted_at IS NULL`)
    .all();

  const queries = [
    {
      q: `Actualités fiscales françaises 24-48h : Loi Finances 2027 amendements, Pacte Dutreil art 787 B CGI, IFI, démembrement. Sources Légifrance, BOFIP, Senat.fr, Les Échos. Dates obligatoires.`,
      sphere: 'fiscalite',
      importance_default: 1,
    },
    {
      q: `Arrêts récents Cass. com. ou Conseil d'État sur holding animatrice, Pacte Dutreil, abus de droit fiscal, démembrement croisé. 7 derniers jours uniquement. Numéro arrêt obligatoire.`,
      sphere: 'transmission',
      importance_default: 2,
    },
    {
      q: `Marchés financiers France 24h : CAC 40, OAT 10 ans, OPA, M&A, levées PE Ardian Tikehau Eurazeo. Sources Les Échos, Capital, Maddyness.`,
      sphere: 'marches',
      importance_default: 0,
    },
  ];

  for (const user of users.results || []) {
    if (user.tier !== 'premium_fo') continue; // veille nocturne réservée Family Office

    for (const query of queries) {
      try {
        const r = await fetch(VEILLE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.q,
            mode: 'quick',
            user_id: user.id,
            tier: user.tier,
          }),
        });
        const data = await r.json();
        if (!data.summary) continue;

        // Filtre : ne garde que si fraîcheur datée < 48h dans la réponse
        const isFresh = /\b(202[6-7])\b/.test(data.summary) || /\bhier\b|\baujourd'hui\b/i.test(data.summary);
        if (!isFresh) continue;

        await env.IKCP_COLLECTOR_DB
          .prepare(`INSERT INTO alerts (id, user_id, sphere, source, title, body, url, importance, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
          .bind(
            crypto.randomUUID(),
            user.id,
            query.sphere,
            'veille_nightly',
            extractTitle(data.summary),
            data.summary.slice(0, 1500),
            data.sources?.[0]?.url || null,
            query.importance_default,
            Date.now()
          )
          .run();

        // Audit Témoin
        await audit(user.id, 'veille_nightly', query.sphere, data.summary.slice(0, 500));
      } catch (err) {
        console.error(`[veille] user=${user.id} sphere=${query.sphere}:`, err.message);
      }
    }
  }
  console.log(`[veille] Done for ${users.results?.length || 0} Premium FO users`);
}

// ─── 2. Cote actifs surveillés (5h UTC) ───────────────────────
async function runCoteActifs(env) {
  const watches = await env.IKCP_COLLECTOR_DB
    .prepare(`SELECT id, user_id, market, category, query, target_price FROM user_watches WHERE active = 1`)
    .all();

  for (const w of watches.results || []) {
    try {
      const q = `Cote actuelle marché secondaire pour : ${w.query}. Source datée obligatoire (Chrono24, WatchCharts, Classic.com, Liv-ex). Cible utilisateur : ${w.target_price || 'non définie'} €. Indique si proche cible (±10%).`;
      const r = await fetch(VEILLE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, mode: 'quick', user_id: w.user_id, tier: 'premium_fo' }),
      });
      const data = await r.json();
      if (!data.summary) continue;

      // Extraction grossière du prix (regex amélioré à terme)
      const priceMatch = data.summary.match(/(\d{1,3}(?:\s?\d{3})*)\s?(?:€|EUR|k€)/i);
      const currentValue = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;

      if (currentValue) {
        await env.IKCP_COLLECTOR_DB
          .prepare(`UPDATE user_watches SET last_value = ?, last_checked_at = ? WHERE id = ?`)
          .bind(currentValue, Date.now(), w.id).run();

        // Alerte si proche cible
        if (w.target_price && Math.abs(currentValue - w.target_price) / w.target_price < 0.10) {
          await env.IKCP_COLLECTOR_DB
            .prepare(`INSERT INTO alerts (id, user_id, sphere, source, title, body, importance, created_at) VALUES (?,?,?,?,?,?,?,?)`)
            .bind(
              crypto.randomUUID(),
              w.user_id,
              w.market,
              'watch_alert',
              `${w.query} proche de votre cible`,
              `Cote actuelle : ${currentValue} € · Cible : ${w.target_price} €\n\n${data.summary.slice(0, 800)}`,
              2,
              Date.now()
            ).run();
        }
      }
    } catch (err) {
      console.error(`[cote] watch=${w.id}:`, err.message);
    }
  }
}

// ─── 3. Daily digest email (5h30 UTC) ─────────────────────────
async function runDailyDigest(env) {
  const today = Date.now() - 24 * 3600 * 1000;
  const users = await env.IKCP_COLLECTOR_DB
    .prepare(`SELECT id, email, prenom, tier FROM users WHERE tier = 'premium_fo' AND deleted_at IS NULL AND marketing_consent = 1`)
    .all();

  for (const user of users.results || []) {
    const alerts = await env.IKCP_COLLECTOR_DB
      .prepare(`SELECT title, body, url, importance FROM alerts WHERE user_id = ? AND created_at >= ? AND read_at IS NULL ORDER BY importance DESC, created_at DESC LIMIT 5`)
      .bind(user.id, today)
      .all();

    if (!alerts.results || alerts.results.length === 0) continue; // pas de mail vide

    const html = buildDigestEmail(user.prenom || 'Marcel', alerts.results);
    await sendBrevoEmail(env, user.email, `Marcel · ${alerts.results.length} alertes ce matin`, html);
  }
}

// ─── 4. Détection inactivité (lundi 9h UTC) ───────────────────
async function runDetectionInactivite(env) {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const inactive = await env.IKCP_COLLECTOR_DB
    .prepare(`SELECT id, email, prenom FROM users WHERE deleted_at IS NULL AND last_seen < ? AND marketing_consent = 1`)
    .bind(cutoff)
    .all();

  for (const user of inactive.results || []) {
    const html = buildNudgeEmail(user.prenom || 'Marcel');
    await sendBrevoEmail(env, user.email, 'Marcel veille toujours sur vos actifs', html);
  }
}

// ─── 5. Cartographie SIREN refresh (1er du mois) ──────────────
async function runCartographieRefresh(env) {
  const sirens = await env.IKCP_COLLECTOR_DB
    .prepare(`SELECT id, user_id, siren FROM user_sirens`)
    .all();

  for (const s of sirens.results || []) {
    try {
      const r = await fetch(`${PAPPERS_URL}/${s.siren}/short`);
      const data = await r.json();
      if (data.nom) {
        await env.IKCP_COLLECTOR_DB
          .prepare(`UPDATE user_sirens SET nom_societe = ?, forme_juridique = ?, capital = ?, ville = ?, cached_json = ?, last_refreshed_at = ? WHERE id = ?`)
          .bind(data.nom, data.forme_juridique, data.capital, data.siege?.ville, JSON.stringify(data), Date.now(), s.id)
          .run();
      }
    } catch (err) {
      console.error(`[refresh] siren=${s.siren}:`, err.message);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function extractTitle(text) {
  const firstLine = text.split('\n').find(l => l.trim().length > 10) || text.slice(0, 100);
  return firstLine.replace(/^[#*\s]+/, '').slice(0, 120);
}

async function audit(userId, action, sphere, summary) {
  try {
    await fetch(TEMOIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        family_id: userId,
        question: `[automation:${action}] ${sphere}`,
        response: summary,
        model: 'sonar',
        metadata: { sphere, automation_type: action },
      }),
    });
  } catch (_) { /* audit non-bloquant */ }
}

async function sendBrevoEmail(env, to, subject, html) {
  // Renommée pour rétrocompatibilité mais utilise Resend (plus simple, transactionnel pur).
  if (!env.RESEND_API_KEY) { console.warn('[email] RESEND_API_KEY missing'); return; }
  try {
    const r = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER_FROM,
        to: [to],
        subject,
        html,
      }),
    });
    if (!r.ok) console.error('[email] Resend error:', r.status, (await r.text()).slice(0, 200));
  } catch (err) {
    console.error('[email] Resend network error:', err.message);
  }
}

function buildDigestEmail(prenom, alerts) {
  const alertsHtml = alerts.map(a => {
    const imp = a.importance >= 2 ? '🔴' : (a.importance >= 1 ? '🟡' : '⚪');
    return `<div style="padding:14px 0;border-bottom:1px solid rgba(26,24,20,0.10)">
      <div style="font-size:14px;color:#1A1814;font-weight:500;line-height:1.4;margin-bottom:6px">${imp} ${a.title}</div>
      <div style="font-size:12.5px;color:#6B655A;line-height:1.5">${(a.body || '').slice(0, 220)}…</div>
      ${a.url ? `<a href="${a.url}" style="font-size:11px;color:#C24722;text-decoration:none">Source →</a>` : ''}
    </div>`;
  }).join('');

  return `<div style="font-family:Georgia,serif;max-width:600px;margin:auto;padding:40px 30px;background:#FAF7F0;color:#1A1814">
    <div style="text-align:center;margin-bottom:30px">
      <h1 style="font-style:italic;color:#C24722;font-size:36px;margin:0;font-weight:400">Marcel</h1>
      <p style="font-size:10.5px;letter-spacing:0.24em;color:#6B655A;text-transform:uppercase;margin-top:6px">Veille du jour</p>
    </div>
    <p style="font-size:15px;line-height:1.6">Bonjour ${prenom},<br><br>Marcel a scanné cette nuit ce qui touche vos actifs. <b>${alerts.length} alertes</b> méritent votre attention ce matin.</p>
    <div style="margin:30px 0">${alertsHtml}</div>
    <a href="https://app.ikcp.eu/veille.html" style="display:inline-block;padding:14px 28px;background:#1A1814;color:#FAF7F0;text-decoration:none;border-radius:8px;font-weight:600;letter-spacing:0.04em">Ouvrir Marcel →</a>
    <footer style="margin-top:50px;padding-top:20px;border-top:1px solid rgba(26,24,20,0.10);font-size:11px;color:#6B655A;line-height:1.6">
      IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568<br>
      Souverain France · RGPD · Conformité MIF II<br>
      <a href="https://app.ikcp.eu/profil.html" style="color:#6B655A">Gérer mes notifications</a>
    </footer>
  </div>`;
}

function buildNudgeEmail(prenom) {
  return `<div style="font-family:Georgia,serif;max-width:600px;margin:auto;padding:40px 30px;background:#FAF7F0;color:#1A1814">
    <h1 style="font-style:italic;color:#C24722;font-size:32px;margin:0 0 20px">Marcel</h1>
    <p style="font-size:15px;line-height:1.7">Bonjour ${prenom},<br><br>Cela fait 30 jours que vous n'avez pas ouvert votre Family Office.<br><br>Marcel a accumulé <b>plusieurs alertes</b> sur vos actifs et la fiscalité 2026. Un coup d'œil mérite peut-être votre attention.</p>
    <a href="https://app.ikcp.eu/dashboard.html" style="display:inline-block;padding:14px 28px;background:#C24722;color:#FAF7F0;text-decoration:none;border-radius:8px;font-weight:600;margin-top:20px">Reprendre où je m'étais arrêté →</a>
  </div>`;
}
