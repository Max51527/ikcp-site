(function(){
var PROXY='https://ikcp-chat.maxime-ead.workers.dev';
var MAX=5,count=0,history=[],isOpen=false;
var msgs=[{role:'assistant',html:'<p>Bonjour ! Je suis l\'assistant d\'IKCP. Comment puis-je vous aider ?</p>'}];

var css=document.createElement('style');
css.textContent=`
#ikcp-chat-btn{position:fixed;bottom:20px;right:20px;z-index:9999;background:none;border:none;cursor:pointer;padding:0}
#ikcp-chat-btn img{width:64px;height:64px;border-radius:50%;border:3px solid rgba(184,149,110,0.4);object-fit:cover;transition:all 0.3s}
#ikcp-chat-btn:hover img{transform:scale(1.1)}
#ikcp-chat-btn .dot{position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#b8956e;border-radius:50%;animation:ikcp-ping 1.5s infinite}
@keyframes ikcp-ping{0%{box-shadow:0 0 0 0 rgba(184,149,110,0.6)}70%{box-shadow:0 0 0 10px rgba(184,149,110,0)}100%{box-shadow:0 0 0 0 rgba(184,149,110,0)}}
@keyframes ikcp-fly{0%,100%{transform:translateY(0) rotate(-1deg)}25%{transform:translateY(-8px) rotate(1deg)}50%{transform:translateY(-12px) rotate(-0.5deg)}75%{transform:translateY(-4px) rotate(0.5deg)}}
#ikcp-chat-btn img{animation:ikcp-fly 7s ease-in-out infinite}
#ikcp-chat-close{width:64px;height:64px;border-radius:50%;background:#1f1a16;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;position:fixed;bottom:20px;right:20px;z-index:9999}
#ikcp-chat-panel{position:fixed;bottom:100px;right:20px;z-index:9998;width:380px;max-width:calc(100vw - 32px);height:480px;max-height:calc(100vh - 140px);background:white;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);border:1px solid #d8d0c4;display:none;flex-direction:column;overflow:hidden}
#ikcp-chat-panel.open{display:flex}
#ikcp-chat-head{background:#1f1a16;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;color:white;border-radius:16px 16px 0 0}
#ikcp-chat-head span{font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:14px}
#ikcp-chat-head .gr{width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:8px}
#ikcp-chat-msgs{flex:1;overflow-y:auto;padding:16px;background:#f9f6f0;display:flex;flex-direction:column;gap:12px}
.ikcp-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif}
.ikcp-msg p{margin:0 0 4px}.ikcp-msg p:last-child{margin:0}
.ikcp-msg a{color:#b8956e;font-weight:600}
.ikcp-msg-a{background:white;border:1px solid #d8d0c4;color:#2e2520;border-radius:14px 14px 14px 2px;align-self:flex-start}
.ikcp-msg-u{background:#1f1a16;color:white;border-radius:14px 14px 2px 14px;align-self:flex-end}
#ikcp-chat-input{padding:12px;background:white;border-top:1px solid #e5ded2;display:flex;gap:8px}
#ikcp-chat-input input{flex:1;border:1px solid #d8d0c4;border-radius:24px;padding:8px 16px;font-size:13px;outline:none;font-family:'DM Sans',system-ui,sans-serif}
#ikcp-chat-input input:focus{border-color:#b8956e}
#ikcp-chat-input button{background:none;border:none;cursor:pointer;font-size:18px;color:#9e9080;padding:0 4px}
#ikcp-chat-input button:hover{color:#b8956e}
.ikcp-dots{display:flex;gap:4px;padding:10px 14px}
.ikcp-dots span{width:8px;height:8px;background:#b4b2a9;border-radius:50%;animation:ikcp-bounce 0.6s infinite alternate}
.ikcp-dots span:nth-child(2){animation-delay:0.1s}
.ikcp-dots span:nth-child(3){animation-delay:0.2s}
@keyframes ikcp-bounce{to{transform:translateY(-6px);opacity:0.5}}
#ikcp-tease{position:fixed;bottom:90px;right:20px;z-index:9998;background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);border:1px solid #e5ded2;padding:12px 16px;max-width:220px;cursor:pointer;display:none;animation:ikcp-fly 3s ease-in-out infinite}
#ikcp-tease p{margin:0;font-family:'DM Sans',system-ui,sans-serif}
#ikcp-tease .t1{font-size:13px;color:#1f1a16;font-weight:600;line-height:1.4}
#ikcp-tease .t2{font-size:11px;color:#907b65;line-height:1.4;margin-top:4px}
`;
document.head.appendChild(css);

function render(){
var el=document.getElementById('ikcp-chat-msgs');
if(!el)return;
el.innerHTML='';
msgs.forEach(function(m){
var d=document.createElement('div');
d.className='ikcp-msg ikcp-msg-'+(m.role==='user'?'u':'a');
d.innerHTML=m.html;
el.appendChild(d);
});
el.scrollTop=el.scrollHeight;
}

function showLoading(){
var el=document.getElementById('ikcp-chat-msgs');
var d=document.createElement('div');
d.id='ikcp-loading';
d.className='ikcp-msg ikcp-msg-a';
d.innerHTML='<div class="ikcp-dots"><span></span><span></span><span></span></div>';
el.appendChild(d);
el.scrollTop=el.scrollHeight;
}
function hideLoading(){var l=document.getElementById('ikcp-loading');if(l)l.remove();}

async function send(){
var inp=document.getElementById('ikcp-inp');
if(!inp||!inp.value.trim())return;
if(count>=MAX){
msgs.push({role:'assistant',html:'<p>Vous avez atteint la limite de 5 questions. <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank">Échanger avec Maxime →</a></p>'});
inp.value='';render();return;
}
count++;
var txt=inp.value.trim();
msgs.push({role:'user',html:'<p>'+txt.replace(/</g,'&lt;')+'</p>'});
history.push({role:'user',content:txt});
inp.value='';render();showLoading();
try{
var r=await fetch(PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt,history:history.slice(-8)})});
var d=await r.json();
var reply=d.reply||d.content&&d.content[0]&&d.content[0].text||'Erreur. Réessayez.';
history.push({role:'assistant',content:reply});
var html=reply.replace(/\n/g,'<br>');
if(count>=MAX)html+='<p style="font-size:11px;color:#b8956e;margin-top:8px;border-top:1px solid #e5ded2;padding-top:8px">5/5 questions utilisées. <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank">Échanger avec Maxime →</a></p>';
else if(count>=3)html+='<p style="font-size:10px;color:#9e9080;margin-top:6px">'+(MAX-count)+' question(s) restante(s)</p>';
msgs.push({role:'assistant',html:html});
}catch(e){msgs.push({role:'assistant',html:'<p>Erreur technique. <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank">Contactez Maxime directement</a>.</p>'});}
hideLoading();render();
}

