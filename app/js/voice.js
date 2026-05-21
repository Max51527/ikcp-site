/**
 * Marcel Voice — STT/TTS via Web Speech API navigateur
 *
 * Sécurité & RGPD :
 *  - STT : transcription locale (Chrome utilise Google STT côté client,
 *    Safari/Edge utilisent l'API OS native). Aucun audio envoyé à nos workers.
 *  - TTS : synthèse vocale OS (voix système). Aucun appel réseau.
 *  - Préférences (auto-read, voix) stockées localStorage uniquement.
 *
 * Usage :
 *   import { Voice } from './voice.js';
 *   Voice.isSupported()
 *   Voice.startListening({ onInterim, onFinal, onError, onEnd })
 *   Voice.stopListening()
 *   Voice.speak(text, { rate, voice })
 *   Voice.stopSpeaking()
 *   Voice.getPreferences() / setAutoRead(bool)
 */

const STORAGE_KEY = 'marcel_voice_prefs_v1';
const VOICE_WORKER = 'https://ikcp-voice.maxime-ead.workers.dev';

function getPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch (_) { return {}; }
}
function savePrefs(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const Voice = {
  _recognition: null,
  _listening: false,

  /** Capacités du navigateur */
  isSupported() {
    return {
      stt: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
      tts: typeof window !== 'undefined' && 'speechSynthesis' in window,
    };
  },

  /** Démarre l'écoute · callbacks { onInterim, onFinal, onError, onEnd } */
  startListening({ onInterim, onFinal, onError, onEnd, lang = 'fr-FR' } = {}) {
    if (this._listening) this.stopListening();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onError?.(new Error('STT non supporté sur ce navigateur')); return; }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) onInterim?.(interim);
      if (final) onFinal?.(final.trim());
    };
    rec.onerror = (e) => { this._listening = false; onError?.(e); };
    rec.onend = () => { this._listening = false; onEnd?.(); };

    this._recognition = rec;
    this._listening = true;
    rec.start();
  },

  stopListening() {
    if (this._recognition && this._listening) {
      try { this._recognition.stop(); } catch (_) {}
    }
    this._listening = false;
  },

  isListening() { return this._listening; },

  /** Synthèse vocale — Marcel parle */
  speak(text, { rate = 1.0, pitch = 1.0, voiceName } = {}) {
    if (!('speechSynthesis' in window)) return;
    if (!text || typeof text !== 'string') return;

    // Stoppe une lecture en cours
    this.stopSpeaking();

    // Nettoie le markdown basique pour la lecture
    const clean = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\|/g, ' ')
      .replace(/[─━┌┐└┘├┤┬┴┼]/g, ' ')
      .trim();

    // Découpage par phrases pour fluidité (~200 chars max par utterance)
    const sentences = clean.match(/[^.!?]+[.!?]+|\S+/g) || [clean];
    const chunks = [];
    let buf = '';
    for (const s of sentences) {
      if ((buf + s).length > 220) { if (buf) chunks.push(buf.trim()); buf = s; }
      else { buf += ' ' + s; }
    }
    if (buf.trim()) chunks.push(buf.trim());

    // Sélection voix française
    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    if (voiceName) voice = voices.find(v => v.name === voiceName);
    if (!voice) voice = voices.find(v => v.lang === 'fr-FR' && /femme|female|amelie|audrey|virginie|marie/i.test(v.name));
    if (!voice) voice = voices.find(v => v.lang === 'fr-FR');
    if (!voice) voice = voices.find(v => v.lang.startsWith('fr'));

    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = 'fr-FR';
      u.rate = rate;
      u.pitch = pitch;
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    });
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  },

  isSpeaking() {
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  },

  /** Préférences utilisateur (localStorage) */
  getPreferences() {
    return { autoRead: false, rate: 1.0, voiceName: null, ...getPrefs() };
  },
  setAutoRead(v) {
    const p = getPrefs();
    p.autoRead = !!v;
    savePrefs(p);
  },
  setRate(r) {
    const p = getPrefs();
    p.rate = Math.max(0.5, Math.min(2, r));
    savePrefs(p);
  },
  setVoice(name) {
    const p = getPrefs();
    p.voiceName = name;
    savePrefs(p);
  },

  /** Liste les voix FR disponibles dans le navigateur */
  listFrenchVoices() {
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('fr'));
  },

  // ────────────────────────────────────────────────
  // MODE PREMIUM — STT/TTS serveur (Mistral Voxtral + VoxCPM2)
  // ────────────────────────────────────────────────

  _audioRecorder: null,
  _audioStream: null,
  _audioChunks: [],
  _audioPlayer: null,

  /** STT serveur premium : enregistre micro → POST /stt → texte
   *  callbacks { onStart, onStop, onFinal, onError, maxSeconds }
   */
  async startRecordingPremium({ onStart, onStop, onFinal, onError, maxSeconds = 60 } = {}) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioStream = stream;
      this._audioChunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 });

      rec.ondataavailable = (e) => { if (e.data.size > 0) this._audioChunks.push(e.data); };
      rec.onstop = async () => {
        // Stop tracks micro
        stream.getTracks().forEach(t => t.stop());
        onStop?.();
        const blob = new Blob(this._audioChunks, { type: mime });
        if (blob.size < 1000) { onError?.(new Error('Enregistrement trop court')); return; }

        // POST vers worker voice
        try {
          const form = new FormData();
          form.append('audio', blob, 'recording.webm');
          const r = await fetch(VOICE_WORKER + '/stt', { method: 'POST', body: form, credentials: 'include' });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            onError?.(new Error(err.error || `HTTP ${r.status}`));
            return;
          }
          const data = await r.json();
          onFinal?.(data.text, { source: data.source, durationMs: data.duration_ms });
        } catch (e) {
          onError?.(e);
        }
      };
      rec.onerror = (e) => onError?.(e.error || new Error('Erreur enregistrement'));

      this._audioRecorder = rec;
      rec.start();
      onStart?.();

      // Auto-stop après maxSeconds
      setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, maxSeconds * 1000);
    } catch (err) {
      onError?.(err);
    }
  },

  stopRecordingPremium() {
    if (this._audioRecorder && this._audioRecorder.state === 'recording') {
      this._audioRecorder.stop();
    }
  },

  isRecordingPremium() {
    return this._audioRecorder?.state === 'recording';
  },

  /** TTS serveur premium : POST /tts → audio/wav (VoxCPM2) → playback */
  async speakPremium(text, { voiceId } = {}) {
    this.stopSpeaking();
    if (!text || typeof text !== 'string') return false;
    try {
      const r = await fetch(VOICE_WORKER + '/tts', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: voiceId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        if (err.fallback_use_webspeech) {
          this.speak(text);
          return 'fallback_webspeech';
        }
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const buf = await r.arrayBuffer();
      // VoxCPM2 retourne audio/wav — Audio() gère wav et mp3 nativement
      const mimeType = r.headers.get('Content-Type') || 'audio/wav';
      const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: mimeType })));
      this._audioPlayer = audio;
      audio.onended = () => { this._audioPlayer = null; URL.revokeObjectURL(audio.src); };
      await audio.play();
      return 'premium';
    } catch (err) {
      console.warn('[voice] TTS premium failed, fallback Web Speech:', err.message);
      this.speak(text);
      return 'fallback_webspeech';
    }
  },

  stopPremiumPlayback() {
    if (this._audioPlayer) {
      this._audioPlayer.pause();
      this._audioPlayer.currentTime = 0;
      this._audioPlayer = null;
    }
  },

  /** Override stopSpeaking pour couvrir les 2 modes */
  stopSpeakingAll() {
    this.stopSpeaking();
    this.stopPremiumPlayback();
  },

  /** Sélection automatique : premium si dispo + autorisé, fallback Web Speech */
  async smartSpeak(text, { tier, voiceId } = {}) {
    const prefs = this.getPreferences();
    if (prefs.premiumMode && (tier === 'premium' || tier === 'fo')) {
      return await this.speakPremium(text, { voiceId });
    }
    this.speak(text, { rate: prefs.rate || 1.0 });
    return 'webspeech';
  },

  async smartListen(callbacks = {}) {
    const prefs = this.getPreferences();
    if (prefs.premiumMode) {
      return this.startRecordingPremium(callbacks);
    }
    return this.startListening(callbacks);
  },

  setPremiumMode(v) {
    const p = getPrefs();
    p.premiumMode = !!v;
    savePrefs(p);
  },

  /** Health check du worker voice */
  async checkPremiumStatus() {
    try {
      const r = await fetch(VOICE_WORKER + '/health');
      const data = await r.json();
      return {
        ok: r.ok,
        stt_voxtral: data.stt?.voxtral || false,
        stt_whisper: data.stt?.whisper_cf || false,
        tts_voxcpm: data.tts?.configured || false,
      };
    } catch (_) {
      return { ok: false };
    }
  },
};

// Initialisation : Chrome charge les voix de manière async
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded — disponibles via Voice.listFrenchVoices()
  };
  // Trigger initial loading
  window.speechSynthesis.getVoices();
}

export { Voice };
if (typeof window !== 'undefined') window.MarcelVoice = Voice;
