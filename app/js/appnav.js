/**
 * IKCP — Barre d'onglets de l'application (bottom tab bar)
 * Donne à l'espace membre le ressenti d'une vraie app native (iOS/Android).
 * Auto-injectée sur les pages membres via api.js (import à effet de bord).
 *
 * • S'affiche UNIQUEMENT sur les pages membres listées dans SHOW_ON.
 * • Exclut marcel.html (chat immersif plein écran avec composer fixe).
 * • S'adapte au thème : couleur active = var(--accent) (or FO / terracotta).
 * • Respecte l'encoche (safe-area-inset-bottom) en mode standalone.
 *
 * © 2026 IKCP · ORIAS 23001568
 */
(function () {
  // Pages qui reçoivent la barre (sans .html, URLs propres Cloudflare Pages)
  var SHOW_ON = ['dashboard', 'patrimoine', 'conciergerie', 'collections', 'veille', 'carnet', 'documents', 'profil', 'securite'];

  // Page courante : dernier segment, sans extension
  var seg = (location.pathname.replace(/\/+$/, '').split('/').pop() || '').replace(/\.html$/, '');
  if (SHOW_ON.indexOf(seg) === -1) return;          // pas une page à onglets → on sort
  if (document.querySelector('.ikcp-appnav')) return; // déjà injectée

  // Onglets — Marcel reste au centre (bouton surélevé) ; les 4 autres sont
  // réordonnables depuis le Studio (localStorage 'ikcp_nav_order').
  var MARCEL = { id:'marcel', label: 'Marcel', href: '/app/marcel', match: ['marcel'], fab: true };
  var OTHERS = {
    accueil:    { id:'accueil', label: 'Accueil', href: '/app/dashboard', match: ['dashboard'],
      svg: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>' },
    patrimoine: { id:'patrimoine', label: 'Patrimoine', href: '/app/patrimoine', match: ['patrimoine'],
      svg: '<path d="M4 20V11M9.3 20V4M14.6 20v-6M20 20V8"/><path d="M2.5 20h19"/>' },
    univers:    { id:'univers', label: 'Univers', href: '/app/conciergerie', match: ['conciergerie', 'collections'],
      svg: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5.3-5.3 2.2 2.2-5.3z"/>' },
    veille:     { id:'veille', label: 'Veille', href: '/app/veille', match: ['veille'],
      svg: '<path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 14.5 18 8.5"/><path d="M13.6 21a2 2 0 0 1-3.2 0"/>' }
  };
  var DEFAULT_ORDER = ['accueil', 'patrimoine', 'univers', 'veille'];
  var order = DEFAULT_ORDER.slice();
  try {
    var saved = JSON.parse(localStorage.getItem('ikcp_nav_order') || 'null');
    if (Array.isArray(saved) && saved.length === 4 && saved.every(function(k){ return OTHERS[k]; }) && (new Set(saved)).size === 4) order = saved;
  } catch (_) {}
  var o = order.map(function(k){ return OTHERS[k]; });
  var TABS = [o[0], o[1], MARCEL, o[2], o[3]];

  // ── Styles (injectés une fois) ──
  var css = ''
    + '.ikcp-appnav{position:fixed;left:0;right:0;bottom:0;z-index:150;display:flex;justify-content:space-around;align-items:flex-end;'
    + 'background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);'
    + 'border-top:1px solid rgba(27,42,74,.08);padding:7px 4px calc(7px + env(safe-area-inset-bottom));'
    + 'box-shadow:0 -10px 34px -18px rgba(27,42,74,.32);font-family:Outfit,system-ui,-apple-system,sans-serif}'
    + '.ikcp-appnav a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;'
    + 'color:#a59b90;font-size:10px;font-weight:600;letter-spacing:.02em;padding:3px 0;line-height:1;'
    + 'transition:color .18s;-webkit-tap-highlight-color:transparent;position:relative}'
    + '.ikcp-appnav a svg{width:23px;height:23px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}'
    + '.ikcp-appnav a.active{color:var(--accent,#1B2A4A)}'
    + '.ikcp-appnav a.active::before{content:"";position:absolute;top:-7px;width:5px;height:5px;border-radius:50%;background:var(--accent,#C9A96E)}'
    + '.ikcp-appnav a.fab{flex:0 0 auto;margin-top:-26px;color:#1B2A4A}'
    + '.ikcp-appnav a.fab .orb{width:56px;height:56px;border-radius:50%;background:linear-gradient(150deg,#2b3d62,#1B2A4A 55%,#0E1729);'
    + 'border:2px solid var(--accent,#C9A96E);display:flex;align-items:center;justify-content:center;'
    + 'color:var(--gold-bright,#E2C896);font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:25px;'
    + 'box-shadow:0 12px 26px -8px rgba(14,23,41,.55);transition:transform .18s,box-shadow .18s}'
    + '.ikcp-appnav a.fab:active .orb{transform:scale(.94)}'
    + '.ikcp-appnav a.fab.active .orb{box-shadow:0 0 0 4px rgba(201,169,110,.22),0 12px 26px -8px rgba(14,23,41,.55)}'
    + '.ikcp-appnav a.fab span{margin-top:5px}'
    + 'body.has-appnav{padding-bottom:calc(74px + env(safe-area-inset-bottom))!important}'
    + '@media(min-width:780px){.ikcp-appnav{max-width:540px;margin:0 auto;border-radius:22px 22px 0 0;border-left:1px solid rgba(27,42,74,.08);border-right:1px solid rgba(27,42,74,.08)}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  // ── Construction de la barre ──
  function isActive(t) { return t.match.indexOf(seg) !== -1; }
  var html = TABS.map(function (t) {
    var active = isActive(t) ? ' active' : '';
    if (t.fab) {
      return '<a class="fab' + active + '" href="' + t.href + '" aria-label="' + t.label + '">'
        + '<span class="orb">M</span><span>' + t.label + '</span></a>';
    }
    return '<a class="' + active.trim() + '" href="' + t.href + '" aria-label="' + t.label + '">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true">' + t.svg + '</svg><span>' + t.label + '</span></a>';
  }).join('');

  function mount() {
    var nav = document.createElement('nav');
    nav.className = 'ikcp-appnav';
    nav.setAttribute('aria-label', 'Navigation principale');
    nav.innerHTML = html;
    document.body.appendChild(nav);
    document.body.classList.add('has-appnav');
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
