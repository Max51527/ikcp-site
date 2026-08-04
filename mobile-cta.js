(function(){
if(window.innerWidth > 768) return;
var bar=document.createElement('div');
bar.id='ikcp-mobile-bar';
bar.innerHTML='<a href="/creer-mon-compte" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:#b8956e;color:#1f1a16;text-decoration:none;font-size:14.5px;font-weight:700;border-radius:10px;padding:12px 10px;font-family:system-ui,sans-serif">Mon bilan patrimonial<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>';
bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9990;background:#1f1a16;padding:10px 12px;display:flex;gap:8px;box-shadow:0 -4px 20px rgba(0,0,0,0.15);border-top:1px solid rgba(184,149,110,0.3)';
document.body.appendChild(bar);
document.body.style.paddingBottom='60px';
})();
