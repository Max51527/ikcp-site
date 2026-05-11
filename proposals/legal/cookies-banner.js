/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4
 *
 * IKCP Cookies banner — RGPD-compliant consent management léger
 *
 * Conforme aux recommandations CNIL :
 *  · Bouton refuser aussi visible que bouton accepter
 *  · Choix mémorisé 13 mois maximum (consent_at > 13 * 30 j → re-prompt)
 *  · Pas de cookie tiers déposé tant que consentement non donné
 *  · Lien clair vers la politique de cookies
 *
 * Usage : ajouter dans le <head> ou avant </body> de chaque page :
 *   <script src="/proposals/legal/cookies-banner.js" defer></script>
 *
 * Convention de stockage :
 *   localStorage['ikcp_consent_v1'] = JSON.stringify({
 *     status: 'accepted' | 'refused' | 'partial',
 *     functional: true|false,
 *     analytics: true|false,
 *     consent_at: ISO timestamp
 *   })
 */

(function () {
  const CONSENT_KEY = 'ikcp_consent_v1';
  const CONSENT_TTL_MONTHS = 13;
  const POLICY_URL = '/proposals/legal/politique-cookies.html';

  function getStoredConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const age = Date.now() - new Date(parsed.consent_at).getTime();
      const ttl = CONSENT_TTL_MONTHS * 30 * 24 * 3600 * 1000;
      if (age > ttl) return null;
      return parsed;
    } catch { return null; }
  }

  function saveConsent(status, functional = false, analytics = false) {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      status, functional, analytics,
      consent_at: new Date().toISOString(),
      version: '1.0',
    }));
    window.IKCP_CONSENT = { status, functional, analytics };
    // Émet un évènement pour les scripts qui en dépendent
    window.dispatchEvent(new CustomEvent('ikcp:consent-changed', { detail: { status, functional, analytics } }));
  }

  function injectCss() {
    if (document.getElementById('ikcp-cookies-banner-css')) return;
    const style = document.createElement('style');
    style.id = 'ikcp-cookies-banner-css';
    style.textContent = `
      .ikcp-cb-overlay {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
        background: #0a0d0b; color: #f4ece1;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 300; line-height: 1.6; padding: 20px 24px;
        border-top: 1px solid rgba(196,162,115,0.32);
        box-shadow: 0 -4px 32px rgba(0,0,0,0.5);
      }
      .ikcp-cb-wrap { max-width: 1100px; margin: 0 auto; display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
      .ikcp-cb-text { flex: 1; min-width: 280px; font-size: 13px; color: #8c857a; }
      .ikcp-cb-text strong { color: #c4a273; font-weight: 500; }
      .ikcp-cb-text a { color: #c4a273; text-decoration: none; border-bottom: 1px solid rgba(196,162,115,0.4); }
      .ikcp-cb-text a:hover { border-bottom-color: #c4a273; }
      .ikcp-cb-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .ikcp-cb-btn {
        background: transparent; color: #f4ece1; border: 1px solid rgba(196,162,115,0.32);
        padding: 9px 18px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
        cursor: pointer; transition: all 0.25s; font-family: inherit; font-weight: 500;
        border-radius: 1px;
      }
      .ikcp-cb-btn:hover { border-color: #c4a273; color: #c4a273; }
      .ikcp-cb-btn.primary { background: #c4a273; color: #0a0d0b; border-color: #c4a273; }
      .ikcp-cb-btn.primary:hover { background: transparent; color: #c4a273; }
      @media (max-width: 720px) {
        .ikcp-cb-wrap { flex-direction: column; gap: 16px; }
        .ikcp-cb-actions { width: 100%; }
        .ikcp-cb-btn { flex: 1; min-width: 0; padding: 11px 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function showBanner() {
    if (document.getElementById('ikcp-cookies-banner')) return;
    injectCss();

    const banner = document.createElement('div');
    banner.id = 'ikcp-cookies-banner';
    banner.className = 'ikcp-cb-overlay';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Bandeau de consentement aux cookies');
    banner.innerHTML = `
      <div class="ikcp-cb-wrap">
        <div class="ikcp-cb-text">
          <strong>Cookies & confidentialité.</strong>
          IKCP utilise uniquement les cookies <em>strictement nécessaires</em> au fonctionnement du site
          (authentification, sécurité Cloudflare). <strong>Aucun cookie publicitaire</strong>, aucun tracker tiers.
          Vous pouvez accepter les cookies fonctionnels (reprise de conversation Marcel) ou les refuser.
          <a href="${POLICY_URL}">Voir la politique cookies</a>
        </div>
        <div class="ikcp-cb-actions">
          <button class="ikcp-cb-btn" id="ikcp-cb-refuse">Refuser fonctionnels</button>
          <button class="ikcp-cb-btn primary" id="ikcp-cb-accept">Accepter</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('ikcp-cb-accept').addEventListener('click', () => {
      saveConsent('accepted', true, false);
      banner.remove();
    });
    document.getElementById('ikcp-cb-refuse').addEventListener('click', () => {
      saveConsent('refused', false, false);
      banner.remove();
    });
  }

  // Init
  function init() {
    const stored = getStoredConsent();
    if (stored) {
      window.IKCP_CONSENT = stored;
      return;
    }
    // Pas de consentement → afficher le banner
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner);
  }

  init();
})();
