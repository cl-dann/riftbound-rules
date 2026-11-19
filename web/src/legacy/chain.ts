// @ts-nocheck
/* Chain elemző: imperatív "sziget" a React appban. A React a gyökér elemet adja, ez a modul tölti fel a buildert és kezeli.
   Az elemzés maga a DOM nélküli chainCore.ts-ben van (analyze), ezt hívják a unit tesztek is.
   A kártyalap megnyitása és a tooltip eseményekkel megy a React felé. */
import {esc,vsCard,b64e,b64d} from './core';
import {analyze,stepInfo,srcCard,abilitiesOf,triggersOf,interp,timingOf,isPermC,actOf,OV_ACTS,OV_N,enterReadyCond} from './chainCore';
const $=(id:string)=>document.getElementById(id) as any;
const openModal=(c:any)=>window.dispatchEvent(new CustomEvent('rb:open-card',{detail:c.n}));
const hideTip=()=>window.dispatchEvent(new Event('rb:hide-tip'));
export const CHAIN_MARKUP=`<div class="cols">
      <div class="panel pad">
        <p class="note" style="margin-top:0">Add meg a helyzetet: a legendeket, a battlefieldeket és a boardon már kint lévő lapokat, majd a chain lépéseit sorban. Az első lépés a kijátszás, minden további egy válasz vagy egy trigger. Az oldal ellenőrzi a lépéseket, és sorban leírja, mi történik.</p>
        <div id="cb-steps"></div>
        <div class="btnrow"><button class="btn sec" id="cb-add">+ Válasz hozzáadása</button><button class="btn" id="cb-run">Chain lefuttatása</button></div>
        <div class="btnrow"><button class="btn sec" id="cb-link">Helyzet linkként</button><button class="linkbtn" id="cb-clear">Minden törlése</button></div>
        <div class="status" id="cb-linkst" role="status"></div>
        <div class="btnrow"><button class="linkbtn" id="cb-ex">Példa betöltése</button><button class="linkbtn" id="cb-ex2">Példa: kontrollváltás</button><button class="linkbtn" id="cb-ex3">Példa: gear leválás</button></div>
      </div>
      <div class="cb-right"><div id="cb-viz"></div><div class="panel pad" id="cb-out"><h2>Chain elemzés</h2><p class="note">Adj meg legalább egy lapot, majd nyomd meg a Chain lefuttatása gombot.</p></div></div>
    </div>
  `;
/* A React rész (Playmat drag and drop, Combat panel) ezen keresztül írja a builder állapotát. */
export type TrigAdd={n:string;src:string;pl:'A'|'B';eff:string;why:string;loc?:string};
export type CombatOut={bf:string;dead:string[];recall:string[];ctrl:''|'A'|'B';label:string};
export const chainApi:{moveUnit?:(uid:string,loc:string)=>string|null;addTriggers?:(list:TrigAdd[],cb:CombatOut)=>void}={};
/* Lejátszási frame-ek: az analyze minden lépés után pillanatképet készít a boardról, a React rész (ChainView) jeleníti meg. */
let LAST_FRAMES:any[]=[];
export const getChainFrames=()=>LAST_FRAMES;
const emitFrames=(f:any[])=>{LAST_FRAMES=f;window.dispatchEvent(new CustomEvent('rb:chain-frames',{detail:f}));};

/** Beépített példák (a "Példa betöltése" gombok és a unit tesztek is ezt használják). */
export const EXAMPLES:any={
  base:()=>({lg:{A:'Kennen, Heart of the Tempest',B:''},bf:[{n:"Vilemaw's Lair",c:'B'},{n:'Zaun Warrens',c:'A'}],
    bd:[{n:'Traveling Merchant',pl:'B',loc:'bf0',d:0},{n:'Long Sword',pl:'B',loc:'bf0',on:0}],
    steps:[{k:'card',n:'Riptide Rex',pl:'A',from:'hand',loc:'base',tg:['b0'],ext:{}},{k:'card',n:'Flash',pl:'B',from:'hand',tg:['b0'],ext:{}},{k:'card',n:'Star-Crossed',pl:'A',from:'hand',tg:['s0','b0'],ext:{}}]}),
  ctrl:()=>({lg:{A:'',B:''},bf:[{n:'Zaun Warrens',c:'B'},{n:'',c:''}],
    bd:[{n:'Yasuo, Remorseful',pl:'A',loc:'bf0',d:0},{n:'Traveling Merchant',pl:'B',loc:'bf0',d:0}],
    steps:[{k:'tg',src:'b0',ti:0,pl:'A',tg:['b1'],ext:{}},{k:'card',n:'Hostile Takeover',pl:'B',from:'facedown',loc:'bf0',tg:['b0'],ext:{}}]}),
  gear:()=>({lg:{A:'',B:''},bf:[{n:'Zaun Warrens',c:'A'},{n:'',c:''}],
    bd:[{n:'Akshan, Mischievous',pl:'A',loc:'bf0',d:0},{n:'Long Sword',pl:'A',loc:'bf0',on:0},{n:'Guardian Angel',pl:'B',loc:'base'}],
    steps:[{k:'card',n:'Hidden Blade',pl:'B',from:'hand',tg:['b0'],ext:{}}]}),
};

