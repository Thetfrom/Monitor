(function(){
'use strict';
function P(){try{var h=String(window.location.hash||'');var i=h.indexOf('#d=');if(i<0)return null;
var f=h.slice(i+3);var s=window.atob(window.decodeURIComponent(f));
var u=window.decodeURIComponent(window.escape(s));return JSON.parse(u);}catch(e){return null;}}
function E(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function N(s){return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g,' ').trim();}
function DD(rows){if(!rows||!rows.length)return rows||[];var seen={},out=[];
var s=rows.slice().sort(function(a,b){var x=(a&&a._createdDate&&a._createdDate.$date)||(a&&a._createdDate)||'';
var y=(b&&b._createdDate&&b._createdDate.$date)||(b&&b._createdDate)||'';return String(x)<String(y)?-1:(String(x)>String(y)?1:0);});
for(var i=0;i<s.length;i++){var r=s[i];var k=String(r.check_date||r.checkDate||'')+'|'+String(r.model||'');
if(seen[k])continue;seen[k]=1;out.push(r);}return out;}
function names(a){if(!a)return [];var t=String(a);var c=t.indexOf(':');
if(c>-1&&c<160&&t.slice(0,c).split(' ').length>4)t=t.slice(c+1);
return t.split(';').map(function(x){return x.replace(/^\s*(?:[\-\u2013\u2022]|\d+\s*[\.\)])\s*/,'').trim();}).filter(function(x){return x.length>1&&x.length<60;});}
function pct(a,b){return b?Math.round(a/b*100):0;}

function build(d){
var mr=d.masterRecord||{};var all=DD(d.ai_visibility_checks||[]);
if(!all.length)return null;
var dates={};all.forEach(function(r){dates[r.check_date]=1;});
var ds=Object.keys(dates).sort();var today=ds[ds.length-1];var prev=ds.length>1?ds[ds.length-2]:null;
var rows=all.filter(function(r){return r.check_date===today;});
var kws=[mr.target_keyword_1,mr.target_keyword_2,mr.target_keyword_3];
var rivals=[mr.competitor_1_name,mr.competitor_2_name,mr.competitor_3_name].filter(Boolean);
var me=mr.business_name||'';

function score(set){var yes=0,ans=0;set.forEach(function(r){for(var n=1;n<=3;n++){
var v=String(r['kw'+n+'_mentioned']||'').toLowerCase();
if(v==='yes'){yes++;ans++;}else if(v==='no'){ans++;}}});return {yes:yes,ans:ans,p:pct(yes,ans)};}
var S=score(rows);
var SP=prev?score(all.filter(function(r){return r.check_date===prev;})):null;
var mods={};rows.forEach(function(r){mods[r.model]=mods[r.model]||false;
for(var n=1;n<=3;n++){if(String(r['kw'+n+'_mentioned']||'').toLowerCase()==='yes')mods[r.model]=true;}});
var mk=Object.keys(mods);var named=mk.filter(function(m){return mods[m];});

var tally={};rows.forEach(function(r){for(var n=1;n<=3;n++){
var seen={};names(r['answer_kw'+n]).forEach(function(x){var k=N(x);if(!k||seen[k])return;seen[k]=1;
tally[k]=tally[k]||{n:x,c:0};tally[k].c++;});}});
var mek=N(me);var rk=rivals.map(N);
var rivalRank=rivals.map(function(rv){return {n:rv,c:(tally[N(rv)]||{c:0}).c};}).sort(function(a,b){return b.c-a.c;});
var topRival=rivalRank[0]||null;
var unt=Object.keys(tally).filter(function(k){return k!==mek&&rk.indexOf(k)<0;})
.map(function(k){return tally[k];}).sort(function(a,b){return b.c-a.c;})[0];

var gaps=[];rows.forEach(function(r){for(var n=1;n<=3;n++){
if(String(r['kw'+n+'_mentioned']||'').toLowerCase()==='no'){
var kw=kws[n-1]||('keyword '+n);
gaps.push({m:r.model,k:kw,brand:mek&&N(kw).indexOf(mek)>-1});}}});
gaps.sort(function(a,b){return (b.brand?1:0)-(a.brand?1:0);});

var ahead=rivalRank.filter(function(x){return S.yes>x.c;}).length;
var pill = S.p>=67?'STRONG POSITION':(S.p>=34?'HOLDING':'NOT BEING NAMED');
var pillNote = S.p>=67?'named in two thirds or more of answered checks'
 :(S.p>=34?'named in a third to two thirds of answered checks':'named in under a third of answered checks');

return {mr:mr,all:all,dates:ds,me:me,today:today,prev:prev,S:S,SP:SP,mk:mk,named:named,rivalRank:rivalRank,
topRival:topRival,unt:unt,gaps:gaps,ahead:ahead,pill:pill,pillNote:pillNote,me:me,kws:kws};
}

function css(){return '#aivis2{font-family:Arial,Helvetica,sans-serif;margin:0 0 32px;}#aivis2.dk{--pg:transparent;--cd:#241B57;--bd:rgba(255,255,255,.09);--tx:#FFFFFF;--bo:#DAD5F0;--mu:#A79FD0;--or:#FF4D1F;--gr:#34D399;--grb:rgba(52,211,153,.16);--pn:rgba(255,255,255,.05);--dv:rgba(255,255,255,.10);}#aivis2.lt{--pg:transparent;--cd:#FFFFFF;--bd:#E6E1F5;--tx:#150F3D;--bo:#3B3468;--mu:#6B6394;--or:#D93A12;--gr:#0E9F6E;--grb:rgba(14,159,110,.12);--pn:#F6F4FD;--dv:#E9E5F7;}#aivis2 *{box-sizing:border-box;}#aivis2 .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin:0 0 20px;}#aivis2 .h1{font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-.06em;color:var(--tx);margin:0 0 8px;}#aivis2 .sub{font-size:15px;line-height:1.5;color:var(--mu);margin:0;}#aivis2 .live{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--mu);background:var(--pn);border:1px solid var(--bd);border-radius:999px;padding:8px 14px;white-space:nowrap;}#aivis2 .dot{width:8px;height:8px;border-radius:50%;background:var(--gr);flex:none;}#aivis2 .card{background:var(--cd);border:1px solid var(--bd);border-radius:16px;padding:32px 36px;}#aivis2 .cr{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 26px;}#aivis2 .ct{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);}#aivis2 .ic{width:32px;height:32px;border-radius:9px;background:rgba(255,77,31,.14);color:var(--or);display:flex;align-items:center;justify-content:center;font-size:15px;flex:none;}#aivis2 .pill{display:inline-flex;align-items:center;gap:8px;background:var(--grb);color:var(--gr);font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:7px 14px;border-radius:999px;}#aivis2 .pill i{width:7px;height:7px;border-radius:50%;background:var(--gr);font-style:normal;}#aivis2 .cr>span:last-child{display:inline-flex;flex-direction:column;align-items:center;}#aivis2 .thr{display:block;text-decoration:none;font-size:11px;line-height:1.4;color:var(--mu);text-align:center;margin-top:7px;max-width:230px;}#aivis2 .bd{display:grid;grid-template-columns:1fr 1px 1fr;gap:44px;align-items:start;}#aivis2 .lf{display:flex;gap:30px;align-items:center;}#aivis2 .rg{display:flex;flex-direction:column;gap:16px;}#aivis2 .dial{position:relative;width:128px;height:128px;flex:none;}#aivis2 .dial svg{transform:rotate(-90deg);display:block;}#aivis2 .dc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}#aivis2 .dc b{font-size:36px;font-weight:700;letter-spacing:-.05em;color:var(--tx);line-height:1;}#aivis2 .dc s{text-decoration:none;font-size:10px;letter-spacing:.1em;color:var(--mu);margin-top:6px;text-transform:uppercase;}#aivis2 .tr{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--gr);margin:0 0 12px;}#aivis2 .tr.dn{color:var(--or);}#aivis2 .lead{font-size:17px;font-weight:700;letter-spacing:-.03em;line-height:1.45;color:var(--tx);margin:0 0 6px;}#aivis2 .body{font-size:14px;line-height:1.6;color:var(--bo);margin:0;}#aivis2 .fine{font-size:12px;line-height:1.5;color:var(--mu);margin:12px 0 0;}#aivis2 .dv{background:var(--dv);width:1px;align-self:stretch;}#aivis2 .cmp{font-size:14px;line-height:1.6;color:var(--bo);margin:0;}#aivis2 .cmp b{color:var(--tx);font-weight:600;}#aivis2 .cal{display:flex;gap:16px;background:var(--pn);border-radius:12px;padding:18px 20px;}#aivis2 .cal .bg{width:38px;height:38px;border-radius:50%;background:rgba(255,77,31,.14);display:flex;align-items:center;justify-content:center;font-size:16px;flex:none;}#aivis2 .cal h4{font-size:13px;font-weight:600;color:var(--or);margin:0 0 5px;}#aivis2 .cal p{font-size:14px;line-height:1.55;color:var(--bo);margin:0;}#aivis2 .cal p b{color:var(--tx);font-weight:600;}@media(max-width:900px){#aivis2 .bd{grid-template-columns:1fr;gap:26px;}#aivis2 .dv{display:none;}#aivis2 .h1{font-size:23px;}#aivis2 .card{padding:22px;}}#aivis2 .s2{margin:34px 0 0;}#aivis2 .s2h{font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);margin:0 0 18px;}#aivis2 .s2g{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}#aivis2 .ac{position:relative;background:var(--cd);border:1px solid var(--bd);border-radius:14px;padding:22px 24px 24px;overflow:hidden;}#aivis2 .ac:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ak);}#aivis2 .ac.r{--ak:#F0563E;--akb:rgba(240,86,62,.14);}#aivis2 .ac.a{--ak:#E8A33D;--akb:rgba(232,163,61,.14);}#aivis2 .ac.g{--ak:#34D399;--akb:rgba(52,211,153,.14);}#aivis2 .ach{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 14px;}#aivis2 .acb{background:var(--akb);color:var(--ak);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 11px;border-radius:6px;white-space:nowrap;}#aivis2 .acw{font-size:12px;color:var(--mu);white-space:nowrap;}#aivis2 .act{font-size:16px;font-weight:700;letter-spacing:-.03em;line-height:1.35;color:var(--tx);margin:0 0 10px;}#aivis2 .acp{font-size:13px;line-height:1.55;color:var(--bo);margin:0 0 16px;}#aivis2 .aca{font-size:13px;color:var(--mu);margin:0;}#aivis2 .aca b{color:var(--ak);font-weight:700;}@media(max-width:900px){#aivis2 .s2g{grid-template-columns:1fr;}}#aivis2 .mv{display:block;width:100%;margin:26px 0 0;padding:24px 0 0;border-top:1px solid var(--dv)!important;}#aivis2 .mv,#aivis2 .mv>*{background:transparent!important;box-shadow:none!important;}#aivis2 .mv,#aivis2 .mv>div{border-color:transparent!important;padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important;max-width:none!important;width:auto!important;}#aivis2 .lf{align-items:flex-start;}#aivis2 .lf>div:last-child{flex:1;min-width:0;}';}
function render(v){
var S=v.S,C=2*Math.PI*57,off=C*(1-S.p/100),up=true,tr='';
if(v.SP){var dl=S.p-v.SP.p;up=dl>=0;tr=dl===0?('No change since '+E(v.prev)):((dl>0?'\u2191 Up ':'\u2193 Down ')+Math.abs(dl)+' point'+(Math.abs(dl)===1?'':'s')+' since '+E(v.prev));}
else{tr='First stored check';}
var mn=v.named.length,mt=v.mk.length;
var lead=mn===mt?('All '+mt+' AI models name you.'):(mn===0?('No AI model named you in '+mt+' checks.'):(mn+' of '+mt+' AI models name you.'));
var cmp='';
if(v.rivalRank.length){var tr2=v.topRival;
 cmp=v.ahead===v.rivalRank.length?('<b>Competitive Status:</b> Ahead of all '+v.rivalRank.length+' tracked rivals in the same '+S.ans+' answers. Closest is '+E(tr2.n)+' at '+tr2.c+'.')
  :('<b>Competitive Status:</b> Ahead of '+v.ahead+' of '+v.rivalRank.length+' tracked rivals. '+E(tr2.n)+' is named in '+tr2.c+' of the same '+S.ans+' answers.');}
else{cmp='<b>Competitive Status:</b> No competitors on your tracking list yet.';}
var worth='';
if(v.unt&&v.unt.c>=2&&(!v.topRival||v.unt.c>=v.topRival.c)){
 worth='<div class="cal"><div class="bg">\u25CE</div><div><h4>Worth knowing</h4><p><b>'+E(v.unt.n)+'</b> is named in '+v.unt.c+' of '+S.ans+' answered checks, more than any rival you track, and is not on your competitor list.</p></div></div>';}
var todo='';
if(v.gaps.length){var g=v.gaps[0];
 todo=(g.brand?('<b>'+E(g.m.toUpperCase())+'</b> did not name you for your own business name, "'+E(g.k)+'".'):('<b>'+E(g.m.toUpperCase())+'</b> did not name you for "'+E(g.k)+'".'))+' That is where a buyer asking that question would not hear about you.';}
else{todo='Nothing urgent. No gaps in the latest stored answers.';}
return '<div class="hd"><div>'
+'<h2 class="h1">AI Visibility Monitor</h2>'
+'<p class="sub">Tracking how search models like '+E(v.mk.map(function(m){return m==='glm'?'GLM':(m.charAt(0).toUpperCase()+m.slice(1));}).join(', '))+' describe your business.</p>'
+'</div><span class="live"><span class="dot"></span>Latest check '+E(v.today)+'</span></div>'
+'<div class="card">'
+'<div class="cr"><span class="ct"><span class="ic">\u2726</span>Your 90-Second AI Briefing</span>'
+'<span><span class="pill"><i></i>'+E(v.pill)+'</span><span class="thr">'+E(v.pillNote)+'</span></span></div>'
+'<div class="bd">'
+'<div class="lf"><div class="dial"><svg width="128" height="128" viewBox="0 0 128 128">'
+'<circle cx="64" cy="64" r="57" fill="none" stroke="var(--dv)" stroke-width="10"/>'
+'<circle cx="64" cy="64" r="57" fill="none" stroke="var(--or)" stroke-width="10" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>'
+'</svg><div class="dc"><b>'+S.p+'%</b><s>Score</s></div></div>'
+'<div><p class="tr'+(up?'':' dn')+'">'+E(tr)+'</p>'
+'<p class="lead">'+E(lead)+'</p>'
+'<p class="body">You were named in '+S.yes+' of '+S.ans+' answered checks today.</p>'
+'<p class="fine">Keywords a model did not answer are left out of the total.</p></div></div>'
+'<div class="dv"></div>'
+'<div class="rg"><p class="cmp">'+cmp+'</p>'+worth
+'<div class="cal"><div class="bg">\uD83D\uDCA1</div><div><h4>Advisor Recommendation</h4><p><b>What to do:</b> '+todo+'</p></div></div>'
+'</div></div></div>'+attn(v);
}

function attn(v){
var kws=[v.mr.target_keyword_1,v.mr.target_keyword_2,v.mr.target_keyword_3];
var byd={};v.all.forEach(function(r){var k=r.check_date+'|'+r.model;byd[k]=r;});
var dts=v.dates,td=v.today,pv=v.prev,cards=[];
var val=function(d,m,n){var r=byd[d+'|'+m];if(!r)return null;var x=String(r['kw'+n+'_mentioned']||'').toLowerCase();return (x==='yes'||x==='no')?x:null;};
v.mk.forEach(function(m){for(var n=1;n<=3;n++){
 var kw=kws[n-1];if(!kw)continue;
 var t=val(td,m,n),p=pv?val(pv,m,n):null;
 var miss=0,seen=0;
 for(var i=dts.length-1;i>=0&&seen<4;i--){var x=val(dts[i],m,n);if(x===null)continue;seen++;if(x==='no')miss++;}
 var brand=v.me&&N(kw).indexOf(N(v.me))>-1;
 if(p==='yes'&&t==='no'){cards.push({r:0,cls:'r',bdg:'High priority',w:'Since '+pv,
  t:m.toUpperCase()+' stopped naming you for "'+kw+'"',
  p:'It named you on '+pv+'. It does not in the latest check.',
  a:'A buyer asking that question no longer hears about you.'});}
 else if(p==='no'&&t==='yes'){cards.push({r:3,cls:'g',bdg:'Monitoring',w:'Since '+pv,
  t:m.toUpperCase()+' started naming you for "'+kw+'"',
  p:'It did not name you on '+pv+'. It does in the latest check.',
  a:'Whatever changed is working. Nothing to undo.'});}
 else if(t==='no'&&miss>=2){cards.push({r:brand?1:2,cls:'a',bdg:'Action suggested',w:miss+' of last '+seen+' checks',
  t:m.toUpperCase()+' has not named you for "'+kw+'"'+(brand?' \u2014 your own name':''),
  p:'Missing in '+miss+' of the last '+seen+' answered checks, including the latest.',
  a:brand?'People searching your own business name are not being shown you.':'This is a standing gap, not a one-off.'});}
}});
cards.sort(function(x,y){return x.r-y.r;});
if(cards.length<3){var hold=[];v.mk.forEach(function(m){for(var n=1;n<=3;n++){var kw=kws[n-1];if(!kw)continue;var hit=0,tot=0;for(var i=dts.length-1;i>=0&&tot<4;i--){var x=val(dts[i],m,n);if(x===null)continue;tot++;if(x==='yes')hit++;}if(tot>=2&&hit===tot&&val(td,m,n)==='yes'){hold.push({score:tot,cls:'g',bdg:'Holding',w:hit+' of last '+tot+' checks',t:m.toUpperCase()+' keeps naming you for "'+kw+'"',p:'Named in every one of the last '+tot+' answered checks, including the latest.',a:'Steady. Nothing to fix here.'});}}});hold.sort(function(x,y){return y.score-x.score;});var used={};cards.forEach(function(c){used[c.t]=1;});for(var q=0;q<hold.length&&cards.length<3;q++){if(used[hold[q].t])continue;used[hold[q].t]=1;cards.push(hold[q]);}}
if(!cards.length){cards=[{cls:'g',bdg:'All clear',w:'Latest check '+td,t:'Nothing changed since '+(pv||td),p:'No model gained or lost you on any tracked keyword.',a:'No action needed today.'}];}
cards=cards.slice(0,3);
return '<div class="s2"><h3 class="s2h">What Needs Your Attention</h3><div class="s2g">'
+cards.map(function(c){return '<div class="ac '+c.cls+'">'
 +'<div class="ach"><span class="acb">'+E(c.bdg)+'</span><span class="acw">'+E(c.w)+'</span></div>'
 +'<p class="act">'+E(c.t)+'</p>'
 +'<p class="acp">'+E(c.p)+'</p>'
 +'<p class="aca">What this means: <b>'+E(c.a)+'</b></p>'
 +'</div>';}).join('')
+'</div></div>';
}
function theme(el){
 try{var b=window.getComputedStyle(document.body).backgroundColor||'';
 var m=b.match(/\d+/g);var lum=m?(0.299*+m[0]+0.587*+m[1]+0.114*+m[2]):0;
 el.className=lum<128?'dk':'lt';}catch(e){el.className='dk';}
}

function mount(){
 if(document.getElementById('aivis2'))return true;
 var d=P();if(!d)return false;
 var v=build(d);if(!v)return false;
 var els=document.querySelectorAll('.page-title,h1,h2,h3,h4'),h=null,i2;
 for(i2=0;i2<els.length;i2++){var t=(els[i2].textContent||'').trim().toLowerCase();
  if(t==='ai visibility'&&els[i2].offsetParent!==null){h=els[i2];break;}}
 if(!h)return false;
 var st=document.getElementById('aivis2css');
 if(!st){st=document.createElement('style');st.id='aivis2css';st.textContent=css();document.head.appendChild(st);}
 var box=document.createElement('div');box.id='aivis2';
 var cands=[].slice.call(document.querySelectorAll('*')).filter(function(e){var t=e.textContent||'';return /of answers/i.test(t)&&/What to do/i.test(t)&&e.offsetParent!==null;});
 var oldCard=cands.length?cands[cands.length-1]:null;
 if(oldCard&&oldCard.parentNode){oldCard.parentNode.insertBefore(box,oldCard);oldCard.style.display='none';}
 else {h.parentNode.insertBefore(box,h.nextElementSibling||null);}
 h.style.display='none';
 box.innerHTML=render(v);
 try{var hits=[].slice.call(document.querySelectorAll('*')).filter(function(el){var tx=el.textContent||'';return /Each AI model today/i.test(tx)&&el.offsetParent!==null&&!box.contains(el);});var pn=hits[hits.length-1];if(pn){var g=0;while(pn&&g<8&&!/CLAUDE|GEMINI|LLAMA|GLM/i.test(pn.textContent||'')){pn=pn.parentElement;g++;}if(pn&&pn!==document.body&&pn!==document.documentElement&&!box.contains(pn)){var cd=box.querySelector('.card');if(cd){pn.classList.add('mv');cd.appendChild(pn);}}}}catch(er){}
 theme(box);
 document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('.theme-toggle')){
   try{var tabs=[].slice.call(document.querySelectorAll('button.nav-tab'));var act=function(b){return b&&(/(^|\s)(active|current|selected)(\s|$)/i.test(b.className)||b.getAttribute('aria-selected')==='true');};var at=tabs.filter(act)[0];if(!at&&document.getElementById('aivis2')){at=tabs.filter(function(b){return /AI Visibility/i.test(b.textContent||'');})[0];}if(at){try{localStorage.setItem('aivisTab',(at.textContent||'').trim());}catch(x){}}}catch(er){}
   setTimeout(function(){var b=document.getElementById('aivis2');if(b)theme(b);},60);}},true);
 return true;
}
var busy=false;
function tryMount(){if(busy)return;busy=true;try{mount();}catch(e){}busy=false;}
if(document.readyState!=='loading')tryMount();else document.addEventListener('DOMContentLoaded',tryMount);
setInterval(tryMount,600);
try{new MutationObserver(tryMount).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
window.addEventListener('hashchange',function(){var o=document.getElementById('aivis2');if(o)o.remove();tryMount();});
})();
(function(){try{var w=localStorage.getItem('aivisTab');if(!w)return;var act=function(b){return b&&(/(^|\s)(active|current|selected)(\s|$)/i.test(b.className)||b.getAttribute('aria-selected')==='true');};var t0=Date.now();var iv=setInterval(function(){if(Date.now()-t0>10000){clearInterval(iv);try{localStorage.removeItem('aivisTab');}catch(x){}return;}var nt=[].slice.call(document.querySelectorAll('button.nav-tab')).filter(function(b){return (b.textContent||'').trim()===w;})[0];if(!nt)return;if(act(nt)){clearInterval(iv);try{localStorage.removeItem('aivisTab');}catch(x){}return;}try{nt.click();}catch(x){}},150);}catch(er){}})();

