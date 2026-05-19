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
