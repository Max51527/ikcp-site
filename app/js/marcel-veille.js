/* ════════════════════════════════════════════════════════════════
   MARCEL VEILLE — agent proactif (Niveau 2)
   © 2026 IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568
   ----------------------------------------------------------------
   L'IA prend l'initiative : sans qu'on demande, Marcel lit les données
   du membre (société + patrimoine) et la date du jour, puis signale
   seuils franchis et échéances. 100 % déterministe (règles), instantané,
   souverain (aucun appel externe), gratuit. Rend dans #marcel-veille.
   Chaque alerte finit par une orientation, jamais une reco (MIF II).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var host = document.getElementById('marcel-veille');
  if (!host) return;

  function readSoc(){ try{ return JSON.parse(localStorage.getItem('ikcp_societe')||'null'); }catch(_){ return null; } }
  function readBiens(){ try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k && k.indexOf('ikcp_patrimoine_')===0){ var v=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(v)&&v.length) return v; } } }catch(_){} return []; }
  function eur(n){ n=Math.max(0,Math.round(n)); var c=Math.abs(n)>=1e6; return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:c?1:0,notation:c?'compact':'standard'}).format(n); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  var soc=readSoc(), biens=readBiens();
  var byCat={}; biens.forEach(function(b){ byCat[b.cat]=(byCat[b.cat]||0)+(+b.value||0); });
  var brut=biens.reduce(function(a,b){return a+(+b.value||0);},0);
  var immo=byCat.immobilier||0, liq=byCat.liquidites||0;
  var now=new Date(), Y=now.getFullYear(), PER=88911;
  var A=[];
  function push(sev,icon,title,body,cta){ A.push({sev:sev,icon:icon,title:title,body:body,cta:cta}); }

  // 1 · IFI
  if(immo>=1300000) push('urgent','🏠','Seuil IFI franchi','Votre immobilier ('+eur(immo)+') dépasse 1,3 M€ : vous êtes redevable de l\'IFI. Leviers : démembrement, dette déductible, dons.',{t:'Voir mon audit',h:'/app/bilan'});
  // 2 · trésorerie qui dort
  if(liq>=100000 || (brut>0 && liq/brut>0.25)) push('info','💰','Trésorerie qui dort','Vous avez '+eur(liq)+' en liquidités, peu rémunérés face à l\'inflation. Au-delà de votre réserve de précaution, un placement adapté préserve leur valeur.',{t:'Mes schémas',h:'/app/strategies'});
  // 3 · société : résultat élevé → arbitrage / holding
  if(soc && soc.resultat!=null && soc.resultat>=50000) push('info','💼','Arbitrage à refaire',(soc.nom?esc(soc.nom)+' — ':'')+'résultat de '+eur(soc.resultat)+'. La façon de le sortir (rémunération / dividendes / holding) peut changer votre net de dizaines de milliers d\'euros.',{t:'Simuler',h:'/app/simulateur-sel'});
  // 4 · PER (selon la date)
  var daysEOY=Math.ceil((new Date(Y,11,31)-now)/864e5);
  if(now.getMonth()>=8) push('urgent','⏳','PER : la fenêtre se ferme','Il vous reste '+daysEOY+' jours pour déduire jusqu\'à '+eur(PER)+' de vos revenus '+Y+'. Effet immédiat sur l\'impôt.',{t:'En parler à Marcel',h:'/app/marcel?q='+encodeURIComponent('Comment optimiser mon PER avant la fin de l\'année ?')});
  else push('info','🐖','PER : anticipez '+Y,'Jusqu\'à '+eur(PER)+' déductibles cette année. Étaler dès maintenant lisse l\'effort et l\'impôt.',{t:'En parler à Marcel',h:'/app/marcel?q='+encodeURIComponent('Comment utiliser le PER pour réduire mon impôt cette année ?')});
  // 5 · prochaine échéance fiscale (indicatif)
  var cal=[{m:3,d:15,l:'Acompte d\'IS'},{m:5,d:15,l:'Solde de l\'IS (exercice civil)'},{m:6,d:15,l:'Acompte d\'IS'},{m:9,d:15,l:'Acompte d\'IS'},{m:12,d:15,l:'CFE + acompte d\'IS'}];
  var next=null; for(var pass=0;pass<2&&!next;pass++){ for(var i=0;i<cal.length;i++){ var dt=new Date(Y+pass,cal[i].m-1,cal[i].d); if(dt>=now){ next={dt:dt,l:cal[i].l}; break; } } }
  if(next){ var dd=Math.ceil((next.dt-now)/864e5); push(dd<=30?'urgent':'info','📅','Échéance fiscale',esc(next.l)+' — dans '+dd+' jours (indicatif, selon votre régime).',null); }
  // 6 · concentration
  var topCat=Object.keys(byCat).sort(function(a,b){return byCat[b]-byCat[a];})[0];
  if(brut>0 && topCat && byCat[topCat]/brut>0.6){ var labMap={immobilier:'immobilier',societe:'votre société',liquidites:'les liquidités',non_cote:'le non coté',collection:'les collections'}; push('info','📊','Patrimoine concentré',Math.round(byCat[topCat]/brut*100)+' % de votre patrimoine repose sur '+(labMap[topCat]||'un seul poste')+'. Diversifier réduit votre risque global.',{t:'Voir mon audit',h:'/app/bilan'}); }

  if(!soc && !biens.length){
    host.innerHTML='<article class="card"><div class="card-head"><span class="card-cat" style="color:var(--accent)">🔔 Marcel veille</span><span class="pill neutral">en attente</span></div><p style="font-size:13px;color:var(--mute);line-height:1.6;margin:4px 0 0">Renseignez votre <b>SIREN</b> (cartographie, ci-dessus) et votre <b>patrimoine</b> (cockpit) — Marcel surveillera alors vos seuils et échéances, et vous alertera de lui-même.</p></article>';
    return;
  }

  A.sort(function(a,b){ return (a.sev==='urgent'?0:1)-(b.sev==='urgent'?0:1); });
  var show=A.slice(0,4), more=A.length-show.length;
  var rows=show.map(function(a){
    return '<div style="display:flex;gap:11px;padding:12px 0;border-top:1px solid var(--line,#E9E2D6)">'+
      '<div style="font-size:20px;line-height:1.2;flex-shrink:0">'+a.icon+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-weight:600;font-size:13.5px;color:var(--navy,#1B2A4A)">'+a.title+(a.sev==='urgent'?' <span style="font-size:9px;background:#C24722;color:#fff;padding:1px 7px;border-radius:999px;font-weight:600;vertical-align:1px">à traiter</span>':'')+'</div>'+
        '<div style="font-size:12px;color:var(--mute,#6B5D52);margin-top:2px;line-height:1.45">'+a.body+'</div>'+
        (a.cta?'<a href="'+a.cta.h+'" style="font-size:11.5px;color:var(--gold-deep,#8B6F3F);font-weight:600;text-decoration:none;display:inline-block;margin-top:5px">'+a.cta.t+' →</a>':'')+
      '</div></div>';
  }).join('');
  host.innerHTML='<article class="card" style="border-color:rgba(201,169,110,.32)">'+
    '<div class="card-head"><span class="card-cat" style="color:var(--accent)">🔔 Marcel veille pour vous</span><span class="pill live">'+A.length+' signal'+(A.length>1?'s':'')+'</span></div>'+
    '<div style="margin-top:2px">'+rows+'</div>'+
    (more>0?'<div style="font-size:11.5px;color:var(--mute);margin-top:10px">+ '+more+' autre'+(more>1?'s':'')+' — <a href="/app/marcel" style="color:var(--gold-deep,#8B6F3F);font-weight:600;text-decoration:none">tout voir avec Marcel →</a></div>':'')+
    '<div style="font-size:9.5px;color:var(--mute);margin-top:11px;line-height:1.4;opacity:.85">Surveillance automatique à titre informatif (art. L.541-1 CoMoFi) — dates fiscales indicatives selon votre régime.</div>'+
    '</article>';
})();
