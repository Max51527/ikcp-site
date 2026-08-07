/**
 * ikcp-watchdog — surveillance santé des services + alerte email
 * © 2026 IKCP · ORIAS 23001568
 * ------------------------------------------------------------------
* Vérification à la demande sur /check : interroge le /health de chaque worker
 * PAR SERVICE BINDING (deux workers du même domaine ne peuvent pas s'appeler par
 * leur URL publique — erreur Cloudflare 1042). Si un service
 * est DOWN (non-200) ou si une clé critique manque → email à Maxime via Resend.
 * Secret requis : RESEND_API_KEY (npx wrangler secret put RESEND_API_KEY).
 * Endpoints : GET /health (statut watchdog) · GET /check (lance un check manuel).
 */
/* Les quinze services réellement déployés, vérifiés un par un le 5 août 2026.
   « critique » = un membre ne peut plus se servir de la plateforme si ce
   service tombe : se connecter, voir son bilan, parler à Marcel. Le reste
   dégrade l'expérience sans la bloquer. */
const SERVICES = [
  { n: 'Auth / comptes',   b: 'S_CLIENT',     critical: true  },
  { n: 'Bilan / coffre',   b: 'S_PATRIMOINE', critical: true  },
  { n: 'Marcel',           b: 'S_CHAT',       critical: true  },
  { n: 'Doctrine (RAG)',   b: 'S_RAG',        critical: false },
  { n: 'Codex — fiscal',   b: 'S_CODEX',      critical: false },
  { n: 'Hermès — transm.', b: 'S_HERMES',     critical: false },
  { n: 'Bâtisseur — 360°', b: 'S_BATISSEUR',  critical: false },
  { n: 'Lifestyle',        b: 'S_LIFESTYLE',  critical: false },
  { n: 'Pappers — SIREN',  b: 'S_PAPPERS',    critical: false },
  { n: 'Témoin — audit',   b: 'S_TEMOIN',     critical: false },
  { n: 'Veille',           b: 'S_VEILLE',     critical: false },
  { n: 'Voix',             b: 'S_VOICE',      critical: false },
  { n: 'Collector',        b: 'S_COLLECTOR',  critical: false },
  { n: 'Feedback',         b: 'S_FEEDBACK',   critical: false },
  { n: 'Powens (réservé)', b: 'S_POWENS',     critical: false },
];
const TO = 'maxime@ikcp.fr';
// Même expéditeur vérifié que le reste de la plateforme. Le bac à sable
// « onboarding@resend.dev » ne délivre qu'au titulaire du compte Resend et
// n'aurait pas survécu au premier changement d'adresse.
const FROM_DEFAUT = 'Marcel IA Patrimoniale <noreply@ikcp.eu>';

/* On interroge chaque service par son binding, pas par son URL publique :
   c'est le seul appel entre workers que Cloudflare accepte sur un même
   domaine. L'hôte de l'URL est ignoré par le binding, seul le chemin compte. */
async function runCheck(env) {
  return Promise.all(SERVICES.map(async (s) => {
    const lien = env[s.b];
    if (!lien) return { n: s.n, critical: s.critical, ok: false, code: 0, note: 'binding absent' };
    try {
      const r = await lien.fetch('https://interne/health', {
        headers: { Origin: 'https://ikcp.eu' },
        signal: AbortSignal.timeout(12000),
      });
      return { n: s.n, critical: s.critical, ok: r.ok, code: r.status };
    } catch (e) {
      return { n: s.n, critical: s.critical, ok: false, code: 0, note: String(e.message || e).slice(0, 80) };
    }
  }));
}

async function sendAlert(env, down) {
  if (!env.RESEND_API_KEY) return false;
  const rows = down.map(d => `<li><b>${d.n}</b> — HS (HTTP ${d.code})${d.critical ? ' ⚠️ CRITIQUE' : ''}</li>`).join('');
  const html = `<h2>⚠️ Alerte IKCP — service(s) hors-ligne</h2>
    <p>Le watchdog a détecté un problème :</p><ul>${rows}</ul>
    <p>Console : <a href="https://ikcp.eu/app/console">ikcp.eu/app/console</a></p>
    <p style="color:#888;font-size:12px">Vérification automatique · IKCP · ORIAS 23001568</p>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM || FROM_DEFAUT, to: TO,
                           subject: `⚠️ IKCP — ${down.length} service(s) hors-ligne`, html }),
  });
  return r.ok;
}

const CORS = { 'Access-Control-Allow-Origin': 'https://ikcp.eu', 'Vary': 'Origin' };
function jres(o, status) { return Response.json(o, { status: status || 200, headers: CORS }); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return jres({ status: 'ok', service: 'ikcp-watchdog', monitors: SERVICES.length, configured: { resend: !!env.RESEND_API_KEY } });
    }
    if (url.pathname === '/check') {
      const results = await runCheck(env);
      const down = results.filter(r => !r.ok);
      let emailed = false;
      if (down.length && url.searchParams.get('email') === '1') emailed = await sendAlert(env, down);
      return jres({ checked_at: new Date().toISOString(), down: down.length, emailed, results });
    }
    return jres({ error: 'not_found' }, 404);
  },
  async scheduled(event, env, ctx) {
    const results = await runCheck(env);
    const down = results.filter(r => !r.ok);
    if (down.length) await sendAlert(env, down).catch(() => {});
  },
};
