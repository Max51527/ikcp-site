/**
 * IKCP — Mode vocal « JARVIS » pour Marcel
 * Conversation vocale temps réel, mains libres : écoute → réfléchit → répond,
 * en boucle, avec une orbe IA animée. Réutilise Voice (STT/TTS) + Marcel.chat.
 * Auto-injecté dans marcel.html. © 2026 IKCP · ORIAS 23001568
 */
import { Marcel } from '/app/js/api.js';
import { Voice } from '/app/js/voice.js';

(function () {
  if (typeof document === 'undefined') return;
  var support = Voice.isSupported ? Voice.isSupported() : { stt: false, tts: false };
  var history = [];
  var state = 'idle'; // idle | listening | thinking | speaking
  var running = false;

  // ── Styles ──
  var css =
    '.jv-launch{display:inline-flex;align-items:center;gap:7px;margin:12px auto 0;background:linear-gradient(135deg,#1B2A4A,#0E1729);color:#E2C896;border:1px solid rgba(201,169,110,.45);border-radius:999px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 8px 22px -12px rgba(14,23,41,.6);transition:transform .15s}' +
    '.jv-launch:hover{transform:translateY(-2px)}' +
    '.jv-overlay{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;' +
      'background:radial-gradient(ellipse 60% 50% at 50% 38%,rgba(201,169,110,.12),transparent 60%),#070D1A;color:#FAF7F0;font-family:Inter,system-ui,sans-serif}' +
    '.jv-overlay.show{display:flex;animation:jvfade .4s ease}' +
    '@keyframes jvfade{from{opacity:0}to{opacity:1}}' +
    '.jv-close{position:absolute;top:18px;right:20px;background:transparent;border:1px solid rgba(201,169,110,.3);color:#C9A96E;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer}' +
    '.jv-orb{position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center;margin-bottom:8px}' +
    '.jv-core{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 40% 32%,#3a4d72,#1B2A4A 58%,#0B1426);border:1px solid rgba(201,169,110,.5);' +
      'display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:34px;color:#E2C896;' +
      'box-shadow:0 0 50px -6px rgba(201,169,110,.5),inset 0 0 26px rgba(0,0,0,.5);transition:transform .3s}' +
    '.jv-ring{position:absolute;border-radius:50%;border:1px solid rgba(201,169,110,.3);inset:0}' +
    '.jv-ring.r2{inset:24px;border-color:rgba(201,169,110,.18)}' +
    '.jv-ring.r3{inset:-18px;border-style:dashed;border-color:rgba(201,169,110,.14)}' +
    '.jv-orb.listening .jv-ring{animation:jvpulse 1.6s ease-in-out infinite}' +
    '.jv-orb.listening .jv-ring.r2{animation-delay:.3s}.jv-orb.listening .jv-ring.r3{animation-delay:.6s}' +
    '.jv-orb.thinking .jv-ring{animation:jvspin 2.2s linear infinite}' +
    '.jv-orb.thinking .jv-ring.r3{animation:jvspin 3.4s linear infinite reverse;border-top-color:#C9A96E}' +
    '.jv-orb.speaking .jv-core{animation:jvspeak .5s ease-in-out infinite alternate}' +
    '@keyframes jvpulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.12);opacity:.15}}' +
    '@keyframes jvspin{to{transform:rotate(360deg)}}' +
    '@keyframes jvspeak{from{transform:scale(1)}to{transform:scale(1.06)}}' +
    '.jv-wave{display:flex;align-items:center;justify-content:center;gap:4px;height:34px;margin-top:6px}' +
    '.jv-wave i{width:4px;height:8px;background:linear-gradient(#E2C896,#C9A96E);border-radius:3px;opacity:.35}' +
    '.jv-overlay.is-listening .jv-wave i,.jv-overlay.is-speaking .jv-wave i{opacity:1;animation:jvbar .9s ease-in-out infinite}' +
    '.jv-wave i:nth-child(2){animation-delay:.1s}.jv-wave i:nth-child(3){animation-delay:.2s}.jv-wave i:nth-child(4){animation-delay:.3s}.jv-wave i:nth-child(5){animation-delay:.15s}.jv-wave i:nth-child(6){animation-delay:.25s}.jv-wave i:nth-child(7){animation-delay:.05s}' +
    '@keyframes jvbar{0%,100%{height:7px}50%{height:30px}}' +
    '.jv-wave.jv-reactive i{animation:none!important;transition:height .07s linear;opacity:1}' +
    '.jv-status{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#C9A96E;font-weight:600;margin-top:18px;min-height:18px}' +
    '.jv-transcript{max-width:560px;margin-top:18px;font-size:15px;line-height:1.55;color:rgba(250,247,240,.92)}' +
    '.jv-transcript .u{color:#E2C896;font-style:italic;font-size:13.5px;margin-bottom:8px}' +
    '.jv-actions{margin-top:26px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center}' +
    '.jv-btn{border:none;border-radius:999px;padding:12px 24px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}' +
    '.jv-btn.gold{background:#C9A96E;color:#0E1729}.jv-btn.ghost{background:transparent;border:1px solid rgba(201,169,110,.4);color:#C9A96E}' +
    '.jv-hint{font-size:11.5px;color:rgba(250,247,240,.5);margin-top:16px;max-width:480px;line-height:1.5}' +
    '@media(prefers-reduced-motion:reduce){.jv-orb *,.jv-wave i,.jv-core{animation:none!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ── Bouton de lancement (dans le header du chat) ──
  function injectLaunch() {
    var head = document.querySelector('.chat-head');
    if (!head || document.querySelector('.jv-launch')) return;
    var b = document.createElement('button');
    b.className = 'jv-launch';
    b.type = 'button';
    b.innerHTML = '🎙️ Mode vocal — parler à Marcel';
    b.onclick = open;
    head.appendChild(b);
  }

  // ── Overlay ──
  var ov, orb, statusEl, transEl;
  function buildOverlay() {
    ov = document.createElement('div');
    ov.className = 'jv-overlay';
    ov.innerHTML =
      '<button class="jv-close" aria-label="Fermer" id="jvClose">✕</button>' +
      '<div class="jv-orb" id="jvOrb"><div class="jv-ring r3"></div><div class="jv-ring"></div><div class="jv-ring r2"></div><div class="jv-core">M</div></div>' +
      '<div class="jv-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="jv-status" id="jvStatus">Mode vocal</div>' +
      '<div class="jv-transcript" id="jvTrans"></div>' +
      '<div class="jv-actions">' +
        '<button class="jv-btn gold" id="jvTalk">🎤 Parler</button>' +
        '<button class="jv-btn ghost" id="jvStop">Terminer</button>' +
      '</div>' +
      '<div class="jv-hint" id="jvHint">Parlez naturellement — Marcel vous écoute, réfléchit, puis répond. Mains libres : après sa réponse, il se remet à l\'écoute.</div>';
    document.body.appendChild(ov);
    orb = ov.querySelector('#jvOrb'); statusEl = ov.querySelector('#jvStatus'); transEl = ov.querySelector('#jvTrans');
    ov.querySelector('#jvClose').onclick = close;
    ov.querySelector('#jvStop').onclick = close;
    ov.querySelector('#jvTalk').onclick = function(){ if (state === 'idle' || state === 'listening') startListen(); };
  }

  function setState(s, label) {
    state = s;
    if (!orb) return;
    orb.className = 'jv-orb' + (s !== 'idle' ? ' ' + s : '');
    ov.classList.toggle('is-listening', s === 'listening');
    ov.classList.toggle('is-speaking', s === 'speaking');
    statusEl.textContent = label || '';
  }
  function showTranscript(user, marcel) {
    transEl.innerHTML = (user ? '<div class="u">« ' + esc(user) + ' »</div>' : '') + (marcel ? esc(marcel) : '');
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Orbe audio-réactive : l'onde suit ta voix en temps réel (Web Audio) ──
  var _ac, _analyser, _micStream, _raf;
  function startMicViz() {
    if (_ac || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (!running) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      _micStream = stream;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      _ac = new AC();
      var src = _ac.createMediaStreamSource(stream);
      _analyser = _ac.createAnalyser(); _analyser.fftSize = 64;
      src.connect(_analyser);
      var wave = ov.querySelector('.jv-wave'); if (wave) wave.classList.add('jv-reactive');
      var bars = ov.querySelectorAll('.jv-wave i');
      var buf = new Uint8Array(_analyser.frequencyBinCount);
      (function tick() {
        if (!_analyser) return;
        _analyser.getByteFrequencyData(buf);
        for (var i = 0; i < bars.length; i++) { var v = buf[i * 2 + 2] || 0; bars[i].style.height = Math.max(6, (v / 255) * 30) + 'px'; }
        _raf = requestAnimationFrame(tick);
      })();
    }).catch(function () {});
  }
  function stopMicViz() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    if (_micStream) { _micStream.getTracks().forEach(function (t) { t.stop(); }); _micStream = null; }
    if (_ac) { try { _ac.close(); } catch (_) {} _ac = null; }
    _analyser = null;
    if (ov) { var w = ov.querySelector('.jv-wave'); if (w) w.classList.remove('jv-reactive'); ov.querySelectorAll('.jv-wave i').forEach(function (b) { b.style.height = ''; }); }
  }

  function startListen() {
    if (!support.stt) { setState('idle', 'Dictée non supportée'); return; }
    setState('listening', 'À l\'écoute…');
    startMicViz();
    var captured = '';
    Voice.startListening({
      onInterim: function (t) { if (t) { transEl.innerHTML = '<div class="u">' + esc(t) + '…</div>'; } },
      onFinal: function (t) { captured = (t || '').trim(); },
      onError: function () { stopMicViz(); setState('idle', 'Réessayez'); },
      onEnd: function () { stopMicViz(); if (running && captured) ask(captured); else if (running) setState('idle', 'Touchez « Parler »'); }
    });
  }

  async function ask(text) {
    showTranscript(text, '');
    setState('thinking', 'Marcel réfléchit…');
    history.push({ role: 'user', content: text });
    var reply = '';
    try {
      var r = await Marcel.chat(text, history.slice(-12));
      reply = (r && (r.reply || r.message)) || 'Je n\'ai pas pu traiter votre demande.';
    } catch (_) { reply = 'Connexion momentanément indisponible. Réessayez.'; }
    history.push({ role: 'assistant', content: reply });
    // Version parlée : on retire le markdown pour une lecture fluide
    var spoken = reply.replace(/[#*`>|_]/g, '').replace(/\n{2,}/g, '. ').replace(/\s+/g, ' ').trim();
    showTranscript(text, reply.replace(/[#*`>]/g, '').slice(0, 600));
    setState('speaking', 'Marcel répond…');
    try {
      if (support.tts && Voice.smartSpeak) { await Voice.smartSpeak(spoken.slice(0, 700), { tier: (localStorage.getItem('ikcp_tier') || 'free') }); }
    } catch (_) {}
    if (running) { setTimeout(function(){ if (running) startListen(); }, 350); } // boucle mains libres
  }

  function open() {
    if (!ov) buildOverlay();
    running = true;
    ov.classList.add('show');
    history = [];
    showTranscript('', '');
    if (support.stt) { startListen(); }
    else { setState('idle', 'Dictée non disponible'); ov.querySelector('#jvHint').textContent = 'Votre navigateur ne gère pas la dictée. Utilisez le chat écrit, ou ouvrez Marcel sur Chrome/Android.'; }
  }
  function close() {
    running = false;
    try { stopMicViz(); } catch (_) {}
    try { Voice.stopListening && Voice.stopListening(); } catch (_) {}
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
    setState('idle', '');
    if (ov) ov.classList.remove('show');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectLaunch);
  else injectLaunch();
})();
