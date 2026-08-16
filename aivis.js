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

return {mr:mr,today:today,prev:prev,S:S,SP:SP,mk:mk,named:named,rivalRank:rivalRank,
topRival:topRival,unt:unt,gaps:gaps,ahead:ahead,pill:pill,pillNote:pillNote,me:me,kws:kws};
}

function css(){return `
#aivis2{--o:#FF3D14;--nv:#0F0638;font-family:Arial,Helvetica,sans-serif;letter-spacing:-.02em;margin:0 0 32px;}
#aivis2.dk{--bg:#0F0638;--cd:#1A0D45;--ln:rgba(238,233,255,.16);--tx:#F4F1FF;--mu:#B9AEE8;--ac:#FF5A36;--pb:#FF3D14;--pt:#0F0638;--pnl:rgba(255,61,20,.10);}
#aivis2.lt{--bg:#FFFFFF;--cd:#FFFFFF;--ln:#E4DEF6;--tx:#0F0638;--mu:#4A3F7A;--ac:#C4290A;--pb:#C4290A;--pt:#FFFFFF;--pnl:rgba(196,41,10,.06);}
#aivis2 *{box-sizing:border-box;}
#aivis2 .eb{font:700 12px/1 Arial;letter-spacing:.14em;color:var(--ac);text-transform:uppercase;margin:0 0 12px;}
#aivis2 .h1{font:700 34px/1.1 Arial;letter-spacing:-.06em;color:var(--tx);margin:0 0 8px;}
#aivis2 .h1 i{font-family:'Times New Roman',Georgia,serif;font-style:italic;font-weight:400;color:var(--ac);letter-spacing:-.02em;}
#aivis2 .sub{font:400 15px/1.5 Arial;color:var(--mu);margin:0;}
#aivis2 .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin:0 0 24px;}
#aivis2 .chip{display:inline-flex;align-items:center;gap:8px;font:400 13px/1 Arial;color:var(--mu);white-space:nowrap;padding-top:6px;}
#aivis2 .dot{width:8px;height:8px;border-radius:50%;background:var(--ac);flex:none;}
#aivis2 .card{background:var(--cd);border:1px solid var(--ln);border-radius:20px;padding:32px;}
#aivis2 .crow{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 28px;flex-wrap:wrap;}
#aivis2 .ct{font:700 20px/1.2 Arial;letter-spacing:-.03em;color:var(--tx);margin:0;}
#aivis2 .pill{display:inline-flex;flex-direction:column;align-items:flex-end;gap:5px;}
#aivis2 .pill b{background:var(--pb);color:var(--pt);font:700 11px/1 Arial;letter-spacing:.1em;padding:8px 14px;border-radius:999px;text-transform:uppercase;}
#aivis2 .pill s{text-decoration:none;font:400 11px/1.3 Arial;color:var(--mu);text-align:right;max-width:230px;}
#aivis2 .body{display:grid;grid-template-columns:1fr 1px 1fr;gap:40px;align-items:start;}
#aivis2 .lft{display:flex;gap:28px;align-items:center;}
#aivis2 .dial{position:relative;width:132px;height:132px;flex:none;}
#aivis2 .dial svg{transform:rotate(-90deg);display:block;}
#aivis2 .dctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
#aivis2 .dctr b{font:700 32px/1 Arial;letter-spacing:-.05em;color:var(--tx);}
#aivis2 .dctr s{text-decoration:none;font:700 9px/1 Arial;letter-spacing:.12em;color:var(--mu);margin-top:6px;text-transform:uppercase;}
#aivis2 .trend{font:400 13px/1 Arial;color:var(--mu);margin:0 0 10px;}
#aivis2 .big{font:700 17px/1.4 Arial;letter-spacing:-.03em;color:var(--tx);margin:0 0 6px;}
#aivis2 .fine{font:400 12px/1.5 Arial;color:var(--mu);margin:10px 0 0;}
#aivis2 .vd{background:var(--ln);width:1px;align-self:stretch;}
#aivis2 .rgt{display:flex;flex-direction:column;gap:14px;}
#aivis2 .comp{font:400 14px/1.5 Arial;color:var(--tx);margin:0;}
#aivis2 .panel{border-left:3px solid var(--ac);background:var(--pnl);border-radius:0 12px 12px 0;padding:14px 18px;}
#aivis2 .panel h4{font:700 10px/1 Arial;letter-spacing:.14em;color:var(--ac);text-transform:uppercase;margin:0 0 8px;}
#aivis2 .panel p{font:400 14px/1.55 Arial;color:var(--tx);margin:0;}
#aivis2 .panel p b{font-weight:700;}
@media(max-width:900px){#aivis2 .body{grid-template-columns:1fr;gap:24px;}#aivis2 .vd{display:none;height:1px;width:100%;}#aivis2 .h1{font-size:26px;}#aivis2 .card{padding:22px;}#aivis2 .lft{gap:18px;}}
`;}