function toggle(){
isOpen=!isOpen;
document.getElementById('ikcp-chat-panel').classList.toggle('open',isOpen);
document.getElementById('ikcp-chat-btn').style.display=isOpen?'none':'block';
document.getElementById('ikcp-chat-close-btn').style.display=isOpen?'flex':'none';
var t=document.getElementById('ikcp-tease');if(t)t.style.display='none';
if(isOpen)setTimeout(function(){var i=document.getElementById('ikcp-inp');if(i)i.focus();},100);
}

var html=`
<div id="ikcp-tease" onclick="document.querySelector('#ikcp-chat-btn').click()"><p class="t1">Une question patrimoniale ?</p><p class="t2">Succession, donation, IFI… posez votre question 👇</p></div>
<div id="ikcp-chat-panel">
<div id="ikcp-chat-head"><div><span class="gr"></span><span>Assistant IKCP</span></div><button onclick="document.querySelector('#ikcp-chat-btn').click()" style="background:none;border:none;color:#9e9080;cursor:pointer;font-size:16px">✕</button></div>
<div id="ikcp-chat-msgs"></div>
<div id="ikcp-chat-input"><input id="ikcp-inp" type="text" placeholder="Posez votre question..." onkeydown="if(event.key==='Enter')document.getElementById('ikcp-send').click()"><button id="ikcp-send" onclick="window._ikcpSend()">→</button></div>
</div>
<button id="ikcp-chat-btn" onclick="window._ikcpToggle()"><span class="dot"></span><img src="/icons/montgolfiere.png" alt="Assistant IKCP" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎈</text></svg>'"></button>
<button id="ikcp-chat-close-btn" style="display:none;position:fixed;bottom:20px;right:20px;z-index:9999;width:64px;height:64px;border-radius:50%;background:#1f1a16;border:none;cursor:pointer" onclick="window._ikcpToggle()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
`;

var container=document.createElement('div');
container.innerHTML=html;
document.body.appendChild(container);

window._ikcpToggle=toggle;
window._ikcpSend=send;

render();
setTimeout(function(){var t=document.getElementById('ikcp-tease');if(t&&!isOpen)t.style.display='block';},6000);
})();
