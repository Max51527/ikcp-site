/**
 * <marcel-feedback> — Web component feedback bêta in-app
 *
 * Permet aux bêta-testeurs de remonter rapidement bug / idée / retour
 * depuis n'importe quelle page. POST vers ikcp-feedback worker.
 *
 * Usage :
 *   <script type="module" src="/assets/marcel-feedback.js"></script>
 *   <marcel-feedback feedback-url="https://ikcp-feedback.maxime-ead.workers.dev"></marcel-feedback>
 *
 * Bouton flottant en bas à droite. Au clic → modal avec :
 *   - radio : Bug / Idée / Retour / Question
 *   - textarea
 *   - submit → POST /feedback
 *
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 */

class MarcelFeedback extends HTMLElement {
  connectedCallback() {
    this.feedbackUrl = this.getAttribute('feedback-url') || 'https://ikcp-feedback.maxime-ead.workers.dev';
    this.userEmail = this.getAttribute('user-email') || '';

    this.innerHTML = `
      <style>
        marcel-feedback button.mf-fab {
          position: fixed; bottom: 24px; right: 24px; z-index: 9000;
          width: 56px; height: 56px; border-radius: 50%;
          border: 1px solid #c4a273; background: #0a0d0b; color: #c4a273;
          font-size: 22px; cursor: pointer; transition: all 0.25s;
          box-shadow: 0 6px 20px rgba(0,0,0,0.4);
          font-family: 'Inter', sans-serif;
        }
        marcel-feedback button.mf-fab:hover { background: #c4a273; color: #0a0d0b; transform: scale(1.05); }
        marcel-feedback .mf-back {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9001;
          display: none; align-items: flex-end; justify-content: center;
        }
        marcel-feedback .mf-back.show { display: flex; }
        marcel-feedback .mf-modal {
          width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
          background: #0d100e; border: 1px solid #c4a273; border-bottom: none;
          padding: 28px 24px 32px;
        }
        @media (min-width: 720px) {
          marcel-feedback .mf-back { align-items: center; }
          marcel-feedback .mf-modal { border-bottom: 1px solid #c4a273; }
        }
        marcel-feedback .mf-modal h3 {
          font-family: 'Playfair Display', serif; font-style: italic;
          font-size: 22px; color: #c4a273; margin-bottom: 6px; font-weight: 400;
        }
        marcel-feedback .mf-modal p { font-size: 13px; color: #8c857a; margin-bottom: 22px; }
        marcel-feedback .mf-types { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        marcel-feedback .mf-types button {
          padding: 8px 14px; background: transparent; border: 1px solid rgba(196,162,115,0.3);
          color: #8c857a; font-size: 12px; cursor: pointer; transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }
        marcel-feedback .mf-types button.active { background: #c4a273; color: #0a0d0b; border-color: #c4a273; }
        marcel-feedback textarea {
          width: 100%; min-height: 120px; padding: 14px 16px;
          background: #0a0d0b; border: 1px solid rgba(196,162,115,0.2);
          color: #f4ece1; font-family: 'Inter', sans-serif; font-size: 14px;
          line-height: 1.6; resize: vertical;
        }
        marcel-feedback textarea:focus { outline: none; border-color: #c4a273; }
        marcel-feedback .mf-row { display: flex; gap: 10px; margin-top: 18px; }
        marcel-feedback .mf-row button {
          padding: 12px 22px; font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        marcel-feedback .mf-row .mf-send {
          background: #c4a273; color: #0a0d0b; border: 1px solid #c4a273; flex: 1;
        }
        marcel-feedback .mf-row .mf-send:hover { background: transparent; color: #c4a273; }
        marcel-feedback .mf-row .mf-send:disabled { opacity: 0.4; cursor: wait; }
        marcel-feedback .mf-row .mf-cancel {
          background: transparent; color: #8c857a; border: 1px solid rgba(196,162,115,0.2);
        }
        marcel-feedback .mf-status {
          margin-top: 14px; padding: 12px 16px; font-size: 13px;
          font-style: italic; font-family: 'Playfair Display', serif;
          display: none;
        }
        marcel-feedback .mf-status.show { display: block; }
        marcel-feedback .mf-status.success { color: #7fae7d; background: rgba(127,174,125,0.06); border-left: 3px solid #7fae7d; }
        marcel-feedback .mf-status.error { color: #b85a5a; background: rgba(184,90,90,0.06); border-left: 3px solid #b85a5a; }
        marcel-feedback .mf-hint { font-size: 11px; color: #524d47; margin-top: 10px; font-family: 'Inter', sans-serif; }
      </style>
      <button class="mf-fab" title="Donner mon feedback bêta" aria-label="Feedback">💬</button>
      <div class="mf-back" role="dialog" aria-modal="true">
        <div class="mf-modal">
          <h3>Votre retour bêta</h3>
          <p>Maxime lit chaque message. Pas de formulaire à rallonge, juste 30 secondes.</p>

          <div class="mf-types">
            <button data-type="bug">🐛 Bug</button>
            <button data-type="idee">💡 Idée</button>
            <button data-type="retour" class="active">✍ Retour</button>
            <button data-type="question">❓ Question</button>
          </div>

          <textarea placeholder="Ce qui marche, ce qui manque, ce qui doit changer…" maxlength="2000"></textarea>
          <div class="mf-hint">Anonyme si vous le souhaitez. La page actuelle et votre email (si connecté) sont joints automatiquement.</div>

          <div class="mf-row">
            <button class="mf-cancel">Annuler</button>
            <button class="mf-send">Envoyer →</button>
          </div>

          <div class="mf-status" id="mf-status"></div>
        </div>
      </div>
    `;

    this.fab = this.querySelector('.mf-fab');
    this.back = this.querySelector('.mf-back');
    this.modal = this.querySelector('.mf-modal');
    this.textarea = this.querySelector('textarea');
    this.sendBtn = this.querySelector('.mf-send');
    this.cancelBtn = this.querySelector('.mf-cancel');
    this.statusEl = this.querySelector('#mf-status');
    this.currentType = 'retour';

    this.fab.addEventListener('click', () => this.open());
    this.back.addEventListener('click', (e) => { if (e.target === this.back) this.close(); });
    this.cancelBtn.addEventListener('click', () => this.close());
    this.sendBtn.addEventListener('click', () => this.send());

    this.querySelectorAll('.mf-types button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.querySelectorAll('.mf-types button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
      });
    });

    // Escape pour fermer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.back.classList.contains('show')) this.close();
    });
  }

  open() {
    this.back.classList.add('show');
    this.statusEl.classList.remove('show');
    setTimeout(() => this.textarea.focus(), 100);
  }

  close() {
    this.back.classList.remove('show');
    this.textarea.value = '';
    this.statusEl.classList.remove('show');
    this.sendBtn.disabled = false;
  }

  showStatus(msg, type) {
    this.statusEl.textContent = msg;
    this.statusEl.className = `mf-status show ${type}`;
  }

  async send() {
    const msg = this.textarea.value.trim();
    if (!msg || msg.length < 5) {
      this.showStatus('Quelques mots de plus ?', 'error');
      return;
    }
    this.sendBtn.disabled = true;

    try {
      const r = await fetch(`${this.feedbackUrl}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: this.currentType,
          message: msg,
          email: this.userEmail,
          page: window.location.pathname,
          user_agent: navigator.userAgent.slice(0, 200),
          ts: new Date().toISOString(),
        }),
      });

      if (r.ok) {
        this.showStatus('Merci. Maxime le lira aujourd\'hui.', 'success');
        this.textarea.value = '';
        setTimeout(() => this.close(), 2500);
      } else {
        const err = await r.text();
        this.showStatus(`Erreur — réessayez ou envoyez à maxime@ikcp.fr (${r.status})`, 'error');
        this.sendBtn.disabled = false;
        console.error('feedback:', err);
      }
    } catch (e) {
      this.showStatus(`Réseau indisponible. Réessayez ou maxime@ikcp.fr (${e.message})`, 'error');
      this.sendBtn.disabled = false;
    }
  }

  setUser(email) { this.userEmail = email; }
}

customElements.define('marcel-feedback', MarcelFeedback);