export function initChain(root:HTMLElement){
root.innerHTML=CHAIN_MARKUP;
let CS:any={lg:{A:'',B:''},bf:[{n:'',c:''},{n:'',c:''}],bd:[],steps:[]};
const LOCS=()=>[['base','Base'],['bf0',(CS.bf[0].n||'1. battlefield')],['bf1',(CS.bf[1].n||'2. battlefield')]];
const locLabel=l=>(LOCS().find(x=>x[0]===l)||['',l])[1];
const cbSel=(attrs,opts,v)=>'<select '+attrs+'>'+opts.map(o=>'<option value="'+esc(o[0])+'"'+(String(v)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';
const PLO=[['A','Te'],['B','Ellenfél']];
const SI=s=>stepInfo(CS,s);
function bdLabel(i){const b=CS.bd[i];const c=vsCard(b.n);return (b.pl==='A'?'Te: ':'Ellenfél: ')+(c?c.n:b.n||'?')+' ('+locLabel(b.loc)+')';}
function tgOptions(j,p){
  const o=[['','nincs kiválasztva']];
  if(p.type==='battlefield'){o.push(['F0',locLabel('bf0')],['F1',locLabel('bf1')]);return o;}
  if(p.type!=='spell'){CS.bd.forEach((b,i)=>{const c=vsCard(b.n);if(c&&c.t.toLowerCase()===p.type)o.push(['b'+i,'Board: '+bdLabel(i)]);});
    for(let k=0;k<=j&&k<CS.steps.length;k++){const s=CS.steps[k];const c=vsCard(s.n);if(s.k==='card'&&isPermC(c)&&c.t.toLowerCase()===p.type)o.push(['s'+k,k===j?'önmaga: '+c.n+' (355.9.c)':(k+1)+'. lépés: '+c.n]);}
    o.push(['x','más '+p.type+' (nincs a board listában)']);}
  else for(let k=0;k<j;k++){const s=CS.steps[k];const c=vsCard(s.n);if(s.k==='card'&&c&&c.t==='Spell')o.push(['s'+k,(k+1)+'. lépés: '+c.n]);}
  return o;
}
/** Trigger és ability forrása: legendek, board lapjai, korábbi lépésekben kijátszott permanentek. */
function srcOptions(j,head){return [['',head]].concat(['A','B'].filter(p=>CS.lg[p]).map(p=>['L'+p,(p==='A'?'Saját':'Ellenfél')+' legend: '+CS.lg[p]])).concat(CS.bd.map((b,i)=>['b'+i,bdLabel(i)])).concat(CS.steps.slice(0,j).map((s,k)=>[s,k]).filter(([s])=>s.k==='card'&&isPermC(vsCard(s.n))).map(([s,k])=>['s'+k,(k+1)+'. lépés: '+vsCard(s.n).n]));}
const OVOPEN=new WeakSet();
function interpHtml(s,j,inf){if(!inf||!inf.eff)return '';const INS=interp(s,inf);const man=INS.some(x=>x.manual);const uns=INS.some(x=>x.unsure.length);
  return '<details class="cbint" data-ovj="'+j+'"'+(OVOPEN.has(s)?' open':'')+'><summary>Így értelmezem '+(s.k==='card'?'a lapot':'a hatást')+' <span class="note">('+INS.length+' utasítás)</span>'+(man?' <span class="cbman">kézzel módosítva</span>':'')+(uns?' <span class="cbuns">bizonytalan</span>':'')+'</summary><ol class="cbint-l">'
    +INS.map((x,xi)=>{const id=j+'_'+xi;const opts=OV_ACTS.some(o=>o[0]===x.act.k)?OV_ACTS:OV_ACTS.concat([[x.act.k,x.act.k]]);
      return '<li><q>'+esc(x.t)+'</q><div class="row2">'+cbSel('data-ovk="'+id+'" aria-label="'+(xi+1)+'. utasítás művelete"',opts.map(o=>[o[0],o[1]+(o[0]===x.det.k?' (felismert)':'')]),x.act.k)
        +(OV_N.has(x.act.k)?'<label class="cbint-n">N <input type="number" min="-30" max="30" data-ovn="'+id+'" value="'+(x.act.n!=null?x.act.n:1)+'"></label>':'')
        +'<label class="chk"><input type="checkbox" data-ovl="'+id+'"'+(x.lk?' checked':'')+(xi?'':' disabled')+'> az előző utasításra hivatkozik (linked)</label>'
        +(x.manual?'<span class="cbman">kézzel</span>':'')+'</div>'
        +(x.det.cond&&x.det.cond.how==='user'?'<div class="row2 sm">'+cbSel('data-cnd="'+id+'" aria-label="'+(xi+1)+'. utasítás feltétele"',[['','feltétel: "'+x.det.cond.t+'" (nincs megadva)'],['1','teljesül: "'+x.det.cond.t+'"'],['0','nem teljesül: "'+x.det.cond.t+'"']],s.cnd&&s.cnd[xi]!=null?s.cnd[xi]:'')+'</div>':'')
        +(x.act.k==='playcard'&&!x.act.self?'<div class="row2 sm"><input type="text" list="cardnames" data-plc="'+id+'" value="'+esc((s.plc&&s.plc[xi])||'')+'" placeholder="Melyik lapot játssza ki?" aria-label="'+(xi+1)+'. utasítás: kijátszott lap">'+cbSel('data-pll="'+id+'" aria-label="Hova kerül"',LOCS(),(s.pll&&s.pll[xi])||'base')+'</div>':'')
        +(x.unsure.length?'<div class="tl"><span class="cbuns">bizonytalan</span> '+esc(x.unsure.join('; '))+'.</div>':'')+'</li>';}).join('')
    +'</ol>'+(s.ov?'<button type="button" class="linkbtn" data-ovr="'+j+'">Visszaállítás a felismert értelmezésre</button>':'')+'</details>';}
/** Célpont választók (kijátszott lap, ability, trigger és combat utáni trigger egyaránt). */
function targetSel(s,j,inf){let x='';
  if(inf.modes&&inf.modes.length)x+=cbSel('data-mode="'+j+'" aria-label="Választott mód (Choose one)"',inf.modes.map((m,i)=>[i,'mód: '+m]),s.mode||0);
  (inf.list||[]).forEach((p,ti)=>{const v=(s.tg||[])[ti]||'';x+=cbSel('data-j="'+j+'" data-ti="'+ti+'" aria-label="'+(ti+1)+'. célpont"',[['',(ti+1)+'. célpont'+(p.opt?' (nem kötelező)':'')+': '+(p.rel!=='any'?p.rel+' ':'')+(p.equipOnly?'Equipment':p.type)+(p.bf?', battlefielden':'')+(p.here?', "here"':'')+(p.free?', másik locationön':'')+(p.max!=null?', max '+p.max+' Might':'')+(p.mighty?', Mighty':'')]].concat(tgOptions(j,p).slice(1)),v);
    if(p.split&&v)x+='<label class="cbint-n">'+(ti+1)+'. célpont damage <input type="number" min="0" max="30" data-spl="'+j+'_'+ti+'" value="'+((s.split&&s.split[ti])||'')+'" placeholder="?"></label>';
    if(v==='x'){const e=s.ext[ti]||{};x+='<span class="tl">'+(ti+1)+'. célpont: '+cbSel('data-eloc="'+j+'_'+ti+'"',LOCS(),e.loc||'bf0')+' Might <input type="number" min="0" max="30" style="width:5em;padding:4px 6px" data-em="'+j+'_'+ti+'" value="'+(e.m!=null?e.m:'')+'" placeholder="?"> '+cbSel('data-epl="'+j+'_'+ti+'"',[['','gazdája?'],['A','a te lapod'],['B','az ellenfélé']],e.pl||'')+'</span>';}});
  if(inf.eff&&interp(s,inf).some(y=>y.act.k==='move'||y.act.k==='replay'&&!['same','base'].includes(y.act.to)))x+=cbSel('data-dest="'+j+'" aria-label="A mozgás célja"',[['base','cél: base']].concat([['bf0','cél: '+locLabel('bf0')],['bf1','cél: '+locLabel('bf1')]]),s.dest||'base');
  if(inf.eff&&actOf(inf.eff).unless)x+=cbSel('data-pay="'+j+'"',[['0','A célzott spell gazdája nem fizet'],['1','A célzott spell gazdája kifizeti']],s.pays?'1':'0');
  return x;}
function renderCB(){
  if(!CS.steps.length)CS.steps=[{k:'card',n:'',pl:'A',tg:[],ext:{}}];
  const L=LOCS();
  let h='<details class="cbset" open><summary>1. Legendek és a kör</summary><div class="row2">'+['A','B'].map(p=>'<input type="text" list="legnames" data-lg="'+p+'" value="'+esc(CS.lg[p])+'" placeholder="'+(p==='A'?'Saját':'Ellenfél')+' legend" aria-label="'+(p==='A'?'Saját':'Ellenfél')+' legend">').join('')+'</div><div class="row2">'+cbSel('data-turn="1" aria-label="Kinek a köre"',[['','Kinek a köre: az első lépés játékosáé'],['A','A te köröd (turn player: te)'],['B','Az ellenfél köre (turn player: ellenfél)']],CS.turn||'')+'</div><div class="tl">A turn player számít, ha egyszerre több játékos abilityje triggerel: ő teszi fel először a sajátjait (383.3.d.1).</div></details>';
  h+='<details class="cbset" open><summary>2. Battlefieldek</summary>'+CS.bf.map((b,i)=>'<div class="row2"><input type="text" list="bfnames" data-bfn="'+i+'" value="'+esc(b.n)+'" placeholder="'+(i+1)+'. battlefield neve" aria-label="'+(i+1)+'. battlefield">'+cbSel('data-bfc="'+i+'" aria-label="'+(i+1)+'. battlefield irányítója"',[['','senki nem irányítja'],['A','Te irányítod'],['B','Ellenfél irányítja']],b.c)+'</div>').join('')+'</details>';
  h+='<details class="cbset" open><summary>3. Board (a chain előtt már kint lévő lapok)</summary>'+CS.bd.map((b,i)=>{const c=vsCard(b.n);const isU=c&&c.t==='Unit',isG=c&&c.t==='Gear';
    const eqs=isG?[['','nincs felcsatolva']].concat(CS.bd.map((x,k)=>[k,x]).filter(([,x])=>{const cc=vsCard(x.n);return cc&&cc.t==='Unit';}).map(([k])=>[String(k),'rajta: '+bdLabel(k)])):null;
    return '<div class="bdrow"><div class="row2"><input type="text" list="cardnames" data-bn="'+i+'" value="'+esc(b.n)+'" placeholder="Lap neve" aria-label="Board lap neve">'+cbSel('data-bpl="'+i+'" aria-label="Irányító"',PLO,b.pl)+cbSel('data-bloc="'+i+'" aria-label="Hely"',L,b.loc)+'<button class="linkbtn" data-bdel="'+i+'">törlés</button></div>'
     +(isU?'<div class="row2 sm"><label>Might <input type="number" min="0" max="30" data-bm="'+i+'" value="'+(b.m!=null?b.m:'')+'" placeholder="'+(c.m!=null?c.m:'')+'"></label><label>Damage <input type="number" min="0" max="30" data-bd="'+i+'" value="'+(b.d||0)+'"></label><label class="chk"><input type="checkbox" data-bex="'+i+'"'+(b.ex?' checked':'')+'> exhausted</label><label class="chk"><input type="checkbox" data-bst="'+i+'"'+(b.st?' checked':'')+'> stunned</label><label class="chk"><input type="checkbox" data-bbu="'+i+'"'+(b.bu?' checked':'')+'> buff (+1)</label></div>':'')
     +(isG?'<div class="row2 sm">'+cbSel('data-bon="'+i+'" aria-label="Csatolás"',eqs,b.on==null?'':b.on)+'<label class="chk"><input type="checkbox" data-bex="'+i+'"'+(b.ex?' checked':'')+'> exhausted</label></div>':'')+'</div>';}).join('')+'<button class="btn sec" id="cb-badd" style="margin-top:4px">+ Lap a boardra</button></details>';
  const mvBtns=j=>'<span class="cbmv"><button type="button" class="linkbtn" data-up="'+j+'" aria-label="'+(j+1)+'. lépés feljebb"'+(j?'':' disabled')+'>Fel</button><button type="button" class="linkbtn" data-dn="'+j+'" aria-label="'+(j+1)+'. lépés lejjebb"'+(j<CS.steps.length-1?'':' disabled')+'>Le</button></span>';
  const hd=(j,t)=>'<div class="hd"><span class="cbdrag" draggable="true" data-drag="'+j+'" title="Húzd a sorrend módosításához" aria-hidden="true"><i></i><i></i><i></i></span><span class="no">'+(j+1)+'.</span>'+t+mvBtns(j)+'<button class="linkbtn" data-del="'+j+'">törlés</button></div>';
  h+='<div class="cbsec2">4. A chain lépései</div>'+CS.steps.map((s,j)=>{const inf=SI(s)||{list:[]};const c=inf.c;s.ext=s.ext||{};
    if(s.k==='tr')return '<div class="cbstep tr" data-sj="'+j+'">'+hd(j,'trigger a combat után')+'<div class="cbtr"><b>'+esc(s.n)+'</b> ('+esc(s.why||'trigger')+', '+(s.pl==='A'?'te':'ellenfél')+'): '+esc(s.eff||'')+'</div>'+(inf.list.length?'<div class="row2">'+targetSel(s,j,inf)+'</div>':'')+'<div class="tl">A Combat panelről került ide. A chain lefutása után a panel kiosztása szerinti combat eredmény jön, majd ezek a triggerek egy új chainen; a legutóbb felvett resolve-ol először. A célpontot itt választod, a legalitást az elemzés ellenőrzi (403.4).</div>'+interpHtml(s,j,inf)+'</div>';
    let x=cbSel('data-k="'+j+'" aria-label="Lépés típusa"',[['card','Lap kijátszása'],['ab','Ability aktiválása'],['tg','Trigger a chainre']],s.k);
    if(s.k!=='tg')x+=cbSel('data-pl="'+j+'" aria-label="Ki"',[['A','Te'],['B','Az ellenfél']],s.pl);
    if(s.k==='ab'){x+=cbSel('data-src="'+j+'" aria-label="Ability forrása"',srcOptions(j,'Ability forrása'),s.src||'');const abs=abilitiesOf(srcCard(CS,s.src));if(abs.length)x+=cbSel('data-ai="'+j+'" aria-label="Ability"',abs.map((a,i)=>[i,a.label]),s.ai||0);else if(s.src)x+='<span class="tl">Ennek a forrásnak nincs aktiválható abilityje.</span>';}
    else if(s.k==='tg'){x+=cbSel('data-src="'+j+'" aria-label="Trigger forrása"',srcOptions(j,'Trigger forrása'),s.src||'');const sc=srcCard(CS,s.src);const trs=triggersOf(sc,s.src&&s.src[0]==='b'?CS.bd.filter(g=>g.on===+s.src.slice(1)).map(g=>(vsCard(g.n)||{}).eff||'').join('\n'):'');if(trs.length)x+=cbSel('data-ti2="'+j+'" aria-label="Trigger"',trs.map((a,i)=>[i,a.label]),s.ti||0);else if(s.src)x+='<span class="tl">Ennek a forrásnak nincs triggered abilityje.</span>';}
    else{x+=cbSel('data-from="'+j+'" aria-label="Honnan"',[['hand','kézből'],['facedown','facedown-ból (Hidden)'],['trash','trashből'],['champ','Champion Zone-ból'],['other','máshonnan']],s.from||(c&&timingOf(c)==='hidden'?'facedown':'hand'));
      if(isPermC(c)||s.from==='facedown')x+=cbSel('data-loc="'+j+'" aria-label="Hova"',L,s.loc||(s.from==='facedown'?'bf0':'base'));
      const erc=enterReadyCond(c);if(erc&&erc.how==='user')x+=cbSel('data-erd="'+j+'" aria-label="Ready belépés feltétele"',[['','belépés: "'+erc.t+'" (nincs megadva, exhausted)'],['1','teljesül: ready lép be'],['0','nem teljesül: exhausted lép be']],s.erd||'');
      if(c&&c.t==='Unit'&&/^\[Accelerate\]/m.test(c.txt||''))x+='<label class="chk"><input type="checkbox" data-accel="'+j+'"'+(s.accel?' checked':'')+'> Accelerate kifizetve (ready lép be, 143.4.a)</label>';
      const ck=inf.cost;if(ck&&(ck.opt||ck.kill&&ck.kill.opt))x+='<label class="chk"><input type="checkbox" data-addc="'+j+'"'+(s.addc?' checked':'')+'> kifizetem az additional costot</label>';
      if(ck&&ck.kill&&(!ck.kill.opt||s.addc)){const opts=[['','költség: megölt friendly '+(ck.kill.mighty?'Mighty ':'')+'unit']].concat(CS.bd.map((b,i)=>[b,i]).filter(([b])=>{const cc=vsCard(b.n);return cc&&cc.t==='Unit';}).map(([,i])=>['b'+i,'költség: '+bdLabel(i)])).concat(CS.steps.slice(0,j).map((t,k)=>[t,k]).filter(([t])=>t.k==='card'&&(vsCard(t.n)||{}).t==='Unit').map(([t,k])=>['s'+k,'költség: '+(k+1)+'. lépés: '+vsCard(t.n).n]));x+=cbSel('data-cost="'+j+'" aria-label="Additional cost: megölt unit"',opts,s.costTg||'');}}
    x+=targetSel(s,j,inf);
    const head=s.k==='tg'?'trigger':j?'válasz':'első lépés';
    return '<div class="cbstep" data-sj="'+j+'">'+hd(j,head)+(s.k==='card'?'<input type="text" list="cardnames" data-name="'+j+'" value="'+esc(s.n)+'" placeholder="Kártya neve" aria-label="Kártya">':'')+'<div class="row2">'+x+'</div>'+(c&&s.k==='card'&&!inf.list.length?'<div class="tl">Ennek a lapnak nincs választandó célpontja.</div>':'')+(s.k==='tg'?'<div class="tl">A triggert a játék teszi a chainre (priority nélkül). Ide azt a pontot állítsd, ahol triggerelt; a célpontját itt választod.</div>':'')+interpHtml(s,j,inf)+'</div>';}).join('');
  $('cb-steps').innerHTML=h;
}
function cbSetStep(j){const s=CS.steps[j];s.tg=[];s.ext={};delete s.ov;delete s.costTg;delete s.split;delete s.cnd;delete s.plc;delete s.pll;}
$('cb-steps').addEventListener('change',e=>{const el=e.target,d=el.dataset;const sp=v=>v.split('_').map(Number);let re=true;
  if(d.lg)CS.lg[d.lg]=el.value;
  else if(d.turn!=null){CS.turn=el.value;re=false;}
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
  else if(d.k!=null){const s=CS.steps[+d.k];s.k=el.value;s.src='';s.ai=0;s.ti=0;cbSetStep(+d.k);}
  else if(d.pl!=null){CS.steps[+d.pl].pl=el.value;re=false;}
  else if(d.src!=null){const s=CS.steps[+d.src];s.src=el.value;s.ai=0;s.ti=0;const sc=srcCard(CS,s.src);s.n=sc?sc.n:'';if(s.k==='tg'){const b=s.src[0]==='b'?CS.bd[+s.src.slice(1)]:s.src[0]==='s'?CS.steps[+s.src.slice(1)]:null;s.pl=s.src[0]==='L'?s.src[1]:b?b.pl:'A';}cbSetStep(+d.src);}
  else if(d.ai!=null){CS.steps[+d.ai].ai=+el.value;cbSetStep(+d.ai);}
  else if(d.ti2!=null){CS.steps[+d.ti2].ti=+el.value;cbSetStep(+d.ti2);}
  else if(d.from!=null)CS.steps[+d.from].from=el.value;
  else if(d.loc!=null){CS.steps[+d.loc].loc=el.value;re=false;}
  else if(d.pay!=null){CS.steps[+d.pay].pays=el.value==='1';re=false;}
  else if(d.dest!=null){CS.steps[+d.dest].dest=el.value;re=false;}
  else if(d.mode!=null){const st=CS.steps[+d.mode];st.mode=+el.value;cbSetStep(+d.mode);}
  else if(d.spl!=null){const [j,ti]=sp(d.spl);const st=CS.steps[j];st.split=st.split||{};st.split[ti]=el.value===''?null:+el.value;re=false;}
  else if(d.cnd!=null||d.plc!=null||d.pll!=null){const [j,xi]=sp(d.cnd??d.plc??d.pll);const st=CS.steps[j];const key=d.cnd!=null?'cnd':d.plc!=null?'plc':'pll';st[key]=st[key]||{};st[key][xi]=el.value===''?null:el.value;OVOPEN.add(st);renderCB();runCB();return;}
  else if(d.addc!=null){CS.steps[+d.addc].addc=el.checked;}
  else if(d.accel!=null){CS.steps[+d.accel].accel=el.checked;re=false;}
  else if(d.erd!=null){CS.steps[+d.erd].erd=el.value;re=false;}
  else if(d.cost!=null){CS.steps[+d.cost].costTg=el.value;re=false;}
  else if(d.eloc!=null){const [j,ti]=sp(d.eloc);CS.steps[j].ext[ti]=Object.assign(CS.steps[j].ext[ti]||{},{loc:el.value});re=false;}
  else if(d.em!=null){const [j,ti]=sp(d.em);CS.steps[j].ext[ti]=Object.assign(CS.steps[j].ext[ti]||{},{m:el.value===''?null:+el.value});re=false;}
  else if(d.epl!=null){const [j,ti]=sp(d.epl);CS.steps[j].ext[ti]=Object.assign(CS.steps[j].ext[ti]||{},{pl:el.value});re=false;}
  else if(d.j!=null){const s=CS.steps[+d.j];s.tg=s.tg||[];s.tg[+d.ti]=el.value;}
  else if(d.ovk!=null||d.ovn!=null||d.ovl!=null){const [j,xi]=sp(d.ovk??d.ovn??d.ovl);const s=CS.steps[j];s.ov=s.ov||{};const o=s.ov[xi]=s.ov[xi]||{};
    if(d.ovk!=null){o.k=el.value;if(OV_N.has(o.k)&&o.n==null){const x=interp(s,SI(s))[xi];o.n=x&&x.det.n||1;}}
    else if(d.ovn!=null){o.n=+el.value||0;if(!o.k){const x=interp(s,SI(s))[xi];o.k=x?x.act.k:'dmg';}}
    else o.lk=el.checked;
    OVOPEN.add(s);renderCB();runCB();const f=$('cb-steps').querySelector('[data-'+(d.ovk!=null?'ovk':d.ovn!=null?'ovn':'ovl')+'="'+j+'_'+xi+'"]');if(f)f.focus();return;}
  if(re)renderCB();});
$('cb-steps').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.ovr!=null){const s=CS.steps[+b.dataset.ovr];delete s.ov;OVOPEN.add(s);renderCB();runCB();const f=$('cb-steps').querySelector('[data-ovj="'+b.dataset.ovr+'"] summary');if(f)f.focus();return;}
  if(b.dataset.up!=null||b.dataset.dn!=null){const j=+(b.dataset.up??b.dataset.dn);const t=b.dataset.up!=null?j-1:j+1;if(moveStep(j,t)){const f=$('cb-steps').querySelector('[data-'+(b.dataset.up!=null?'up':'dn')+'="'+t+'"]:not([disabled])')||$('cb-steps').querySelector('[data-sj="'+t+'"] .cbmv button:not([disabled])');if(f)f.focus();}}
  else if(b.dataset.del!=null){CS.steps.splice(+b.dataset.del,1);CS.steps.forEach(s=>{s.tg=[];delete s.costTg;});renderCB();}
  else if(b.dataset.bdel!=null){CS.bd.splice(+b.dataset.bdel,1);CS.steps.forEach(s=>{s.tg=[];delete s.costTg;});CS.bd.forEach(x=>x.on=null);renderCB();}
  else if(b.id==='cb-badd'){CS.bd.push({n:'',pl:'B',loc:'bf0',d:0});renderCB();}});
