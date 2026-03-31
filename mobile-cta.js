(function(){
if(window.innerWidth > 768) return;
var bar=document.createElement('div');
bar.id='ikcp-mobile-bar';
bar.innerHTML='<a href="tel:+33000000000" id="ikcp-tel-btn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;color:white;text-decoration:none;font-size:14px;font-weight:600;font-family:system-ui,sans-serif"><span style="font-size:20px">📞</span>Appeler</a><a href="https://calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#b8956e;color:#1f1a16;text-decoration:none;font-size:14px;font-weight:600;border-radius:10px;font-family:system-ui,sans-serif"><span style="font-size:20px">📅</span>RDV gratuit</a>';
bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9990;background:#1f1a16;padding:10px 12px;display:flex;gap:8px;box-shadow:0 -4px 20px rgba(0,0,0,0.15);border-top:1px solid rgba(184,149,110,0.3)';
document.body.appendChild(bar);
document.body.style.paddingBottom='60px';
})();
