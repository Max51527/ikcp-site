(function(){
var PROXY='https://ikcp-chat.maxime-ead.workers.dev';
var MAX=15,count=0,history=[],isOpen=false,isExpanded=false;

// Questions envoyées à Marcel — toutes interrogatives/factuelles, MIF II-safe
var QS={
// Groupe 1 — Votre déclaration 2026
'per':'Les versements sur un PER sont-ils deductibles des revenus imposables ?',
'pensions':'Comment declarer une pension alimentaire versee ?',
'fraisreels':'Quelle difference entre frais reels et abattement de 10 % sur les salaires ?',
'fonciers':'Quelle difference entre micro-foncier et regime reel pour les revenus fonciers ?',
// Groupe 2 — Autres thèmes fiscaux
'dons':'Comment fonctionne la reduction d\'impot pour les dons aux associations ?',
'niches':'Comment fonctionne le plafond global des niches fiscales ?',
'pv':'Comment est calculee la plus-value immobiliere a la revente ?',
'credits':'Comment fonctionnent les credits et reductions d\'impot ?',
// Groupe 3 — Patrimoine
'bilan':'Je voudrais faire un mini-bilan patrimonial',
'donation':'Combien puis-je donner a mes enfants sans droits ?',
'conjoint':'Comment proteger mon conjoint en cas de deces ?',
'ifi':'Comment fonctionne l\'impot sur l\'immobilier (IFI) ?'
};

var welcomeHTML=''
+ '<p><strong>Bonjour, je suis Marcel</strong>, agent patrimonial IKCP.</p>'
+ '<p>C\'est la saison de la déclaration. Une règle simple :</p>'
+ '<p class="ikcp-manifeste">Payez le bon montant d\'impôt.<br><span class="ikcp-manifeste-2">Pas un euro de plus.</span></p>'
+ '<p class="ikcp-subtle">Posez votre question, ou cliquez sur un thème ci-dessous.</p>'

+ '<div class="ikcp-qs-group">'
+   '<div class="ikcp-qs-label">Votre déclaration 2026</div>'
+   '<div class="ikcp-qs">'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'per\')">PER</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'pensions\')">Pensions alimentaires</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'fraisreels\')">Frais réels</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'fonciers\')">Revenus fonciers</button>'
+   '</div>'
+ '</div>'

+ '<div class="ikcp-qs-group">'
+   '<div class="ikcp-qs-label">Autres thèmes fiscaux</div>'
+   '<div class="ikcp-qs">'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'dons\')">Dons aux associations</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'niches\')">Plafond des niches</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'pv\')">Plus-value immo</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'credits\')">Crédits d\'impôt</button>'
+   '</div>'
+ '</div>'

+ '<div class="ikcp-qs-group">'
+   '<div class="ikcp-qs-label">Patrimoine</div>'
+   '<div class="ikcp-qs">'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'bilan\')">Mini-bilan (2 min)</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'donation\')">Donation</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'conjoint\')">Protection conjoint</button>'
+     '<button class="ikcp-qs-btn" onclick="window._ikcpQuick(\'ifi\')">Impôt immobilier</button>'
+   '</div>'
+ '</div>';

var msgs=[{role:'assistant',html:welcomeHTML,_hasQuickstart:true}];

var css=document.createElement('style');
css.textContent=`
#ikcp-chat-btn{position:fixed;bottom:20px;right:20px;z-index:9999;background:none;border:none;cursor:pointer;padding:0}
#ikcp-chat-btn img{width:64px;height:64px;border-radius:50%;border:3px solid rgba(184,149,110,0.4);object-fit:cover;transition:all 0.3s}
#ikcp-chat-btn:hover img{transform:scale(1.1)}
#ikcp-chat-btn .dot{position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#b8956e;border-radius:50%;animation:ikcp-ping 1.5s infinite}
@keyframes ikcp-ping{0%{box-shadow:0 0 0 0 rgba(184,149,110,0.6)}70%{box-shadow:0 0 0 10px rgba(184,149,110,0)}100%{box-shadow:0 0 0 0 rgba(184,149,110,0)}}
@keyframes ikcp-fly{0%,100%{transform:translateY(0) rotate(-1deg)}25%{transform:translateY(-8px) rotate(1deg)}50%{transform:translateY(-12px) rotate(-0.5deg)}75%{transform:translateY(-4px) rotate(0.5deg)}}
#ikcp-chat-btn img{animation:ikcp-fly 7s ease-in-out infinite}
#ikcp-chat-close-btn{width:64px;height:64px;border-radius:50%;background:#1f1a16;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;position:fixed;bottom:20px;right:20px;z-index:9999}
#ikcp-chat-panel{position:fixed;bottom:100px;right:20px;z-index:9998;width:400px;max-width:calc(100vw - 32px);height:640px;max-height:calc(100vh - 140px);background:white;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);border:1px solid #d8d0c4;display:none;flex-direction:column;overflow:hidden;transition:all 0.28s cubic-bezier(0.4,0,0.2,1)}
#ikcp-chat-panel.open{display:flex}
#ikcp-chat-panel.expanded{width:calc(100vw - 40px);max-width:calc(100vw - 40px);height:calc(100vh - 40px);max-height:calc(100vh - 40px);bottom:20px;right:20px;border-radius:20px}
@media (max-width:600px){#ikcp-chat-panel{width:calc(100vw - 32px);height:calc(100vh - 140px)}#ikcp-chat-panel.expanded{width:calc(100vw - 16px);max-width:calc(100vw - 16px);height:calc(100vh - 16px);max-height:calc(100vh - 16px);right:8px;bottom:8px;border-radius:14px}}
#ikcp-chat-head{background:#1f1a16;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;color:white;border-radius:16px 16px 0 0}
#ikcp-chat-head .ikcp-title{font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:14px}
#ikcp-chat-head .gr{width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:8px}
#ikcp-chat-head .ikcp-actions{display:flex;gap:2px;align-items:center}
#ikcp-chat-head button{background:none;border:none;color:#b8956e;cursor:pointer;padding:4px 6px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:all 0.15s}
#ikcp-chat-head button:hover{color:white;background:rgba(255,255,255,0.08)}
#ikcp-chat-msgs{flex:1;overflow-y:auto;padding:16px;background:#f9f6f0;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
#ikcp-chat-panel.expanded #ikcp-chat-msgs{padding:28px max(28px, calc((100vw - 800px) / 2))}
.ikcp-msg{max-width:92%;padding:14px 16px;border-radius:14px;font-size:13px;line-height:1.6;font-family:'DM Sans',system-ui,sans-serif}
#ikcp-chat-panel.expanded .ikcp-msg{font-size:14px;max-width:720px}
.ikcp-msg p{margin:0 0 6px}.ikcp-msg p:last-child{margin:0}
.ikcp-msg strong{color:#1f1a16;font-weight:500}
.ikcp-msg a{color:#b8956e;font-weight:500;text-decoration:underline}
.ikcp-msg-a{background:white;border:1px solid #d8d0c4;color:#2e2520;border-radius:14px 14px 14px 2px;align-self:flex-start}
.ikcp-msg-u{background:#1f1a16;color:white;border-radius:14px 14px 2px 14px;align-self:flex-end;max-width:85%}
.ikcp-msg-u p{margin:0}
.ikcp-manifeste{font-family:'Playfair Display',Georgia,serif;color:#1f1a16;font-size:15px;font-weight:500;line-height:1.5;margin:8px 0 10px!important;padding:10px 0;border-top:1px solid #e5ded2;border-bottom:1px solid #e5ded2}
.ikcp-manifeste-2{color:#b8956e;font-style:italic}
.ikcp-subtle{color:#5f5e5a;margin-bottom:14px!important;font-size:12px}
.ikcp-qs-group{margin-top:14px}
.ikcp-qs-label{font-size:10px;font-weight:500;color:#b8956e;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:8px}
.ikcp-qs{display:flex;gap:6px;flex-wrap:wrap}
.ikcp-qs-btn{background:#f9f6f0;border:1px solid #d8d0c4;color:#1f1a16;border-radius:18px;padding:6px 12px;font-size:11px;font-family:'DM Sans',system-ui,sans-serif;cursor:pointer;transition:all 0.15s;font-weight:500;line-height:1.3}
.ikcp-qs-btn:hover{background:#1f1a16;color:white;border-color:#1f1a16}
#ikcp-chat-input{padding:12px;background:white;border-top:1px solid #e5ded2;display:flex;gap:8px}
#ikcp-chat-panel.expanded #ikcp-chat-input{padding:16px max(16px, calc((100vw - 800px) / 2))}
#ikcp-chat-input input{flex:1;border:1px solid #d8d0c4;border-radius:24px;padding:8px 16px;font-size:13px;outline:none;font-family:'DM Sans',system-ui,sans-serif}
#ikcp-chat-input input:focus{border-color:#b8956e}
#ikcp-chat-input button{background:none;border:none;cursor:pointer;font-size:18px;color:#9e9080;padding:0 4px}
#ikcp-chat-input button:hover{color:#b8956e}
.ikcp-dots{display:flex;gap:4px;padding:10px 14px}
.ikcp-dots span{width:8px;height:8px;background:#b4b2a9;border-radius:50%;animation:ikcp-bounce 0.6s infinite alternate}
.ikcp-dots span:nth-child(2){animation-delay:0.1s}
.ikcp-dots span:nth-child(3){animation-delay:0.2s}
@keyframes ikcp-bounce{to{transform:translateY(-6px);opacity:0.5}}
#ikcp-tease{position:fixed;bottom:90px;right:20px;z-index:9998;background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);border:1px solid #e5ded2;padding:12px 16px;max-width:260px;cursor:pointer;display:none;animation:ikcp-fly 3s ease-in-out infinite}
#ikcp-tease p{margin:0;font-family:'DM Sans',system-ui,sans-serif}
#ikcp-tease .t1{font-size:13px;color:#1f1a16;font-weight:500;line-height:1.4;font-family:'Playfair Display',Georgia,serif;font-style:italic}
#ikcp-tease .t2{font-size:11px;color:#907b65;line-height:1.4;margin-top:4px}
.ikcp-meta{font-size:10px;color:#9e9080;margin-top:6px;font-style:italic}
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

function stripQuickstart(){
if(msgs[0]&&msgs[0]._hasQuickstart){
msgs[0].html='<p><strong>Bonjour, je suis Marcel</strong>, agent patrimonial IKCP.</p>';
msgs[0]._hasQuickstart=false;
}
}

async function send(){
var inp=document.getElementById('ikcp-inp');
if(!inp||!inp.value.trim())return;
if(count>=MAX){
msgs.push({role:'assistant',html:'<p>Vous avez atteint la limite de '+MAX+' échanges. Pour poursuivre, <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank">prenez rendez-vous avec Maxime →</a></p>'});
inp.value='';render();return;
}
count++;
stripQuickstart();
var txt=inp.value.trim();
msgs.push({role:'user',html:'<p>'+txt.replace(/</g,'&lt;')+'</p>'});
history.push({role:'user',content:txt});
inp.value='';render();showLoading();
try{
var r=await fetch(PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt,history:history.slice(-20)})});
var d=await r.json();
var reply=d.reply||d.content&&d.content[0]&&d.content[0].text||'Erreur. Réessayez.';
history.push({role:'assistant',content:reply});
var html=formatReply(reply);
if(count>=MAX)html+='<p class="ikcp-meta" style="color:#b8956e;border-top:1px solid #e5ded2;padding-top:8px;margin-top:10px">'+MAX+'/'+MAX+' échanges utilisés. <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank">Poursuivre avec Maxime →</a></p>';
else if(count>=MAX-3)html+='<p class="ikcp-meta">'+(MAX-count)+' échange(s) restant(s) avant rdv</p>';
msgs.push({role:'assistant',html:html});
}catch(e){msgs.push({role:'assistant',html:'<p>Erreur technique. <a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank">Contactez Maxime directement</a>.</p>'});}
hideLoading();render();
}

function formatReply(txt){
var html=txt.replace(/</g,'&lt;').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
if(!html.startsWith('<p>'))html='<p>'+html+'</p>';
html=html.replace(/(https:\/\/calendly\.com\/[^\s<]+)/g,'<a href="$1" target="_blank">Prendre rendez-vous →</a>');
return html;
}

function quick(key){
var txt=QS[key];
if(!txt)return;
var inp=document.getElementById('ikcp-inp');
if(!inp)return;
inp.value=txt;
send();
}

function toggle(){
isOpen=!isOpen;
document.getElementById('ikcp-chat-panel').classList.toggle('open',isOpen);
document.getElementById('ikcp-chat-btn').style.display=isOpen?'none':'block';
document.getElementById('ikcp-chat-close-btn').style.display=isOpen?'flex':'none';
var t=document.getElementById('ikcp-tease');if(t)t.style.display='none';
if(isOpen)setTimeout(function(){var i=document.getElementById('ikcp-inp');if(i)i.focus();},100);
}

function expand(){
isExpanded=!isExpanded;
var p=document.getElementById('ikcp-chat-panel');
if(p)p.classList.toggle('expanded',isExpanded);
var b=document.getElementById('ikcp-expand');
if(b)b.innerHTML=isExpanded
?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>'
:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
if(b)b.title=isExpanded?'Réduire':'Agrandir';
}

var html=`
<div id="ikcp-tease" onclick="document.querySelector('#ikcp-chat-btn').click()"><p class="t1">Payez le bon montant d\'impôt.</p><p class="t2">Pas un euro de plus. Marcel éclaire 24h/24 👇</p></div>
<div id="ikcp-chat-panel">
<div id="ikcp-chat-head"><div><span class="gr"></span><span class="ikcp-title">Marcel &mdash; IKCP</span></div><div class="ikcp-actions"><button id="ikcp-expand" onclick="window._ikcpExpand()" title="Agrandir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button><button onclick="window._ikcpToggle()" title="Fermer" style="font-size:16px">✕</button></div></div>
<div id="ikcp-chat-msgs"></div>
<div id="ikcp-chat-input"><input id="ikcp-inp" type="text" placeholder="Posez votre question à Marcel..." onkeydown="if(event.key==='Enter')document.getElementById('ikcp-send').click()"><button id="ikcp-send" onclick="window._ikcpSend()">→</button></div>
</div>
<button id="ikcp-chat-btn" onclick="window._ikcpToggle()"><span class="dot"></span><img src="/icons/montgolfiere.png" alt="Marcel - Assistant patrimonial IKCP" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎈</text></svg>'"></button>
<button id="ikcp-chat-close-btn" style="display:none" onclick="window._ikcpToggle()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
`;

var container=document.createElement('div');
container.innerHTML=html;
document.body.appendChild(container);

window._ikcpToggle=toggle;
window._ikcpSend=send;
window._ikcpExpand=expand;
window._ikcpQuick=quick;

render();
setTimeout(function(){var t=document.getElementById('ikcp-tease');if(t&&!isOpen)t.style.display='block';},6000);
})();
