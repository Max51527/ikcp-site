/**
 * <marcel-vision> — Web component drag-drop + vision Marcel
 *
 * Permet à l'utilisateur de déposer un document (PDF, image, screenshot)
 * pour que Marcel le lise en direct via l'API Anthropic vision.
 *
 * Usage :
 *   <marcel-vision agents-url="https://agents.ikcp.eu"
 *                  marcel-url="https://chat.ikcp.eu"></marcel-vision>
 *
 * Événements :
 *   - 'vision-start' { filename, type, size }
 *   - 'vision-progress' { text }   — streaming des chunks Marcel
 *   - 'vision-done' { full_text, document_kind?, extracted? }
 *   - 'vision-error' { message }
 *
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 */

class MarcelVision extends HTMLElement {
  connectedCallback() {
    const agentsUrl = this.getAttribute('agents-url') || 'https://agents.ikcp.eu';
    const marcelUrl = this.getAttribute('marcel-url') || 'https://chat.ikcp.eu';
    this.agentsUrl = agentsUrl;
    this.marcelUrl = marcelUrl;

    this.innerHTML = `
      <style>
        marcel-vision .mv-drop {
          border: 2px dashed rgba(196,162,115,0.4);
          background: rgba(196,162,115,0.04);
          border-radius: 4px; padding: 48px 32px;
          text-align: center; cursor: pointer;
          transition: all 0.25s; min-height: 180px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
          font-family: 'Inter', sans-serif;
        }
        marcel-vision .mv-drop:hover,
        marcel-vision .mv-drop.over {
          border-color: #c4a273;
          background: rgba(196,162,115,0.10);
        }
        marcel-vision .mv-drop.processing {
          border-color: #7fae7d;
          background: rgba(127,174,125,0.06);
          cursor: wait;
        }
        marcel-vision .mv-icon { font-size: 36px; color: #c4a273; }
        marcel-vision .mv-title {
          font-family: 'Playfair Display', serif; font-size: 18px;
          font-style: italic; color: #f4ece1; margin: 0;
        }
        marcel-vision .mv-sub {
          font-size: 12px; color: #8c857a; letter-spacing: 0.05em;
        }
        marcel-vision input[type=file] { display: none; }
        marcel-vision .mv-output {
          margin-top: 16px; padding: 20px 24px;
          background: #0d100e; border: 1px solid rgba(196,162,115,0.14);
          font-family: 'JetBrains Mono', monospace; font-size: 13px;
          color: #f4ece1; line-height: 1.7; max-height: 400px;
          overflow-y: auto; white-space: pre-wrap; display: none;
        }
        marcel-vision .mv-output.show { display: block; }
        marcel-vision .mv-spinner {
          width: 16px; height: 16px; border: 2px solid rgba(196,162,115,0.3);
          border-top-color: #c4a273; border-radius: 50%;
          animation: mv-spin 0.8s linear infinite;
          display: inline-block; vertical-align: middle; margin-right: 8px;
        }
        @keyframes mv-spin { to { transform: rotate(360deg); } }
      </style>
      <label class="mv-drop">
        <div class="mv-icon">📄</div>
        <p class="mv-title">Déposez un document — avis IR, Kbis, acte…</p>
        <div class="mv-sub">PDF, JPG, PNG · jusqu'à 10 MB · ou cliquez pour parcourir</div>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp">
      </label>
      <div class="mv-output"></div>
    `;

    this.drop = this.querySelector('.mv-drop');
    this.input = this.querySelector('input[type=file]');
    this.output = this.querySelector('.mv-output');
    this.subEl = this.querySelector('.mv-sub');

    this.drop.addEventListener('click', () => this.input.click());

    this.drop.addEventListener('dragover', e => {
      e.preventDefault(); this.drop.classList.add('over');
    });
    this.drop.addEventListener('dragleave', () => this.drop.classList.remove('over'));
    this.drop.addEventListener('drop', e => {
      e.preventDefault(); this.drop.classList.remove('over');
      if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
    });

    this.input.addEventListener('change', e => {
      if (e.target.files.length) this.handleFile(e.target.files[0]);
    });
  }

  async handleFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      this.showError('Fichier > 10 MB — utilisez l\'agent documents pour les gros fichiers');
      return;
    }
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.showError(`Type ${file.type} non supporté`);
      return;
    }

    this.dispatchEvent(new CustomEvent('vision-start', {
      detail: { filename: file.name, type: file.type, size: file.size }, bubbles: true,
    }));

    this.drop.classList.add('processing');
    this.subEl.innerHTML = '<span class="mv-spinner"></span> Marcel lit le document…';
    this.output.classList.add('show');
    this.output.textContent = '';

    try {
      const b64 = await fileToBase64(file);
      const isPdf = file.type === 'application/pdf';
      const mediaType = file.type;

      // Appel Marcel chat avec content multimodal
      const r = await fetch(`${this.marcelUrl}/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'Lis ce document. Classifie-le (avis_ir / avis_ifi / kbis / statuts / acte_donation / contrat_av / autre). Extrais les champs clés en JSON. Mentionne les points d\'attention.',
          attachments: [{
            type: isPdf ? 'document' : 'image',
            source: { type: 'base64', media_type: mediaType, data: b64 },
          }],
          theme: 'admin',
        }),
      });

      if (!r.ok) {
        const err = await r.text().catch(() => '');
        throw new Error(`marcel ${r.status}: ${err.slice(0, 100)}`);
      }
      const data = await r.json();
      const reply = data.reply || data.text || JSON.stringify(data).slice(0, 500);

      this.output.textContent = reply;
      this.drop.classList.remove('processing');
      this.subEl.textContent = '✓ Marcel a lu — déposez un autre document si besoin';

      // Détection de JSON structuré dans la réponse
      let extracted = null;
      const jsonMatch = reply.match(/```json\s*([\s\S]+?)\s*```/);
      if (jsonMatch) {
        try { extracted = JSON.parse(jsonMatch[1]); } catch {}
      }

      this.dispatchEvent(new CustomEvent('vision-done', {
        detail: { full_text: reply, extracted, document_kind: extracted?.type || null },
        bubbles: true,
      }));
    } catch (e) {
      this.showError(e.message || 'Erreur de lecture');
      this.dispatchEvent(new CustomEvent('vision-error', {
        detail: { message: e.message }, bubbles: true,
      }));
    }
  }

  showError(msg) {
    this.drop.classList.remove('processing');
    this.subEl.textContent = `✗ ${msg}`;
    this.output.classList.remove('show');
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

customElements.define('marcel-vision', MarcelVision);
