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
  var SHOW_ON = ['dashboard', 'patrimoine', 'patrimoine-pro', 'diagnostic', 'simulateurs', 'score', 'famille', 'univers', 'conciergerie', 'collections', 'veille', 'carnet', 'documents', 'profil', 'securite'];

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
    patrimoine: { id:'patrimoine', label: 'Patrimoine', href: '/app/patrimoine-pro', match: ['patrimoine', 'patrimoine-pro', 'diagnostic', 'simulateurs', 'score'],
      svg: '<path d="M4 20V11M9.3 20V4M14.6 20v-6M20 20V8"/><path d="M2.5 20h19"/>' },
    univers:    { id:'univers', label: 'Univers', href: '/app/univers', match: ['univers', 'conciergerie', 'collections', 'famille'],
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
    + 'body.has-appnav{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}'
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
    try { document.querySelectorAll('nav.app-tabs').forEach(function(n){ n.style.display='none'; }); } catch(_){} // évite la double barre si une nav inline existe
    var nav = document.createElement('nav');
    nav.className = 'ikcp-appnav';
    nav.setAttribute('aria-label', 'Navigation principale');
    nav.innerHTML = html;
    document.body.appendChild(nav);
    document.body.classList.add('has-appnav');
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  // ── Bouton flottant « Mon avis » — boucle de feedback bêta (→ console Retours testeurs) ──
  function mountFb() {
    if (document.querySelector('.ikcp-fb')) return;
    var fcss = document.createElement('style');
    fcss.textContent = '.ikcp-fb{position:fixed;right:15px;bottom:86px;z-index:151;background:var(--accent,#C9A96E);color:#0E1729;border:0;border-radius:999px;padding:10px 15px;font:600 12.5px Outfit,system-ui,sans-serif;box-shadow:0 10px 26px -10px rgba(14,23,41,.55);cursor:pointer}'
      + '.ikcp-fbm{position:fixed;inset:0;z-index:200;background:rgba(14,23,41,.55);display:none;align-items:flex-end;justify-content:center}.ikcp-fbm.open{display:flex}'
      + '.ikcp-fbm .box{background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom))}'
      + '@media(min-width:560px){.ikcp-fbm{align-items:center}.ikcp-fbm .box{border-radius:20px}}'
      + '.ikcp-fbm h3{font-family:"Playfair Display",serif;font-weight:500;font-size:19px;margin:0 0 4px;color:#1B2A4A}'
      + '.ikcp-fbm p{font-size:12.5px;color:#6E7689;margin:0 0 12px;line-height:1.5}'
      + '.ikcp-fbm textarea{width:100%;min-height:92px;box-sizing:border-box;border:1.5px solid rgba(27,42,74,.15);border-radius:10px;padding:11px;font:inherit;font-size:14px;resize:vertical}'
      + '.ikcp-fbm .fbtypes{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 11px}'
      + '.ikcp-fbm .fbtypes button{flex:1;min-width:0;border:1.5px solid rgba(27,42,74,.15);background:#fff;border-radius:10px;padding:9px 5px;font:600 12px Outfit,system-ui,sans-serif;cursor:pointer;color:#1B2A4A;white-space:nowrap}'
      + '.ikcp-fbm .fbtypes button.sel{background:#1B2A4A;color:#fff;border-color:#1B2A4A}'
      + '.ikcp-fbm .row{display:flex;gap:9px;margin-top:12px}.ikcp-fbm .row button{flex:1;border:0;border-radius:10px;padding:12px;font:600 14px Outfit,system-ui,sans-serif;cursor:pointer}'
      + '.ikcp-fbm .send{background:#1B2A4A;color:#fff}.ikcp-fbm .cancel{background:transparent;border:1px solid rgba(27,42,74,.15);color:#6E7689}';
    document.head.appendChild(fcss);
    var btn = document.createElement('button'); btn.className = 'ikcp-fb'; btn.type = 'button'; btn.textContent = '💬 Mon avis';
    var modal = document.createElement('div'); modal.className = 'ikcp-fbm';
    modal.innerHTML = '<div class="box"><h3>Votre avis compte</h3><p>Bêta — vous façonnez la prochaine version. Maxime lit chaque retour.</p>'
      + '<div class="fbtypes" id="ikcpFbTypes">'
      + '<button type="button" data-t="bug">🐞 Bug</button>'
      + '<button type="button" data-t="idee">💡 Idée</button>'
      + '<button type="button" data-t="manque">🧩 Il manque…</button>'
      + '<button type="button" data-t="jadore">❤️ J\'adore</button>'
      + '</div>'
      + '<textarea id="ikcpFbT" placeholder="Votre retour…"></textarea>'
      + '<div class="row"><button type="button" class="cancel">Annuler</button><button type="button" class="send">Envoyer</button></div></div>';
    document.body.appendChild(btn); document.body.appendChild(modal);
    var fbType = '';
    var typeWrap = modal.querySelector('#ikcpFbTypes');
    typeWrap.addEventListener('click', function(e){ var b = e.target.closest('button[data-t]'); if(!b) return;
      fbType = (fbType === b.getAttribute('data-t')) ? '' : b.getAttribute('data-t');
      Array.prototype.forEach.call(typeWrap.children, function(c){ c.classList.toggle('sel', c.getAttribute('data-t')===fbType); }); });
    function close(){ modal.classList.remove('open'); }
    btn.onclick = function(){ modal.classList.add('open'); setTimeout(function(){ var t=document.getElementById('ikcpFbT'); if(t) t.focus(); },80); };
    modal.addEventListener('click', function(e){ if(e.target===modal) close(); });
    modal.querySelector('.cancel').onclick = close;
    modal.querySelector('.send').onclick = function(){
      var t = (document.getElementById('ikcpFbT').value||'').trim(); if(t.length<5) return;
      var s = modal.querySelector('.send'); s.textContent='Envoi…'; s.disabled=true;
      var LBL = { bug:'🐞 Bug', idee:'💡 Idée', manque:'🧩 Manque', jadore:'❤️ J\'adore' };
      var PRIO = { bug:'haute', manque:'moyenne', idee:'moyenne', jadore:'basse' };
      var tier = ''; try { tier = localStorage.getItem('ikcp_tier') || ''; } catch (_) {}
      fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/feedback', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ besoin:t, type:(fbType||'avis'), categories:[ fbType ? LBL[fbType] : 'avis in-app' ], priorite:(PRIO[fbType]||'moyenne'), page:location.pathname, tier:tier, source:'app-feedback', meta:{ vw:(window.innerWidth||0), ua:(navigator.userAgent||'').slice(0,120) } }) })
        .catch(function(){}).finally(function(){ modal.querySelector('.box').innerHTML='<h3>Merci 🙏</h3><p>Votre retour est transmis — il façonne directement la prochaine version.</p>'; setTimeout(close,1800); });
    };
  }
  if (document.body) mountFb(); else document.addEventListener('DOMContentLoaded', mountFb);

  // ── Pulse NPS — 1 question, au 3ᵉ passage, une seule fois (→ console Retours testeurs) ──
  function mountNps() {
    try {
      if (localStorage.getItem('ikcp_nps_done')) return;
      var v = (parseInt(localStorage.getItem('ikcp_visits') || '0', 10) || 0) + 1;
      localStorage.setItem('ikcp_visits', String(v));
      if (v < 3) return;
    } catch (_) { return; }
    var css = document.createElement('style');
    css.textContent = '.ikcp-nps{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(12px);z-index:160;max-width:min(94vw,440px);background:#fff;border:1px solid rgba(27,42,74,.12);border-radius:16px;box-shadow:0 16px 44px -12px rgba(14,23,41,.4);padding:16px 18px;opacity:0;transition:.3s}'
      + '.ikcp-nps.on{opacity:1;transform:translateX(-50%) translateY(0)}'
      + '.ikcp-nps h4{font-family:"Playfair Display",serif;font-weight:500;font-size:15px;margin:0 0 3px;color:#1B2A4A}'
      + '.ikcp-nps p{font-size:11.5px;color:#6E7689;margin:0 0 10px}'
      + '.ikcp-nps .sc{display:flex;flex-wrap:wrap;gap:5px}'
      + '.ikcp-nps .sc button{flex:1;min-width:26px;border:1px solid rgba(27,42,74,.14);background:#fff;border-radius:7px;padding:7px 0;font:600 12px Outfit,system-ui,sans-serif;cursor:pointer;color:#1B2A4A}'
      + '.ikcp-nps .sc button:hover{background:#1B2A4A;color:#fff;border-color:#1B2A4A}'
      + '.ikcp-nps .x{position:absolute;top:7px;right:11px;background:none;border:0;color:#9aa3b2;font-size:16px;cursor:pointer;line-height:1}';
    document.head.appendChild(css);
    var box = document.createElement('div'); box.className = 'ikcp-nps';
    var scale = ''; for (var n = 0; n <= 10; n++) scale += '<button type="button" data-n="' + n + '">' + n + '</button>';
    box.innerHTML = '<button class="x" type="button" aria-label="Fermer">×</button><h4>Une question rapide</h4><p>De 0 à 10, recommanderiez-vous IKCP à un proche dirigeant ?</p><div class="sc">' + scale + '</div>';
    document.body.appendChild(box);
    setTimeout(function () { box.classList.add('on'); }, 1600);
    function done() { try { localStorage.setItem('ikcp_nps_done', '1'); } catch (_) {} box.classList.remove('on'); setTimeout(function () { box.remove(); }, 300); }
    box.querySelector('.x').onclick = done;
    box.querySelector('.sc').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-n]'); if (!b) return;
      var nn = parseInt(b.getAttribute('data-n'), 10); var tier = ''; try { tier = localStorage.getItem('ikcp_tier') || ''; } catch (_) {}
      box.innerHTML = '<h4>Merci 🙏</h4><p>Votre note nourrit directement la prochaine version.</p>';
      try { fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ besoin: 'NPS ' + nn + '/10', type: 'nps', score: nn, categories: ['📊 NPS ' + nn + '/10'], priorite: (nn <= 6 ? 'haute' : 'basse'), page: location.pathname, tier: tier, source: 'nps-pulse' }) }).catch(function () {}); } catch (_) {}
      try { localStorage.setItem('ikcp_nps_done', '1'); } catch (_) {}
      setTimeout(done, 1700);
    });
  }
  if (document.body) mountNps(); else document.addEventListener('DOMContentLoaded', mountNps);
})();