function render(v){
var S=v.S;var C=2*Math.PI*58;var off=C*(1-S.p/100);
var trend='';
if(v.SP){var dl=S.p-v.SP.p;
trend = dl===0 ? ('No change since '+E(v.prev))
 : ((dl>0?'\u2191 ':'\u2193 ')+Math.abs(dl)+' point'+(Math.abs(dl)===1?'':'s')+' since '+E(v.prev));}
else{trend='First stored check';}
var mn=v.named.length, mt=v.mk.length;
var modLine = mn===mt ? ('All '+mt+' models named you.') : (mn===0?('No model named you in '+mt+' checks.'):(mn+' of '+mt+' models named you.'));
var comp='';
if(v.rivalRank.length){
 var tr=v.topRival;
 comp = v.ahead===v.rivalRank.length
  ? ('Ahead of all '+v.rivalRank.length+' tracked rivals in the same '+S.ans+' answers. Closest is '+E(tr.n)+' at '+tr.c+'.')
  : ('Ahead of '+v.ahead+' of '+v.rivalRank.length+' tracked rivals. '+E(tr.n)+' is named in '+tr.c+' of the same '+S.ans+' answers.');
}else{comp='No competitors are on your tracking list yet.';}
var worth='';
if(v.unt && v.unt.c>=2 && (!v.topRival || v.unt.c>=v.topRival.c)){
 worth='<div class="panel"><h4>Worth knowing</h4><p><b>'+E(v.unt.n)+'</b> is named in '+v.unt.c+' of '+S.ans+' answered checks, more than any rival you track, and is not on your competitor list.</p></div>';}
var todo='';
if(v.gaps.length){
 var g=v.gaps[0];var same=v.gaps.filter(function(x){return x.k===g.k&&x.m===g.m;}).length;
 todo=(g.brand?'<b>'+E(g.m.toUpperCase())+'</b> did not name you for your own business name, "'+E(g.k)+'".'
   :'<b>'+E(g.m.toUpperCase())+'</b> did not name you for "'+E(g.k)+'".')
   +' That is where a buyer asking that question would not hear about you.';
}else{todo='No gaps in the latest stored answers. Nothing to act on today.';}

return '<div class="hdr"><div>'
+'<p class="eb">AI Visibility Monitor</p>'
+'<h2 class="h1">Do the models <i>name you?</i></h2>'
+'<p class="sub">'+E(v.mk.map(function(m){return m.charAt(0).toUpperCase()+m.slice(1);}).join(', '))+' \u2014 checked every day.</p>'
+'</div><div class="chip"><span class="dot"></span>Latest check '+E(v.today)+'</div></div>'
+'<div class="card">'
+'<div class="crow"><h3 class="ct">Your 90-Second Briefing</h3>'
+'<span class="pill"><b>'+E(v.pill)+'</b><s>'+E(v.pillNote)+'</s></span></div>'
+'<div class="body">'
+'<div class="lft"><div class="dial"><svg width="132" height="132" viewBox="0 0 132 132">'
+'<circle cx="66" cy="66" r="58" fill="none" stroke="var(--ln)" stroke-width="11"/>'
+'<circle cx="66" cy="66" r="58" fill="none" stroke="var(--o)" stroke-width="11" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>'
+'</svg><div class="dctr"><b>'+S.p+'%</b><s>of answers</s></div></div>'
+'<div><p class="trend">'+E(trend)+'</p>'
+'<p class="big">Named in '+S.yes+' of '+S.ans+' answered checks.</p>'
+'<p class="big" style="font-weight:400;color:var(--mu);font-size:14px;margin:0;">'+E(modLine)+'</p>'
+'<p class="fine">Keywords a model did not answer are left out of the total.</p></div></div>'
+'<div class="vd"></div>'
+'<div class="rgt"><p class="comp">'+comp+'</p>'+worth
+'<div class="panel"><h4>What to do</h4><p>'+todo+'</p></div></div>'
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
 theme(box);
 document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('.theme-toggle')){
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
