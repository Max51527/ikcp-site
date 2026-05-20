/**
 * ikcp-voice — Voix Marcel premium (Sprint 3)
 *
 * STT : Mistral Voxtral (France) avec fallback Cloudflare Workers AI Whisper
 * TTS : ElevenLabs voix Marcel signature, cache KV 7j
 *
 * Endpoints :
 *   GET  /health
 *   POST /stt       multipart audio → { text, lang, source, duration_ms }
 *   POST /tts       { text, voice? } → audio/mpeg stream (cached KV)
 *
 * Souveraineté :
 *   - Mistral Voxtral : France
 *   - Cloudflare Workers AI : WEUR (Paris/Frankfurt)
 *   - ElevenLabs : USA → préférer Voxtral pour STT, ElevenLabs en option Premium FO
 *   - Audio non stocké : transit uniquement
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://app.ikcp.eu',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev',
  'https://ikcp-eu.pages.dev',        // Cloudflare Pages (prod)
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
  // Workers AI Whisper (EU jurisdiction)
  const arr = new Uint8Array(await audioBlob.arrayBuffer());
  const result = await env.AI.run('@cf/openai/whisper', { audio: [...arr] });
  return { text: result.text || '', source: 'whisper-cf', lang: 'fr' };
}

// ────────────────────────────────────────────────
// TTS — ElevenLabs voix Marcel signature
// ────────────────────────────────────────────────
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function speakElevenLabs(env, text, voiceId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',  // supporte FR avec qualité haute
      voice_settings: {
        stability: 0.50,
        similarity_boost: 0.75,
        style: 0.30,
        use_speaker_boost: true,
      },
    }),
  });
  if (!r.ok) throw new Error(`elevenlabs_${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.body;  // ReadableStream audio/mpeg
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
        version: '0.2.0',
        stt: {
          voxtral: !!env.MISTRAL_API_KEY,
          whisper_cf: !!env.AI,
          primary: env.STT_PRIMARY,
        },
        tts: {
          elevenlabs: !!env.ELEVENLABS_API_KEY,
          voice_id: env.ELEVENLABS_VOICE_ID || 'default',
          primary: env.TTS_PRIMARY,
        },
        cache: !!env.VOICE_CACHE,
        region: 'WEUR Paris/Frankfurt',
      }, 200, origin);
    }

    // ─── POST /stt ────────────────────────────────
    if (url.pathname === '/stt' && request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || '';
      let audioBlob;
      try {
        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData();
          audioBlob = form.get('audio') || form.get('file');
        } else {
          // Body brut (octet-stream)
          audioBlob = await request.blob();
        }
        if (!audioBlob || audioBlob.size === 0) return json({ error: 'audio_empty' }, 400, origin);
        if (audioBlob.size > 10 * 1024 * 1024) return json({ error: 'audio_too_large', max_mb: 10 }, 413, origin);
      } catch (err) {
        return json({ error: 'audio_parse_failed', detail: err.message }, 400, origin);
      }

      const t0 = Date.now();
      let result;
      try {
        if (env.STT_PRIMARY === 'voxtral' && env.MISTRAL_API_KEY) {
          result = await transcribeVoxtral(env, audioBlob);
        } else if (env.AI) {
          result = await transcribeWhisperCF(env, audioBlob);
        } else {
          return json({ error: 'no_stt_provider_configured' }, 500, origin);
        }
      } catch (err) {
        // Fallback automatique sur Whisper CF si Voxtral échoue
        if (env.AI) {
          try { result = await transcribeWhisperCF(env, audioBlob); }
          catch (err2) { return json({ error: 'stt_all_providers_failed', detail: err.message }, 502, origin); }
        } else {
          return json({ error: 'stt_failed', detail: err.message }, 502, origin);
        }
      }

      return json({ ...result, duration_ms: Date.now() - t0 }, 200, origin);
    }

    // ─── POST /tts ────────────────────────────────
    if (url.pathname === '/tts' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400, origin); }
      let { text, voice } = body || {};
      if (!text || typeof text !== 'string') return json({ error: 'text_required' }, 400, origin);
      const maxChars = parseInt(env.TTS_MAX_CHARS, 10) || 5000;
      if (text.length > maxChars) text = text.slice(0, maxChars);

      const voiceId = voice || env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

      if (!env.ELEVENLABS_API_KEY) {
        return json({ error: 'tts_provider_not_configured', fallback_use_webspeech: true }, 503, origin);
      }

      // Cache KV par hash(text + voiceId)
      const cacheKey = `tts:${voiceId}:${(await sha256Hex(text)).slice(0, 32)}`;
      try {
        const cached = await env.VOICE_CACHE.get(cacheKey, 'arrayBuffer');
        if (cached) {
          return new Response(cached, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'X-Cache': 'HIT',
              'Cache-Control': 'private, max-age=604800',
              ...corsHeaders(origin),
            },
          });
        }
      } catch (_) { /* cache miss continue */ }

      try {
        const audioStream = await speakElevenLabs(env, text, voiceId);
        // Téléchargement complet pour caching (streaming pur ne permet pas le cache)
        const audioBuf = await new Response(audioStream).arrayBuffer();
        const ttl = parseInt(env.CACHE_TTL_HOURS, 10) * 3600 || 604800;
        try { await env.VOICE_CACHE.put(cacheKey, audioBuf, { expirationTtl: ttl }); } catch (_) {}

        return new Response(audioBuf, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'X-Cache': 'MISS',
            'Cache-Control': 'private, max-age=604800',
            ...corsHeaders(origin),
          },
        });
      } catch (err) {
        return json({ error: 'tts_failed', detail: err.message, fallback_use_webspeech: true }, 502, origin);
      }
    }

    // ─── GET /voices ──────────────────────────────
    // Liste les voix ElevenLabs disponibles (pour panneau préférences front)
    if (url.pathname === '/voices' && request.method === 'GET') {
      if (!env.ELEVENLABS_API_KEY) return json({ error: 'tts_not_configured' }, 503, origin);
      try {
        const r = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
        });
        if (!r.ok) return json({ error: 'voices_fetch_failed', status: r.status }, 502, origin);
        const data = await r.json();
        // Filtre voix françaises ou multilingues
        const voices = (data.voices || []).filter(v =>
          (v.labels?.language === 'fr' || v.labels?.language === 'french') ||
          (v.fine_tuning?.language === 'fr') ||
          (v.preview_url && v.name)
        ).map(v => ({
          voice_id: v.voice_id,
          name: v.name,
          labels: v.labels,
          preview_url: v.preview_url,
        }));
        return json({ voices }, 200, origin);
      } catch (err) {
        return json({ error: 'voices_error', detail: err.message }, 502, origin);
      }
    }

    return json({ error: 'not_found', path: url.pathname }, 404, origin);
  },
};
