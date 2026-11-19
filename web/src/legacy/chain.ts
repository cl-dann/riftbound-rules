// @ts-nocheck
/* Chain elemző: átmenetileg imperatív "sziget" a React appban. A React a gyökér elemet adja,
   ez a modul tölti fel és kezeli. A kártyalap megnyitása és a tooltip eseményekkel megy a React felé. */
import {CARDS,RULES,TOPICS,esc,norm,glossify,FL,FLT,vsCard,vsPairs,b64e,b64d,domDots,typeLine} from './core';
const $=(id:string)=>document.getElementById(id) as any;
const openModal=(c:any)=>window.dispatchEvent(new CustomEvent('rb:open-card',{detail:c.n}));
const hideTip=()=>window.dispatchEvent(new Event('rb:hide-tip'));
export const CHAIN_MARKUP=`<div class="cols">
      <div class="panel pad">
        <p class="note" style="margin-top:0">Add meg a helyzetet: a legendeket, a battlefieldeket és a boardon már kint lévő lapokat, majd a chain lépéseit sorban. Az első lépés a kijátszás, minden további egy válasz. Az oldal ellenőrzi a lépéseket, és sorban leírja, mi történik.</p>
        <div id="cb-steps"></div>
        <div class="btnrow"><button class="btn sec" id="cb-add">+ Válasz hozzáadása</button><button class="btn" id="cb-run">Chain lefuttatása</button></div>
        <div class="btnrow"><button class="btn sec" id="cb-link">Helyzet linkként</button><button class="linkbtn" id="cb-clear">Minden törlése</button></div>
        <div class="status" id="cb-linkst" role="status"></div>
        <div class="btnrow"><button class="linkbtn" id="cb-ex">Példa betöltése</button></div>
      </div>
      <div class="cb-right"><div id="cb-viz"></div><div class="panel pad" id="cb-out"><h2>Chain elemzés</h2><p class="note">Adj meg legalább egy lapot, majd nyomd meg a Chain lefuttatása gombot.</p></div></div>
    </div>
  `;
