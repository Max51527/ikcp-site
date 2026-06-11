/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial
 * Maxime Juveneton · ORIAS 23001568 · maxime@ikcp.fr
 *
 * ikcp-voice — Worker voix premium pour Marcel
 *
 * Endpoints :
 *   POST /tts  { text, voice?, format? }  → audio/wav stream (cached KV)
 *   POST /stt  { audio_b64, language? }   → { text, confidence }
 *   GET  /voices                           → liste des voix VoxCPM
 *   GET  /health                           → ping
 *
 * Fournisseurs :
 *   TTS = VoxCPM2 (OpenBMB Apache 2.0, self-hosted Modal.run)
 *   STT = Mistral Voxtral (api.mistral.ai)
 *
 * Cache : KV VOICE_CACHE — clé = sha256(model+voice+text), TTL 30j
 * Rate limit : KV VOICE_RATE — 100 req/heure/IP non-auth
 *
 * Bindings :
 *   VOXCPM_API_URL        (env, ex: https://xxx--voxcpm-tts.modal.run)
 *   VOXCPM_MODEL          (env, "openbmb/VoxCPM2")
 *   VOXCPM_VOICE          (env, "default")
 *   MISTRAL_API_KEY       (secret)
 *   VOICE_CACHE           (KV binding, optional)
 *   VOICE_RATE            (KV binding, optional)
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://client.ikcp.eu',
  'https://app.ikcp.eu',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
];

const RATE_LIMIT_PER_HOUR = 100;
const CACHE_TTL_SECONDS = 30 * 24 * 3600;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      if (url.pathname === '/health') {
        return json({ ok: true, ts: Date.now(),
                      tts: { model: env.VOXCPM_MODEL || 'openbmb/VoxCPM2',
                             configured: !!env.VOXCPM_API_URL },
                      stt: { provider: 'mistral', configured: !!env.MISTRAL_API_KEY } }, 200, cors);
      }

      if (url.pathname === '/voices' && req.method === 'GET') {
        return json({ voices: VOICES, default: env.VOXCPM_VOICE || 'default' }, 200, cors);
      }

      if (await rateLimitExceeded(req, env)) {
        return json({ error: 'rate_limited', message: 'Trop de requêtes — réessayez dans 1h' },
                    429, cors);
      }

      if (url.pathname === '/tts' && req.method === 'POST') {
        return await handleTTS(req, env, cors);
      }

      if (url.pathname === '/stt' && req.method === 'POST') {
        return await handleSTT(req, env, cors);
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      console.error('ikcp-voice error:', e?.stack || e);
      return json({ error: 'internal_error', message: String(e?.message || e) }, 500, cors);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// TTS — texte → audio via VoxCPM2
// ─────────────────────────────────────────────────────────────
async function handleTTS(req, env, cors) {
  const body = await req.json().catch(() => ({}));
  const { text, voice, format = 'wav' } = body;

  if (!text || typeof text !== 'string') {
    return json({ error: 'missing_text' }, 400, cors);
  }
  if (text.length > 4000) {
    return json({ error: 'text_too_long', max: 4000 }, 400, cors);
  }
  if (!env.VOXCPM_API_URL) {
    return json({ error: 'tts_not_configured', hint: 'Set VOXCPM_API_URL' }, 500, cors);
  }

  const chosenVoice = voice && VOICES.find(v => v.id === voice) ? voice : (env.VOXCPM_VOICE || 'default');
  const cacheKey = await sha256Hex(`tts:${env.VOXCPM_MODEL}:${chosenVoice}:${format}:${text}`);

  // Cache hit
  if (env.VOICE_CACHE) {
    const cached = await env.VOICE_CACHE.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: { ...cors, 'Content-Type': mimeFor(format), 'X-Cache': 'HIT' },
      });
    }
  }

  // VoxCPM2 — API OpenAI-compatible
  const r = await fetch(env.VOXCPM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.VOXCPM_MODEL || 'openbmb/VoxCPM2',
      input: text,
      voice: chosenVoice === 'default' ? undefined : chosenVoice,
      response_format: format,
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    return json({ error: 'tts_failed', status: r.status, body: errText.slice(0, 200) }, 502, cors);
  }
  const audio = await r.arrayBuffer();

  // Cache write (TTL 30j) — pas de PII dans la clé (juste hash)
  if (env.VOICE_CACHE) {
    await env.VOICE_CACHE.put(cacheKey, audio, { expirationTtl: CACHE_TTL_SECONDS });
  }

  return new Response(audio, {
    headers: { ...cors, 'Content-Type': mimeFor(format), 'X-Cache': 'MISS' },
  });
}

// ─────────────────────────────────────────────────────────────
// STT — audio → texte via Mistral Voxtral
// ─────────────────────────────────────────────────────────────
async function handleSTT(req, env, cors) {
  if (!env.MISTRAL_API_KEY) {
    return json({ error: 'stt_not_configured', hint: 'Set MISTRAL_API_KEY' }, 500, cors);
  }

  const contentType = req.headers.get('content-type') || '';
  let audioBlob, language;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    audioBlob = form.get('file');
    language = form.get('language') || 'fr';
  } else if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    if (!body.audio_b64) return json({ error: 'missing_audio_b64' }, 400, cors);
    const bytes = Uint8Array.from(atob(body.audio_b64), c => c.charCodeAt(0));
    audioBlob = new Blob([bytes], { type: 'audio/webm' });
    language = body.language || 'fr';
  } else {
    return json({ error: 'unsupported_content_type' }, 415, cors);
  }

  // Mistral Voxtral — endpoint OpenAI-compatible audio transcriptions
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'voxtral-small-latest');
  form.append('language', language);
  form.append('response_format', 'json');

  const r = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.MISTRAL_API_KEY}` },
    body: form,
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    return json({ error: 'stt_failed', status: r.status, body: errText.slice(0, 200) }, 502, cors);
  }
  const data = await r.json();
  return json({ text: data.text || '', language, provider: 'mistral-voxtral' }, 200, cors);
}

// ─────────────────────────────────────────────────────────────
// Rate limit anti-scraping (KV, fenêtre glissante 1h)
// ─────────────────────────────────────────────────────────────
async function rateLimitExceeded(req, env) {
  if (!env.VOICE_RATE) return false;
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const key = `rl:${ip}:${Math.floor(Date.now() / 3600_000)}`;
  const current = parseInt(await env.VOICE_RATE.get(key) || '0', 10);
  if (current >= RATE_LIMIT_PER_HOUR) return true;
  await env.VOICE_RATE.put(key, String(current + 1), { expirationTtl: 3600 });
  return false;
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const VOICES = [
  { id: 'default',    label: 'Marcel — voix par défaut (neutre, posé)' },
  { id: 'marcel_fr',  label: 'Marcel — version conseil patrimonial' },
  { id: 'pedagogue',  label: 'Pédagogue — NextGen formation' },
];

function mimeFor(format) {
  return { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' }[format] || 'audio/wav';
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(req) {
  const origin = req.headers.get('origin');
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}
