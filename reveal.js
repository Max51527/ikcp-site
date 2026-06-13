/* ════════════════════════════════════════════════════════════════
   IKCP — Mouvement léger : révélation au scroll + micro-animations
   © 2026 IKCP · Créé par IKCP.EU
   ----------------------------------------------------------------
   - Apparition douce (fade + montée) des sections/cartes au scroll.
   - Stagger automatique entre éléments voisins.
   - Respecte prefers-reduced-motion (accessibilité) → aucune animation.
   - Zéro dépendance, ~1 ko. S'active tout seul au chargement.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // accessibilité : on n'anime pas

  // Sélecteurs ciblés (blocs qui gagnent à apparaître en douceur)
  var SEL = 'section, .card, .style-card, .cat-card, .sec, .tier, .univ-card, .orbit-univ, .live-card, .booking-card, .faq-item, .passion-mini, .lev, .feat, [data-reveal]';

  function init() {
    var nodes = [];
    try { nodes = Array.prototype.slice.call(document.querySelectorAll(SEL)); } catch (_) { return; }
    if (!nodes.length) return;

    // Style injecté une seule fois
    var st = document.createElement('style');
    st.textContent =
      '.ik-reveal{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}' +
      '.ik-reveal.ik-in{opacity:1;transform:none}';
    document.head.appendChild(st);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var el = e.target;
          // petit stagger selon la position parmi ses frères
          var sibs = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
          el.style.transitionDelay = Math.min(sibs % 6, 5) * 70 + 'ms';
          el.classList.add('ik-in');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

    nodes.forEach(function (el) {
      // ne pas masquer ce qui est déjà visible au-dessus de la ligne de flottaison
      var r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) * 0.92) return; // visible d'emblée → on laisse
      el.classList.add('ik-reveal');
      io.observe(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