let started=false;
/* A React rész (Playmat drag and drop) ezen keresztül írja a builder állapotát. */
export const chainApi:{moveUnit?:(uid:string,loc:string)=>string|null}={};
/* Lejátszási frame-ek: a runCB minden lépés után pillanatképet készít a boardról, a React rész (ChainView) jeleníti meg. */
let LAST_FRAMES:any[]=[];
export const getChainFrames=()=>LAST_FRAMES;
const emitFrames=(f:any[])=>{LAST_FRAMES=f;window.dispatchEvent(new CustomEvent('rb:chain-frames',{detail:f}));};
const plainOf=(h:string)=>{const d=document.createElement('div');d.innerHTML=h;return (d.textContent||'').replace(/\s+/g,' ').trim();};
export function initChain(root:HTMLElement){
root.innerHTML=CHAIN_MARKUP;
/* ---------- Chain builder ---------- */
let CS={lg:{A:'',B:''},bf:[{n:'',c:''},{n:'',c:''}],bd:[],steps:[]};
const LOCS=()=>[['base','Base'],['bf0',(CS.bf[0].n||'1. battlefield')],['bf1',(CS.bf[1].n||'2. battlefield')]];
const locLabel=l=>(LOCS().find(x=>x[0]===l)||['',l])[1];
const stripRem=s=>(s||'').replace(/\([^()]*\)/g,' ').replace(/\s+/g,' ').trim();
const effOf=c=>stripRem((c.txt||'')+' '+(c.eff||''));
function abilitiesOf(c){
  const out=[];if(!c)return out;
  (c.txt||'').split('\n').forEach(raw=>{const l=stripRem(raw);
    if(/^\[Equip\]/.test(l)){out.push({label:'Equip',eff:'Attach this to a unit you control.',tm:'none',equip:true});return;}
    const k=l.indexOf(':');if(k<0)return;const cost=l.slice(0,k),eff=l.slice(k+1).replace(/^\s*\[Reaction\]\s*[,—-]*\s*/,'').trim();
    if(/^when|^at the|^if /i.test(cost))return;
    const tm=/\[Reaction\]/.test(l)?'reaction':/\[Action\]/.test(l)?'action':'none';
    out.push({label:cost.replace(/\[>\]/g,'').trim()+': '+eff.slice(0,60),eff,tm,add:/\[Add\]/.test(eff)});});
  return out;
}
function phrasesTxt(e){
  const out=[];const re=/\b(a|an|another|two|up to (\d+))\s+((?:other\s+)?(friendly|enemy)\s+)?(unit|gear|spell)s?\b/gi;let m;
  const mm=/(\d+) \[S\] or less/i.exec(e);
  if(/\bchoose a battlefield\b/i.test(e))out.push({type:'battlefield',rel:'any',max:null,bf:false,opt:false});
  while((m=re.exec(e))){const ty=m[5].toLowerCase();const tail=e.slice(m.index,m.index+80);
    if(/^(?:a|an) (?:unit|gear|spell)s? (?:you control|token)/i.test(tail)&&/play an? /i.test(e.slice(Math.max(0,m.index-8),m.index)))continue;
    const n=m[2]?+m[2]:(m[1].toLowerCase()==='two'?2:1);
    for(let i=0;i<Math.min(n,3);i++)out.push({type:ty,rel:(m[4]||'any').toLowerCase(),max:mm&&ty==='unit'?+mm[1]:null,bf:ty!=='spell'&&/^[^.]*?\bat (?:a|the same) battlefield/i.test(tail),same:/^[^.]*?\bat the same battlefield/i.test(tail),opt:!!m[2]});}
  return out;
}
function stepInfo(s){
  const c=vsCard(s.n);if(!c)return null;
  if(s.k==='ab'){const ab=abilitiesOf(srcCard(s.src))[s.ai||0];if(!ab)return {c,ab:null,eff:'',list:[],trig:false,isAb:true};
    return {c:srcCard(s.src),ab,eff:ab.eff,list:ab.add?[]:ab.equip?[{type:'unit',rel:'friendly',max:null,bf:false,opt:false}]:phrasesTxt(ab.eff),trig:false,isAb:true,may:/^you may\b/i.test(ab.eff)};}
  const pt=/when you play (?:me|this)[^,.]*[,.]\s*([^\n]*)/i.exec(c.txt||'');
  const e=stripRem(c.t==='Spell'?effOf(c):(pt?pt[1]:''));
  return {c,eff:e,list:phrasesTxt(e),trig:!!pt,may:/^you may\b/i.test(e)};
}
function srcCard(src){if(!src)return null;if(src[0]==='L')return vsCard(CS.lg[src.slice(1)]);if(src[0]==='b'){const b=CS.bd[+src.slice(1)];return b?vsCard(b.n):null;}return null;}
function actOf(eff){
  if(/counter (?:a|an|that|it)?\b[^.]{0,30}spell|counter a spell/i.test(eff))return {k:'counter',unless:/unless its controller pays/i.test(eff)};
  if(/\battach this to\b/i.test(eff))return {k:'attach'};
  if(/\[Add\]/.test(eff))return {k:'add'};
  if(/return[^.]{0,80}hand/i.test(eff))return {k:'hand'};
  if(/\bbanish/i.test(eff))return {k:'banish'};
  if(/\bkill\b/i.test(eff))return {k:'kill'};
  if(/\brecall/i.test(eff))return {k:'recall'};
  if(/\bmove\b[^.]{0,40}\bbase\b/i.test(eff))return {k:'base'};
  const d=/\bdeal (\d+)/i.exec(eff);if(d)return {k:'dmg',n:+d[1]};
  if(/\bstun\b/i.test(eff))return {k:'stun'};
  if(/\bbuff\b/i.test(eff))return {k:'buff'};
  return {k:'other'};
}
const allScope=eff=>{const m=/\b(all|each) (other )?(friendly |enemy )?(units?|gear)\b([^.]{0,30})/i.exec(eff);if(!m)return null;
  return {rel:(m[3]||'any').trim().toLowerCase()||'any',type:/gear/i.test(m[4])?'gear':'unit',here:/\bhere\b/i.test(m[5]),there:/\bthere\b/i.test(m[5]),atbf:/at (?:a |each )?battlefields?/i.test(m[5])};};
function timingOf(c){
  const t=c.txt||'';const kw=k=>new RegExp('^\\['+k+'\\](?:\\s*\\(|\\s*$)','m').test(t);
  if(kw('Reaction')||kw('Quick-Draw'))return 'reaction';
  if(kw('Hidden'))return 'hidden';
  if(kw('Action'))return 'action';
  return c.t==='Spell'?'none':'perm';
}
const isPermC=c=>c&&(c.t==='Unit'||c.t==='Gear');
const cbSel=(attrs,opts,v)=>'<select '+attrs+'>'+opts.map(o=>'<option value="'+esc(o[0])+'"'+(String(v)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';
const PLO=[['A','Te'],['B','Ellenfél']];
function bdLabel(i){const b=CS.bd[i];const c=vsCard(b.n);return (b.pl==='A'?'Te: ':'Ellenfél: ')+(c?c.n:b.n||'?')+' ('+locLabel(b.loc)+')';}
function tgOptions(j,p){
  const o=[['','nincs kiválasztva']];
  if(p.type==='battlefield'){o.push(['F0',locLabel('bf0')],['F1',locLabel('bf1')]);return o;}
  if(p.type!=='spell'){CS.bd.forEach((b,i)=>{const c=vsCard(b.n);if(c&&c.t.toLowerCase()===p.type)o.push(['b'+i,'Board: '+bdLabel(i)]);});
    for(let k=0;k<j;k++){const s=CS.steps[k];const c=vsCard(s.n);if(s.k==='card'&&isPermC(c)&&c.t.toLowerCase()===p.type)o.push(['s'+k,(k+1)+'. lépés: '+c.n]);}
    o.push(['x','más '+p.type+' (nincs a board listában)']);}
  else for(let k=0;k<j;k++){const s=CS.steps[k];const c=vsCard(s.n);if(s.k==='card'&&c&&c.t==='Spell')o.push(['s'+k,(k+1)+'. lépés: '+c.n]);}
  return o;
}
function renderCB(){
  if(!CS.steps.length)CS.steps=[{k:'card',n:'',pl:'A',tg:[],ext:{}}];
  const L=LOCS();
  let h='<details class="cbset" open><summary>1. Legendek</summary><div class="row2">'+['A','B'].map(p=>'<input type="text" list="legnames" data-lg="'+p+'" value="'+esc(CS.lg[p])+'" placeholder="'+(p==='A'?'Saját':'Ellenfél')+' legend">').join('')+'</div></details>';
  h+='<details class="cbset" open><summary>2. Battlefieldek</summary>'+CS.bf.map((b,i)=>'<div class="row2"><input type="text" list="bfnames" data-bfn="'+i+'" value="'+esc(b.n)+'" placeholder="'+(i+1)+'. battlefield neve">'+cbSel('data-bfc="'+i+'"',[['','senki nem irányítja'],['A','Te irányítod'],['B','Ellenfél irányítja']],b.c)+'</div>').join('')+'</details>';
  h+='<details class="cbset" open><summary>3. Board (a chain előtt már kint lévő lapok)</summary>'+CS.bd.map((b,i)=>{const c=vsCard(b.n);const isU=c&&c.t==='Unit',isG=c&&c.t==='Gear';
    const eqs=isG?[['','nincs felcsatolva']].concat(CS.bd.map((x,k)=>[k,x]).filter(([k,x])=>{const cc=vsCard(x.n);return cc&&cc.t==='Unit';}).map(([k])=>[String(k),'rajta: '+bdLabel(k)])):null;
    return '<div class="bdrow"><div class="row2"><input type="text" list="cardnames" data-bn="'+i+'" value="'+esc(b.n)+'" placeholder="Lap neve">'+cbSel('data-bpl="'+i+'"',PLO,b.pl)+cbSel('data-bloc="'+i+'"',L,b.loc)+'<button class="linkbtn" data-bdel="'+i+'">törlés</button></div>'
     +(isU?'<div class="row2 sm"><label>Might <input type="number" min="0" max="30" data-bm="'+i+'" value="'+(b.m!=null?b.m:'')+'" placeholder="'+(c.m!=null?c.m:'')+'"></label><label>Damage <input type="number" min="0" max="30" data-bd="'+i+'" value="'+(b.d||0)+'"></label><label class="chk"><input type="checkbox" data-bex="'+i+'"'+(b.ex?' checked':'')+'> exhausted</label><label class="chk"><input type="checkbox" data-bst="'+i+'"'+(b.st?' checked':'')+'> stunned</label><label class="chk"><input type="checkbox" data-bbu="'+i+'"'+(b.bu?' checked':'')+'> buff (+1)</label></div>':'')
     +(isG?'<div class="row2 sm">'+cbSel('data-bon="'+i+'"',eqs,b.on==null?'':b.on)+'<label class="chk"><input type="checkbox" data-bex="'+i+'"'+(b.ex?' checked':'')+'> exhausted</label></div>':'')+'</div>';}).join('')+'<button class="btn sec" id="cb-badd" style="margin-top:4px">+ Lap a boardra</button></details>';
  h+='<div class="cbsec2">4. A chain lépései</div>'+CS.steps.map((s,j)=>{const inf=stepInfo(s)||{list:[]};const c=inf.c;s.ext=s.ext||{};
    let x=cbSel('data-k="'+j+'"',[['card','Lap kijátszása'],['ab','Ability aktiválása']],s.k)+cbSel('data-pl="'+j+'"',[['A','Te'],['B','Az ellenfél']],s.pl);
    if(s.k==='ab'){const srcs=[['','Ability forrása']].concat(['A','B'].filter(p=>CS.lg[p]).map(p=>['L'+p,(p==='A'?'Saját':'Ellenfél')+' legend: '+CS.lg[p]])).concat(CS.bd.map((b,i)=>['b'+i,bdLabel(i)]));
      x+=cbSel('data-src="'+j+'"',srcs,s.src||'');const abs=abilitiesOf(srcCard(s.src));if(abs.length)x+=cbSel('data-ai="'+j+'"',abs.map((a,i)=>[i,a.label]),s.ai||0);else if(s.src)x+='<span class="tl">Ennek a forrásnak nincs aktiválható abilityje.</span>';}
    else{x+=cbSel('data-from="'+j+'"',[['hand','kézből'],['facedown','facedown-ból (Hidden)'],['trash','trashből'],['champ','Champion Zone-ból'],['other','máshonnan']],s.from||(c&&timingOf(c)==='hidden'?'facedown':'hand'));
      if(isPermC(c)||s.from==='facedown')x+=cbSel('data-loc="'+j+'"',L,s.loc||(s.from==='facedown'?'bf0':'base'));}
    (inf.list||[]).forEach((p,ti)=>{const v=(s.tg||[])[ti]||'';x+=cbSel('data-j="'+j+'" data-ti="'+ti+'" aria-label="Célpont"',[['',(ti+1)+'. célpont'+(p.opt?' (nem kötelező)':'')+': '+(p.rel!=='any'?p.rel+' ':'')+p.type+(p.bf?', battlefielden':'')+(p.max!=null?', max '+p.max+' Might':'')]].concat(tgOptions(j,p).slice(1)),v);
      if(v==='x'){const e=s.ext[ti]||{};x+='<span class="tl">'+(ti+1)+'. célpont: '+cbSel('data-eloc="'+j+'_'+ti+'"',L,e.loc||'bf0')+' Might <input type="number" min="0" max="30" style="width:5em;padding:4px 6px" data-em="'+j+'_'+ti+'" value="'+(e.m!=null?e.m:'')+'" placeholder="?"> '+cbSel('data-epl="'+j+'_'+ti+'"',[['','gazdája?'],['A','a te lapod'],['B','az ellenfélé']],e.pl||'')+'</span>';}});
    if(inf.eff&&actOf(inf.eff).unless)x+=cbSel('data-pay="'+j+'"',[['0','A célzott spell gazdája nem fizet'],['1','A célzott spell gazdája kifizeti']],s.pays?'1':'0');
    return '<div class="cbstep" data-sj="'+j+'"><div class="hd"><span class="cbdrag" draggable="true" data-drag="'+j+'" title="Húzd a sorrend módosításához" aria-hidden="true"><i></i><i></i><i></i></span><span class="no">'+(j+1)+'.</span>'+(j?'válasz':'első lépés')+'<span class="cbmv"><button type="button" class="linkbtn" data-up="'+j+'" aria-label="'+(j+1)+'. lépés feljebb"'+(j?'':' disabled')+'>Fel</button><button type="button" class="linkbtn" data-dn="'+j+'" aria-label="'+(j+1)+'. lépés lejjebb"'+(j<CS.steps.length-1?'':' disabled')+'>Le</button></span><button class="linkbtn" data-del="'+j+'">törlés</button></div>'+(s.k==='card'?'<input type="text" list="cardnames" data-name="'+j+'" value="'+esc(s.n)+'" placeholder="Kártya neve" aria-label="Kártya">':'')+'<div class="row2">'+x+'</div>'+(c&&s.k==='card'&&!inf.list.length?'<div class="tl">Ennek a lapnak nincs választandó célpontja.</div>':'')+'</div>';}).join('');
  $('cb-steps').innerHTML=h;
}
function cbSetStep(j){const s=CS.steps[j];s.tg=[];s.ext={};}
$('cb-steps').addEventListener('change',e=>{const el=e.target,d=el.dataset;const sp=v=>v.split('_').map(Number);let re=true;
  if(d.lg)CS.lg[d.lg]=el.value;
  else if(d.bfn!=null)CS.bf[+d.bfn].n=el.value;
  else if(d.bfc!=null){CS.bf[+d.bfc].c=el.value;re=false;}
  else if(d.bn!=null){const b=CS.bd[+d.bn];b.n=el.value;b.m=null;}
  else if(d.bpl!=null)CS.bd[+d.bpl].pl=el.value;
  else if(d.bloc!=null)CS.bd[+d.bloc].loc=el.value;
  else if(d.bm!=null){CS.bd[+d.bm].m=el.value===''?null:+el.value;re=false;}
  else if(d.bd!=null){CS.bd[+d.bd].d=+el.value||0;re=false;}
  else if(d.bex!=null){CS.bd[+d.bex].ex=el.checked;re=false;}
  else if(d.bst!=null){CS.bd[+d.bst].st=el.checked;re=false;}
  else if(d.bbu!=null){CS.bd[+d.bbu].bu=el.checked;re=false;}
  else if(d.bon!=null){CS.bd[+d.bon].on=el.value===''?null:+el.value;re=false;}
  else if(d.name!=null){const s=CS.steps[+d.name];s.n=el.value;s.loc=null;s.from=null;cbSetStep(+d.name);}
  else if(d.k!=null){const s=CS.steps[+d.k];s.k=el.value;s.src='';s.ai=0;cbSetStep(+d.k);}
  else if(d.pl!=null){CS.steps[+d.pl].pl=el.value;re=false;}
  else if(d.src!=null){const s=CS.steps[+d.src];s.src=el.value;s.ai=0;const sc=srcCard(s.src);s.n=sc?sc.n:'';cbSetStep(+d.src);}
  else if(d.ai!=null){CS.steps[+d.ai].ai=+el.value;cbSetStep(+d.ai);}
  else if(d.from!=null)CS.steps[+d.from].from=el.value;
  else if(d.loc!=null){CS.steps[+d.loc].loc=el.value;re=false;}
  else if(d.pay!=null){CS.steps[+d.pay].pays=el.value==='1';re=false;}
  else if(d.eloc!=null){const [j,ti]=sp(d.eloc);CS.steps[j].ext[ti]=Object.assign(CS.steps[j].ext[ti]||{},{loc:el.value});re=false;}
  else if(d.em!=null){const [j,ti]=sp(d.em);CS.steps[j].ext[ti]=Object.assign(CS.steps[j].ext[ti]||{},{m:el.value===''?null:+el.value});re=false;}
  else if(d.epl!=null){const [j,ti]=sp(d.epl);CS.steps[j].ext[ti]=Object.assign(CS.steps[j].ext[ti]||{},{pl:el.value});re=false;}
  else if(d.j!=null){const s=CS.steps[+d.j];s.tg=s.tg||[];s.tg[+d.ti]=el.value;}
  if(re)renderCB();});
$('cb-steps').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.up!=null||b.dataset.dn!=null){const j=+(b.dataset.up??b.dataset.dn);const t=b.dataset.up!=null?j-1:j+1;if(moveStep(j,t)){const f=$('cb-steps').querySelector('[data-'+(b.dataset.up!=null?'up':'dn')+'="'+t+'"]:not([disabled])')||$('cb-steps').querySelector('[data-sj="'+t+'"] .cbmv button:not([disabled])');if(f)f.focus();}}
  else if(b.dataset.del!=null){CS.steps.splice(+b.dataset.del,1);CS.steps.forEach(s=>s.tg=[]);renderCB();}
  else if(b.dataset.bdel!=null){CS.bd.splice(+b.dataset.bdel,1);CS.steps.forEach(s=>s.tg=[]);CS.bd.forEach(x=>x.on=null);renderCB();}
  else if(b.id==='cb-badd'){CS.bd.push({n:'',pl:'B',loc:'bf0',d:0});renderCB();}});
