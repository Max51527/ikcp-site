/* ════════════════════════════════════════════════════════════════
   MARCEL FLOTTANT — copilote patrimonial omniprésent
   © 2026 IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568
   ----------------------------------------------------------------
   Bulle montgolfière présente sur tout l'espace membre : propose des
   pistes et dialogue avec Marcel.
   SOUVERAINETÉ — NON NÉGOCIABLE : ne révèle JAMAIS le moteur d'IA
   ni l'arrière-boutique (sources, infrastructure). On n'affiche jamais
   le champ "provider"/"model" renvoyé par l'API. Marcel parle, point.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.__marcelFloat) return;
  window.__marcelFloat = 1;
  var path = location.pathname.replace(/\.html$/, '');
  if (/\/app\/(marcel|index)$/.test(path)) return; // pas sur le chat plein écran ni le login
  var API = 'https://ikcp-chat.maxime-ead.workers.dev/';
  var hist = [], busy = false, greeted = false;

  var css = document.createElement('style');
  css.textContent =
    '#mflt-fab{position:fixed;right:14px;bottom:84px;z-index:9400;width:58px;height:58px;border-radius:50%;border:1.5px solid rgba(201,169,110,.55);background:#FAF8F4;box-shadow:0 12px 30px -10px rgba(14,23,41,.5);cursor:pointer;display:grid;place-items:center;padding:0;animation:mflt-bob 4s ease-in-out infinite}' +
    '#mflt-fab:hover{transform:translateY(-2px)}' +
    '@keyframes mflt-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}' +
    '@media(prefers-reduced-motion:reduce){#mflt-fab{animation:none}}' +
    '#mflt-fab .dot{position:absolute;top:-3px;right:-3px;width:15px;height:15px;border-radius:50%;background:#C0414C;border:2px solid #FAF8F4}' +
    '#mflt-panel{position:fixed;right:14px;bottom:84px;z-index:9401;width:min(360px,calc(100vw - 28px));max-height:72vh;background:#FAF8F4;border:1px solid rgba(139,111,63,.25);border-radius:18px;box-shadow:0 24px 60px -16px rgba(14,23,41,.55);display:none;flex-direction:column;overflow:hidden;font-family:Outfit,system-ui,sans-serif}' +
    '#mflt-panel.on{display:flex;animation:mflt-up .25s ease}' +
    '@keyframes mflt-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
    '.mflt-h{display:flex;align-items:center;gap:10px;padding:13px 15px;background:#1B2A4A;color:#fff}' +
    '.mflt-h .nm{font-family:"Playfair Display",serif;font-weight:600;font-size:15px;flex:1}' +
    '.mflt-h .nm small{display:block;font-family:Outfit,sans-serif;font-weight:400;font-size:10.5px;color:#C9B68F}' +
    '.mflt-h .x{background:none;border:0;color:rgba(255,255,255,.6);font-size:20px;cursor:pointer;padding:0 2px}' +
    '.mflt-body{flex:1;overflow-y:auto;padding:13px;display:flex;flex-direction:column;gap:9px}' +
    '.mflt-b{max-width:85%;padding:9px 12px;border-radius:13px;font-size:13px;line-height:1.5}' +
    '.mflt-b.a{background:#fff;border:1px solid rgba(139,111,63,.18);color:#221E18;border-bottom-left-radius:4px}' +
    '.mflt-b.u{background:#1B2A4A;color:#EDE6DA;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.mflt-b.a b{color:#8B6F3F}' +
    '.mflt-think{font-size:12px;color:#8A7E70;font-style:italic}' +
    '.mflt-chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.mflt-chip{font-size:12px;color:#1B2A4A;background:#fff;border:1px solid rgba(139,111,63,.28);border-radius:999px;padding:6px 11px;cursor:pointer;text-align:left}' +
    '.mflt-chip:hover{border-color:#C9A96E;background:#F4EFE7}' +
    '.mflt-foot{display:flex;gap:7px;padding:11px 12px;border-top:1px solid rgba(139,111,63,.18);background:#fff}' +
    '.mflt-foot input{flex:1;border:1px solid rgba(139,111,63,.25);border-radius:999px;padding:9px 13px;font-family:Outfit,sans-serif;font-size:13px;color:#221E18;outline:none}' +
    '.mflt-foot input:focus{border-color:#1B2A4A}' +
    '.mflt-foot .go{border:0;background:#1B2A4A;color:#fff;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:15px;flex-shrink:0}' +
    '.mflt-disc{font-size:9px;color:#8A7E70;text-align:center;padding:0 12px 9px;background:#fff;line-height:1.4}';
  document.head.appendChild(css);

  var BALLOON =
    '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">' +
    '<defs><clipPath id="mfltb"><circle cx="16" cy="13" r="10"/></clipPath></defs>' +
    '<g clip-path="url(#mfltb)"><rect x="6" y="3" width="6.7" height="20" fill="#1B2A4A"/><rect x="12.7" y="3" width="6.6" height="20" fill="#FAF8F4"/><rect x="19.3" y="3" width="6.7" height="20" fill="#C0414C"/></g>' +
    '<circle cx="16" cy="13" r="10" fill="none" stroke="#C9A96E" stroke-width="1.1"/>' +
    '<path d="M12.5 22 l1.6 4 M19.5 22 l-1.6 4" stroke="#1B2A4A" stroke-width="1"/>' +
    '<path d="M13.6 26 h4.8 l-.7 3 h-3.4 z" fill="#C9A96E"/></svg>';

  var fab = document.createElement('button');
  fab.id = 'mflt-fab'; fab.setAttribute('aria-label', 'Ouvrir Marcel'); fab.title = 'Marcel — votre copilote';
  fab.innerHTML = BALLOON + '<span class="dot"></span>';
  document.body.appendChild(fab);

  var panel = document.createElement('div');
  panel.id = 'mflt-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Marcel');
  panel.innerHTML =
    '<div class="mflt-h">' + BALLOON + '<div class="nm">Marcel<small>Votre copilote patrimonial</small></div><button class="x" aria-label="Fermer">&times;</button></div>' +
    '<div class="mflt-body" id="mflt-body"></div>' +
    '<div class="mflt-disc">Information, jamais un conseil personnalisé (art. L.541-1).</div>' +
    '<div class="mflt-foot"><input id="mflt-in" placeholder="Posez votre question…" autocomplete="off"><button class="go" id="mflt-go" aria-label="Envoyer">&#10148;</button></div>';
  document.body.appendChild(panel);

  var body = panel.querySelector('#mflt-body');
  var input = panel.querySelector('#mflt-in');

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function md(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
  function bubble(role, html){ var d = document.createElement('div'); d.className = 'mflt-b ' + role; d.innerHTML = html; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
  function chips(list){ if(!list || !list.length) return; var w = document.createElement('div'); w.className = 'mflt-chips'; list.forEach(function(t){ var c = document.createElement('button'); c.className = 'mflt-chip'; c.textContent = t; c.onclick = function(){ send(t); }; w.appendChild(c); }); body.appendChild(w); body.scrollTop = body.scrollHeight; }

  function greet(){
    if (greeted) return; greeted = true;
    bubble('a', 'Bonjour. Je suis <b>Marcel</b>. Je relie votre société, votre fiscalité et votre patrimoine pour révéler vos leviers. Par où commençons-nous ?');
    chips(['Révèle mes angles', 'Optimiser ma rémunération de dirigeant', 'Préparer ma transmission', 'Faire fructifier ma trésorerie']);
  }

  function send(msg){
    msg = (msg || input.value || '').trim(); if (!msg || busy) return;
    input.value = ''; busy = true;
    bubble('u', esc(msg));
    var think = bubble('a', '<span class="mflt-think">Marcel réfléchit…</span>');
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: hist }) })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        // SOUVERAINETÉ : on n'expose ni d.provider ni d.model — uniquement la réponse de Marcel.
        if (!d || !d.reply) { think.innerHTML = 'Marcel est momentanément indisponible. Réessayez dans un instant.'; busy = false; return; }
        think.innerHTML = md(d.reply);
        hist.push({ role: 'user', content: msg }, { role: 'assistant', content: d.reply });
        if (hist.length > 12) hist = hist.slice(-12);
        busy = false;
        if (d.follow_ups && d.follow_ups.length) chips(d.follow_ups.slice(0, 3));
      })
      .catch(function(){ think.innerHTML = 'Connexion interrompue. Réessayez dans un instant.'; busy = false; });
  }

  function toggle(o){ var show = (o == null) ? !panel.classList.contains('on') : o; panel.classList.toggle('on', show); fab.style.display = show ? 'none' : 'grid'; if (show) { greet(); setTimeout(function(){ input.focus(); }, 80); } }
  fab.onclick = function(){ toggle(true); };
  panel.querySelector('.x').onclick = function(){ toggle(false); };
  panel.querySelector('#mflt-go').onclick = function(){ send(); };
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); send(); } });
})();
