/**
 * ikcp-voice — Voix Marcel premium (Sprint 3)
 *
 * STT : Mistral Voxtral (France) avec fallback Cloudflare Workers AI Whisper
 * TTS : VoxCPM2 (OpenBMB, Apache 2.0) via endpoint OpenAI-compatible
 *       Hébergement : Modal.com serverless GPU (voir deploy-voxcpm-modal.py)
 *                  ou tout serveur vLLM-Omni exposant /v1/audio/speech
 *
 * Endpoints :
 *   GET  /health
 *   POST /stt       multipart audio → { text, lang, source, duration_ms }
 *   POST /tts       { text, voice? } → audio/wav stream (cached KV)
 *   GET  /voices    → liste des voix VoxCPM disponibles
 *
 * Souveraineté :
 *   - Mistral Voxtral : France
 *   - Cloudflare Workers AI : WEUR (Paris/Frankfurt)
 *   - VoxCPM2 : open-source Apache 2.0, hébergement au choix (Modal WEUR recommandé)
 *   - Audio non stocké : transit uniquement
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://app.ikcp.eu',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev',
  'https://ikcp-eu.pages.dev',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8765',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'null', '',  // file:// + navigateur direct (tests)
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || (origin?.endsWith('.ikcp.eu')) || (origin?.endsWith('.maxime-ead.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://app.ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}
function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

// ────────────────────────────────────────────────
// STT — Voxtral (Mistral France) avec fallback Whisper Cloudflare AI
// ────────────────────────────────────────────────
async function transcribeVoxtral(env, audioBlob, lang = 'fr') {
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'voxtral-mini-latest');
  form.append('language', lang);

  const r = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.MISTRAL_API_KEY}` },
    body: form,
  });
  if (!r.ok) throw new Error(`voxtral_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return { text: data.text || '', source: 'voxtral-mini', lang };
}

async function transcribeWhisperCF(env, audioBlob) {
  const arr = new Uint8Array(await audioBlob.arrayBuffer());
  const result = await env.AI.run('@cf/openai/whisper', { audio: [...arr] });
  return { text: result.text || '', source: 'whisper-cf', lang: 'fr' };
}

// ────────────────────────────────────────────────
// TTS — VoxCPM2 via API OpenAI-compatible
// Endpoint : POST {VOXCPM_API_URL}/v1/audio/speech
// Retourne : audio/wav 48kHz
// ────────────────────────────────────────────────
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function speakVoxCPM(env, text, voice) {
  const baseUrl = env.VOXCPM_API_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('VOXCPM_API_URL not configured');

  const body = {
    model: env.VOXCPM_MODEL || 'openbmb/VoxCPM2',
    input: text,
  };
  // Voice optionnel : nom de voix prédéfinie ou description textuelle (Voice Design)
  if (voice && voice !== 'default') body.voice = voice;

  const headers = { 'Content-Type': 'application/json' };
  // Clé API optionnelle (si le serveur est protégé)
  if (env.VOXCPM_API_KEY) headers['Authorization'] = `Bearer ${env.VOXCPM_API_KEY}`;

  const r = await fetch(`${baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`voxcpm_${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.body; // ReadableStream audio/wav
}

// ────────────────────────────────────────────────
// Worker entry
// ────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });

    // ─── /health ──────────────────────────────────
    if (url.pathname === '/health') {
      return json({
        status: 'ok',
        service: 'ikcp-voice',
        version: '1.0.0',
        stt: {
          voxtral: !!env.MISTRAL_API_KEY,
          whisper_cf: !!env.AI,
          primary: env.STT_PRIMARY || 'voxtral',
        },
        tts: {
          provider: 'voxcpm2',
          configured: !!env.VOXCPM_API_URL,
          api_url: env.VOXCPM_API_URL ? env.VOXCPM_API_URL.replace(/\/.*$/, '/[...]') : null,
          model: env.VOXCPM_MODEL || 'openbmb/VoxCPM2',
          voice: env.VOXCPM_VOICE || 'default',
          primary: 'voxcpm2',
        },
        cache: !!env.VOICE_CACHE,
        region: 'WEUR Paris/Frankfurt',
        license: 'VoxCPM2 Apache 2.0 — open-source souverain',
      }, 200, origin);
    }

    // ─── POST /stt ────────────────────────────────
    if (url.pathname === '/stt' && request.method === 'POST') {
      // Anti-abus : plafond 120/h par IP (KV).
      { const ip = request.headers.get('CF-Connecting-IP') || ''; if (ip && env.VOICE_CACHE) { const k = 'rls:'+ip+':'+Math.floor(Date.now()/3600000); let n=0; try{ n=parseInt(await env.VOICE_CACHE.get(k))||0; }catch(_){} if(n>=120) return json({ error:'rate_limited' },429,origin); try{ await env.VOICE_CACHE.put(k,String(n+1),{expirationTtl:3700}); }catch(_){} } }
      const contentType = request.headers.get('Content-Type') || '';
      let audioBlob;
      try {
        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData();
          audioBlob = form.get('audio') || form.get('file');
        } else {
          audioBlob = await request.blob();
        }
        if (!audioBlob || audioBlob.size === 0) return json({ error: 'audio_empty' }, 400, origin);
        if (audioBlob.size > 10 * 1024 * 1024) return json({ error: 'audio_too_large', max_mb: 10 }, 413, origin);
      } catch (err) {
        return json({ error: 'audio_parse_failed', detail: err.message }, 400, origin);
      }

      const t0 = Date.now();
      // ── SOUVERAINETÉ VOIX ────────────────────────────────────────────────
      // Dès que la clé Mistral est présente, on transcrit via Voxtral (FR) et on
      // NE bascule JAMAIS sur Whisper (US), même en cas d'échec. La voix est une
      // donnée personnelle → zéro dépendance américaine. Whisper n'intervient
      // QUE si aucune clé souveraine n'est configurée (transition).
      const sovereign = !!env.MISTRAL_API_KEY && (env.STT_PRIMARY || 'voxtral') === 'voxtral';
      let result;
      try {
        if (sovereign) {
          result = await transcribeVoxtral(env, audioBlob);
        } else if (env.AI) {
          result = await transcribeWhisperCF(env, audioBlob);
        } else {
          return json({ error: 'no_stt_provider_configured' }, 500, origin);
        }
      } catch (err) {
        // En mode souverain : pas de repli américain. Échec propre.
        if (!sovereign && env.AI) {
          try { result = await transcribeWhisperCF(env, audioBlob); }
          catch (err2) { return json({ error: 'stt_all_providers_failed', detail: err.message }, 502, origin); }
        } else {
          return json({ error: 'stt_failed_sovereign', detail: err.message }, 502, origin);
        }
      }

      return json({ ...result, duration_ms: Date.now() - t0 }, 200, origin);
    }

    // ─── POST /tts ────────────────────────────────
    if (url.pathname === '/tts' && request.method === 'POST') {
      // Anti-abus : plafond 120/h par IP (KV) — évite le vidage de Workers AI par curl en boucle.
      { const ip = request.headers.get('CF-Connecting-IP') || ''; if (ip && env.VOICE_CACHE) { const k = 'rl:'+ip+':'+Math.floor(Date.now()/3600000); let n=0; try{ n=parseInt(await env.VOICE_CACHE.get(k))||0; }catch(_){} if(n>=120) return json({ error:'rate_limited' },429,origin); try{ await env.VOICE_CACHE.put(k,String(n+1),{expirationTtl:3700}); }catch(_){} } }
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400, origin); }
      let { text, voice } = body || {};
      if (!text || typeof text !== 'string') return json({ error: 'text_required' }, 400, origin);
      const maxChars = parseInt(env.TTS_MAX_CHARS, 10) || 5000;
      if (text.length > maxChars) text = text.slice(0, maxChars);

      const voiceId = voice || env.VOXCPM_VOICE || 'default';

      const ttl = parseInt(env.CACHE_TTL_HOURS, 10) * 3600 || 604800;
      // Cache KV par hash(texte)
      const cacheKey = `tts:sov:${(await sha256Hex(text)).slice(0, 32)}`;
      try {
        const cached = await env.VOICE_CACHE.get(cacheKey, 'arrayBuffer');
        if (cached) return new Response(cached, { status: 200, headers: { 'Content-Type': 'audio/wav', 'X-Cache': 'HIT', 'X-Provider': 'cf-melotts', 'Cache-Control': 'private, max-age=604800', ...corsHeaders(origin) } });
      } catch (_) { /* cache miss → continue */ }

      // Option premium (si un jour configurée) : VoxCPM via Modal — sinon on reste souverain Cloudflare
      if (env.VOXCPM_API_URL) {
        try {
          const audioStream = await speakVoxCPM(env, text, voiceId);
          const audioBuf = await new Response(audioStream).arrayBuffer();
          try { await env.VOICE_CACHE.put(cacheKey, audioBuf, { expirationTtl: ttl }); } catch (_) {}
          return new Response(audioBuf, { status: 200, headers: { 'Content-Type': 'audio/wav', 'X-Cache': 'MISS', 'X-Provider': 'voxcpm2', 'Cache-Control': 'private, max-age=604800', ...corsHeaders(origin) } });
        } catch (_) { /* on bascule sur le souverain Cloudflare */ }
      }

      // Souverain par défaut : Cloudflare Workers AI (MeloTTS, français, sur Cloudflare — zéro US, aucun secret)
      if (env.AI) {
        try {
          let out;
          for (const L of ['fr', 'FR', 'fr-FR']) { try { out = await env.AI.run('@cf/myshell-ai/melotts', { prompt: text, lang: L }); break; } catch (_) {} }
          if (!out) out = await env.AI.run('@cf/myshell-ai/melotts', { prompt: text });
          let b64 = out && out.audio ? String(out.audio) : '';
          if (b64.indexOf('base64,') >= 0) b64 = b64.split('base64,')[1]; // tolère un préfixe data:
          if (b64) {
            const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            try { await env.VOICE_CACHE.put(cacheKey, bin.buffer, { expirationTtl: ttl }); } catch (_) {}
            return new Response(bin, { status: 200, headers: { 'Content-Type': 'audio/wav', 'X-Cache': 'MISS', 'X-Provider': 'cf-melotts', 'Cache-Control': 'private, max-age=604800', ...corsHeaders(origin) } });
          }
        } catch (err) { return json({ error: 'tts_failed', detail: String(err.message || err).slice(0, 160), fallback_use_webspeech: true }, 502, origin); }
      }

      return json({ error: 'tts_unavailable', fallback_use_webspeech: true }, 503, origin);
    }

    // ─── GET /voices ──────────────────────────────
    // VoxCPM2 : voix prédéfinies + Voice Design (description textuelle)
    if (url.pathname === '/voices' && request.method === 'GET') {
      // Si le serveur VoxCPM expose un endpoint /v1/models, on l'interroge
      // Sinon on retourne les voix prédéfinies (VoxCPM2 Voice Design)
      const builtinVoices = [
        { voice_id: 'default', name: 'Marcel (défaut)', description: 'Voix neutre française' },
        { voice_id: 'formal', name: 'Formel', description: 'Ton sérieux, professionnel' },
        { voice_id: 'warm', name: 'Chaleureux', description: 'Ton accueillant, rassurant' },
        { voice_id: 'energetic', name: 'Dynamique', description: 'Ton vif, enthousiaste' },
      ];

      if (!env.VOXCPM_API_URL) {
        return json({ voices: builtinVoices, source: 'builtin', configured: false }, 200, origin);
      }

      try {
        // Tenter de récupérer les modèles disponibles sur le serveur
        const baseUrl = env.VOXCPM_API_URL?.replace(/\/$/, '');
        const headers = {};
        if (env.VOXCPM_API_KEY) headers['Authorization'] = `Bearer ${env.VOXCPM_API_KEY}`;
        const r = await fetch(`${baseUrl}/v1/models`, { headers });
        if (r.ok) {
          const data = await r.json();
          const models = (data.data || []).map(m => ({ voice_id: m.id, name: m.id, description: 'VoxCPM2 model' }));
          return json({ voices: models.length ? models : builtinVoices, source: 'server' }, 200, origin);
        }
      } catch (_) { /* fallback builtins */ }

      return json({ voices: builtinVoices, source: 'builtin', configured: true }, 200, origin);
    }

    return json({ error: 'not_found', path: url.pathname }, 404, origin);
  },
};