/* Lépések átrendezése: a "sK" célpont-hivatkozásokat az új indexre írjuk át; ha a hivatkozott lépés a hivatkozó mögé kerül, a célpont törlődik (csak korábbi lépés lehet célpont). */
function moveStep(from,to){const n=CS.steps.length;if(to<0||to>=n||from===to)return false;
  const order=[...Array(n).keys()];order.splice(to,0,order.splice(from,1)[0]);const newOf={};order.forEach((o,ni)=>newOf[o]=ni);
  const steps=order.map(o=>CS.steps[o]);
  steps.forEach((s,ni)=>{s.tg=(s.tg||[]).map(v=>{const m=/^s(\d+)$/.exec(v||'');if(!m)return v;const t=newOf[+m[1]];return t<ni?'s'+t:'';});});
  CS.steps=steps;renderCB();if(LAST_FRAMES.length)runCB();return true;}
let dragJ=-1;
const clearDrop=()=>$('cb-steps').querySelectorAll('.cbstep.dropb,.cbstep.dropa').forEach(x=>x.classList.remove('dropb','dropa'));
$('cb-steps').addEventListener('dragstart',e=>{const h=e.target.closest&&e.target.closest('[data-drag]');if(!h)return;dragJ=+h.dataset.drag;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','step:'+dragJ);
  const st=h.closest('.cbstep');st.classList.add('dragging');try{e.dataTransfer.setDragImage(st,20,20);}catch(_){} });
$('cb-steps').addEventListener('dragover',e=>{if(dragJ<0)return;const st=e.target.closest('.cbstep');if(!st)return;e.preventDefault();e.dataTransfer.dropEffect='move';
  const r=st.getBoundingClientRect();const after=e.clientY>r.top+r.height/2;clearDrop();st.classList.add(after?'dropa':'dropb');});
$('cb-steps').addEventListener('drop',e=>{if(dragJ<0)return;const st=e.target.closest('.cbstep');if(!st)return;e.preventDefault();
  const r=st.getBoundingClientRect();const k=+st.dataset.sj;let t=k+(e.clientY>r.top+r.height/2?1:0);if(t>dragJ)t--;const f=dragJ;dragJ=-1;clearDrop();moveStep(f,t);});
$('cb-steps').addEventListener('dragend',()=>{dragJ=-1;clearDrop();$('cb-steps').querySelectorAll('.dragging').forEach(x=>x.classList.remove('dragging'));});
chainApi.moveUnit=(uid,loc)=>{let m;
  if((m=/^b(\d+)$/.exec(uid))&&CS.bd[+m[1]]){const b=CS.bd[+m[1]];if(b.loc===loc)return null;b.loc=loc;CS.bd.forEach(g=>{if(g.on===+m[1])g.loc=loc;});}
  else if((m=/^s(\d+)$/.exec(uid))&&CS.steps[+m[1]]){const st=CS.steps[+m[1]];if((st.loc||'base')===loc)return null;st.loc=loc;}
  else return 'Ez a lap nem a builder board listájából vagy a chain lépéseiből jön, ezért nem helyezhető át.';
  renderCB();runCB();return null;};
$('cb-add').addEventListener('click',()=>{const l=CS.steps[CS.steps.length-1];CS.steps.push({k:'card',n:'',pl:l&&l.pl==='A'?'B':'A',tg:[],ext:{}});renderCB();});
$('cb-clear').addEventListener('click',()=>{CS={lg:{A:'',B:''},bf:[{n:'',c:''},{n:'',c:''}],bd:[],steps:[]};renderCB();emitFrames([]);$('cb-out').innerHTML='<h2>Chain elemzés</h2><p class="note">Adj meg legalább egy lapot.</p>';});
$('cb-ex').addEventListener('click',()=>{CS={lg:{A:'Kennen, Heart of the Tempest',B:''},bf:[{n:"Vilemaw's Lair",c:'B'},{n:'Zaun Warrens',c:'A'}],
  bd:[{n:'Traveling Merchant',pl:'B',loc:'bf0',d:0},{n:'Long Sword',pl:'B',loc:'bf0',on:0}],
  steps:[{k:'card',n:'Riptide Rex',pl:'A',from:'hand',loc:'base',tg:['b0'],ext:{}},{k:'card',n:'Flash',pl:'B',from:'hand',tg:['b0'],ext:{}},{k:'card',n:'Star-Crossed',pl:'A',from:'hand',tg:['s0','b0'],ext:{}}]};renderCB();runCB();});
$('cb-run').addEventListener('click',runCB);
$('cb-link').addEventListener('click',async()=>{const u=location.origin+location.pathname+'#c='+b64e(JSON.stringify(CS));const st=$('cb-linkst');
  try{await navigator.clipboard.writeText(u);st.textContent='A link a vágólapra került. Megnyitva ugyanez a helyzet töltődik be.';}catch(e){st.textContent='Másold ki: '+u;}});