/* Lépések átrendezése: az "sK" hivatkozásokat (célpont, költség, forrás) az új indexre írjuk át; ha a hivatkozott lépés a hivatkozó mögé kerül, a hivatkozás törlődik. */
function moveStep(from,to){const n=CS.steps.length;if(to<0||to>=n||from===to)return false;
  const order=[...Array(n).keys()];order.splice(to,0,order.splice(from,1)[0]);const newOf={};order.forEach((o,ni)=>newOf[o]=ni);
  const steps=order.map(o=>CS.steps[o]);const fix=(v,ni)=>{const m=/^s(\d+)$/.exec(v||'');if(!m)return v;const t=newOf[+m[1]];return t<ni?'s'+t:'';};
  steps.forEach((s,ni)=>{s.tg=(s.tg||[]).map(v=>fix(v,ni));if(s.costTg)s.costTg=fix(s.costTg,ni);if(s.src&&/^s\d+$/.test(s.src))s.src=fix(s.src,ni);});
  CS.steps=steps;renderCB();if(LAST_FRAMES.length)runCB();return true;}
$('cb-steps').addEventListener('toggle',e=>{const d=e.target;if(!d.dataset||d.dataset.ovj==null)return;const s=CS.steps[+d.dataset.ovj];if(!s)return;if(d.open)OVOPEN.add(s);else OVOPEN.delete(s);},true);
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
  if((m=/^b(\d+)$/.exec(uid))&&CS.bd[+m[1]]){const b=CS.bd[+m[1]];if(b.loc===loc)return null;if(b.on!=null&&vsCard(b.n)&&vsCard(b.n).t==='Gear')return 'Csatolt gear nem mozgatható külön: a unittal együtt mozog (719.3.a). Előbb a board listában vedd le róla.';b.loc=loc;CS.bd.forEach(g=>{if(g.on===+m[1])g.loc=loc;});}
  else if((m=/^s(\d+)$/.exec(uid))&&CS.steps[+m[1]]){const st=CS.steps[+m[1]];if((st.loc||'base')===loc)return null;st.loc=loc;}
  else return 'Ez a lap nem a builder board listájából vagy a chain lépéseiből jön, ezért nem helyezhető át.';
  renderCB();runCB();return null;};
