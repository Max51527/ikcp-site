/**
 * ikcp-watchdog — surveillance santé des services + alerte email
 * © 2026 IKCP · ORIAS 23001568
 * ------------------------------------------------------------------
 * Cron (toutes les 6 h) : ping /health de chaque worker. Si un service
 * est DOWN (non-200) ou si une clé critique manque → email à Maxime via Resend.
 * Secret requis : RESEND_API_KEY (npx wrangler secret put RESEND_API_KEY).
 * Endpoints : GET /health (statut watchdog) · GET /check (lance un check manuel).
 */
const SERVICES = [
  { n: 'Marcel (chat)',   u: 'https://ikcp-chat.maxime-ead.workers.dev/health',      critical: true  },
  { n: 'Auth/Client',     u: 'https://ikcp-client.maxime-ead.workers.dev/health',    critical: true  },
  { n: 'Veille',          u: 'https://ikcp-veille.maxime-ead.workers.dev/health',    critical: false },
  { n: 'Pappers',         u: 'https://ikcp-pappers.maxime-ead.workers.dev/health',   critical: false },
  { n: 'Codex',           u: 'https://ikcp-codex.maxime-ead.workers.dev/health',     critical: false },
  { n: 'Hermès',          u: 'https://ikcp-hermes.maxime-ead.workers.dev/health',    critical: false },
  { n: 'Lifestyle',       u: 'https://ikcp-lifestyle.maxime-ead.workers.dev/health', critical: false },
  { n: 'Témoin',          u: 'https://ikcp-temoin.maxime-ead.workers.dev/health',    critical: false },
  { n: 'Voice',           u: 'https://ikcp-voice.maxime-ead.workers.dev/health',     critical: false },
];
const TO = 'maxime@ikcp.fr';
const FROM = 'IKCP Watchdog <onboarding@resend.dev>';

async function runCheck() {
  const results = await Promise.all(SERVICES.map(async (s) => {
    try {
      const r = await fetch(s.u, { cf: { cacheTtl: 0 }, signal: AbortSignal.timeout(12000) });
      return { ...s, ok: r.ok, code: r.status };
    } catch (_) { return { ...s, ok: false, code: 0 }; }
  }));
  return results;
}

async function sendAlert(env, down) {
  if (!env.RESEND_API_KEY) return false;
  const rows = down.map(d => `<li><b>${d.n}</b> — HS (HTTP ${d.code})${d.critical ? ' ⚠️ CRITIQUE' : ''}</li>`).join('');
  const html = `<h2>⚠️ Alerte IKCP — service(s) hors-ligne</h2>
    <p>Le watchdog a détecté un problème :</p><ul>${rows}</ul>
    <p>Console : <a href="https://ikcp.eu/app/console.html">ikcp.eu/app/console.html</a></p>
    <p style="color:#888;font-size:12px">Vérification automatique · IKCP · ORIAS 23001568</p>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, subject: `⚠️ IKCP — ${down.length} service(s) hors-ligne`, html }),
  });
  return r.ok;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'ikcp-watchdog', monitors: SERVICES.length, configured: { resend: !!env.RESEND_API_KEY } });
    }
    if (url.pathname === '/check') {
      const results = await runCheck();
      const down = results.filter(r => !r.ok);
      let emailed = false;
      if (down.length && url.searchParams.get('email') === '1') emailed = await sendAlert(env, down);
      return Response.json({ checked_at: new Date().toISOString(), down: down.length, emailed, results });
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  },
  async scheduled(event, env, ctx) {
    const results = await runCheck();
    const down = results.filter(r => !r.ok);
    if (down.length) await sendAlert(env, down).catch(() => {});
  },
};