window.__setCS=s=>{CS=s;renderCB();runCB();};window.__getCS=()=>CS;
function loadChainFromHash(){const m=/^#c=(.+)$/.exec(location.hash);if(!m)return false;try{CS=JSON.parse(b64d(m[1]));renderCB();runCB();return true;}catch(e){return false;}}

/* Instruction felbontás és linked instruction felismerés (359.3.e.14). Levezetés a lap szövegéből, nem teljes nyelvi elemzés. */
const KW_HEAD=/^(?:\[(?:Reaction|Action|Hidden|Quick-Draw|Accelerate|Ganking|Deflect(?: \d+)?|Tank|Backline|Shield(?: \d+)?|Assault(?: \d+)?|Vision|Temporary|Legion)\]\s*)+/i;
const splitInstr=(eff:string)=>String(eff||'').replace(KW_HEAD,'').split(/(?<=\.)\s+|,\s*then\s+|\s+and\s+(?=(?:ready|stun|exhaust|buff|draw|recall|give)\b)/i).map(x=>x.trim()).filter(Boolean);
const LINK_RE=/\b(it|its|them|their|they|that unit|that spell|that gear|the killed unit|the chosen unit)\b/i;
const DIRECT_RE=/\bif you do\b|\bif (?:this|it) kills\b|\bif (?:it|that unit) dies\b/i;
const INS_ST={executed:'végrehajtódik',partial:'részben hajtódik végre',ignored:'Ignored',negated:'Negated',skipped:'nem hajtódik végre'};
let MT=null;const MTIDS=new Set();
function runCB(){
  const o=$('cb-out');MT=null;MTIDS.clear();
  const S=CS.steps.map((s,j)=>{const inf=stepInfo(s);return inf&&inf.c?Object.assign({},s,inf,{j,tg:(s.tg||[]).slice(),ext:s.ext||{}}):null;}).filter(Boolean);
  if(!S.length){emitFrames([]);o.innerHTML='<h2>Chain elemzés</h2><p class="note">Nem találok felismert kártyát vagy abilityt. Válassz a listából.</p>';return;}
  const art=x=>(/^[aáeéiíoóöőuúüű]/i.test(x)?'az ':'a ')+x;const Art=x=>{const s=art(x);return s[0].toUpperCase()+s.slice(1);};
  const other=p=>p==='A'?'B':'A';const WHO={A:'te',B:'az ellenfél'};
  let REC=null;
  const line=(ref,txt,fl)=>{if(REC)REC.push([[...new Set(String(ref).split(',').map(r=>r.trim()).filter(Boolean))].join(', '),plainOf(txt)]);return lineH(ref,txt,fl);};
  const lineH=(ref,txt,fl)=>'<tr><td class="r">'+String(ref).split(',').filter(r=>r.trim()).map(r=>'<a href="#szabalyok" data-ref="'+r.trim()+'">'+r.trim()+'</a>').join('')+'</td><td>'+txt+'</td><td class="f">'+(fl!=null?'<span class="fl f'+fl+'" title="'+FLT[fl]+'">'+FL[fl]+'</span>':'')+'</td></tr>';
  const story=[];let rows='';const notes=[];
  // ---- objects ----
  const O={};const bfC=n=>{const c=vsCard(n);return c&&c.t==='Battlefield'?c:null;};const BF={bf0:{c:bfC(CS.bf[0].n),ctrl:CS.bf[0].c},bf1:{c:bfC(CS.bf[1].n),ctrl:CS.bf[1].c}};
  const mightOf=id=>{const ob=O[id];if(!ob||ob.m==null)return null;let m=ob.m+(ob.bu?1:0);Object.values(O).forEach(g=>{if(g.on===id&&g.zone==='board'&&g.card&&g.card.m)m+=g.card.m;});return m;};
  CS.bd.forEach((b,i)=>{const c=vsCard(b.n);if(!c)return;O['b'+i]={name:c.n,card:c,ctrl:b.pl,loc:b.loc,m:c.t==='Unit'?(b.m!=null?b.m:c.m):null,dmg:b.d||0,ex:b.ex,st:b.st,bu:b.bu,zone:'board',type:c.t.toLowerCase(),board:true};});
  CS.bd.forEach((b,i)=>{if(O['b'+i]&&b.on!=null&&O['b'+b.on])O['b'+i].on='b'+b.on;});
  ['A','B'].forEach(p=>{const c=vsCard(CS.lg[p]);if(c)O['L'+p]={name:c.n,card:c,ctrl:p,zone:'legend',type:'legend'};});
  const cnt={};S.forEach(s=>cnt[s.c.n]=(cnt[s.c.n]||0)+1);
  S.forEach(s=>{const j=s.j;const c=s.c;if(s.k==='ab')return;
    if(isPermC(c))O['s'+j]={name:c.n+(cnt[c.n]>1?' ('+(j+1)+'.)':''),card:c,ctrl:s.pl,loc:s.loc||(s.from==='facedown'?'bf0':'base'),m:c.m,dmg:0,zone:'pending',type:c.t.toLowerCase()};
    else O['s'+j]={name:c.n+(cnt[c.n]>1?' ('+(j+1)+'.)':''),card:c,ctrl:s.pl,zone:'pending',type:'spell'};
    s.tg=s.tg.map((v,ti)=>{if(v!=='x')return v;const p=s.list[ti];const e=s.ext[ti]||{};const id='t'+j+'_'+ti;
      const ctrl=e.pl||(p.rel==='enemy'?other(s.pl):p.rel==='friendly'?s.pl:null);
      O[id]={name:c.n+' célpontja ('+(ctrl==='A'?'a te '+p.type+'od':ctrl==='B'?'az ellenfél '+p.type+'ja':p.type)+')',ctrl,loc:e.loc||'bf0',m:e.m!=null?e.m:null,dmg:0,zone:'board',type:p.type};return id;});});
  S.forEach(s=>{s.tg=s.tg.map(v=>v==='F0'?'F0':v==='F1'?'F1':v);});
  const nm=id=>id==='F0'?locLabel('bf0'):id==='F1'?locLabel('bf1'):O[id]?O[id].name:id;
  // ---- frames (vizuális lejátszás) ----
  const FR=[];REC=[];
  const pside=p=>p==='A'?'me':p==='B'?'opp':null;
  const itemName=it=>it.kind==='trig'?(O[it.src]?O[it.src].name:'?')+' triggere':it.s.k==='ab'?it.s.c.n+' abilityje':((O['s'+it.s.j]&&O['s'+it.s.j].name)||it.s.c.n)+(isPermC(it.s.c)?' (play trigger)':'');
  const visItems=items=>items.filter(it=>!(it.kind==='step'&&O['s'+it.s.j]&&O['s'+it.s.j].zone==='countered')).reverse();
  const onBoard=ob=>ob.zone==='board'||(ob.zone==='trash'&&ob.dyingF);
  const snap=(label,items)=>{
    const vis=visItems(items||[]);
    const mk=()=>({base:[],trash:[],banish:[],hand:[]});const side={A:mk(),B:mk()};const bfs=[0,1].map(i=>({name:CS.bf[i].n||(i+1)+'. battlefield',ctrl:pside(BF['bf'+i].ctrl),me:[],opp:[],i}));
    const shown=new Set();
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='unit'&&ob.type!=='gear')return;const p=ob.ctrl==='B'?'B':'A';
      if(!onBoard(ob)){const nmC=ob.card?ob.card.n:ob.name;if(ob.zone==='trash')side[p].trash.push(nmC);else if(ob.zone==='banish')side[p].banish.push(nmC);else if(ob.zone==='hand')side[p].hand.push(nmC);return;}
      if(ob.type==='gear'&&ob.on&&O[ob.on]&&onBoard(O[ob.on]))return;
      if(ob.type==='gear'&&ob.wasOn&&O[ob.wasOn]&&O[ob.wasOn].dyingF)return;
      const mt=ob.type==='unit'?(ob.dyingF&&ob.dyingM!=null?ob.dyingM:mightOf(id)):null;const st=[];
      if(ob.st)st.push('stunned');if(ob.bu)st.push('buffed');if(ob.dyingF)st.push('dying');if(MTIDS.has(id))st.push('mistarget');
      const gear=Object.values(O).filter(g=>(g.on===id||(ob.dyingF&&g.wasOn===id))&&g.zone==='board').map(g=>g.card?g.card.n:g.name);
      const u={id,n:ob.card?ob.card.n:ob.name,m:mt!=null?mt:0,dmg:ob.dmg||0,ex:!!ob.ex,gear,status:st};
      if(ob.type==='gear'){u.kind='gear';u.base=0;u.m=0;}
      if(ob.type==='unit'&&mt==null){u.base=0;u.mods=['Might ismeretlen'];}
      if(ob.card&&/token/i.test((ob.card.st||[]).join(' ')+' '+(ob.card.tg||[]).join(' ')))u.token=true;
      shown.add(id);
      if(ob.loc==='base')side[p].base.push(u);else{const f=bfs[ob.loc==='bf1'?1:0];(p==='A'?f.me:f.opp).push(u);}});
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='spell')return;const p=ob.ctrl==='B'?'B':'A';if(ob.zone==='trash'||ob.zone==='countered')side[p].trash.push(ob.card.n);});
    const used=bfs.filter(f=>CS.bf[f.i].n||f.me.length||f.opp.length);const bfPos=i=>used.findIndex(f=>f.i===i);
    const arrows=[];
    vis.forEach((it,ci)=>{if(it.kind!=='step')return;const s=it.s;(s.list||[]).forEach((p,ti)=>{const v=s.tg[ti];if(!v)return;
      if(v==='F0'||v==='F1'){const k=bfPos(+v[1]);if(k>=0)arrows.push({from:ci,to:'bf:'+k});return;}
      const ob=O[v];if(!ob)return;
      if(ob.type==='spell'){const k=vis.findIndex(x=>x.kind==='step'&&'s'+x.s.j===v);if(k>=0)arrows.push({from:ci,to:'c:'+k});return;}
      if(shown.has(v))arrows.push({from:ci,to:'u:'+v});else if(ob.type==='gear'&&ob.on&&shown.has(ob.on))arrows.push({from:ci,to:'u:'+ob.on});});});
    const lg=p=>{const c=vsCard(CS.lg[p]);return c?c.n:undefined;};
    const ps=p=>({legend:lg(p),base:side[p].base,hand:side[p].hand,trash:side[p].trash,banish:side[p].banish});
    FR.push({label,board:{me:ps('A'),opp:ps('B'),bfs:used.map(({i,...f})=>f),chain:vis.map(itemName)},changes:REC||[],arrows,bfi:used.map(f=>f.i),mt:MT});REC=[];MT=null;MTIDS.clear();};
  const RES={ok:'lefutott',partial:'részben futott le',fizzle:'hatás nélkül',countered:'counterelve'};
  const cleanupSnap=()=>{const d=Object.keys(O).filter(id=>O[id].dyingF);if(!d.length)return;
    d.forEach(id=>{O[id].dyingF=false;REC.push(['429, 323.4',O[id].name+': a damage elérte a Mightját, a cleanupban meghal (Kill), a trashbe kerül.']);});
    snap('Cleanup: '+d.map(id=>O[id].name).join(', ')+' meghal',stack);};
  // static battlefield effects
  ['bf0','bf1'].forEach(l=>{const b=BF[l];if(b.c)notes.push(line('169',esc(b.c.n)+' ('+(b.ctrl==='A'?'te irányítod':b.ctrl==='B'?'az ellenfél irányítja':'senki nem irányítja')+'): '+esc(stripRem(b.c.txt))+(/can.t move from here to base|can.t be played here/i.test(b.c.txt||'')?' <b>Ezt az állandó hatást az elemzés figyelembe veszi.</b>':' Ezt a hatást az elemzés nem értékeli ki, ha számít, vedd figyelembe.'),/can.t move from here to base|can.t be played here/i.test(b.c.txt||'')?0:1));});
  const bfBlocksBase=l=>BF[l]&&BF[l].c&&/can.t move from here to base/i.test(BF[l].c.txt||'');
  const bfBlocksPlay=l=>BF[l]&&BF[l].c&&/can.t be played here/i.test(BF[l].c.txt||'');
  // ---- triggers from "when you play" ----
  const playTrigs=(s)=>{const out=[];const ty=s.c.t.toLowerCase();
    Object.keys(O).forEach(id=>{const ob=O[id];if(!ob.card||id==='s'+s.j)return;if(!(ob.zone==='board'||ob.zone==='legend'))return;
      (ob.card.txt||'').split('\n').forEach(l=>{const m=/^when (you|an opponent|a player) plays? (?:a |an )?(card|spell|unit|gear)s?([^,]*),\s*(.*)$/i.exec(stripRem(l));if(!m)return;
        const who=m[1].toLowerCase();if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        if(m[2].toLowerCase()!=='card'&&m[2].toLowerCase()!==ty)return;
        if(/other than your hand/i.test(m[3])&&(s.from||'hand')==='hand')return;
        if(/from your hand/i.test(m[3])&&s.from&&s.from!=='hand')return;
        out.push({kind:'trig',src:id,pl:ob.ctrl,eff:m[4],why:'"'+stripRem(l)+'"'});});});
    return out;};
  // ---- 1. build ----
  const chain=[];let stack=[];
  const legalNow=(s,p,v)=>{const why=[];if(v==='F0'||v==='F1'){if(p.type!=='battlefield')why.push('ez battlefield');return why;}
    const ob=O[v];if(!ob)return ['ismeretlen célpont'];
    if(p.type==='spell'){if(ob.type!=='spell')why.push(esc(ob.name)+' nem spell, hanem '+ob.type+' (355.9.a.2).');else if(ob.zone!=='chain')why.push(esc(ob.name)+' nincs a chainen.');}
    else{if(ob.type!==p.type)why.push(esc(ob.name)+' '+ob.type+', nem '+p.type+'.');
      if(ob.zone!=='board')why.push(esc(ob.name)+' nincs a boardon.');
      if(p.bf&&ob.loc==='base')why.push(esc(ob.name)+' base-ben áll, a lap battlefielden álló célpontot kér.');
      if(p.max!=null){const mt=mightOf(v);if(mt==null)why.push('Add meg '+esc(ob.name)+' Mightját.');else if(mt>p.max)why.push(esc(ob.name)+' Mightja '+mt+', a lap legfeljebb '+p.max+' Mightút választhat.');}
      if(s.from==='facedown'&&s.loc&&ob.loc!==s.loc&&p.bf!==false)why.push('Facedown-ból kijátszva csak azon a battlefielden választhat ('+esc(locLabel(s.loc))+'), ahol el volt rejtve (811.1.d.2).');}
    if(p.rel!=='any'&&ob.ctrl){const need=p.rel==='enemy'?other(s.pl):s.pl;if(ob.ctrl!==need)why.push(esc(ob.name)+' '+(ob.ctrl===s.pl?'saját':'ellenséges')+' lap, a választás '+(p.rel==='enemy'?'ellenséges':'saját')+' lapot kér');}
    if(ob.card&&ob.ctrl&&ob.ctrl!==s.pl&&/can.t be chosen by enemy|cannot be chosen by enemy/i.test(ob.card.txt||''))why.push(esc(ob.name)+' szövege szerint ellenséges spell vagy ability nem választhatja (757).');
    if(ob.card&&ob.ctrl&&ob.ctrl!==s.pl&&/\[Deflect/.test(ob.card.txt||''))s.defl=(s.defl||[]).concat(ob.name);
    return why;};
  snap('Kiinduló helyzet',[]);
  S.forEach((s,ix)=>{try{const c=s.c;const tm=s.k==='ab'?(s.ab?s.ab.tm:'none'):timingOf(c);const perm=s.k==='card'&&isPermC(c);const empty=!chain.length;
    const verb=s.pl==='A'?(ix?'Válaszként ':'')+(s.k==='ab'?'aktiválod':'kijátszod'):'Az ellenfél '+(ix?'válaszként ':'')+(s.k==='ab'?'aktiválja':'kijátssza');
    const what=s.k==='ab'?art(c.n)+' abilityjét ('+esc(s.ab?s.ab.label:'?')+')':art(c.n)+' lapot';
    let illegal=null;
    if(s.k==='ab'&&!s.ab)illegal='nincs kiválasztva ability';
    else if(s.k==='ab'&&s.ab.add){rows+=line('430.2, 337.2',esc(verb[0].toUpperCase()+verb.slice(1))+' '+what+'. Erőforrást ad: azonnal resolve-ol, nem kerül a chainre, és nem lehet rá válaszolni.',0);story.push(verb[0].toUpperCase()+verb.slice(1)+' '+what+': azonnal erőforrást ad, nem kerül a chainre.');return;}
    else if(!empty&&!(tm==='reaction'||tm==='hidden'&&s.from==='facedown'))illegal=(s.k==='ab'?'az ability':'a lap')+' nem [Reaction]'+(tm==='hidden'?' (kézből; csak facedown-ból kapna [Reaction]-t)':'')+', ezért amíg van valami a chainen, nem jöhet';
    else if(s.k==='card'&&tm==='hidden'&&s.from==='facedown'&&!empty){}
    if(!illegal&&perm&&bfBlocksPlay(O['s'+s.j].loc))illegal=esc(locLabel(O['s'+s.j].loc))+' szövege szerint ide nem játszható ki';
    if(!illegal&&s.k==='ab'&&s.src&&O[s.src]&&O[s.src].ex&&/\[T\]|\[E\]/.test(s.ab.label))illegal='a forrás már exhausted, az [Exhaust] költség nem fizethető ki';
    // targets
    if(!illegal)s.list.forEach((p,ti)=>{if(illegal)return;const v=s.tg[ti];if(!v){if(!p.opt)illegal='nincs megadva a kötelező '+(ti+1)+'. célpont';return;}
      const why=legalNow(s,p,v);if(why.length)illegal=(ti+1)+'. célpont nem választható: '+why.join(' ').replace(/\.\s*$/,'');});
    if(!illegal&&s.list.some(p=>p.same)){const ls=s.tg.filter(Boolean).map(v=>O[v]&&O[v].loc);if(ls.length>1&&ls.some(l=>l!==ls[0]))illegal='a célpontoknak ugyanazon a battlefielden kell állniuk';}
    s.illegal=illegal;
    if(illegal){rows+=line(empty?'355.8':'813.1.c.1, 355.8','<span class="stbad">Nem szabályos:</span> '+esc(verb[0].toUpperCase()+verb.slice(1))+' '+what+'? '+illegal+'. Kimarad.',0);story.push((s.pl==='A'?'Nem '+(s.k==='ab'?'aktiválhatod':'játszhatod ki'):'Az ellenfél nem '+(s.k==='ab'?'aktiválhatja':'játszhatja ki'))+' '+what.replace(/<[^>]+>/g,'')+' így: '+illegal.replace(/<[^>]+>/g,'').replace(/ \([0-9.]+\)/g,'')+'.');if(O['s'+s.j])O['s'+s.j].zone='none';return;}
    // legal
    const timingTxt=!empty?(tm==='reaction'?'[Reaction], ezért válaszként jöhet':'facedown-ból [Reaction]-ként jön'):(tm==='none'&&c.t==='Spell'?'üres chain mellett, a saját körödben':'üres chain mellett');
    rows+=line(!empty?(tm==='reaction'?'813.1.c.1':'811.6'):(s.k==='ab'?'381':'155'),esc(verb[0].toUpperCase()+verb.slice(1))+' '+what+' ('+timingTxt+').'+(s.from&&s.from!=='hand'&&s.k==='card'?' Honnan: '+{facedown:'facedown',trash:'trash',champ:'Champion Zone',other:'nem kézből'}[s.from]+'.':''),0);
    if(perm){O['s'+s.j].zone='board';rows+=line('337.2','A '+c.t.toLowerCase()+' azonnal resolve-ol és ide kerül: '+esc(locLabel(O['s'+s.j].loc))+'.'+(s.trig?' A "When you play" hatása triggerként a chainre kerül (355.5.b).':''),0);}
    else if(O['s'+s.j])O['s'+s.j].zone='chain';
    s.tg.forEach((v,ti)=>{if(v)rows+=line('355.7','<span class="stok">'+(ti+1)+'. célpont:</span> '+esc(nm(v))+(O[v]&&O[v].loc?' ('+esc(locLabel(O[v].loc))+(mightOf(v)!=null?', '+mightOf(v)+' Might':'')+')':'')+'.',0);});
    if(s.defl)rows+=line('356.2.a','Deflect: '+esc(s.defl.join(', '))+' kiválasztásáért plusz költséget kell fizetni.',0);
    if(s.may)rows+=line('383.3.a','"You may": '+WHO[s.pl]+' dönt'+(s.pl==='A'?'öd':'i')+' el a lefutáskor, végrehajtja-e. Az elemzés igennel számol.',0);
    story.push(verb[0].toUpperCase()+verb.slice(1)+' '+what.replace(/<[^>]+>/g,'')+(perm?', ami azonnal ide kerül: '+locLabel(O['s'+s.j].loc)+(s.trig?', a "When you play" hatása pedig a chainre':''):', ez a chain tetejére kerül')+'.');
    if(s.k==='ab'||c.t==='Spell'||s.trig)chain.push({kind:'step',s});
    if(s.k==='card'){playTrigs(s).forEach(t=>{chain.push(t);rows+=line('383, 420.4.a','Trigger: '+esc(O[t.src].name)+' '+t.why+' Ez is a chainre kerül.',1);story.push(Art(O[t.src].name)+' képessége triggerel erre a kijátszásra, és a chainre kerül.');});}
  }finally{snap((s.pl==='A'?'Te':'Ellenfél')+': '+(s.k==='ab'?'aktiválás':'kijátszás')+', '+(s.k==='ab'?s.c.n+' abilityje':s.c.n)+(s.illegal?' (nem szabályos, kimarad)':''),chain);}});
  // ---- 2. resolve (stack) ----
  let rr='';const zt={hand:'a tulajdonosa kezébe kerül',trash:'meghal, a trashbe kerül',banish:'banishelődik',base:'a base-be kerül',recall:'visszakerül a base-be (recall)'};
  stack=chain.slice();const done=[];
  const evTrig=(id,ev)=>{const ob=O[id];if(!ob||!ob.card)return;const t=ob.card.txt||'';
    if(ev==='die'&&/\[Deathknell\]/.test(t)){const m=/\[Deathknell\]\s*(?:\[>\])?\s*[—-]?\s*([^\n]*)/.exec(t);stack.push({kind:'trig',src:id,pl:ob.ctrl,eff:stripRem(m?m[1]:''),why:'Deathknell',dead:true});}
    if(ev==='move'&&/when i move/i.test(t)){const m=/when i move[^,]*,\s*([^\n]*)/i.exec(t);stack.push({kind:'trig',src:id,pl:ob.ctrl,eff:stripRem(m?m[1]:''),why:'"When I move"'});}
    Object.keys(O).forEach(k=>{const g=O[k];if(g.on===id&&ev!=='move'&&g.zone==='board'){g.on=null;g.wasOn=id;g.loc='base';rr+=line('719.5',esc(g.name)+' leválik '+esc(ob.name)+' lapról, és a következő cleanupban a base-be kerül.',0);story.push(Art(g.name)+' leválik '+art(ob.name)+' lapról.');}});};
  const applyTo=(v,act,srcName,perm,parts,refs)=>{const ob=O[v];
    if(act.k==='counter'){ob.zone='countered';parts.push(esc(ob.name)+' counterelve.');refs.push('426.1');story.push(Art(srcName)+' countereli '+art(ob.name)+' lapot.');return;}
    if(['hand','banish','kill'].includes(act.k)){const z=act.k==='kill'?'trash':act.k;
      if(z==='trash'&&/if i would die|would be killed/i.test((ob.card&&ob.card.txt)||'')){parts.push(esc(ob.name)+' meghalna, de a saját replacement effectje mást hajt végre helyette (367).');story.push(Art(ob.name)+' meghalna, de a saját replacement effectje helyettesíti a halált.');refs.push('367');return 'neg';}
      const sv=Object.values(O).find(g=>g.on===v&&g.zone==='board'&&g.card&&/if i would die/i.test(g.card.eff||''));
      if(z==='trash'&&sv){parts.push(esc(ob.name)+' meghalna, de a rajta lévő '+esc(sv.name)+' Effect Textje helyettesíti a halált (367).');story.push(Art(ob.name)+' meghalna, de a rajta lévő '+sv.name+' megmenti.');refs.push('367');return 'neg';}
      ob.zone=z;parts.push(esc(ob.name)+' '+zt[z]+'.');if(z==='hand')refs.push('056.2');if(z==='trash')refs.push('429');story.push(Art(srcName)+(perm?' triggere':'')+' lefut: '+ob.name+' '+zt[z]+'.');evTrig(v,z==='trash'?'die':'leave');return;}
    if(act.k==='base'||act.k==='recall'){if(act.k==='base'&&ob.loc!=='base'&&bfBlocksBase(ob.loc)){parts.push(esc(ob.name)+' nem mozoghat a base-be, mert '+esc(locLabel(ob.loc))+' tiltja: a mozgás negálódik (358.3.a).');story.push(Art(ob.name)+' a base-be mozogna, de '+locLabel(ob.loc)+' ezt tiltja, így a helyén marad.');refs.push('358.3.a','359.3.e.6');return 'neg';}
      const from=ob.loc;ob.loc='base';parts.push(esc(ob.name)+' '+zt[act.k]+'.');refs.push(act.k==='base'?'421':'457');story.push(Art(srcName)+' lefut: '+ob.name+' '+zt[act.k]+'.');if(act.k==='base'&&from!=='base')evTrig(v,'move');return;}
    if(act.k==='dmg'){ob.dmg+=act.n;const mt=mightOf(v);parts.push(esc(ob.name)+' '+act.n+' damage-et kap'+(mt!=null?' (Might '+mt+', összesen '+ob.dmg+' damage)':'')+'.');refs.push('142.4');
      if(mt!=null&&ob.dmg>=mt){parts.push('A cleanupban meghal (319.5, 323.4).');refs.push('323.4');story.push(Art(srcName)+(perm?' triggere':'')+' '+act.n+' damage-et oszt '+art(ob.name)+' lapra. Ez eléri a Mightját ('+mt+'), ezért a cleanupban meghal.');
        const sv=Object.values(O).find(g=>g.on===v&&g.zone==='board'&&g.card&&/if i would die/i.test(g.card.eff||''));
        if(sv){story.push('A rajta lévő '+sv.name+' Effect Textje helyettesíti a halált.');parts.push('A rajta lévő '+esc(sv.name)+' helyettesíti a halált (367).');}
        else{ob.zone='trash';ob.dyingF=true;ob.dyingM=mt;evTrig(v,'die');}}
      else story.push(Art(srcName)+(perm?' triggere':'')+' '+act.n+' damage-et oszt '+art(ob.name)+' lapra'+(mt==null?'. A Mightja nincs megadva, ezért nem tudni, túléli-e.':', ami túléli ('+ob.dmg+' damage, '+mt+' Might).'));return;}
    if(act.k==='stun'){ob.st=true;parts.push(esc(ob.name)+' Stunned lesz (424).');refs.push('424');story.push(Art(srcName)+' lefut: '+ob.name+' Stunned lesz.');return;}
    if(act.k==='buff'){if(ob.bu){parts.push(esc(ob.name)+' már buffolt, nem kap újabbat (701).');story.push(Art(ob.name)+' már buffolt, így nem történik semmi.');refs.push('701');return 'neg';}else{ob.bu=true;parts.push(esc(ob.name)+' +1 Might buffot kap (701).');story.push(Art(srcName)+' lefut: '+ob.name+' +1 Might buffot kap.');}refs.push('701');return;}
    if(act.k==='attach'){parts.push('Felcsatolva: '+esc(ob.name)+'.');refs.push('435');story.push(Art(srcName)+' felcsatolódik '+art(ob.name)+' lapra.');return;}
    parts.push(esc(ob.name)+': a hatás lefut, ezt az elemzés nem követi részletesen.');story.push(Art(srcName)+' lefut '+art(ob.name)+' lapra (részletesen nem követett hatás).');};
  let guard=0;
  while(stack.length&&guard++<60){const it=stack.pop();const itN=itemName(it);const d0=done.length;try{
    if(it.kind==='trig'){const src=O[it.src];const eff=it.eff;const act=actOf(eff);const sc=allScope(eff);const parts=[];const refs=['383'];
      let t='<b>'+esc(src.name)+'</b> triggere ('+esc(it.why)+') resolve-ol. ';
      if(sc&&['dmg','kill','stun','hand','banish'].includes(act.k)){const hereLoc=src.loc;Object.keys(O).forEach(v=>{const ob=O[v];if(ob.zone!=='board'||ob.type!==sc.type)return;if(sc.rel==='enemy'&&ob.ctrl===it.pl)return;if(sc.rel==='friendly'&&ob.ctrl!==it.pl)return;if(sc.here&&ob.loc!==hereLoc)return;applyTo(v,act,src.name,false,parts,refs);});if(!parts.length)parts.push('Nincs olyan lap, amire hatna.');}
      else if(/^empower me\b/i.test(eff)){parts.push(esc(src.name)+' Empowered lesz.');refs.push('442');story.push(Art(src.name)+' triggere lefut: '+src.name+' Empowered lesz.');}else{parts.push('Hatás: '+esc(eff)+'. Ezt az elemzés nem követi tovább.');story.push(Art(src.name)+' triggere lefut: '+eff);}
      rr+=line(refs.join(','),t+parts.join(' '),1);done.push({name:src.name+' triggere',pl:it.pl,res:'ok'});continue;}
    const s=it.s;const c=s.c;const perm=s.k==='card'&&isPermC(c);const self=O['s'+s.j];const srcName=s.k==='ab'?c.n+' abilityje':c.n;
    const head='<b>'+esc(srcName)+'</b>'+(perm?' play triggere':'')+' resolve-ol. ';
    if(self&&self.zone==='countered'){rr+=line('426.1',head+'Counterelték: nem csinál semmit, a trashbe kerül, a költség nem jár vissza, és nem számít kijátszottnak.',0);story.push(Art(c.n)+' sorra kerülne, de counterelték: nem történik semmi.');done.push({name:c.n,pl:s.pl,res:'countered'});continue;}
    let t=head;let fl=0;const refs=['340.1'];
    if(perm&&self.zone!=='board'){story.push(Art(c.n)+' már nincs a boardon, de a play triggere a chainen maradt, ezért lefut.');t+='A forrás már nincs a boardon, de a trigger független objektum, ezért lefut (355.9.c; a 359.3.f.3 példája szerint a forrás távozása nem állítja meg). ';fl=1;
      if(/\b(my|me|here)\b/i.test(s.eff)){t+='<span class="stbad">Figyelem:</span> a hatás a forrásra hivatkozik ("my", "me", "here"), ezt a végrehajtáskor nézi a játék (359.3.f.2), így ez a rész elmaradhat. ';}}
    if(s.k==='ab'&&s.src&&O[s.src]&&O[s.src].zone&&!['board','legend'].includes(O[s.src].zone)){t+='Az ability forrása már nincs a boardon, de az ability ettől még lefut (355.9.c). ';fl=1;}
    const act=actOf(s.eff);const parts=[];let legal=0,tot=0;
    if(act.k==='attach'&&s.k==='ab'){const v=s.tg[0];if(v&&O[v]&&O[v].zone==='board'){O[s.src].on=v;O[s.src].loc=O[v].loc;}}
    /* Instruction szintű végrehajtás (359.3.e.5-359.3.e.14): a szöveget utasításokra bontjuk, mindegyik a saját célpontjaira hat.
       Illegális célpont miatt elmaradó utasítás: Ignored; más okból elmaradó: Negated (359.3.e.6). */
    let INS=splitInstr(s.eff).map(t=>({t,n:phrasesTxt(t).length,tis:[],st:'',ref:'',why:''}));
    if(INS.reduce((x,y)=>x+y.n,0)!==s.list.length)INS=[{t:s.eff,n:s.list.length,tis:[],st:'',ref:'',why:''}];
    {let k=0;INS.forEach(x=>{for(let q=0;q<x.n;q++)x.tis.push(k++);});}
    const tgOut=[];const mtT=[];let lastT=null;
    const runTarget=(x,ti)=>{const p=s.list[ti];const v=s.tg[ti];if(!v)return;tot++;if(v==='F0'||v==='F1'){legal++;tgOut[ti]='ok';return;}const ob=O[v];const wS=[];const xa=actOf(x.t);
      if(p.type==='spell'){if(ob.zone!=='chain')wS.push('már nincs a chainen');}
      else{if(ob.zone!=='board')wS.push('már '+(ob.zone==='hand'?'kézben van':ob.zone==='trash'?'a trashben van':ob.zone==='banish'?'banishelve van':'nincs a boardon'));
        else if(p.bf&&ob.loc==='base')wS.push('már a base-ben áll, a lap pedig battlefielden álló célpontot kér');
        if(p.rel!=='any'&&ob.ctrl){const need=p.rel==='enemy'?other(s.pl):s.pl;if(ob.ctrl!==need)wS.push('megváltozott az irányítója');}}
      if(wS.length){tgOut[ti]='ign';mtT.push({n:ob.name,ok:false,why:wS.join(', ')});if(ob.zone==='board')MTIDS.add(v);
        parts.push('<span class="stbad">'+(ti+1)+'. célpont illegális</span> ('+esc(ob.name)+' '+wS.join(', ')+'): mistarget, rá a hatás elmarad (359.3.e.2, 359.3.e.5).');refs.push('359.3.e.9');story.push(Art(srcName)+(perm?' triggere':'')+' sorra kerül, de '+(s.list.length>1?((ti===0||ti===4)?'az ':'a ')+(ti+1)+'.':'a')+' célpontja ('+ob.name+') '+wS.join(', ')+': mistarget, rá a hatás elmarad.');return;}
      legal++;mtT.push({n:ob.name,ok:true});
      if(xa.k==='counter'&&ob.type==='spell'&&xa.unless&&s.pays){tgOut[ti]='neg';parts.push(esc(ob.name)+' irányítója kifizeti a kért költséget, ezért a counter nem történik meg.');story.push(Art(srcName)+' lefut, de '+art(ob.name)+' gazdája kifizeti a kért költséget, így a spell marad.');return;}
      if(xa.k==='attach'&&s.k==='ab'){tgOut[ti]='ok';parts.push('Felcsatolva: '+esc(ob.name)+' megkapja '+art(c.n)+' Might bónuszát'+(c.eff?' és Effect Textjét':'')+'.');refs.push('435','136.2.c');story.push(Art(c.n)+' felcsatolódik '+art(ob.name)+' lapra.');return;}
      tgOut[ti]=applyTo(v,xa,srcName,perm,parts,refs)==='neg'?'neg':'ok';};
    INS.forEach((x,xi)=>{
      const dir=DIRECT_RE.test(x.t);const lk=xi>0&&(dir||LINK_RE.test(x.t));const prev=lk?lastT:null;
      if(prev&&(prev.st==='ignored')){x.st='ignored';x.ref='359.3.e.14.a';x.why='linked instruction, a korábbi utasítás Ignored lett, ezért ez is Ignored';
        x.tis.forEach(ti=>{const v=s.tg[ti];if(v){tot++;tgOut[ti]='ign';mtT.push({n:nm(v),ok:false,skip:true,why:'a linked instruction Ignored, ezért rá sem hat'});}});}
      else if(prev&&prev.st==='negated'&&dir){x.st='skipped';x.ref='359.3.e.14.b';x.why='közvetlenül a korábbi game actionre hivatkozik ("if you do"), az pedig Negated lett, ezért nem hajtódik végre';}
      else if(x.tis.length){x.tis.forEach(ti=>runTarget(x,ti));const ch=x.tis.filter(ti=>tgOut[ti]);const ig=ch.filter(ti=>tgOut[ti]==='ign').length,ng=ch.filter(ti=>tgOut[ti]==='neg').length;
        if(!ch.length){x.st='executed';x.why='nincs választott célpont';}
        else if(ig===ch.length){x.st='ignored';x.ref=ch.length>1?'359.3.e.6, 359.3.e.7':'359.3.e.6';x.why='minden célpontja illegális (mistarget)';}
        else if(ng===ch.length-ig){x.st='negated';x.ref='359.3.e.6';x.why='a célpont legális, de a game action nem hajtható végre vagy helyettesítődik';}
        else if(ig){x.st='partial';x.ref='359.3.e.8';x.why='csak a legális célpontokra hat';}
        else{x.st='executed';x.why='';}}
      else{x.st='executed';
        if(prev&&prev.st==='negated'){x.ref='359.3.e.14.b';x.why='linked instruction, a korábbi Negated lett, de erre nem hat (nem hivatkozik közvetlenül a game actionre)';}
        else if(prev&&prev.st==='partial'){x.ref='359.3.e.14.a';x.why='linked instruction: csak a legális célpontokra vonatkozik';}
        else if(!lk&&INS.some((y,yi)=>yi<xi&&y.st==='ignored')){x.ref='359.3.e.5';x.why='nem linked, ezért a korábbi mistarget ellenére végrehajtódik';}
        const dm=/its controller draws (\d+)/i.exec(x.t);
        if(dm&&lk){const ok=prev?prev.tis.filter(ti=>tgOut[ti]&&tgOut[ti]!=='ign').length:1;if(ok){parts.push('A célpont irányítója húz '+dm[1]+' lapot.');story.push('A célpont irányítója húz '+dm[1]+' lapot.');}}}
      if(x.tis.length)lastT=x;});
    const insShown=INS.length>1||INS.some(x=>x.st!=='executed');
    if(insShown&&tot){parts.push('Utasítások: '+INS.map(x=>'"'+esc(x.t)+'": '+INS_ST[x.st]+(x.ref?' ('+x.ref+')':'')).join('; ')+'.');
      INS.forEach(x=>{if(x.ref)x.ref.split(/,\s*/).forEach(r=>refs.push(r));});
      INS.forEach((x,xi)=>{if(xi&&(x.st==='ignored'||x.st==='skipped'))story.push('"'+x.t+'": '+INS_ST[x.st]+', mert '+x.why+'.');});}
    if(tot&&(mtT.some(t=>!t.ok)||INS.some(x=>x.st==='negated'||x.st==='skipped')))
      MT={item:srcName+(perm?' (play trigger)':''),kind:!legal?'full':mtT.some(t=>!t.ok)?'partial':'none',targets:mtT,instr:INS.map(x=>({t:x.t,st:x.st,ref:x.ref,why:x.why}))};
    const sc=allScope(s.eff);
    if(!tot&&sc&&['dmg','kill','stun','hand','banish'].includes(act.k)){const hereLoc=sc.there?(s.tg.find(v=>v==='F0'||v==='F1')==='F1'?'bf1':'bf0'):(perm?self.loc:(s.src&&O[s.src]?O[s.src].loc:null));
      Object.keys(O).forEach(v=>{const ob=O[v];if(ob.zone!=='board'||ob.type!==sc.type)return;if(sc.rel==='enemy'&&ob.ctrl===s.pl)return;if(sc.rel==='friendly'&&ob.ctrl!==s.pl)return;if((sc.here||sc.there)&&ob.loc!==hereLoc)return;if(sc.atbf&&ob.loc==='base')return;applyTo(v,act,srcName,perm,parts,refs);});
      if(!parts.length)parts.push('Nincs olyan lap a boardon, amire hatna.');}
    else if(!tot){parts.push(c.sh&&s.k==='card'?'Hatás: '+esc(c.sh):'Hatás: '+esc(s.eff||''));fl=Math.max(fl,1);story.push(Art(srcName)+' lefut'+(s.k==='card'&&c.sh?': '+c.sh:': '+s.eff));}
    if(tot&&!legal){const rest=INS.some(x=>x.st==='executed'&&!x.tis.length);if(rest){parts.push('Teljes mistarget: minden célpontja illegális lett, a célponthoz nem kötött utasítás viszont végrehajtódik.');refs.push('359.3.e.7');}else{parts.push('Teljes mistarget: minden célpontja illegális lett, ezért hatás nélkül resolve-ol'+(perm||s.k==='ab'?'':', de kijátszottnak számít (359.3.e.10)')+'.');refs.push('359.3.e.7');story.push(Art(srcName)+' így hatás nélkül fejeződik be.');}}
    else if(tot&&legal<tot&&tot>1)refs.push('359.3.e.8');
    if(self&&self.type==='spell')self.zone='trash';
    done.push({name:srcName+(perm?' (play trigger)':''),pl:s.pl,res:(tot&&!legal)?'fizzle':(tot&&legal<tot)?'partial':'ok'});
    rr+=line(refs.join(','),t+parts.join(' '),fl);
  }finally{const dn=done.length>d0?done[done.length-1]:null;snap('Resolve: '+itN+(dn?', '+(RES[dn.res]||dn.res):''),stack);cleanupSnap();}}
  story.push('A chain kiürült.');
  REC.push(['','A chain kiürült.']);snap('Végállapot: a chain üres',[]);REC=null;emitFrames(FR);
  // ---- 3. output ----
  const stat={ok:['stok','lefutott'],partial:['stok','részben futott le'],fizzle:['stbad','hatás nélkül'],countered:['stbad','counterelve']};
  let h='<h2>Chain elemzés</h2><p class="note">Lépésenkénti levezetés a lapok szövegéből és a Core Rules szabályaiból. A "levezetés" címkéjű sorok az oldal következtetései, a judge felülbírálhatja őket.</p>';
  h+='<h3 class="cbsec">A chain lefutása</h3><p class="note" style="margin:0 0 6px">Ebben a sorrendben futottak le a tételek: mindig a legutóbb felrakott először, a közben keletkező triggerek pedig rögtön a tetejére kerülnek.</p><ol class="stack">'+done.map((d,i)=>{const r=stat[d.res]||['','?'];return '<li><span class="sn">'+(i+1)+'.</span><span class="sc">'+esc(d.name)+'</span><span class="note">'+(d.pl==='A'?'te':'ellenfél')+'</span><span class="'+r[0]+'">'+r[1]+'</span></li>';}).join('')+'</ol>';
  const off=S.filter(s=>s.illegal||(s.k==='card'&&isPermC(s.c)&&!s.trig)||(s.k==='ab'&&s.ab&&s.ab.add));
  if(off.length)h+='<p class="note" style="margin:4px 0 0">Nem került a chainre: '+off.map(s=>esc(s.c.n)+(s.illegal?' (nem szabályos)':s.k==='ab'?' (erőforrást ad, azonnal lefut)':' (azonnal a boardra került, nincs play triggere)')).join(', ')+'.</p>';
  h+='<h3 class="cbsec">Sorban ez történik</h3><ol class="flow">'+story.map(x=>'<li><span>'+glossify(esc(x))+'</span></li>').join('')+'</ol>';
  const res=[];Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type==='legend')return;
    if(ob.type==='spell'){if(ob.zone==='none')return;res.push(esc(ob.name)+': '+(ob.zone==='countered'?'counterelve, a trashben':'lefutott, a trashben'));return;}
    if(ob.zone==='none'||ob.zone==='pending')return;
    const mt=mightOf(id);const z={board:esc(locLabel(ob.loc))+(ob.type==='unit'&&mt!=null?', '+mt+' Might':'')+(ob.dmg?', '+ob.dmg+' damage':'')+(ob.st?', stunned':'')+(ob.on&&O[ob.on]?', rajta: '+esc(O[ob.on].name):''),hand:'a tulajdonosa kezében',trash:'a trashben',banish:'banishelve'}[ob.zone]||ob.zone;
    res.push((ob.ctrl==='A'?'Te: ':ob.ctrl==='B'?'Ellenfél: ':'')+esc(ob.name)+': '+z);});
  h+='<h3 class="cbsec">Végállapot</h3><ul class="res">'+res.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  if(notes.length)h+='<h3 class="cbsec">Battlefieldek állandó hatása</h3><table class="nt">'+notes.join('')+'</table>';
  // pair interactions (former "Lap a lap ellen")
  const cards=[];S.forEach(s=>{if(!cards.includes(s.c))cards.push(s.c);});CS.bd.forEach(b=>{const c=vsCard(b.n);if(c&&!cards.includes(c))cards.push(c);});
  let pr='';for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){const A=cards[a],B=cards[b];
    const p=vsPairs(A,B).concat(vsPairs(B,A));
    const rA=new Map(),rB=new Map();(A.nt||[]).forEach(n=>n[0].split(',').forEach(r=>rA.set(r.trim(),n[2])));(B.nt||[]).forEach(n=>n[0].split(',').forEach(r=>rB.set(r.trim(),n[2])));
    const common=[...rA.keys()].filter(r=>rB.has(r)&&!/^(155|813|806|355\.7|355\.10|337)/.test(r));
    if(!p.length&&!common.length)continue;
    pr+='<details class="tp"><summary><span class="tt">'+esc(A.n)+' és '+esc(B.n)+'</span><span class="why">'+p.length+' kölcsönhatás, '+common.length+' közös szabály</span></summary><div class="rules"><table class="nt">'+p.map(x=>line(x[0],glossify(esc(x[1])),1)).join('')+common.map(r=>line(r,'<b>'+esc(A.n)+':</b> '+glossify(esc(rA.get(r)))+'<br><b>'+esc(B.n)+':</b> '+glossify(esc(rB.get(r))),null)).join('')+'</table></div></details>';}
  if(pr)h+='<h3 class="cbsec">Kölcsönhatások a lapok között</h3><p class="note" style="margin:0 0 6px">Általános összevetés, a konkrét helyzettől függetlenül: milyen kölcsönhatás lehetséges két lap között, és mely szabályokra hivatkozik mindkettő magyarázata.</p>'+pr;
  h+='<h3 class="cbsec">Részletesen: a chain felépítése</h3><table class="nt">'+rows+'</table>';
  h+='<h3 class="cbsec">Részletesen: lefutás (340.1)</h3>'+(rr?'<table class="nt">'+rr+'</table>':'<p class="note">Nem került semmi a chainre.</p>');
  h+='<p class="note" style="margin-top:14px">Követett hatások: counter, kézbe küldés, kill, banish, base-be mozgatás, recall, sebzés, stun, buff, Equipment csatolás, "all/each unit" hatások, Deathknell és "When I move" triggerek, "When you play" triggerek legendeken és boardon lévő lapokon, Vilemaw\'s Lair típusú mozgástiltás. Ami ezen kívül esik, azt az elemzés megnevezi, de nem számolja ki.</p>';
  const names=[...new Set(Object.values(O).map(ob=>ob.card&&ob.card.n).filter(Boolean).concat(['bf0','bf1'].map(l=>BF[l].c&&BF[l].c.n).filter(Boolean)))].sort((a,b)=>b.length-a.length);
  if(names.length){const re=new RegExp('('+names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','g');
    h=h.replace(/(<[^>]+>)|([^<]+)/g,(m,tag,txt)=>tag?tag:txt.replace(re,w=>'<button type="button" class="cl" data-card="'+esc(w)+'">'+w+'</button>'));}
  o.innerHTML=h;
}
$('cb-out').addEventListener('click',e=>{const b=e.target.closest('.cl');if(!b)return;const c=vsCard(b.dataset.card);if(c){hideTip();openModal(c);}});
renderCB();
if(!loadChainFromHash()){}
started=true;
}