/* Combat panel: Deathknell és Conquer triggerek felvétele. A combat eredményét (cb) minden trigger lépés ugyanazzal az értékkel hordozza. */
chainApi.addTriggers=(list,cb)=>{if(!list.length)return;list.forEach(t=>CS.steps.push({k:'tr',n:t.n,src:t.src,pl:t.pl,eff:t.eff,why:t.why,loc:t.loc,tg:[],ext:{}}));
  CS.steps.forEach(s=>{if(s.k==='tr')s.cb=cb;});renderCB();runCB();};
$('cb-add').addEventListener('click',()=>{const l=CS.steps[CS.steps.length-1];CS.steps.push({k:'card',n:'',pl:l&&l.pl==='A'?'B':'A',tg:[],ext:{}});renderCB();});
$('cb-clear').addEventListener('click',()=>{CS={lg:{A:'',B:''},bf:[{n:'',c:''},{n:'',c:''}],bd:[],steps:[]};renderCB();emitFrames([]);$('cb-out').innerHTML='<h2>Chain elemzés</h2><p class="note">Adj meg legalább egy lapot.</p>';});
const loadEx=k=>{CS=EXAMPLES[k]();renderCB();runCB();};
$('cb-ex').addEventListener('click',()=>loadEx('base'));$('cb-ex2').addEventListener('click',()=>loadEx('ctrl'));$('cb-ex3').addEventListener('click',()=>loadEx('gear'));
$('cb-run').addEventListener('click',runCB);
$('cb-link').addEventListener('click',async()=>{const u=location.origin+location.pathname+'#c='+b64e(JSON.stringify(CS));const st=$('cb-linkst');
  try{await navigator.clipboard.writeText(u);st.textContent='A link a vágólapra került. Megnyitva ugyanez a helyzet töltődik be.';}catch(e){st.textContent='Másold ki: '+u;}});
window.__setCS=s=>{CS=s;renderCB();runCB();};window.__getCS=()=>CS;
function loadChainFromHash(){const m=/^#c=(.+)$/.exec(location.hash);if(!m)return false;try{CS=JSON.parse(b64d(m[1]));renderCB();runCB();return true;}catch(e){return false;}}
function runCB(){const r=analyze(CS);emitFrames(r.frames);$('cb-out').innerHTML=r.html;}
$('cb-out').addEventListener('click',e=>{const b=e.target.closest('.cl');if(!b)return;const c=vsCard(b.dataset.card);if(c){hideTip();openModal(c);}});
renderCB();
loadChainFromHash();
}
