/**
 * <marcel-voice> — Web component voix Marcel
 *
 * Usage :
 *   <script src="/assets/marcel-voice.js" type="module"></script>
 *   <marcel-voice tts-url="https://voice.ikcp.eu/tts"
 *                 stt-url="https://voice.ikcp.eu/stt"></marcel-voice>
 *
 * API JS :
 *   const voice = document.querySelector('marcel-voice');
 *   await voice.speak("Bonjour, je suis Marcel.");
 *   voice.addEventListener('transcript', e => console.log(e.detail.text));
 *
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 */

class MarcelVoice extends HTMLElement {
  constructor() {
    super();
    this.mediaRecorder = null;
    this.chunks = [];
    this.currentAudio = null;
  }

  connectedCallback() {
    const ttsUrl = this.getAttribute('tts-url') || 'https://voice.ikcp.eu/tts';
    const sttUrl = this.getAttribute('stt-url') || 'https://voice.ikcp.eu/stt';
    this.ttsUrl = ttsUrl;
    this.sttUrl = sttUrl;

    this.innerHTML = `
      <style>
        marcel-voice .mv-wrap { display: inline-flex; align-items: center; gap: 12px; }
        marcel-voice button.mv-btn {
          width: 56px; height: 56px; border-radius: 50%; border: 1px solid #c4a273;
          background: rgba(196,162,115,0.08); color: #c4a273; font-size: 20px;
          cursor: pointer; transition: all 0.2s; display: inline-flex;
          align-items: center; justify-content: center;
        }
        marcel-voice button.mv-btn:hover { background: #c4a273; color: #0a0d0b; }
        marcel-voice button.mv-btn.recording { background: #b85a5a; color: #fff;
          animation: mv-pulse 1.2s ease-in-out infinite; }
        marcel-voice button.mv-btn.playing { background: #7fae7d; color: #0a0d0b; }
        marcel-voice button.mv-btn:disabled { opacity: 0.4; cursor: wait; }
        @keyframes mv-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(184,90,90,0.6); }
          50% { box-shadow: 0 0 0 12px rgba(184,90,90,0); }
        }
        marcel-voice .mv-status {
          font-family: 'Playfair Display', serif; font-style: italic;
          font-size: 13px; color: #8c857a; min-width: 200px;
        }
      </style>
      <div class="mv-wrap">
        <button class="mv-btn mv-mic" title="Maintenir pour parler à Marcel" aria-label="Parler">🎤</button>
        <button class="mv-btn mv-stop" title="Stopper la lecture" aria-label="Stopper" style="display:none">⏸</button>
        <span class="mv-status">Cliquez pour parler à Marcel</span>
      </div>
    `;

    this.btnMic = this.querySelector('.mv-mic');
    this.btnStop = this.querySelector('.mv-stop');
    this.statusEl = this.querySelector('.mv-status');

    // Press-and-hold pour parler
    this.btnMic.addEventListener('mousedown', () => this.startRecording());
    this.btnMic.addEventListener('mouseup', () => this.stopRecording());
    this.btnMic.addEventListener('touchstart', e => { e.preventDefault(); this.startRecording(); }, { passive: false });
    this.btnMic.addEventListener('touchend', e => { e.preventDefault(); this.stopRecording(); });

    this.btnStop.addEventListener('click', () => this.stopPlayback());
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.chunks = [];
      this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRecorder.onstop = () => this.processRecording(stream);
      this.mediaRecorder.start();
      this.btnMic.classList.add('recording');
      this.setStatus('🔴 J\'écoute…');
    } catch (e) {
      this.setStatus('Micro non autorisé — vérifiez vos paramètres');
      console.error('getUserMedia error:', e);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.btnMic.classList.remove('recording');
    }
  }

  async processRecording(stream) {
    // Arrêter le micro
    stream.getTracks().forEach(t => t.stop());

    if (this.chunks.length === 0) {
      this.setStatus('Pas de son détecté');
      return;
    }

    const blob = new Blob(this.chunks, { type: 'audio/webm' });
    this.setStatus('🤔 Transcription en cours…');
    this.btnMic.disabled = true;

    try {
      const form = new FormData();
      form.append('file', blob, 'rec.webm');
      form.append('language', this.getAttribute('language') || 'fr');

      const r = await fetch(this.sttUrl, { method: 'POST', body: form });
      const data = await r.json();
      const text = (data.text || '').trim();

      if (!text) {
        this.setStatus('Je n\'ai pas compris, réessayez ?');
      } else {
        this.setStatus(`"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);
        this.dispatchEvent(new CustomEvent('transcript', {
          detail: { text }, bubbles: true,
        }));
      }
    } catch (e) {
      this.setStatus('Erreur transcription');
      console.error(e);
    } finally {
      this.btnMic.disabled = false;
    }
  }

  /**
   * Faire parler Marcel.
   * @param {string} text - texte à dire
   * @param {string} voice - id de voix (default | marcel_fr | pedagogue)
   */
  async speak(text, voice = 'default') {
    if (!text) return;
    this.stopPlayback();
    this.setStatus('🔊 Marcel parle…');
    this.btnMic.classList.add('playing');
    this.btnStop.style.display = 'inline-flex';

    try {
      const r = await fetch(this.ttsUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, voice, format: 'wav' }),
      });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      const audioBlob = await r.blob();
      const url = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(url);
      this.currentAudio.onended = () => {
        this.setStatus('');
        this.btnMic.classList.remove('playing');
        this.btnStop.style.display = 'none';
        URL.revokeObjectURL(url);
        this.dispatchEvent(new CustomEvent('speak-end', { bubbles: true }));
      };
      await this.currentAudio.play();
    } catch (e) {
      this.setStatus('Erreur synthèse vocale');
      this.btnMic.classList.remove('playing');
      this.btnStop.style.display = 'none';
      console.error(e);
    }
  }

  /**
   * Stream un audio depuis une URL (utile pour endpoint /demo/:id/voice
   * qui retourne directement le binary audio).
   */
  async playFromUrl(url, postBody) {
    this.stopPlayback();
    this.setStatus('🔊 Marcel parle…');
    this.btnMic.classList.add('playing');
    this.btnStop.style.display = 'inline-flex';

    try {
      const r = await fetch(url, postBody ? {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(postBody),
      } : undefined);
      if (!r.ok) throw new Error(`audio ${r.status}`);
      const blob = await r.blob();
      const audioUrl = URL.createObjectURL(blob);
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.onended = () => {
        this.setStatus('');
        this.btnMic.classList.remove('playing');
        this.btnStop.style.display = 'none';
        URL.revokeObjectURL(audioUrl);
        this.dispatchEvent(new CustomEvent('speak-end', { bubbles: true }));
      };
      await this.currentAudio.play();
    } catch (e) {
      this.setStatus('Erreur audio');
      this.btnMic.classList.remove('playing');
      this.btnStop.style.display = 'none';
      console.error(e);
    }
  }

  stopPlayback() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.btnMic.classList.remove('playing');
    this.btnStop.style.display = 'none';
    this.setStatus('');
  }
}

customElements.define('marcel-voice', MarcelVoice);
