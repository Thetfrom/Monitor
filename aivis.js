(function(){
'use strict';
function P(){try{var h=String(window.location.hash||'');var i=h.indexOf('#d=');if(i<0)return null;
var f=h.slice(i+3);var s=window.atob(window.decodeURIComponent(f));
var u=window.decodeURIComponent(window.escape(s));return JSON.parse(u);}catch(e){return null;}}
function E(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function N(s){return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g,' ').trim();}
function DD(rows){if(!rows||!rows.length)return rows||[];var m={},order=[],o=[],i,r,k,cur;function scored(x){var c=0,n,f;for(n=1;n<=3;n++){f=x['kw'+n+'_mentioned'];f=(f===undefined||f===null)?'':String(f).toLowerCase();if(f==='yes'||f==='no')c++;}return c;}function texts(x){var c=0,n;for(n=1;n<=3;n++){if(String(x['answer_kw'+n]||'').trim())c++;}return c;}function better(a,b){var sa=scored(a),sb=scored(b);if(sa!==sb)return sa>sb;return texts(a)>texts(b);}var s=rows.slice().sort(function(a,b){var x=(a&&a._createdDate&&a._createdDate.$date)||(a&&a._createdDate)||'';var y=(b&&b._createdDate&&b._createdDate.$date)||(b&&b._createdDate)||'';return String(x)<String(y)?-1:(String(x)>String(y)?1:0);});for(i=0;i<s.length;i++){r=s[i];k=String(r.check_date||r.checkDate||'')+'|'+String(r.model||'').toLowerCase();cur=m[k];if(!cur){m[k]=r;order.push(k);continue;}if(better(r,cur))m[k]=r;}for(i=0;i<order.length;i++)o.push(m[order[i]]);return o;}
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

function css(){return '#aivis2{font-family:Arial,Helvetica,sans-serif;margin:0 0 32px;}#aivis2.dk{--pg:transparent;--cd:#241B57;--bd:rgba(255,255,255,.09);--tx:#FFFFFF;--bo:#DAD5F0;--mu:#A79FD0;--or:#FF4D1F;--gr:#34D399;--grb:rgba(52,211,153,.16);--pn:rgba(255,255,255,.05);--dv:rgba(255,255,255,.10);}#aivis2.lt{--pg:transparent;--cd:#FFFFFF;--bd:#E6E1F5;--tx:#150F3D;--bo:#3B3468;--mu:#6B6394;--or:#D93A12;--gr:#0E9F6E;--grb:rgba(14,159,110,.12);--pn:#F6F4FD;--dv:#E9E5F7;}#aivis2 *{box-sizing:border-box;}#aivis2 .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin:0 0 20px;}#aivis2 .h1{font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-.06em;color:var(--tx);margin:0 0 8px;}#aivis2 .sub{font-size:15px;line-height:1.5;color:var(--mu);margin:0;}#aivis2 .live{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--mu);background:var(--pn);border:1px solid var(--bd);border-radius:999px;padding:8px 14px;white-space:nowrap;}#aivis2 .dot{width:8px;height:8px;border-radius:50%;background:var(--gr);flex:none;}#aivis2 .card{background:var(--cd);border:1px solid var(--bd);border-radius:16px;padding:32px 36px;}#aivis2 .cr{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 26px;}#aivis2 .ct{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);}#aivis2 .ic{width:32px;height:32px;border-radius:9px;background:rgba(255,77,31,.14);color:var(--or);display:flex;align-items:center;justify-content:center;font-size:15px;flex:none;}#aivis2 .pill{display:inline-flex;align-items:center;gap:8px;background:var(--grb);color:var(--gr);font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:7px 14px;border-radius:999px;}#aivis2 .pill i{width:7px;height:7px;border-radius:50%;background:var(--gr);font-style:normal;}#aivis2 .cr>span:last-child{display:inline-flex;flex-direction:column;align-items:center;}#aivis2 .thr{display:block;text-decoration:none;font-size:11px;line-height:1.4;color:var(--mu);text-align:center;margin-top:7px;max-width:230px;}#aivis2 .bd{display:grid;grid-template-columns:1fr 1px 1fr;gap:44px;align-items:start;}#aivis2 .lf{display:flex;gap:30px;align-items:center;}#aivis2 .rg{display:flex;flex-direction:column;gap:16px;}#aivis2 .dial{position:relative;width:128px;height:128px;flex:none;}#aivis2 .dial svg{transform:rotate(-90deg);display:block;width:100%;height:100%;}#aivis2 .dc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}#aivis2 .dc b{font-size:36px;font-weight:700;letter-spacing:-.05em;color:var(--tx);line-height:1;}#aivis2 .dc s{text-decoration:none;font-size:10px;letter-spacing:.1em;color:var(--mu);margin-top:6px;text-transform:uppercase;}#aivis2 .tr{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--gr);margin:0 0 12px;}#aivis2 .tr.dn{color:var(--or);}#aivis2 .lead{font-size:17px;font-weight:700;letter-spacing:-.03em;line-height:1.45;color:var(--tx);margin:0 0 6px;}#aivis2 .body{font-size:14px;line-height:1.6;color:var(--bo);margin:0;}#aivis2 .fine{font-size:12px;line-height:1.5;color:var(--mu);margin:12px 0 0;}#aivis2 .dv{background:var(--dv);width:1px;align-self:stretch;}#aivis2 .cmp{font-size:14px;line-height:1.6;color:var(--bo);margin:0;}#aivis2 .cmp b{color:var(--tx);font-weight:600;}#aivis2 .cal{display:flex;gap:16px;background:var(--pn);border-radius:12px;padding:18px 20px;}#aivis2 .cal .bg{width:38px;height:38px;border-radius:50%;background:rgba(255,77,31,.14);display:flex;align-items:center;justify-content:center;font-size:16px;flex:none;}#aivis2 .cal h4{font-size:13px;font-weight:600;color:var(--or);margin:0 0 5px;}#aivis2 .cal p{font-size:14px;line-height:1.55;color:var(--bo);margin:0;}#aivis2 .cal p b{color:var(--tx);font-weight:600;}@media(max-width:900px){#aivis2 .bd{grid-template-columns:1fr;gap:26px;}#aivis2 .dv{display:none;}#aivis2 .h1{font-size:23px;}#aivis2 .card{padding:22px;}}#aivis2 .s2{margin:34px 0 0;}#aivis2 .s2h{font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);margin:0 0 18px;}#aivis2 .s2g{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}#aivis2 .ac{position:relative;background:var(--cd);border:1px solid var(--bd);border-radius:14px;padding:22px 24px 24px;overflow:hidden;}#aivis2 .ac:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ak);}#aivis2 .ac.r{--ak:#F0563E;--akb:rgba(240,86,62,.14);}#aivis2 .ac.a{--ak:#E8A33D;--akb:rgba(232,163,61,.14);}#aivis2 .ac.g{--ak:#34D399;--akb:rgba(52,211,153,.14);}#aivis2 .ach{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 14px;}#aivis2 .acb{background:var(--akb);color:var(--ak);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 11px;border-radius:6px;white-space:nowrap;}#aivis2 .acw{font-size:12px;color:var(--mu);white-space:nowrap;}#aivis2 .act{font-size:16px;font-weight:700;letter-spacing:-.03em;line-height:1.35;color:var(--tx);margin:0 0 10px;}#aivis2 .acp{font-size:13px;line-height:1.55;color:var(--bo);margin:0 0 16px;}#aivis2 .aca{font-size:13px;color:var(--mu);margin:0;}#aivis2 .aca b{color:var(--ak);font-weight:700;}@media(max-width:900px){#aivis2 .s2g{grid-template-columns:1fr;}}#aivis2 .mv{display:block!important;width:100%!important;flex:0 0 100%!important;max-width:none!important;box-sizing:border-box;margin:22px 0 0!important;padding:0!important;border:0!important;border-radius:0!important;}#aivis2 .mv *{max-width:none!important;}#aivis2 .mv,#aivis2 .mv>*{background:transparent!important;box-shadow:none!important;}#aivis2 .mv>*{border:0!important;padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important;width:auto!important;}#aivis2 .lf{align-items:flex-start;flex-wrap:wrap;}#aivis2 .lf>div:last-child{flex:1;min-width:0;}#aivis2 .s3{margin:34px 0 0;}#aivis2 .s3h{font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);margin:0 0 18px;}#aivis2 .s3g{display:grid;grid-template-columns:1fr 1fr;gap:20px;}#aivis2 .wc{background:var(--cd);border:1px solid var(--bd);border-radius:14px;padding:24px;}#aivis2 .wch{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700;letter-spacing:-.03em;color:var(--tx);margin:0 0 16px;}#aivis2 .wci{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none;}#aivis2 .wc.win .wci{background:var(--grb);color:var(--gr);}#aivis2 .wc.gap .wci{background:rgba(240,86,62,.14);color:#F0563E;}#aivis2 .wi{display:flex;justify-content:space-between;align-items:center;gap:14px;background:var(--pn);border-radius:10px;padding:13px 15px;margin:0 0 9px;}#aivis2 .wi:last-child{margin:0;}#aivis2 .wk{font-size:14px;font-weight:700;letter-spacing:-.02em;color:var(--tx);margin:0 0 4px;}#aivis2 .ws{font-size:12px;color:var(--mu);margin:0;}#aivis2 .wm{display:flex;align-items:center;gap:11px;flex:none;}#aivis2 .wb{font-size:11px;font-weight:700;letter-spacing:.03em;padding:5px 10px;border-radius:6px;white-space:nowrap;background:var(--or);color:#FFFFFF;}#aivis2 .wb.sec{background:var(--dv);color:var(--tx);}#aivis2 .wb.no{background:rgba(240,86,62,.16);color:#F0563E;}#aivis2 .wd{font-size:12px;font-weight:600;white-space:nowrap;color:var(--mu);}#aivis2 .wd.up{color:var(--gr);}#aivis2 .wd.dn{color:#F0563E;}#aivis2 .wo{font-size:12px;color:var(--mu);white-space:nowrap;}#aivis2 .wn{font-size:13px;color:var(--mu);margin:0;}@media(max-width:900px){#aivis2 .s3g{grid-template-columns:1fr;}}#aivis2 .s4{margin:34px 0 0;}#aivis2 .s4h{font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);margin:0 0 18px;}#aivis2 .s4c{background:var(--cd);border:1px solid var(--bd);border-radius:14px;padding:24px;}#aivis2 .s4t{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin:0 0 18px;flex-wrap:wrap;}#aivis2 .s4t p{font-size:14px;line-height:1.55;color:var(--tx);font-weight:600;margin:0;max-width:820px;}#aivis2 .s4t p em{font-style:normal;color:var(--or);}#aivis2 .s4t span{font-size:12px;color:var(--mu);white-space:nowrap;}#aivis2 .s4g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}#aivis2 .cp{background:var(--pn);border:1px solid transparent;border-radius:12px;padding:18px;}#aivis2 .cp.me{border-color:var(--or);}#aivis2 .cph{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 14px;}#aivis2 .cpn{font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--bo);line-height:1.3;}#aivis2 .cp.me .cpn{color:var(--or);}#aivis2 .cpr{font-size:22px;font-weight:700;letter-spacing:-.05em;color:var(--tx);flex:none;}#aivis2 .cpd{border-top:1px solid var(--dv);padding:13px 0 0;margin:0 0 12px;}#aivis2 .cpl{font-size:11px;color:var(--mu);margin:0 0 4px;}#aivis2 .cpv{font-size:16px;font-weight:700;letter-spacing:-.03em;color:var(--tx);margin:0;}#aivis2 .cpm{font-size:11px;font-weight:600;margin:0;color:var(--mu);}#aivis2 .cpm.up{color:var(--gr);}#aivis2 .cpm.dn{color:#F0563E;}@media(max-width:900px){#aivis2 .s4g{grid-template-columns:1fr 1fr;}}#aivis2 .s5{margin:34px 0 0;}#aivis2 .s5h{font-size:20px;font-weight:700;letter-spacing:-.04em;color:var(--tx);margin:0 0 18px;}#aivis2 .s5g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}#aivis2 .mc{background:var(--cd);border:1px solid var(--bd);border-radius:14px;padding:20px 22px;}#aivis2 .mc.warn{border-color:#E8A33D;}#aivis2 .mch{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 12px;}#aivis2 .mcn{font-size:17px;font-weight:700;letter-spacing:-.03em;color:var(--tx);}#aivis2 .mcs{font-size:13px;font-weight:700;color:var(--gr);white-space:nowrap;}#aivis2 .mcs.mid{color:#E8A33D;}#aivis2 .mcs.low{color:#F0563E;}#aivis2 .mcb{font-size:12px;font-weight:600;margin:0 0 12px;color:var(--mu);}#aivis2 .mcb.ok{color:var(--gr);}#aivis2 .mcb.warn{color:#E8A33D;}#aivis2 .mcp{font-size:13px;line-height:1.55;color:var(--bo);margin:0;}@media(max-width:900px){#aivis2 .s5g{grid-template-columns:1fr 1fr;}}';}
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
+'</div></div></div>'+attn(v)+winlose(v)+compdisp(v)+models(v)+quotes(v)+skin();
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

function ordn(k){var t=k%100;if(t>=11&&t<=13)return k+'th';var d=k%10;return k+(d===1?'st':d===2?'nd':d===3?'rd':'th');}
function winlose(v){
var kws=[v.mr.target_keyword_1,v.mr.target_keyword_2,v.mr.target_keyword_3];
var byd={};v.all.forEach(function(r){byd[r.check_date+'|'+r.model]=r;});
var mek=N(v.me);
var posOf=function(d,m,n){var r=byd[d+'|'+m];if(!r)return null;var L=names(r['answer_kw'+n]);
 for(var i=0;i<L.length;i++){if(N(L[i])===mek)return i+1;}return null;};
var firstOf=function(d,m,n){var r=byd[d+'|'+m];if(!r)return null;var L=names(r['answer_kw'+n]);return L.length?L[0]:null;};
var said=function(d,m,n){var r=byd[d+'|'+m];if(!r)return null;var x=String(r['kw'+n+'_mentioned']||'').toLowerCase();return (x==='yes'||x==='no')?x:null;};
var win=[],gap=[];
for(var n=1;n<=3;n++){var kw=kws[n-1];if(!kw)continue;
 var yes=[],no=[],best=null,bestPrev=null,owners={};
 v.mk.forEach(function(m){var t=said(v.today,m,n);if(t===null)return;
  if(t==='yes'){yes.push(m);var p=posOf(v.today,m,n);if(p&&(best===null||p<best))best=p;}else{no.push(m);}
  var f=firstOf(v.today,m,n);if(f)owners[N(f)]=(owners[N(f)]||{n:f,c:0}),owners[N(f)].c++;});
 if(v.prev){v.mk.forEach(function(m){var p=posOf(v.prev,m,n);if(p&&(bestPrev===null||p<bestPrev))bestPrev=p;});}
 var cap=function(m){return m==='glm'?'GLM':(m.charAt(0).toUpperCase()+m.slice(1));};
 if(yes.length){var dl='',dc='';
  if(bestPrev===null){dl='New entry';dc='up';}
  else if(best===null){dl='';}
  else if(best<bestPrev){dl='+'+(bestPrev-best)+' spot'+((bestPrev-best)===1?'':'s');dc='up';}
  else if(best>bestPrev){dl='-'+(best-bestPrev)+' spot'+((best-bestPrev)===1?'':'s');dc='dn';}
  else{dl='Steady';dc='';}
  win.push({k:kw,s:'Named by '+yes.map(cap).join(', '),b:best?ordn(best)+' mention':'Named',sec:best&&best>1,d:dl,dc:dc,r:best||99});}
 if(no.length){var ow=null;for(var q in owners){if(q===mek)continue;if(!ow||owners[q].c>ow.c)ow=owners[q];}
  gap.push({k:kw,s:'Not named by '+no.map(cap).join(', '),o:ow?ow.n+' is named first':'',r:no.length});}
}
win.sort(function(x,y){return x.r-y.r;});gap.sort(function(x,y){return y.r-x.r;});
var rowW=function(c){return '<div class="wi"><div><p class="wk">"'+E(c.k)+'"</p><p class="ws">'+E(c.s)+'</p></div>'
 +'<div class="wm"><span class="wb'+(c.sec?' sec':'')+'">'+E(c.b)+'</span>'+(c.d?'<span class="wd '+c.dc+'">'+E(c.d)+'</span>':'')+'</div></div>';};
var rowG=function(c){return '<div class="wi"><div><p class="wk">"'+E(c.k)+'"</p><p class="ws">'+E(c.s)+'</p></div>'
 +'<div class="wm"><span class="wb no">Not named</span>'+(c.o?'<span class="wo">'+E(c.o)+'</span>':'')+'</div></div>';};
return '<div class="s3"><h3 class="s3h">Where You are Winning vs. Losing</h3><div class="s3g">'
+'<div class="wc win"><p class="wch"><span class="wci">\u2713</span>Winning Mentions (People Find You)</p>'
+(win.length?win.map(rowW).join(''):'<p class="wn">No keyword was answered with your name in the latest check.</p>')+'</div>'
+'<div class="wc gap"><p class="wch"><span class="wci">\u26A0</span>Opportunity Gaps (Missing You)</p>'
+(gap.length?gap.map(rowG).join(''):'<p class="wn">Every model named you for every tracked keyword.</p>')+'</div>'
+'</div></div>';
}

function tally(v,date){var m={},tot=0;
v.all.forEach(function(r){if(r.check_date!==date)return;
 for(var n=1;n<=3;n++){var L=names(r['answer_kw'+n]);if(!L.length)continue;tot++;var seen={};
  L.forEach(function(x){var k=N(x);if(!k||seen[k])return;seen[k]=1;m[k]=m[k]||{n:x,c:0};m[k].c++;});}});
return {m:m,tot:tot};}
function compdisp(v){
var T=tally(v,v.today),P=v.prev?tally(v,v.prev):null;
if(!T.tot)return '';
var mek=N(v.me);
var pick=[{k:mek,n:v.me,me:true}];
[v.mr.competitor_1_name,v.mr.competitor_2_name,v.mr.competitor_3_name].forEach(function(r){if(r)pick.push({k:N(r),n:r,me:false});});
var known={};pick.forEach(function(p){known[p.k]=1;});
var out=Object.keys(T.m).filter(function(k){return !known[k];}).map(function(k){return {k:k,n:T.m[k].n,me:false,un:true};});
out.sort(function(x,y){return (T.m[y.k].c||0)-(T.m[x.k].c||0);});
var all=pick.concat(out.slice(0,3));
all.forEach(function(p){p.c=(T.m[p.k]||{c:0}).c;p.p=P?((P.m[p.k]||{c:0}).c):null;});
all.sort(function(x,y){return y.c-x.c;});
var meIdx=-1;all.forEach(function(p,i){if(p.me)meIdx=i;});
var top=all.slice(0,4);
if(meIdx>=4){top=all.slice(0,3).concat([all[meIdx]]);}
var lead='';var meRow=all[meIdx];
var above=all.filter(function(p,i){return i<meIdx;});
if(meIdx===0){lead='You are named in more of today answers than every business tracked here.';}
else{var b=all[meIdx-1];lead='<em>'+E(b.n)+'</em> is named in '+(b.c-meRow.c)+' more of today answers than you.';}
if(meRow&&meRow.p!==null){var dd=meRow.c-meRow.p;
 lead+=dd>0?(' You gained '+dd+' since '+E(v.prev)+'.'):(dd<0?(' You lost '+Math.abs(dd)+' since '+E(v.prev)+'.'):(' No change since '+E(v.prev)+'.'));}
return '<div class="s4"><h3 class="s4h">Competitor Displacement</h3><div class="s4c">'
+'<div class="s4t"><p>'+lead+'</p><span>Latest check '+E(v.today)+'</span></div>'
+'<div class="s4g">'+top.map(function(p,i){
 var mv='',mc='';
 if(p.p===null){mv='First recorded check';}
 else if(p.c>p.p){mv='Gained '+(p.c-p.p)+' since '+v.prev;mc='up';}
 else if(p.c<p.p){mv='Lost '+(p.p-p.c)+' since '+v.prev;mc='dn';}
 else{mv='No change';}
 return '<div class="cp'+(p.me?' me':'')+'">'
  +'<div class="cph"><span class="cpn">'+E(p.n)+(p.me?' (you)':'')+(p.un?' \u2014 not tracked':'')+'</span><span class="cpr">#'+(i+1)+'</span></div>'
  +'<div class="cpd"><p class="cpl">Named in</p><p class="cpv">'+p.c+' of '+T.tot+' answers</p></div>'
  +'<p class="cpm '+mc+'">'+E(mv)+'</p></div>';}).join('')
+'</div></div></div>';
}

function models(v){
var kws=[v.mr.target_keyword_1,v.mr.target_keyword_2,v.mr.target_keyword_3];
var byd={};v.all.forEach(function(r){byd[r.check_date+'|'+r.model]=r;});
var val=function(d,m,n){var r=byd[d+'|'+m];if(!r)return null;var x=String(r['kw'+n+'_mentioned']||'').toLowerCase();return (x==='yes'||x==='no')?x:null;};
var cap=function(m){return m==='glm'?'GLM':(m.charAt(0).toUpperCase()+m.slice(1));};
var cards=v.mk.map(function(m){
 var yes=[],no=[],ans=0;
 for(var n=1;n<=3;n++){var t=val(v.today,m,n);if(t===null)continue;ans++;if(t==='yes')yes.push(kws[n-1]);else no.push(kws[n-1]);}
 var streak=0;
 for(var i=v.dates.length-1;i>=0;i--){var d=v.dates[i],ok=true,any=false;
  for(var n2=1;n2<=3;n2++){var x=val(d,m,n2);if(x===null)continue;any=true;if(x==='no'){ok=false;break;}}
  if(!any)continue;if(ok)streak++;else break;}
 var drop=null;
 for(var i2=v.dates.length-1;i2>0;i2--){var dd=v.dates[i2],pd=v.dates[i2-1],hit=false;
  for(var n3=1;n3<=3;n3++){if(val(pd,m,n3)==='yes'&&val(dd,m,n3)==='no'){hit=true;break;}}
  if(hit){drop=dd;break;}}
 var bl,bc;
 if(streak>=2){bl='\uD83D\uDD25 '+streak+' perfect checks in a row';bc='ok';}
 else if(drop){bl='\u26A0 Dropped on '+drop;bc='warn';}
 else if(no.length){bl='\u26A1 Mixed results';bc='warn';}
 else{bl='\uD83D\uDD25 Named on every keyword';bc='ok';}
 var body;
 if(!ans){body='This model returned no answer for any tracked keyword in the latest check.';}
 else if(!no.length){body='Names you for all '+ans+' keyword'+(ans===1?'':'s')+' it answered.';}
 else if(!yes.length){body='Does not name you for any of the '+ans+' keyword'+(ans===1?'':'s')+' it answered.';}
 else{body='Names you for '+yes.map(function(k){return '"'+k+'"';}).join(' and ')+'. Does not name you for '+no.map(function(k){return '"'+k+'"';}).join(' or ')+'.';}
 return {m:m,n:cap(m),y:yes.length,a:ans,bl:bl,bc:bc,body:body};});
if(!cards.length)return '';
var worst=null;cards.forEach(function(c){var rt=c.a?c.y/c.a:1;if(worst===null||rt<worst.r)worst={m:c.m,r:rt};});
return '<div class="s5"><h3 class="s5h">How AI Models See You This Week</h3><div class="s5g">'
+cards.map(function(c){var rt=c.a?c.y/c.a:1;var sc=rt===1?'':(rt>=0.5?'mid':'low');
 return '<div class="mc'+(worst&&c.m===worst.m&&rt<1?' warn':'')+'">'
 +'<div class="mch"><span class="mcn">'+E(c.n)+'</span><span class="mcs '+sc+'">'+c.y+'/'+c.a+' score</span></div>'
 +'<p class="mcb '+c.bc+'">'+E(c.bl)+'</p>'
 +'<p class="mcp">'+E(c.body)+'</p></div>';}).join('')
+'</div></div>';
}
function ptxt(r,n){return r['answer_text_kw'+n]||r['answerTextKw'+n]||r['answer_text_'+n]||'';}function kwlab(v,n){if(v&&v.kws&&v.kws[n-1])return String(v.kws[n-1]);var rs=(v.all||[]);for(var i=0;i<rs.length;i++){var k=rs[i]['target_keyword_'+n];if(k)return String(k);}return '';}function hlq(t,w){if(!w)return E(t);var s=String(w),i=t.toLowerCase().indexOf(s.toLowerCase());if(i<0)return E(t);return E(t.slice(0,i))+'<b class="qn">'+E(t.slice(i,i+s.length))+'</b>'+E(t.slice(i+s.length));}function css6(){return '<style>#aivis2 .q6{margin:32px 0 0}#aivis2 .qh{font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:-.045em;margin:0 0 5px;color:var(--tx)}#aivis2 .qs{font-size:12.5px;line-height:1.55;color:var(--mu);margin:0 0 14px;max-width:64ch}#aivis2 .qc{background:var(--cd);border:1px solid var(--bd);border-radius:16px;padding:22px 24px}#aivis2 .qg+.qg{border-top:1px solid var(--dv);margin-top:20px;padding-top:20px}#aivis2 .qq{color:var(--or);font-size:11px;font-weight:700;letter-spacing:.085em;text-transform:uppercase;margin:0 0 14px}#aivis2 .qr{display:grid;grid-template-columns:96px 1fr;gap:16px;align-items:start;margin:0 0 13px}#aivis2 .qr:last-child{margin-bottom:0}#aivis2 .qm2{color:var(--mu);font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding-top:2px}#aivis2 .ql{font-size:13.5px;line-height:1.65;color:var(--bo);margin:0}#aivis2 .qt{font-style:italic;font-size:14px;line-height:1.65;color:var(--bo);margin:0}#aivis2 .qn{color:var(--or);font-weight:700}#aivis2 .qsep{color:var(--mu);opacity:.6}#aivis2 .qtag{display:inline-block;margin-left:8px;font-style:normal;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--mu);border:1px solid var(--dv);border-radius:999px;padding:2px 8px;white-space:nowrap}#aivis2 .qtag.win{color:var(--or);border-color:var(--or)}#aivis2 .qz{font-size:13px;line-height:1.65;color:var(--mu);margin:0}#aivis2 .qe{color:var(--mu);font-size:13px;margin:0}#aivis2 .qfoot{color:var(--mu);font-size:11.5px;line-height:1.55;margin:16px 0 0;padding-top:14px;border-top:1px solid var(--dv)}@media(max-width:640px){#aivis2 .qr{grid-template-columns:1fr;gap:4px}}</style>';}function trows(v){var a=(v.all||[]),o=[],s={},i,r,m;for(i=0;i<a.length;i++){r=a[i];if(String(r.check_date)!==String(v.today))continue;m=String(r.model||'').toLowerCase();if(!m||s[m])continue;s[m]=1;o.push(r);}return o;}function quotes(v){var rs=trows(v);if(!rs.length)return '';var g=[],i,j,n,any=false;for(n=1;n<=3;n++){var kw=kwlab(v,n);if(!kw)continue;var it=[],has=false;for(i=0;i<rs.length;i++){var r=rs[i],ls=names(r['answer_kw'+n]||''),t=String(ptxt(r,n)||'').trim(),pos=0;if(v.me){for(j=0;j<ls.length;j++){if(N(ls[j])===N(v.me)){pos=j+1;break;}}}it.push({m:String(r.model||'').toUpperCase(),ls:ls,t:t,pos:pos});if(ls.length||t)has=true;}if(has){g.push({kw:kw,it:it});any=true;}}var h=css6()+'<div class="q6"><div class="qh">What AI Actually Says About You</div>'+'<p class="qs">The businesses each model named today, in the order it named them. Your name is highlighted wherever it appears.</p>'+'<div class="qc">';if(!any){h+='<p class="qe">No model returned an answer today. When they do, their replies appear here.</p>';}else{for(i=0;i<g.length;i++){h+='<div class="qg"><div class="qq">Query: \u201C'+E(g[i].kw)+'\u201D</div>';for(j=0;j<g[i].it.length;j++){var x=g[i].it[j],b='';h+='<div class="qr"><div class="qm2">'+E(x.m)+'</div>';if(x.t){h+='<p class="qt">'+hlq(x.t,x.ls.length?x.ls[0]:'')+'</p>';}else if(x.ls.length){for(var k=0;k<x.ls.length;k++){b+=(k?'<span class="qsep">; </span>':'')+(N(x.ls[k])===N(v.me||'')?('<b class="qn">'+E(x.ls[k])+'</b>'):E(x.ls[k]));}h+='<p class="ql">'+b+(x.pos===1?'<span class="qtag win">named first</span>':(x.pos>1?('<span class="qtag">ranked '+x.pos+' of '+x.ls.length+'</span>'):'<span class="qtag">not named</span>'))+'</p>';}else{h+='<p class="qz">No answer stored for this keyword today.</p>';}h+='</div>';}h+='</div>';}}h+='<p class="qfoot">Stored exactly as each model replied. A model that returned nothing is listed too, so you can see which engines went quiet rather than having them silently dropped.</p></div></div>';return h;}function skin(){return '<style>#aivis2 .thr{display:none}#aivis2 .lf>div:not(.dial){flex:1 1 0;min-width:0;align-self:center}</style>';}function rstat(v,r){var n,f,o={ans:0,named:0,miss:0,tot:0};for(n=1;n<=3;n++){if(!kwlab(v,n))continue;o.tot++;f=r['kw'+n+'_mentioned'];f=(f===undefined||f===null)?'':String(f).toLowerCase();if(f==='yes'){o.ans++;o.named++;}else if(f==='no'){o.ans++;}else{o.miss++;}}return o;}function rcss(){return '<style>#aivis2 .t6{--t6-o:#FF3D14;--t6-n:#0F0638;--t6-l:#EEE9FF;margin:32px 0 0;width:100%}#aivis2 .t6h{font-family:Arial,Helvetica,sans-serif;font-weight:700;letter-spacing:-.06em;font-size:16px;color:var(--tx);margin:0 0 4px}#aivis2 .t6s{font-size:12px;line-height:1.5;color:var(--mu);margin:0 0 16px;max-width:52ch}#aivis2 .t6g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}#aivis2 .t6t{display:flex;flex-direction:column;align-items:center;gap:4px;opacity:0;animation:t6up 400ms cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i) * 80ms)}@keyframes t6up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}#aivis2 .t6r{position:relative;width:64px;height:64px}#aivis2 .t6r svg{transform:rotate(-90deg)}#aivis2 .t6k{fill:none;stroke:var(--t6-l);stroke-width:6}#aivis2 .t6a{fill:none;stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset 400ms cubic-bezier(.16,1,.3,1)}#aivis2 .t6a.full{stroke:var(--gr)}#aivis2 .t6a.part{stroke:var(--t6-o)}#aivis2 .t6a.none{stroke:transparent}#aivis2 .t6v{position:absolute;inset:0;display:grid;place-items:center;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;letter-spacing:-.04em;color:var(--tx)}#aivis2 .t6n{font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--tx);margin:8px 0 0}#aivis2 .t6c{font-size:11px;line-height:1.4;color:var(--mu);margin:0;text-align:center}#aivis2 .t6c.warn{color:var(--t6-o)}#aivis2.dk .t6{--t6-l:rgba(255,255,255,.14)}#aivis2.dk .t6a.full{stroke:var(--gr)}@media(max-width:560px){#aivis2 .t6g{grid-template-columns:repeat(2,1fr);gap:16px}}@media(prefers-reduced-motion:reduce){#aivis2 .t6t{animation-duration:.01ms}}</style>';}function rings(v){var rs=trows(v),i,h;if(!rs.length)return '';h=rcss()+'<section class="t6" aria-label="Each AI model today">'+'<h3 class="t6h">Each AI model today</h3>'+'<p class="t6s">How many of your keywords each model names you for. A keyword a model did not return is left out of its total, not counted against you.</p>'+'<div class="t6g">';for(i=0;i<rs.length;i++){var r=rs[i],s=rstat(v,r),nm=String(r.model||'').toUpperCase();var C=163.36,pctv=s.ans?(s.named/s.ans):0,off=C-(C*pctv);var cls=!s.ans?'none':(s.named===s.ans?'full':'part');var val=s.ans?(s.named+'/'+s.ans):(s.tot?('0/'+s.tot):'\u2014');var cap=!s.tot?('no keywords tracked'):(s.miss?(s.miss+' of '+s.tot+' keywords not returned'):('all '+s.tot+' measured'));var lab=nm+(s.ans?(' named you in '+s.named+' of '+s.ans+' answered keywords'):' returned no answer today');h+='<div class="t6t" style="--i:'+i+'"><div class="t6r" role="img" aria-label="'+E(lab)+'">'+'<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">'+'<circle class="t6k" cx="32" cy="32" r="26"></circle>'+'<circle class="t6a '+cls+'" cx="32" cy="32" r="26" style="stroke-dasharray:'+C+';stroke-dashoffset:'+off.toFixed(2)+'"></circle>'+'</svg><b class="t6v">'+val+'</b></div>'+'<p class="t6n">'+E(nm)+'</p><p class="t6c'+((!s.ans||s.miss)?' warn':'')+'">'+E(cap)+'</p></div>';}h+='</div></section>';return h;}function theme(el){
 try{var b=window.getComputedStyle(document.body).backgroundColor||'';
 var m=b.match(/\d+/g);var lum=m?(0.299*+m[0]+0.587*+m[1]+0.114*+m[2]):0;
 el.className=lum<128?'dk':'lt';}catch(e){el.className='dk';}
}

function mount(){
 if(document.getElementById('aivis2'))return true;[].slice.call(document.querySelectorAll('[data-aivis-hid]')).forEach(function(el){el.style.removeProperty('display');el.removeAttribute('data-aivis-hid');});
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
 if(oldCard&&oldCard.parentNode){oldCard.parentNode.insertBefore(box,oldCard);oldCard.style.display='none';oldCard.setAttribute('data-aivis-hid','1');}
 else {h.parentNode.insertBefore(box,h.nextElementSibling||null);}
 h.style.display='none';h.setAttribute('data-aivis-hid','1');
 box.innerHTML=render(v);
 try{var hits=[].slice.call(document.querySelectorAll('*')).filter(function(el){var tx=el.textContent||'';return /Each AI model today/i.test(tx)&&el.offsetParent!==null&&!box.contains(el);});var pn=hits[hits.length-1];if(pn){var g=0;while(pn&&g<8&&!/CLAUDE|GEMINI|LLAMA|GLM/i.test(pn.textContent||'')){pn=pn.parentElement;g++;}if(pn&&pn!==document.body&&pn!==document.documentElement&&!box.contains(pn)){var cd=box.querySelector('.lf')||box.querySelector('.card');if(cd){pn.style.setProperty('display','none','important');pn.setAttribute('data-aivis-hid','1');cd.insertAdjacentHTML('beforeend',rings(v));try{var rows=[].slice.call(pn.querySelectorAll('*')).filter(function(el){var ch=[].slice.call(el.children);return ch.length===4&&ch.every(function(c){return /\d\s*\/\s*\d/.test(c.textContent||'');});});var row=rows[rows.length-1];if(row){row.style.setProperty('display','grid','important');row.style.setProperty('grid-template-columns','repeat(4,1fr)','important');row.style.setProperty('gap','10px','important');row.style.setProperty('width','100%','important');row.style.setProperty('max-width','none','important');[].slice.call(row.children).forEach(function(c){c.style.setProperty('width','auto','important');c.style.setProperty('margin','0','important');});}}catch(e2){}}}}}catch(er){}
 try{var qh=[].slice.call(document.querySelectorAll('*')).filter(function(el){var t=el.textContent||'';return /What the AIs actually said about you today/i.test(t)&&/one card per question/i.test(t)&&el.offsetParent!==null&&!box.contains(el);});var qn=qh[qh.length-1];if(qn&&qn!==document.body&&qn!==document.documentElement){qn.style.setProperty('display','none','important');qn.setAttribute('data-aivis-hid','1');}}catch(e3){}theme(box);
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

