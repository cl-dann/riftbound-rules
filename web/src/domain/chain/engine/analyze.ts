// @ts-nocheck
/* Chain elemző magja, DOM nélkül. A builder állapotából (CS: legendek, battlefieldek, board, lépések) kiszámolja a
   lejátszás frame-jeit, a szabálysorokat és az eseménynaplót. A legacy builder űrlapja és a unit tesztek a render/html/chainReport.ts analyze()-én át hívják.
   A lapszöveg értelmezése szöveges heurisztika; amit nem ismer fel biztosan, azt "bizonytalan" címkével jelöli. */
import { esc } from '../../text/norm';
import { vsCard } from '../../data/store';
import {cardOv} from '../overrides';
import { OV_LBL, OV_N, allScope, interp, isPermC, timingOf } from '../actions';
import { condOf, enterReadyCond } from '../conditions';
import { COSTVAR, costCheck, costCondOf, printedCost } from '../cost';
import { effOf, numOf, phrasesTxt, triggersOf } from '../parser';
import { stepInfo } from '../steps';
import { plainOf, stripRem } from '../text';
import { ZONE_HU, type ZoneRef, zoneCheck, zoneRefOf } from '../zones';
import { type ChainResult, type EngineCtx } from './ctx';
import { installTriggers } from './triggers';
import { installState } from './state';
import { installFrames } from './frames';
import { installObjects } from './objects';
import { INS_ST, RES, art, Art, other, WHO, WHOC, LOCK, lineH } from './labels';

/** A chain lefuttatása a helyzetből (CS): frame-ek, szabálysorok, eseménynapló, objektumok. HTML-t nem készít
    (out.html üres); a riportot a render/html/chainReport.ts analyze() függvénye teszi hozzá. */
export { type ChainResult, type EngineCtx, WHO, lineH };
export function runChain(CS:any):ChainResult{
  const X:EngineCtx={CS} as EngineCtx;
  installObjects(X);
  installFrames(X);
  installState(X);
  installTriggers(X);
  X.MT=null;X.MTIDS=new Set<string>();
  X.S=X.CS.steps.map((s:any,j:number)=>{if(s&&(s.k==='res'||s.k==='end'))return {k:s.k,j,pl:s.pl||'A',c:{n:'',t:'',txt:''},tg:[],ext:{},list:[]};const inf=stepInfo(X.CS,s);return inf&&inf.c?Object.assign({},s,inf,{j,tg:(s.tg||[]).slice(),ext:s.ext||{}}):null;}).filter(Boolean);
  X.POST=X.S.filter((s:any)=>s.k==='tr');X.MAIN=X.S.filter((s:any)=>s.k!=='tr');
  X.out={frames:[],html:'',story:[],done:[],rows:[],ev:[],objs:{},items:[],delayed:[],empty:false};
  if(!X.S.length){X.out.empty=true;return X.out;}
  X.REC=null;X.MAN=false;X.ALL=X.out.rows;X.EV=X.out.ev;
  X.story=X.out.story;X.rows='';X.rr='';X.notes=[];
  // ---- objektumok ----
  X.O={};X.out.objs=X.O;
  X.BF={bf0:{c:X.bfC(X.CS.bf[0].n),ctrl:X.CS.bf[0].c},bf1:{c:X.bfC(X.CS.bf[1].n),ctrl:X.CS.bf[1].c}};
  /** Aktuális Might (layer-egyszerűsítés): nyomtatott vagy megadott + buff + csatolt gear Might bonus + "this turn" módosítók + ismert statikus hatások. Nem boardon: null (359.3.e.12). */
  X.CS.bd.forEach((b:any,i:number)=>{const c=vsCard(b.n);if(!c)return;X.O['b'+i]={id:'b'+i,name:c.n,card:c,ctrl:b.pl,own:b.pl,loc:b.loc,baseOf:b.pl,m:c.t==='Unit'?(b.m!=null?b.m:(c.m!=null?+c.m:null)):null,dmg:b.d||0,dealt:(b.d||0)>0,atk:b.atk||'',ex:!!b.ex,st:!!b.st,bu:!!b.bu,emp:!!b.emp,mods:[],kws:[],zone:'board',type:c.t.toLowerCase()==='unit'?'unit':c.t==='Gear'?'gear':c.t.toLowerCase(),board:true};});
  X.CS.bd.forEach((b:any,i:number)=>{if(X.O['b'+i]&&b.on!=null&&X.O['b'+b.on]&&X.O['b'+i].type==='gear'){X.O['b'+i].on='b'+b.on;X.O['b'+i].loc=X.O['b'+b.on].loc;}});
  ['A','B'].forEach(p=>{const c=vsCard(X.CS.lg[p]);if(c)X.O['L'+p]={id:'L'+p,name:c.n,card:c,ctrl:p,own:p,zone:'legend',type:'legend',emp:false,ex:false};});
  /* Kéz, trash és deck tartalma (a pályás építő mezői, nem kötelező): "zc" objektumok, a többi lapszámítás nem látja őket. Ha nincs megadva, az elemzés változatlan. */
  X.ZC=!!(X.CS.hand||X.CS.trash||X.CS.deck||(X.CS.steps||[]).some((x:any)=>x&&x.zp));X.zcK={hand:'h',trash:'t',deck:'d'};
  if(X.ZC)(['hand','trash','deck'] as const).forEach(z=>['A','B'].forEach(p=>((X.CS[z]||{})[p]||[]).forEach((e:any,i:number)=>{const n=typeof e==='string'?e:e&&e.n;const c=vsCard(n);if(!c)return;const id=typeof e==='string'||!e.id?'z'+X.zcK[z]+p+i:e.id;X.O[id]={id,name:c.n,card:c,own:p,ctrl:p,zone:z,type:'zc',ord:i,gen:0};})));
  /** Választható lapok egy zónában: zc objektumok és a játék közben oda került lapok (meghalt unit, lefutott spell a trashben). */
  X.out.zsnap={};
  /** Egy zónából választott lap legális-e (a lap szövegének megkötései: kinek a zónája, típus, tag, darabszám). Üres string: legális. */
  /** A költségfeltétel változói a választás pillanatában: a forrás Mightja, a játékos pontszáma, a költségként megölt unit nyomtatott költsége. */
  X.cnt={};X.S.forEach((s:any)=>{if(s.k!=='res'&&s.k!=='end')X.cnt[s.c.n]=(X.cnt[s.c.n]||0)+1;});
  X.MAIN.forEach((s:any)=>{const j=s.j;const c=s.c;if(s.k==='res'||s.k==='end')return;
    if(s.k==='ab'||s.k==='tg'){const sc=s.src&&X.O[s.src];X.O['s'+j]={id:'s'+j,name:c.n+(s.k==='ab'?' abilityje':' triggere'),card:c,ctrl:s.k==='tg'&&sc?sc.ctrl:s.pl,own:s.k==='tg'&&sc?sc.ctrl:s.pl,zone:'pending',type:'ability',src:s.src,stepJ:j};return;}
    const nmx=c.n+(X.cnt[c.n]>1?' ('+(j+1)+'.)':'');
    if(isPermC(c))X.O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,loc:s.loc||(s.from==='facedown'?'bf0':'base'),baseOf:s.pl,m:c.t==='Unit'&&c.m!=null?+c.m:null,dmg:0,mods:[],kws:[],zone:'pending',type:c.t==='Unit'?'unit':'gear',ex:false,accel:!!s.accel};
    else X.O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,zone:'pending',type:'spell'};});
  X.S.forEach((s:any)=>{const c=s.c;const j=s.j;
    s.tg=s.tg.map((v:string,ti:number)=>{if(v!=='x')return v;const p=s.list[ti];if(!p)return '';const e=s.ext[ti]||{};const id='t'+j+'_'+ti;
      const ctrl=e.pl||(p.rel==='enemy'?other(s.pl):p.rel==='friendly'?s.pl:null);
      X.O[id]={id,name:c.n+' célpontja ('+(ctrl==='A'?'a te '+p.type+'od':ctrl==='B'?'az ellenfél '+p.type+'ja':p.type)+')',ctrl,own:ctrl,baseOf:ctrl,loc:e.loc||'bf0',m:e.m!=null?e.m:null,dmg:0,mods:[],kws:[],zone:'board',type:p.type};return id;});
    if(s.cost&&s.costTg==='x'){}});
  // ---- frame-ek ----
  X.FR=X.out.frames;X.REC=[];
  X.DET=new Set<string>();X.NEWCTRL=new Set<string>();
  // battlefield állandó hatások
  ['bf0','bf1'].forEach(l=>{const b=X.BF[l];if(b.c){const known=/can.t move from here to base|can.t be played here/i.test(b.c.txt||'');X.notes.push(X.line('169',esc(b.c.n)+' ('+(b.ctrl==='A'?'te irányítod':b.ctrl==='B'?'az ellenfél irányítja':'senki nem irányítja')+'): '+esc(stripRem(b.c.txt))+(known?' <b>Ezt az állandó hatást az elemzés figyelembe veszi.</b>':' Ezt a hatást az elemzés nem értékeli ki, ha számít, vedd figyelembe.'),known?0:1));}});
  X.ALL.length=0;
  X.chain=[];X.stack=[];X.REPL=new Set<string>();X.READY={A:false,B:false};X.BUFF2={A:false,B:false};X.PREVSA={on:false};
  /** 143.4: a unit exhausted lép be. Kivétel (143.4.a): kifizetett Accelerate (805.6), a lap saját "I enter ready" sora (369.3; feltételes sornál a feltétel kiértékelve, vagy a builderben megadva),
      más lap folyamatos hatása (Confront, Bushwhack, Magma Wurm, Firebrand Raider, Renata, Riven legend, Sun Disc). Visszaadja: {ready, why, note}. */
  X.READYNEXT={A:false,B:false};
  X.ST={};
  /* ---- játékállapot: builder mezők (kezdőértékek) és a lépésekből számolt változások ---- */
  X.PSD={xp:0,score:0,runes:0,runeDeck:12,played:0,playedT:'',spent:0,hand:0,diedT:0};
  /** A lépés előtt az adott játékos által (ebben a körben) kijátszott lapok típusai: a builder lépései és a korábbi kijátszások mezője. */
  X.ST.xpOf=X.xpOf;X.ST.scoreOf=X.scoreOf;X.ST.VS=X.VS;
  X.ST.diedT=(p:string,gearToo:boolean)=>+X.PSv(p,'diedT')>0||X.EV.some((e:any)=>e.k==='zone'&&e.to==='trash'&&X.O[e.id]&&X.O[e.id].own===p&&(X.O[e.id].type==='unit'||gearToo&&X.O[e.id].type==='gear'));
  /* Egyszerre triggerelő abilityk (383.3.d, 383.3.d.1): előbb gyűjtjük, majd a turn player teszi fel a sajátjait, utána a többiek; azonos controllernél a sorrendet a controller választja. */
  X.TP=X.CS.turn==='A'||X.CS.turn==='B'?X.CS.turn:(X.MAIN[0]?(X.MAIN[0].k==='tg'?((X.CS.bd[+String(X.MAIN[0].src||'').slice(1)]||{}).pl||X.MAIN[0].pl||'A'):X.MAIN[0].pl):'A');
  X.PEND=[];X.DIED=[];
  /** "When another (non-X) unit you control dies" és társai (383.2.c.2: a forrásnak a boardon kell maradnia). Amit nem ismer fel, azt kiírja. */
  /* ---- zónaváltás, triggerek, kontroll ---- */
  /** Kontrollváltás (191): a lap az új irányítóhoz kerül a Playmaton; "until" esetén a forrás távozásakor visszaáll (391.5.b). */
  X.setCtrl=(id:string,to:string,ref:string,why:string,until?:string)=>{const ob=X.O[id];if(!ob||!to||ob.ctrl===to)return false;const from=ob.ctrl;ob.ctrl=to;if(ob.loc==='base')ob.baseOf=ob.baseOf||from;
    if(until)ob.until={src:until,prev:from};X.NEWCTRL.add(id);X.EV.push({k:'ctrl',id,name:ob.name,from,to});
    Object.values(X.O).forEach((g:any)=>{if(g.on===id&&g.zone==='board'){}});
    X.REC.push([ref,ob.name+': az irányítója '+(from==='A'?'te':'az ellenfél')+' helyett '+(to==='A'?'te':'az ellenfél')+' lesz'+(why?' ('+why+')':'')+'. A Playmaton átkerül a másik oldalra.']);X.ALL.push(X.REC[X.REC.length-1]);return true;};
  /** Lap távozása a boardról: csatolt gear leválik (719.5), a "until I leave the board" kontroll megszűnik (391.5.b), a kontroll visszaáll a tulajdonosra. */
  X.leaveBoard=(id:string,zone:string)=>{const ob=X.O[id];const was=ob.zone==='board';ob.lk={m:X.mightOf(id),ctrl:ob.ctrl,loc:ob.loc,kws:(ob.kws||[]).slice(),alone:ob.zone==='board'?!Object.values(X.O).some((o:any)=>o.id!==id&&o.zone==='board'&&o.type==='unit'&&o.ctrl===ob.ctrl&&o.loc===ob.loc):null};ob.zone=zone;
    if(zone!=='board'){ob.dmg=0;ob.mods=[];ob.kws=[];ob.st=false;ob.bu=false;ob.shields=[];ob.save=null;ob.dbl=false;ob.dieTo=null;ob.baseSet=null;ob.untgt=false;if(ob.on){ob.on=null;}ob.ctrl=ob.own;ob.until=null;}
    X.EV.push({k:'zone',id,name:ob.name,to:zone});
    if(!was)return;
    Object.keys(X.O).forEach(k=>{const g=X.O[k];if(g.on===id&&g.zone==='board'){g.on=null;g.loc=ob.lk.loc;X.DET.add(k);X.EV.push({k:'detach',id:k,name:g.name,from:id});
      X.REC.push(['719.5, 436.4',g.name+' leválik '+ob.name+' lapról, és a helyén marad ('+X.locLabel(g.loc)+').'+(g.loc!=='base'?' Battlefielden álló, csatolatlan gear: a következő cleanupban recall-olódik (436.4.a, 323.6).':'')]);X.ALL.push(X.REC[X.REC.length-1]);
      X.story.push(Art(g.name)+' leválik '+art(ob.name)+' lapról'+(g.loc!=='base'?', és a következő cleanupban a base-be kerül':'')+'.');}});
    Object.keys(X.O).forEach(k=>{const g=X.O[k];if(g.until&&g.until.src===id&&g.zone==='board'){const prev=g.until.prev;g.until=null;X.setCtrl(k,prev,'391.5.b, 391.5.a',ob.name+' elhagyta a boardot, a "until I leave the board" kontroll véget ért');X.story.push(Art(g.name)+' irányítása visszakerül, mert '+ob.name+' elhagyta a boardot.');}});};
  /** Replacement a halál helyett (367, 369.1): saját "If I would die", csatolt gear Effect Textje (Guardian Angel), vagy friendly gear "If a friendly unit would die, kill this instead" (Zhonya's Hourglass). */
  X.deathRepl=(id:string)=>{const ob=X.O[id];if(!ob||ob.type!=='unit')return null;
    if(ob.dieTo)return {by:null,dieTo:ob.dieTo,txt:'If it would die this turn, banish it instead.'};
    if(ob.save)return {by:null,save:true,txt:ob.save.src+': heal, exhaust, recall instead'};
    if(ob.card&&/\bif I would die\b/i.test(ob.card.txt||''))return {by:id,txt:stripRem((/[^\n]*if I would die[^\n]*/i.exec(ob.card.txt)||[''])[0]),self:true};
    const ga=Object.values(X.O).find((g:any)=>g.on===id&&g.zone==='board'&&g.card&&/\bif I would die\b/i.test(g.card.eff||''));if(ga)return {by:ga.id,txt:ga.card.eff};
    const zh=Object.values(X.O).find((g:any)=>g.zone==='board'&&g.id!==id&&!g.on&&g.ctrl===ob.ctrl&&g.card&&/\bif a friendly unit would die, kill this instead\b/i.test(g.card.txt||''));if(zh)return {by:zh.id,txt:stripRem((/[^\n]*would die[^\n]*/i.exec(zh.card.txt)||[''])[0])};
    return null;};
  /** Kill (429): replacement esetén Negated (359.3.e.14.b), Deathknell nem fut (808.1.d.1). */
  X.killObj=(id:string,why:string,parts:string[],refs:string[],srcName?:string):'ok'|'neg'=>{const ob=X.O[id];const rp=X.deathRepl(id);
    if(rp){X.EV.push({k:'replace',id,name:ob.name,by:rp.by});refs.push('367','369.1');
      if(rp.dieTo){parts.push(esc(ob.name)+' meghalna, de helyette banishelődik (replacement: "'+esc(rp.txt)+'"). A lap a replacement miatt nem a trashbe kerül: a halálra triggerelő abilityk nem triggerelnek (383.2.c.3.a), a "leaves the board" triggerek igen, mert a lap így is elhagyja a boardot.');X.story.push(Art(ob.name)+' meghalna, de helyette banishelődik.');X.leaveTrigs(id,false);X.leaveBoard(id,'banish');X.REPL.add(id);return 'neg';}
      if(rp.save){ob.save=null;parts.push(esc(ob.name)+' meghalna, de a replacement ('+esc(rp.txt)+') helyettesíti: meggyógyul, exhausted lesz és a base-be recall-olódik (457).');X.story.push(Art(ob.name)+' meghalna, de helyette gyógyulva a base-be kerül.');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;Object.values(X.O).forEach((g:any)=>{if(g.on===id)g.loc='base';});X.EV.push({k:'recall',id,name:ob.name});X.REPL.add(id);return 'neg';}
      if(rp.self){parts.push(esc(ob.name)+' meghalna, de a saját replacement effectje mást hajt végre helyette (367): "'+esc(rp.txt)+'". Ezt az elemzés nem követi tovább.');X.story.push(Art(ob.name)+' meghalna, de a saját replacement effectje helyettesíti a halált.');return 'neg';}
      const hasDK=triggersOf(ob.card).some((t:any)=>t.dk||/^when I die\b/i.test(t.why));
      const by=X.O[rp.by];parts.push(esc(ob.name)+' meghalna, de '+esc(by.name)+' replacement effectje helyettesíti: "'+esc(rp.txt)+'". '+esc(by.name)+' a trashbe kerül, '+esc(ob.name)+' meggyógyul, exhausted lesz és a base-be recall-olódik (457).'+(hasDK?' A halálra triggerelő abilityje a chainre kerülne (808.1.d.2), de mivel a lap nem került a trashbe, lekerül (808.1.d.1).':''));refs.push('457');if(hasDK)refs.push('808.1.d.1','808.1.d.2');
      X.story.push(Art(ob.name)+' meghalna, de '+art(by.name)+' megmenti: '+by.name+' a trashbe kerül, '+ob.name+' gyógyulva, exhausted állapotban a base-be kerül.');
      X.REPL.add(id);X.leaveTrigs(rp.by,false);X.leaveBoard(rp.by,'trash');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;X.EV.push({k:'recall',id,name:ob.name});return 'neg';}
    if(srcName)X.story.push(Art(srcName)+' lefut: '+ob.name+' meghal.');
    X.leaveTrigs(id,true);X.leaveBoard(id,'trash');if(ob.type==='unit')X.DIED.push(id);parts.push(esc(ob.name)+' meghal, a tulajdonosa trashébe kerül'+(why?' ('+why+')':'')+'.');refs.push('429');return 'ok';};
  X.moveObj=(id:string,to:string,parts:string[],refs:string[],srcName:string,toBase?:string)=>{const ob=X.O[id];const from=ob.loc;const nb=toBase||ob.ctrl;
    if(from===to&&(to!=='base'||ob.baseOf===nb)){parts.push(esc(ob.name)+' már ott van ('+esc(X.locLabel(to))+'), nincs mozgás.');return 'neg';}
    if(to==='base'&&from!=='base'&&X.bfBlocksBase(from)){parts.push(esc(ob.name)+' nem mozoghat a base-be, mert '+esc(X.locLabel(from))+' tiltja: a mozgás Negated (358.3.a, 359.3.e.6).');refs.push('358.3.a','359.3.e.6');X.story.push(Art(ob.name)+' a base-be mozogna, de '+X.locLabel(from)+' ezt tiltja, így a helyén marad.');return 'neg';}
    ob.loc=to;if(to==='base')ob.baseOf=nb;X.EV.push({k:'move',id,name:ob.name,from,to,baseOf:to==='base'?nb:undefined});refs.push('421');
    Object.values(X.O).forEach((g:any)=>{if(g.on===id)g.loc=to;});
    const bTxt=to==='base'&&nb!==ob.ctrl?(nb==='A'?'a te base-edbe':'az ellenfél base-ébe'):to==='base'?'a base-be':X.locLabel(to);
    parts.push(esc(ob.name)+' mozog: '+esc(X.locLabel(from))+' → '+esc(bTxt)+'.');X.story.push(Art(srcName)+' lefut: '+ob.name+' '+(to==='base'?bTxt.replace(/^a /,'a ')+' mozog':'ide mozog: '+X.locLabel(to))+'.');
    const tr=triggersOf(ob.card).find((t:any)=>/^when I move\b/i.test(t.why));if(tr){X.pushTrig({kind:'auto',label:ob.name+' triggere ("When I move")',name:ob.name+' triggere',src:id,pl:ob.ctrl,eff:tr.eff,why:'"When I move"',list:[],tg:[]});X.rr+=X.line('383','<b>'+esc(ob.name)+'</b> triggerel ("'+esc(tr.why)+'"), a chainre kerül.',1);}
    return 'ok';};
  X.bonusDmg=(pl:string)=>Object.values(X.O).reduce((a:number,o:any)=>{if(o.zone!=='board'||o.ctrl!==pl||!o.card)return a;const m=/your spells and abilities deal (\d+) bonus damage/i.exec(o.card.txt||'');return a+(m?+m[1]:0);},0);
  /** Damage egy unitra. Duplázás (433.1.b) és Prevent (438.2, 438.3) replacementek: ha mindkettő él, a sorrendet a unit controllere választja (372, 467.2.c.5 példa).
      Az elemzés mindkét sorrend eredményét kiírja, és a kevesebb damage-et adó sorrenddel számol (a controller ezt választaná, ha a túlélés a cél). */
  X.dealDmg=(v:string,n:number,parts:string[],refs:string[],note?:string)=>{const ob=X.O[v];const base=Math.max(0,n);const rp:string[]=[];
    if(X.PREVSA.on&&base>0){X.EV.push({k:'prevented',id:v,name:ob.name,n:base});parts.push(esc(ob.name)+': '+base+' spell vagy ability damage megelőzve (Unyielding Spirit, 438.1.b.1.b, 438.4; levezetés).');refs.push('438.4');return 0;}
    const sh=(ob.shields||[]).map((x:any)=>Object.assign({},x));const pv=sh.reduce((q:number,x:any)=>q+x.n,0);
    const run=(order:'pd'|'dp')=>{let d=base;let left=pv;const step=()=>{const k=Math.min(d,left);d-=k;left-=k;return k;};let prevd=0;
      if(order==='pd'){prevd=step();if(ob.dbl)d=d*2;}else{if(ob.dbl)d=d*2;prevd=step();}return {d,prevd,left:pv>=99?'All':left};};
    let r=run('pd');
    if(ob.dbl&&pv>0&&base>0){const A=run('pd'),B=run('dp');refs.push('372','467.2.c.5','433.1.b');
      rp.push('két replacement él (Prevent és duplázás), a sorrendet '+WHO[ob.ctrl]+' választja (372): Prevent előbb '+A.d+' damage (megmaradó Prevent: '+A.left+'), duplázás előbb '+B.d+' damage (megmaradó Prevent: '+B.left+'); az elemzés '+(A.d<=B.d?'a Prevent előbb':'a duplázás előbb')+' sorrenddel számol');r=A.d<=B.d?A:B;}
    else if(ob.dbl&&base>0){rp.push('duplázva (433.1.b)');refs.push('433.1.b');}
    if(r.prevd>0){rp.push(r.prevd+' megelőzve (438.2)');refs.push('438.2','438.3');}
    let used=r.prevd;(ob.shields||[]).forEach((x:any)=>{if(used<=0&&!x.next)return;const k=Math.min(x.n,used);if(x.n<99)x.n-=k;used-=k;if(x.next&&base>0||x.n<=0)x.used=true;});
    ob.shields=(ob.shields||[]).filter((x:any)=>!x.used);
    const d=r.d;
    if(d<=0&&base>0){X.EV.push({k:'prevented',id:v,name:ob.name,n:base});parts.push(esc(ob.name)+': '+base+' damage teljesen megelőzve, nem számít megtörtént damage-nek (438.4)'+(rp.length?' ['+rp.join(', ')+']':'')+'.');refs.push('438.4');return 0;}
    ob.dmg+=d;ob.dealt=true;const mt=X.mightOf(v);X.EV.push({k:'dmg',id:v,name:ob.name,n:d});
    parts.push(esc(ob.name)+' '+d+' damage-et kap'+(note?' ('+note+')':'')+(rp.length?' ['+rp.join(', ')+']':'')+(mt!=null?' (Might '+mt+', összesen '+ob.dmg+' damage)':'')+'.');refs.push('418');
    if(mt!=null&&ob.dmg>=mt&&ob.dmg>0){parts.push('Lethal damage: a következő cleanupban meghal (142.4.b, 323.4).');refs.push('142.4.b');}
    return d;};
  /** Keyword érték (Shield, Assault): a nyomtatott sor eleji keyword és a kapott keywordök összege (807.2, 814.2). */
  X.kwVal=(id:string,kw:string)=>{const ob=X.O[id];if(!ob)return 0;let n=0;const t=(ob.card&&ob.card.txt)||'';const re=new RegExp('^\\['+kw+'(?: (\\d+))?\\]','m');const m=re.exec(t);if(m)n+=m[1]?+m[1]:1;
    (ob.kws||[]).forEach((k:string)=>{const q=new RegExp('^'+kw+'(?: (\\d+))?$').exec(k);if(q)n+=q[1]?+q[1]:1;});return n;};
  /** Szorzó számolása a frame boardján (418.8: egy damage példány). */
  X.countEach=(cnt:any,it:any,tv?:string)=>{if(cnt.kills)return null;
    if(cnt.bfs){const here=X.srcLoc(it);return ['bf0','bf1'].filter(l=>X.BF[l].c&&X.BF[l].ctrl===it.pl&&!(cnt.other&&l===here)).length;}if(cnt.eqOn){const host=cnt.eqOn==='me'?it.src:tv;return Object.values(X.O).filter((g:any)=>g.on===host&&g.zone==='board'&&g.card&&(g.card.tg||[]).includes('Equipment')).length;}
    const here=X.srcLoc(it);const there=tv&&X.O[tv]?X.O[tv].loc:null;
    return Object.keys(X.O).filter(id=>{const ob=X.O[id];if(ob.zone!=='board'||ob.type!==cnt.type)return false;if(cnt.other&&(id===it.src||id===tv))return false;
      if(cnt.rel==='friendly'&&ob.ctrl!==it.pl)return false;if(cnt.rel==='enemy'&&ob.ctrl===it.pl)return false;
      if(cnt.mighty&&!((X.mightOf(id)??0)>=5))return false;
      if(cnt.st==='exhausted'&&!ob.ex||cnt.st==='ready'&&ob.ex||cnt.st==='stunned'&&!ob.st||cnt.st==='buffed'&&!ob.bu)return false;
      if(cnt.where==='here'&&ob.loc!==here)return false;if(cnt.where==='there'&&ob.loc!==there)return false;if(cnt.where==='bf'&&ob.loc==='base')return false;if(cnt.where==='base'&&ob.loc!=='base')return false;return true;}).length;};
  /** Token létrehozása (440, 143.4): "play (N) (ready) (M [S]) <Név> unit|gear token(s) (exhausted) (with [Kw]) (here|there|to your base)". */
  X.TOKN=0;
  X.createTokens=(t:string,it:any,parts:string[],refs:string[],times:number)=>{const m=/\b(?:[Pp]lay|[Cc]reate)s? (a|an|one|two|three|four|five|six|\d+|that many)\s+(ready\s+)?(?:(\d+) \[S\]\s+)?([A-Z][\w'\-]*(?: [A-Z][\w'\-]*)*)(?:\s+(unit|gear))?\s+tokens?(\s+exhausted)?(?:\s+with\s+((?:\[[^\]]+\](?:,?\s*(?:and\s+)?)?)+))?([^.]*)/.exec(t);
    if(!m){parts.push('"'+esc(t)+'": token jön létre (440), az elemzés nem tudja pontosan, milyen.');return;}
    let n=m[1].toLowerCase()==='that many'?0:numOf(m[1]);n=n*(times==null?1:times);const name=m[4];const card=vsCard(name);const kind=m[5]?m[5].toLowerCase():card&&card.t==='Gear'?'gear':'unit';const kws=(m[7]||'').match(/\[([^\]]+)\]/g)||[];const tail=m[8]||'';
    const here=X.srcLoc(it);const loc=/\bto a (?:single )?battlefield\b/i.test(tail)?(it.dest||(it.s&&it.s.dest)||'bf0'):/\bthere\b/i.test(tail)?(it.notedLoc||(it.lk&&it.lk.loc)||here||'base'):/\bhere\b/i.test(tail)?(here||'base'):'base';
    const ids:string[]=[];for(let q=0;q<n;q++){const id='k'+(++X.TOKN);const extra=kws.filter((k:string)=>!(card&&(card.txt||'').includes(k))).join('\n');const c=card?(extra?Object.assign({},card,{txt:(card.txt||'')+'\n'+extra}):card):{n:name,t:kind==='unit'?'Unit':'Gear',m:m[3]?+m[3]:null,st:['Token'],tg:[],txt:extra};
      const er=kind==='unit'?X.enterReady(Object.assign({},c,{t:'Unit',st:['Token']}),it.pl,false,loc,undefined,id):{ready:false,why:''};if(q===0&&er.why&&!m[2]&&!m[6])parts.push('Ready lép be: '+esc(er.why)+'.');
      X.O[id]={id,name:name+' token',card:c,ctrl:it.pl,own:it.pl,loc,baseOf:it.pl,m:kind==='unit'?(m[3]?+m[3]:(c.m!=null?+c.m:null)):null,dmg:0,mods:[],kws:[],zone:'board',type:kind,ex:m[6]?true:m[2]?false:kind==='unit'?!er.ready:false,token:true};
      ids.push(id);X.EV.push({k:'token',pl:it.pl,id,name,loc});}
    if(it.notedLoc&&/\bthere\b/i.test(tail)){parts.push('A "there" a trigger feltételéből a triggereléskor feljegyzett location ('+esc(X.locLabel(it.notedLoc))+'), a forrás későbbi mozgása nem számít (359.3.f.3).');refs.push('359.3.f.3');}
    parts.push(n+' db '+esc(name)+' '+kind+' token jön létre ('+esc(X.locLabel(loc))+(m[2]?', ready':m[6]?', exhausted':kind==='unit'?(X.O[ids[0]]&&!X.O[ids[0]].ex?', ready (143.4.a)':', exhausted (143.4)'):'')+(kws.length?', '+kws.join(' '):'')+') (350.2, 440.2).');refs.push('350.2','440.2');
    if(n)X.story.push(n+' '+name+' token kerül ide: '+X.locLabel(loc)+'.');
    ids.forEach(id=>{if(X.O[id].type==='unit')X.playTrigs({c:X.O[id].card,j:-1,pl:it.pl,from:'other',objId:id}).forEach((tr:any)=>X.pushTrig(tr));});};
  /** Egy művelet végrehajtása egy célponton. Visszatérés: 'neg' ha a game action nem történik meg (Negated). */
  X.applyTo=(v:string,act:any,it:any,parts:string[],refs:string[]):string|void=>{const ob=X.O[v];const srcName=it.name;
    switch(act.k){
    case 'counter':if(ob.type!=='spell'&&ob.type!=='ability')return 'skip';ob.zone='countered';if(act.toHand)ob.toHand=true;X.EV.push({k:'counter',id:v,name:ob.name});parts.push(esc(ob.name)+' counterelve.');refs.push('426.1');X.story.push(Art(srcName)+' countereli '+art(ob.name)+' lapot.');return;
    case 'kill':{const r=X.killObj(v,'',parts,refs,srcName);return r==='neg'?'neg':undefined;}
    case 'hand':case 'banish':X.story.push(Art(srcName)+' lefut: '+ob.name+' '+(act.k==='hand'?'a tulajdonosa kezébe kerül':'banishelődik')+'.');X.leaveTrigs(v,false);X.leaveBoard(v,act.k);parts.push(esc(ob.name)+' '+(act.k==='hand'?'a tulajdonosa kezébe kerül (056.2)':'banishelődik')+'.');refs.push(act.k==='hand'?'056.2':'428');return;
    case 'recall':{if(ob.loc==='base'&&ob.baseOf===ob.ctrl){parts.push(esc(ob.name)+' már a base-ben van.');return 'neg';}ob.loc='base';ob.baseOf=ob.ctrl;Object.values(X.O).forEach((g:any)=>{if(g.on===v)g.loc='base';});X.EV.push({k:'recall',id:v,name:ob.name});parts.push(esc(ob.name)+' visszakerül a base-be (recall, nem Move, 457).');refs.push('457');X.story.push(Art(srcName)+' lefut: '+ob.name+' recall-olódik a base-be.');return;}
    case 'base':return X.moveObj(v,'base',parts,refs,srcName,/\bto your base\b/i.test(act.t||'')?it.pl:undefined);
    case 'move':return X.moveObj(v,it.dest||'base',parts,refs,srcName);
    case 'dmg':case 'dmgM':{let n=act.k==='dmg'?act.n:null;
      if(act.k==='dmgM'&&act.who==='linked'&&it.soM!=null&&/\bshowed off\b|\bthat unit's Might\b/i.test(act.t||'')){n=+it.soM;parts.push('A Show Off-olt unit ('+esc(it.soName)+') Mightja a finalizáláskor: '+n+'; a későbbi változás nem számít (832.1.d, 832.1.d.1).');refs.push('832.1.d','832.1.d.1');}
      else if(act.k==='dmgM'){const sid=act.who==='self'?it.src:null;n=sid?X.mightOf(sid):null;if(n==null){parts.push(esc(ob.name)+': a damage a forrás Mightjától függ, de a forrás már nincs a boardon, így az érték null, az utasítás Ignored (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}}
      let note='';if(act.each&&act.each.cnt){const k=X.countEach(act.each.cnt,it,v);if(k!=null){note='szorzó: '+k+' ('+act.each.txt+'), '+n+' x '+k;n=n*k;refs.push('418.8');}}
      const b=X.bonusDmg(it.pl)+(act.bonus||0);if(b){refs.push('715.1');note=(note?note+', ':'')+'+'+b+' Bonus Damage';}const tot=n+b;
      const d=X.dealDmg(v,tot,parts,refs,note);const mt=X.mightOf(v);
      if(d>0)X.story.push(Art(srcName)+' '+d+' damage-et oszt '+art(ob.name)+' lapra'+(mt!=null&&ob.dmg>=mt?'. Ez eléri a Mightját ('+mt+'), ezért a cleanupban meghal.':mt==null?'. A Mightja nincs megadva, ezért nem tudni, túléli-e.':', ami túléli ('+ob.dmg+' damage, '+mt+' Might).'));
      else{X.story.push(Art(srcName)+' damage-ét megelőzik ('+ob.name+').');if(tot>0){parts.push('A Deal utasítás Negated: az eseményt a Prevent helyettesítette (438.2, 359.3.e.14.b).');refs.push('359.3.e.14.b');return 'neg';}}return;}
    case 'stealEquip':{const g=Object.values(X.O).find((o:any)=>o.on===v&&o.zone==='board'&&o.card&&(o.card.tg||[]).includes('Equipment'));if(!g||!X.onB(it.src)){parts.push(esc(ob.name)+': nincs Equipment rajta, vagy a forrás nincs a boardon.');return 'neg';}
      g.on=it.src;g.loc=X.O[it.src].loc;X.EV.push({k:'attach',id:g.id,name:g.name,to:it.src});parts.push(esc(g.name)+' átkerül '+esc(ob.name)+' lapról '+esc(X.O[it.src].name)+' lapra (435.1.f).');refs.push('435.1.f');return;}
    case 'fightSelf':{if(!X.onB(it.src)){parts.push('A forrás már nincs a boardon (359.3.e.12).');return 'ign';}const a1=X.mightOf(it.src),a2=X.mightOf(v);X.dealDmg(v,a1||0,parts,refs,'forrás: '+X.O[it.src].name+', 418.6.b.3');X.dealDmg(it.src,a2||0,parts,refs,'forrás: '+ob.name+', 418.6.b.3');refs.push('418.6.b.3');return;}
    case 'raiseSelf':case 'raiseTo':{const base=act.k==='raiseSelf'?it.src:it.raiseBase;if(!base||!X.onB(base)){parts.push('A növelendő unit nem érvényes (359.3.e.12).');return 'ign';}const cur=X.mightOf(base),to=X.mightOf(v);if(cur==null||to==null||to<=cur){parts.push(esc(X.O[base].name)+' Mightja nem nő ('+cur+' és '+to+'), nincs mire növelni.');return;}
      X.O[base].mods.push({n:to-cur});X.EV.push({k:'might',id:base,name:X.O[base].name,from:cur,to});parts.push(esc(X.O[base].name)+' Mightja '+cur+' → '+to+' ebben a körben.');return;}
    case 'mightNum':case 'dmgNum':{const n=+(act.fv||0);if(act.k==='dmgNum'){if(n<=0){parts.push(esc(ob.name)+': 0 damage, nincs deal (715.4).');return 'neg';}X.dealDmg(v,n,parts,refs,'a lapnál megadott érték: '+n);return;}
      if(n===0){parts.push(esc(ob.name)+': a megadott érték 0, nincs Might változás.');return 'neg';}const b0=X.mightOf(v);ob.mods.push({n});X.EV.push({k:'might',id:v,name:ob.name,from:b0,to:X.mightOf(v)});parts.push(esc(ob.name)+' +'+n+' Might ebben a körben (a lapnál megadott érték).');return;}
    case 'dblShield':{const n=X.kwVal(v,'Shield');if(!n){parts.push(esc(ob.name)+': nincs Shield, a duplázás 0-t ad (433.1).');return 'neg';}ob.kws.push('Shield '+n);X.EV.push({k:'kw',id:v,name:ob.name,kw:'Shield'});parts.push(esc(ob.name)+' Shield értéke '+n+' → '+(2*n)+' ebben a körben (433.1, 814.2).');return;}
    case 'katoGive':{if(!X.onB(it.src)&&!(X.O[it.src]&&X.O[it.src].lk)){parts.push('A forrás adatai nem elérhetők (359.3.e.12).');return 'ign';}const so=X.O[it.src];const n=X.onB(it.src)?X.mightOf(it.src):so.lk.m;const kw=((so.card&&so.card.txt)||'').split('\n').map(stripRem).filter((l:string)=>/^\[[A-Za-z]+(?: \d+)?\]$/.test(l)).map((l:string)=>l.slice(1,-1)).concat(X.onB(it.src)?(so.kws||[]):((so.lk&&so.lk.kws)||[]));
      const b0=X.mightOf(v);ob.mods.push({n:n||0});kw.forEach((k:string)=>ob.kws.push(k));X.EV.push({k:'might',id:v,name:ob.name,from:b0,to:X.mightOf(v)});const sums=['Shield','Assault','Deflect'].filter((k:string)=>kw.some((x:string)=>x.split(' ')[0]===k)).map((k:string)=>k+' '+X.kwVal(v,k));parts.push(esc(ob.name)+' +'+n+' Might'+(kw.length?' és Kato összes jelenlegi keywordjét kapja (a nyomtatottakat és a kapottakat is): '+esc(kw.join(', ')):'')+' ebben a körben; az azonos értékes keywordök összeadódnak (801.3.a, 814.2)'+(sums.length?', '+esc(ob.name)+' összesített értéke: '+esc(sums.join(', ')):'')+'.');refs.push('801.3.a','814.2');return;}
    case 'mightTags':{const tags=act.tags||[];const have=tags.filter((t:string)=>Object.values(X.O).some((o:any)=>o.zone==='board'&&o.type==='unit'&&o.ctrl===it.pl&&o.card&&(o.card.tg||[]).includes(t)));const n=have.length;const b0=X.mightOf(v);if(n)ob.mods.push({n});X.EV.push({k:'might',id:v,name:ob.name,from:b0,to:X.mightOf(v)});parts.push(esc(ob.name)+' +'+n+' Might (a saját unitok között előforduló tagek: '+(have.join(', ')||'nincs')+').');return;}
    case 'mightOnlyThere':{const alone=!Object.values(X.O).some((o:any)=>o.id!==v&&o.zone==='board'&&o.type==='unit'&&o.ctrl===it.pl&&o.loc===ob.loc);if(!alone){parts.push(esc(ob.name)+' nem az egyetlen saját unit ott, ezért nem kap további +1-et (a boardon ellenőrizve).');return 'neg';}const b0=X.mightOf(v);ob.mods.push({n:1});X.EV.push({k:'might',id:v,name:ob.name,from:b0,to:X.mightOf(v)});parts.push(esc(ob.name)+' az egyetlen saját unit ott: további +1 Might.');return;}
    case 'setbase':ob.baseSet=act.n;{const mt=X.mightOf(v);X.EV.push({k:'setbase',id:v,name:ob.name,n:act.n});parts.push(esc(ob.name)+' alap Mightja '+act.n+' lesz ebben a körben (jelenlegi Might: '+mt+').');X.story.push(Art(ob.name)+' alap Mightja '+act.n+' lesz.');}return;
    case 'dmgKw':case 'dmgMarked':{const sid=act.k==='dmgMarked'?v:act.who==='self'?it.src:it.kwSrc;const so=sid&&X.O[sid];if(!so||so.zone!=='board'){parts.push(esc(ob.name)+': a damage értéke nem elérhető (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}
      const n=act.k==='dmgMarked'?so.dmg:X.kwVal(sid,act.kw);const d=X.dealDmg(v,n,parts,refs,act.k==='dmgMarked'?'a rajta lévő damage alapján':esc(so.name)+' ['+act.kw+'] értéke: '+n);if(d>0)X.story.push(Art(srcName)+' '+d+' damage-et oszt '+art(ob.name)+' lapra.');return;}
    case 'todeck':X.leaveTrigs(v,false);X.leaveBoard(v,'deck');parts.push(esc(ob.name)+' a tulajdonosa Main Deckjébe kerül (056.2).');refs.push('056.2');X.story.push(Art(ob.name)+' a tulajdonosa paklijába kerül.');return;
    case 'untgt':ob.untgt=true;X.EV.push({k:'untgt',id:v,name:ob.name});parts.push(esc(ob.name)+' ebben a körben nem választható enemy spellel vagy abilityvel (757.1, 758.1).');refs.push('757.1','758.1');return;
    case 'prevent':ob.shields=(ob.shields||[]).concat([{n:act.n,next:act.next}]);X.EV.push({k:'prevent',id:v,name:ob.name,n:act.n});parts.push(esc(ob.name)+': '+(act.n>=99?(act.next?'a következő damage-et':'minden damage-et'):'a következő '+act.n+' damage-et')+' megelőzi ebben a körben (Prevent, delayed replacement, 438.1.b.2, 438.7).');refs.push('438.1.b.2','438.7');X.story.push(Art(ob.name)+' védelmet kap: a damage megelőzése (Prevent).');return;
    case 'dbldmg':ob.dbl=true;X.EV.push({k:'dbldmg',id:v,name:ob.name});parts.push(esc(ob.name)+': minden ráosztott damage duplázódik ebben a körben (replacement, 433.1.b).');refs.push('433.1.b');X.story.push(Art(ob.name)+' minden damage-et duplán kap ebben a körben.');return;
    case 'saveNext':ob.save={pay:!!act.pay,src:srcName};X.EV.push({k:'save',id:v,name:ob.name});parts.push(esc(ob.name)+': ha ebben a körben meghalna, helyette gyógyul, exhausted lesz és recall-olódik (replacement, 369.1)'+(act.pay?'; a "you may pay" miatt a controller dönt, az elemzés úgy veszi, hogy fizet (371.2)':'')+'.');refs.push('369.1');X.story.push(Art(ob.name)+' halálát ebben a körben egy replacement megakadályozza.');return;
    case 'dieRepl':ob.dieTo=act.to;X.EV.push({k:'dierepl',id:v,name:ob.name});parts.push(esc(ob.name)+': ha ebben a körben meghalna, helyette banishelődik (replacement, 369.1).');refs.push('369.1');return;
    case 'stun':if(ob.st){parts.push(esc(ob.name)+' már Stunned, nem stunolható újra: az utasítás Negated (424.1.a.1).');refs.push('424.1.a.1');return 'neg';}ob.st=true;X.EV.push({k:'stun',id:v,name:ob.name});parts.push(esc(ob.name)+' Stunned lesz (424).');refs.push('424');X.story.push(Art(srcName)+' lefut: '+ob.name+' Stunned lesz.');return;
    case 'buff':if(ob.bu){parts.push(esc(ob.name)+' már buffolt, nem kap újabbat: a buff nem kerül fel, az utasítás Negated (427.1.b.1, 427.1.c).');X.story.push(Art(ob.name)+' már buffolt, így nem történik semmi.');refs.push('427.1.b.1','427.1.c');return 'neg';}ob.bu=true;X.EV.push({k:'buff',id:v,name:ob.name});parts.push(esc(ob.name)+' +1 Might buffot kap (427, 703).');refs.push('427','703');X.story.push(Art(srcName)+' lefut: '+ob.name+' +1 Might buffot kap.');return;
    case 'replay':{if(ob.zone==='board'){parts.push(esc(ob.name)+' nem hagyta el a boardot, így nincs mit újra kijátszani.');return 'neg';}
      if(!['banish','trash','hand'].includes(ob.zone)){parts.push(esc(ob.name)+' nem elérhető az újra kijátszáshoz (359.3.e.12).');return 'ign';}
      const to=act.to==='same'?(ob.lk&&ob.lk.loc)||'base':act.to==='base'?'base':(it.dest||'base');const nid=v+'r';let erR:any=null;
      X.O[nid]=Object.assign({},ob,{id:nid,zone:'board',loc:to,baseOf:ob.own,ctrl:ob.own,dmg:0,mods:[],kws:[],st:false,bu:false,ex:ob.type==='unit'&&!(erR=X.enterReady(ob.card,ob.own,false,to,undefined,nid)).ready,on:null,shields:[],save:null,dbl:false,dieTo:null,lk:null,until:null});
      ob.zone='gone';X.EV.push({k:'enter',id:nid,name:ob.name,loc:to,replay:true});
      const unitEnt=ob.type!=='unit'?'':erR&&erR.ready?', a unit ready lép be ('+erR.why+')':', a unit exhausted lép be (143.4)';
      parts.push(esc(ob.name)+': a tulajdonosa újra kijátssza ('+esc(X.locLabel(to))+(act.free?', a költség figyelmen kívül':'')+'). Ez új objektum (359.3.e.4)'+unitEnt+'; a kijátszás nem a kézből történik (420.3).'+(erR&&erR.note?' '+erR.note:''));refs.push('420.3','359.3.e.4',erR&&erR.ready?'143.4.a':'143.4');
      X.story.push(Art(ob.name)+' újra a boardra kerül: '+X.locLabel(to)+'.');
      X.playTrigs({c:ob.card,j:-1,pl:ob.own,from:'other',objId:nid}).forEach((t:any)=>{X.pushTrig(t);parts.push('Triggerel: '+esc(t.label)+' (420.4.a).');});
      const own=triggersOf(ob.card).find((t:any)=>/^when you play (?:me|this)\b/i.test(t.why));if(own){X.pushTrig({kind:'auto',label:ob.name+' play triggere',name:ob.name+' play triggere',src:nid,pl:ob.own,eff:own.eff,why:own.why,list:[],tg:[]});parts.push('A play effectje is triggerel; célpontját a játékos választja, az elemzés nem követi.');}
      return;}
    case 'might':case 'mightEq':case 'double':{let n=act.n;if(act.each&&act.each.cnt&&act.k==='might'){const k=X.countEach(act.each.cnt,it,v);if(k!=null){parts.push('Szorzó: '+k+' ('+esc(act.each.txt)+').');n=n*k;}}if(act.k==='mightEq'){n=it.lkMight!=null?it.lkMight:null;if(n==null){parts.push(esc(ob.name)+': a Might értéke a korábbi célponttól függ, ami nem elérhető, ezért Ignored (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}}
      const before=X.mightOf(v);if(act.k==='double'){ob.mods.push({n:Math.max(0,before||0)});refs.push('433');}else ob.mods.push({n,min:act.min});const after=X.mightOf(v);X.EV.push({k:'might',id:v,name:ob.name,from:before,to:after});
      parts.push(esc(ob.name)+' Mightja '+before+' → '+after+' (ebben a körben'+(act.min!=null?', minimum '+act.min:'')+').');X.story.push(Art(srcName)+' lefut: '+ob.name+' Mightja '+before+' helyett '+after+'.');
      if(X.lethal(v)){parts.push('A már rajta lévő damage így lethal: a következő cleanupban meghal (142.4.b).');refs.push('142.4.b');}return;}
    case 'kw':{const L=act.all&&act.all.length>1?act.all:[act.kw+(act.n?' '+act.n:'')];L.forEach((k:string)=>ob.kws.push(k));X.EV.push({k:'kw',id:v,name:ob.name,kw:act.kw,all:L});parts.push(esc(ob.name)+' megkapja: '+L.map((k:string)=>'['+esc(k)+']').join(', ')+' (ebben a körben).');}X.story.push(Art(srcName)+' lefut: '+ob.name+' ['+act.kw+(act.n?' '+act.n:'')+'] keywordöt kap.');return;
    case 'ready':if(!ob.ex){parts.push(esc(ob.name)+' már ready, nem readyzhető újra (416.1.b, 416.1.c): a game action nem hajtható végre, az utasítás Negated (359.3.e.6).');refs.push('416.1.b','416.1.c');return 'neg';}ob.ex=false;X.EV.push({k:'ready',id:v,name:ob.name});parts.push(esc(ob.name)+' ready lesz (416).');refs.push('416');X.story.push(Art(srcName)+' lefut: '+ob.name+' ready lesz.');return;
    case 'exhaust':if(ob.ex){parts.push(esc(ob.name)+' már exhausted, nem exhaustolható újra (415.1.b, 415.1.c): a game action nem hajtható végre, az utasítás Negated (359.3.e.6).');refs.push('415.1.b','415.1.c');return 'neg';}ob.ex=true;X.EV.push({k:'exhaust',id:v,name:ob.name});parts.push(esc(ob.name)+' exhausted lesz (415).');refs.push('415');X.story.push(Art(srcName)+' lefut: '+ob.name+' exhausted lesz.');return;
    case 'heal':ob.dmg=0;X.EV.push({k:'heal',id:v,name:ob.name});parts.push(esc(ob.name)+' meggyógyul (419).');refs.push('419');return;
    case 'control':{const ok=X.setCtrl(v,it.pl,'191','a kontroll a resolve-kor változik');if(!ok){parts.push(esc(ob.name)+' irányítója már '+WHO[it.pl]+'.');return 'neg';}
      parts.push(esc(ob.name)+' irányítását '+WHO[it.pl]+' szerzi meg (a resolve-kor).');X.story.push(Art(srcName)+' lefut: '+ob.name+' irányítását '+WHO[it.pl]+' veszi át.');return;}
    case 'ctrlUntil':{if(act.until==='src'&&!(it.src&&X.onB(it.src))){parts.push('"'+esc(act.t||'')+'": a forrás már nincs a boardon, így a delayed kontroll nem jön létre, a lap irányítója nem változik, egy pillanatra sem (359.3.e.16).');refs.push('359.3.e.16');return 'ign';}
      const ok=X.setCtrl(v,it.pl,'391.5.b, 391.5.a','addig, amíg '+(it.src&&X.O[it.src]?X.O[it.src].name:'a forrás')+' a boardon van',act.until==='src'?it.src:undefined);if(ok){parts.push(esc(ob.name)+' irányítója '+WHO[it.pl]+' lesz, amíg '+esc(it.src&&X.O[it.src]?X.O[it.src].name:'a forrás')+' a boardon van (391.5.b).');X.story.push(WHOC[it.pl]+' irányítja '+art(ob.name)+' lapot, amíg '+(it.src&&X.O[it.src]?X.O[it.src].name:'a forrás')+' a boardon van.');}return;}
    case 'attach':{let gear=v,unit=it.src;if(act.self){gear=it.src;unit=v;}
      if(act.toSelf&&!(it.src&&X.onB(it.src))){parts.push('A csatolás célja ("me") már nincs a boardon: az információ nem elérhető, az utasítás Ignored (359.3.e.6).');refs.push('359.3.e.6');return 'ign';}
      const G=X.O[gear],U=X.O[unit];if(!G||!U||G.type!=='gear'||U.type!=='unit'||!X.onB(gear)||!X.onB(unit)){parts.push('A csatolás nem hajtható végre.');return 'neg';}
      if(!(G.card&&(G.card.tg||[]).includes('Equipment'))){parts.push(esc(G.name)+' nem Equipment, ezért nem csatolódik.');return 'neg';}
      if(G.on===unit){parts.push(esc(G.name)+' már ezen a uniton van, a csatolásnak nincs hatása (435.1.g, 435.1.i); az elemzés ezt Negated-nek veszi (levezetés, a 416.1.b és 415.1.b mintájára).');refs.push('435.1.g','435.1.i');it.flL=true;return 'neg';}
      G.on=unit;G.loc=U.loc;X.EV.push({k:'attach',id:gear,name:G.name,to:unit});parts.push('Felcsatolva: '+esc(G.name)+' → '+esc(U.name)+', a unit megkapja a Might bónuszát'+(G.card.eff?' és Effect Textjét':'')+' (435.1.c, 435.1.d).');refs.push('435','435.4');X.story.push(Art(G.name)+' felcsatolódik '+art(U.name)+' lapra.');return;}
    case 'detach':{const gs=ob.type==='gear'?[ob]:Object.values(X.O).filter((g:any)=>g.on===v&&g.zone==='board');if(!gs.length){parts.push(esc(ob.name)+': nincs leválasztható gear (436.1.a.1).');refs.push('436.1.a.1');return 'neg';}
      const g=gs[0];const top=X.O[g.on];if(!top){parts.push(esc(g.name)+' nincs csatolva (436.1.a.1).');refs.push('436.1.a.1');return 'neg';}g.on=null;g.loc=top.loc;X.DET.add(g.id);X.EV.push({k:'detach',id:g.id,name:g.name,from:top.id});
      parts.push(esc(g.name)+' leválik '+esc(top.name)+' lapról, a helye '+esc(X.locLabel(g.loc))+' (436.4)'+(g.loc!=='base'?'; battlefielden csatolatlan gear a következő cleanupban recall-olódik (436.4.a)':'')+'.');refs.push('436.4');X.story.push(Art(g.name)+' leválik '+art(top.name)+' lapról.');return;}
    case 'disempower':ob.emp=false;X.EV.push({k:'disempower',id:v,name:ob.name});parts.push(esc(ob.name)+' disempowered lesz (443).');refs.push('443');X.story.push(Art(ob.name)+' disempowered lesz.');return;
    case 'empower':ob.emp=true;X.EV.push({k:'empower',id:v,name:ob.name});parts.push(esc(ob.name)+' Empowered lesz (442).');refs.push('442');X.story.push(Art(ob.name)+' Empowered lesz.');return;
    case 'swap':{const me=X.O[it.src];if(!me||!X.onB(it.src)){parts.push('A forrás már nincs a boardon, a helycsere nem hajtható végre (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}
      const a=me.loc,b=ob.loc;const p1:string[]=[];const r1=X.moveObj(it.src,b,p1,refs,srcName);const r2=X.moveObj(v,a,p1,refs,srcName);parts.push(...p1);return r1==='neg'&&r2==='neg'?'neg':undefined;}
    case 'choose':parts.push(esc(ob.name)+' kiválasztva.');return;
    case 'none':parts.push(esc(ob.name)+': a kézi értelmezés szerint ez az utasítás nem csinál semmit.');return;
    default:parts.push(esc(ob.name)+': a hatás lefut, ezt az elemzés nem követi részletesen.');X.story.push(Art(srcName)+' lefut '+art(ob.name)+' lapra (részletesen nem követett hatás).');return;}};
  /** Önmagára hivatkozó utasítás ("ready me", "give me +2", "empower me", "kill this"): a forrásra hat, ha még a boardon van (359.3.f.2). */
  X.selfRef=(t:string)=>/\b(?:me|myself)\b(?! to\b)|\b(?:kill|banish|recall|exhaust|ready) this\b|\bI (?:get|gain|have)\b/i.test(t)&&!/\bto me\b/i.test(t);
  /* ---- célpont legalitás ---- */
  X.srcLoc=(it:any,phase?:string)=>phase==='play'&&it.perm?it.loc:it.src&&X.O[it.src]&&X.O[it.src].zone==='board'?X.O[it.src].loc:null;
  /** A célpont legalitása. phase: 'play' (kijátszáskor, 355.8) vagy 'res' (resolve-kor, 359.3.e.2). Visszaadja az okok listáját. */
  /** "Counter an enemy spell or ability that chooses it and no other friendly unit" (Repulse): a választott chain elem célpontjai közül
      a friendly unitok száma 359.3.e.9.a szerint: a mistargetelt választások is számítanak a boardon (a célzó utasítás zónája), a boardot elhagyók nem. */
  X.chooseOnlyWhy=(it:any,ob:any,phase:string)=>{const mine=(it.tg||[])[0];const st=X.MAIN.find((x:any)=>'s'+x.j===ob.id);const tg=st?(st.tg||[]):[];
    const cnt=tg.filter((v:string)=>v&&X.O[v]&&X.O[v].type==='unit'&&X.O[v].zone==='board'&&X.O[v].ctrl===it.pl);const gone=tg.filter((v:string)=>v&&X.O[v]&&X.O[v].type==='unit'&&X.O[v].zone!=='board');
    const N=esc(ob.name);const out:string[]=[];
    if(!mine||!tg.includes(mine))out.push(N+' nem választja ki '+(mine&&X.O[mine]?esc(X.O[mine].name)+' lapot':'a kiválasztott friendly unitot'));
    else if(cnt.length!==1)out.push(N+' '+cnt.length+' friendly unitot választott, amelyek a boardon vannak ('+cnt.map((v:string)=>esc(X.O[v].name)).join(', ')+'); a mistargetelt, de a boardon maradt választások is számítanak (359.3.e.9.a)');
    if(!out.length&&gone.length)it.coNote=N+' célpontjai közül '+gone.map((v:string)=>esc(X.O[v].name)).join(', ')+' nem a boardon van, ezért nem számít (359.3.e.9.a); így csak '+esc(X.O[mine].name)+' a választott friendly unit.';
    return out;};
  X.itemEnergy=(it:any)=>{const c=it.s&&it.s.c;return it.s&&it.s.k==='card'&&c&&c.e!=null?+c.e:0;};
  /** Költségfeltétel a célpontra (Defy, Rebuttal, Pickpocket): a nyomtatott költség számít (206). */
  X.tgWhy=(it:any,p:any,v:string,ti:number,phase:string)=>{const w=X.tgWhy0(it,p,v,ti,phase);
    if(!w.length&&p&&p.cost&&v!=='F0'&&v!=='F1'&&X.O[v]&&X.O[v].card){const cw=costCheck(p.cost,X.O[v].card,{might:it.src&&X.onB(it.src)?X.mightOf(it.src):null,points:X.scoreOf(it.pl)});if(cw)w.push(esc(X.O[v].name)+': '+cw+'.');}
    return w;};
  X.tgWhy0=(it:any,p:any,v:string,ti:number,phase:string)=>{const why:string[]=[];if(v==='F0'||v==='F1'){if(p.type!=='battlefield')why.push('ez battlefield');return why;}
    const ob=X.O[v];if(!ob)return ['ismeretlen célpont'];const N=esc(ob.name);
    if(p.type==='spell'){if(!(ob.type==='spell'||p.orAb&&ob.type==='ability'))why.push(N+' nem spell'+(p.orAb?' vagy ability':'')+', hanem '+ob.type+' (355.9.a.2).');else if(ob.zone!=='chain')why.push(phase==='res'?'már nincs a chainen':N+' nincs a chainen.');
      if(!why.length&&p.rel==='enemy'&&ob.ctrl===it.pl)why.push(N+' nem enemy (a saját '+(ob.type==='ability'?'abilityd':'spelled')+').');
      if(!why.length&&p.chooseOnly)why.push(...X.chooseOnlyWhy(it,ob,phase));
      return why;}
    if(ob.type!==p.type&&!(p.type==='perm'&&(ob.type==='unit'||ob.type==='gear')))why.push(N+' '+ob.type+', nem '+p.type+'.');
    if(ob.zone!=='board'){why.push(phase==='res'?'már '+(ob.zone==='hand'?'kézben van':ob.zone==='trash'?'a trashben van':ob.zone==='banish'?'banishelve van':'nincs a boardon')+', zónát váltott (359.3.e.2)':N+' nincs a boardon.');return why;}
    if(p.equipOnly&&!(ob.card&&(ob.card.tg||[]).includes('Equipment')))why.push(N+' nem Equipment.');
    if(p.bf&&ob.loc==='base')why.push(phase==='res'?'már a base-ben áll, a lap pedig battlefielden álló célpontot kér':N+' base-ben áll, a lap battlefielden álló célpontot kér.');
    if(p.base&&ob.loc!=='base')why.push(N+' nem base-ben áll.');
    if(p.eq&&!p.equipOnly&&!Object.values(X.O).some((g:any)=>g.on===v&&g.zone==='board'))why.push(phase==='res'?'már nincs rajta Equipment, nem "equipped" (359.3.e.12)':N+' nem equipped.');
    if(p.stunned&&!ob.st)why.push(N+' nem stunned.');
    if(p.here){const hl=X.srcLoc(it,phase);if(hl==null)why.push(phase==='res'?'a forrás már nincs a boardon, ezért a "here" nem értelmezhető (359.3.f.2)':'a forrás nincs a boardon ("here")');else if(ob.loc!==hl)why.push(phase==='res'?'már nem ott áll, ahol a forrás ("here" a végrehajtáskor, 359.3.f.2)':N+' nem ott áll, ahol a forrás ("here").');}
    if(p.free&&X.srcLoc(it,phase)!=null&&X.srcLoc(it,phase)===ob.loc)why.push(N+' ugyanott áll, a lap másik locationt kér.');
    if(p.max!=null){const mt=X.mightOf(v);if(mt==null)why.push('Add meg '+N+' Mightját.');else if(mt>p.max)why.push(N+' Mightja '+mt+', a lap legfeljebb '+p.max+' Mightút választhat.');}
    if(p.mighty){const mt=X.mightOf(v);if(mt!=null&&mt<5)why.push(N+' nem Mighty (Might '+mt+', 5 kell, 708).');}
    if(p.another&&it.tg&&it.tg.some((x:string,k:number)=>k!==ti&&x===v))why.push(N+' már egy másik célpont, a lap "another" egységet kér.');
    if(p.another&&it.src===v&&p.rel!=='enemy')why.push(N+' maga a forrás, a lap másik unitot kér.');
    if(it.from==='facedown'&&!p.free&&it.loc){const at=it.perm&&phase==='res'?(X.onB(it.objId)?it.loc:null):it.loc;
      if(at==null)why.push('a facedown-ból kijátszott forrás már nincs a boardon, így nem tudni, melyik battlefieldről jött (811.1.d.3.a)');
      else if(ob.loc!==at)why.push(phase==='res'?'már nem azon a battlefielden áll, ahonnan a lapot facedown-ból kijátszották (811.1.d.2, 359.3.e.2.a)':'Facedown-ból kijátszva csak azon a battlefielden választhat ('+esc(X.locLabel(at))+'), '+(it.perm?'ahová a lap került (811.1.d.3)':'ahol el volt rejtve (811.1.d.2)')+'.');}
    if(p.rel!=='any'&&ob.ctrl){const need=p.rel==='enemy'?other(it.pl):it.pl;if(ob.ctrl!==need)why.push(phase==='res'?'megváltozott az irányítója, már nem '+(p.rel==='enemy'?'enemy':'friendly')+' (359.3.e.2)':N+' '+(ob.ctrl===it.pl?'saját':'ellenséges')+' lap, a választás '+(p.rel==='enemy'?'ellenséges':'saját')+' lapot kér');}
    if(ob.untgt&&ob.ctrl&&ob.ctrl!==it.pl)why.push(phase==='res'?'ebben a körben nem választható enemy spellel vagy abilityvel, így illegális célpont (758.1)':N+' ebben a körben nem választható enemy spellel vagy abilityvel (757.1).');
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/^I can.t be chosen by enemy spells or abilities with Energy cost less than my Might\b/im.test(ob.card.txt||'')){const ec=X.itemEnergy(it);const mt=X.mightOf(v);
      if(mt!=null&&ec<mt)why.push(phase==='res'?'a Mightja ('+mt+') nagyobb, mint a forrás Energy költsége ('+ec+'), ezért nem választható, illegális célpont (757, 758.1)':N+' Mightja ('+mt+') nagyobb, mint a lap Energy költsége ('+ec+'), ezért nem választható (757).');
      else if(phase==='res'&&X.EV.slice(it.evPlay||0).some((e:any)=>e.k==='might'&&e.id===v&&e.to!=null&&e.to>ec))it.prot758=(it.prot758||[]).concat([N+': a Mightja ('+mt+') már nem nagyobb, mint az Energy költség ('+ec+'), ezért újra legális célpont (758.2)']);}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&ob.type==='unit'&&ob.zone==='board'){const W=Object.values(X.O).find((w:any)=>w.id!==v&&w.zone==='board'&&w.ctrl===ob.ctrl&&w.loc===ob.loc&&w.card&&/^Your units here with less Might than me can.t be chosen by enemy spells and abilities\b/im.test(w.card.txt||'')&&(X.mightOf(w.id)||0)>(X.mightOf(v)||0));
      if(!W&&phase==='res'){const W2:any=Object.values(X.O).find((w:any)=>w.id!==v&&w.board&&w.own===ob.ctrl&&w.card&&/^Your units here with less Might than me can.t be chosen by enemy spells and abilities\b/im.test(w.card.txt||''));
        if(W2&&X.EV.slice(it.evPlay||0).some((e:any)=>e.k==='might'&&e.id===W2.id&&e.to!=null&&e.to>(X.mightOf(v)||0)))it.prot758=(it.prot758||[]).concat([N+': '+esc(W2.name)+' passzív képessége már nem vonatkozik rá ('+(W2.zone!=='board'?'nincs a boardon':W2.loc!==ob.loc?'nem ugyanott áll':'a Mightja nem nagyobb')+'), ezért a resolve-kor legális célpont (758.2.a)']);}
      if(W)why.push(phase==='res'?esc((W as any).name)+' passzív képessége miatt ('+X.mightOf(v)+' Might, kevesebb, mint '+X.mightOf((W as any).id)+') nem választható, illegális célpont (757, 758.1)':N+' nem választható: '+esc((W as any).name)+' ugyanott áll, és a Mightja nagyobb (757).');}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/can.t be chosen by enemy|cannot be chosen by enemy/i.test((ob.card.txt||'').split('\n').filter((l:string)=>!/with Energy cost less than my Might|^Your units here with less Might/i.test(l)).join('\n'))&&!/unless/i.test(ob.card.txt||''))why.push(phase==='res'?'enemy spell vagy ability nem választhatja, így illegális célpont (758.1)':N+' szövege szerint ellenséges spell vagy ability nem választhatja (757, 758).');
    return why;};
  /** Legális választások egy célponthoz (403.4.b). */
  X.legalOpts=(it:any,p:any,ti:number)=>{if(p.type==='battlefield')return ['F0','F1'].filter(f=>X.BF['bf'+f[1]].c);
    return Object.keys(X.O).filter(id=>(p.type==='spell'?X.O[id].zone==='chain':X.O[id].zone==='board')&&(X.O[id].type===p.type||p.orAb&&X.O[id].type==='ability'||p.type==='perm'&&(X.O[id].type==='unit'||X.O[id].type==='gear'))&&!(it.tg||[]).some((x:string,k:number)=>k!==ti&&x===id)&&!X.tgWhy(it,p,id,ti,'play').length);};
  /* ---- 1. felépítés ---- */
  /** "When you play a [type] (that costs / with Energy cost / with Power cost ...)": a kijátszott lap nyomtatott (vagy copied) költsége dönt (206).
      A trashben lévő lap "play this/me from your trash" triggere is figyel (Forbidden Technique, Meticulous Restorationist). A döntés indoka egyszer kerül a sorok közé. */
  X.PTN=new Set<string>();
  /** "When you play a unit, gear, or activated ability with Energy cost [7] or more" (Nasus): az ability aktiválására, az ability alapköltségével (206.1). */
  X.snap('Kiinduló helyzet',[]);
  X.itemOf=(s:any)=>{const c=s.c;const perm=s.k==='card'&&isPermC(c);
    const label=s.k==='ab'?c.n+' abilityje':s.k==='tg'?c.n+' triggere':((X.O['s'+s.j]&&X.O['s'+s.j].name)||c.n)+(perm?' (play trigger)':'');
    const src=s.k==='ab'||s.k==='tg'?s.src:perm?'s'+s.j:null;
    return {kind:'step',s,label,name:s.k==='ab'?c.n+' abilityje':s.k==='tg'?c.n+' triggere':c.n,pl:s.k==='tg'?((X.O[s.src]&&X.O[s.src].ctrl)||s.pl):s.pl,eff:s.eff,list:s.list,tg:s.tg,src,perm,from:s.k==='card'?s.from:null,loc:s.k==='card'?(s.loc||(s.from==='facedown'?'bf0':'base')):null,objId:s.k==='card'||s.k==='ab'||s.k==='tg'?'s'+s.j:null,dest:s.dest,ov:s.ov,pays:s.pays,may:s.may,isTg:s.k==='tg',evPlay:X.EV.length,soM:s.so?(String(s.so).startsWith('h:')?((vsCard(String(s.so).slice(2))||{}).m??null):(X.O[s.so]?X.mightOf(s.so):null)):null,soName:s.so?(String(s.so).startsWith('h:')?String(s.so).slice(2)+' (kézből felfedve)':(X.O[s.so]?X.O[s.so].name:'')):'',notedLoc:s.k==='tg'&&s.tr&&/\bmove from a location\b/i.test(s.tr.why||'')?(s.mfrom||'base'):null};};
  X.playMain=()=>X.MAIN.forEach((s:any,ix:number)=>{
    if(s.k==='end'){/* Kör vége: a chain lefut, majd Ending Step (317.1); a további lépések a kör végi triggerekre válaszolnak. */
      X.stack=X.chain;if(X.chain.length){X.rows+=X.line('340.1','Mindkét játékos passzol: a chain teljes egészében lefut, utána jön az Ending Phase.',0);X.resolveAll();}
      if(!X.ENDED){X.rows+=X.line('317, 317.1','Kör vége: Ending Phase, Ending Step.',0);X.endStep();}return;}
    if(s.k==='res'){/* "Mindenki passzol": a chain legfelső eleme most resolve-ol (340.1), utána a cleanup; a következő lépések erre az állapotra épülnek. */
      if(!X.chain.length){X.rows+=X.line('340.1','Resolve lépés: a chain üres, nincs mit lefuttatni.',0);return;}
      X.stack=X.chain;const top=X.chain.pop();X.rows+=X.line('340.1','Mindkét játékos passzol: a chain legfelső eleme ('+esc(top.label)+') most resolve-ol, a következő lépések ez után jönnek.',0);
      const d0=X.done.length;try{X.resolveItem(top);X.flushPend(X.chain);}finally{const dn=X.done.length>d0?X.done[X.done.length-1]:null;X.snap('Resolve: '+top.label+(dn?', '+(RES[dn.res]||dn.res):''),X.chain);X.cleanup();}
      return;}
    let it:any=null;try{const c=s.c;const tm=s.k==='ab'?(s.ab?s.ab.tm:'none'):s.k==='tg'?'trig':timingOf(c);const perm=s.k==='card'&&isPermC(c);const empty=!X.chain.length;
    const verb=s.k==='tg'?Art(c.n)+' triggerel':s.pl==='A'?(ix&&!empty?'Válaszként ':'')+(s.k==='ab'?'aktiválod':'kijátszod'):'Az ellenfél '+(ix&&!empty?'válaszként ':'')+(s.k==='ab'?'aktiválja':'kijátssza');
    const what=s.k==='tg'?'('+esc(s.tr?s.tr.why:'?')+')':s.k==='ab'?art(c.n)+' abilityjét ('+esc(s.ab?s.ab.label:'?')+')':art(c.n)+' lapot';
    const Verb=verb[0].toUpperCase()+verb.slice(1);
    it=X.itemOf(s);s.it=it;if(X.ZC)X.out.zsnap[s.j]={board:Object.keys(X.O).filter((id:string)=>(X.O[id].type==='unit'||X.O[id].type==='gear')&&X.O[id].zone==='board'),ctx:X.zctx(it,s),hand:{A:X.zoneIds('hand','A'),B:X.zoneIds('hand','B')},trash:{A:X.zoneIds('trash','A'),B:X.zoneIds('trash','B')},deck:{A:X.zoneIds('deck','A'),B:X.zoneIds('deck','B')}};
    let illegal:any=null;
    if(s.k==='ab'&&!s.ab)illegal='nincs kiválasztva ability';
    else if(s.k==='tg'&&!s.tr)illegal='nincs kiválasztva trigger';
    else if(s.k==='ab'&&s.ab.add){X.rows+=X.line('430.2, 337.2',esc(Verb)+' '+what+'. Erőforrást ad: azonnal resolve-ol, nem kerül a chainre, és nem lehet rá válaszolni.',0);X.story.push(Verb+' '+what+': azonnal erőforrást ad, nem kerül a chainre.');return;}
    else if(s.k!=='tg'&&!empty&&!(tm==='reaction'||tm==='hidden'&&s.from==='facedown')&&(s.illTiming=true))illegal=(s.k==='ab'?'az ability':'a lap')+' nem [Reaction]'+(tm==='hidden'?' (kézből; csak facedown-ból kapna [Reaction]-t)':'')+', ezért amíg van valami a chainen, nem jöhet';
    if(!illegal&&s.k==='tg'&&s.src&&X.O[s.src]&&!['board','legend'].includes(X.O[s.src].zone)&&!s.tr.dk)illegal='a trigger forrása nincs a boardon';
    if(!illegal&&s.repBad){illegal=s.repBad;}
    if(!illegal&&perm&&X.bfBlocksPlay(X.O['s'+s.j].loc))illegal=esc(X.locLabel(X.O['s'+s.j].loc))+' szövege szerint ide nem játszható ki';
    if(!illegal&&s.k==='ab'&&s.src&&X.O[s.src]){const sc=X.O[s.src];
      if(sc.ex&&/\[T\]|\[E\]/.test(s.ab.cost||s.ab.label))illegal='a forrás már exhausted, az [Exhaust] költség nem fizethető ki';
      else if(s.ab.empower&&sc.emp)illegal='a forrás már Empowered; az Empower csak akkor aktiválható, ha nem az (827.1.b, a lap emlékeztető szövege)';
      else if(/disempower me/i.test(s.ab.cost||'')&&!sc.emp)illegal='a "Disempower me" költséghez a forrásnak Empowered állapotban kell lennie';
      else if(!['board','legend'].includes(sc.zone))illegal='a forrás nincs a boardon';}
    // additional cost: kill
    const ck=s.k==='card'&&s.cost&&s.cost.kill;let costV:any=null;
    if(!illegal&&ck&&(!ck.opt||s.addc)){costV=s.costTg||'';if(!costV)illegal='az additional cost kill célpontja nincs megadva';else{const ob=X.O[costV];
      if(!ob||ob.zone!=='board'||ob.type!=='unit')illegal='a költségként megölendő unit nincs a boardon';else if(ob.ctrl!==s.pl)illegal='költségként csak friendly unit ölhető meg';else if(ck.mighty&&(X.mightOf(costV)==null||X.mightOf(costV)<5))illegal=esc(ob.name)+' nem Mighty (5 vagy több Might kell, 708)';}}
    // célpontok (355.8). A kijátszott permanent már a boardon van, mire a play effectje célpontot választ (337.2), így önmagát is választhatja (355.9.c).
    if(perm&&!illegal&&X.O['s'+s.j].zone==='pending')X.O['s'+s.j].zone='board';
    const pick:any[]=[];
    // trigger (play effect, chainre tett trigger): ha van legális választás, kötelező azt választani (403.4.b); ha nincs, lekerül (403.4)
    if(!illegal&&(perm&&s.trig||s.k==='tg'))s.list.forEach((p:any,ti:number)=>{const v=s.tg[ti];if(!v&&p.opt)return;if(v&&!X.tgWhy(it,p,v,ti,'play').length)return;
      const opts=X.legalOpts(it,p,ti);if(!opts.length)return;const was=v?X.nm(v):'';const wy=v?X.tgWhy(it,p,v,ti,'play').join(' '):'';s.tg[ti]=opts[0];
      pick.push(['403.4.b, 403.2','A trigger '+(ti+1)+'. célpontja '+(was?'('+esc(was)+') nem legális: '+wy.replace(/\.\s*$/,'')+';':'nincs megadva;')+' de van legális választás, ezért kötelező azt választani (403.4.b). Az elemzés ezzel számol: '+esc(X.nm(opts[0]))+(opts.length>1?'; '+WHO[it.pl]+' választhatja helyette ezek egyikét is: '+opts.slice(1).map((o:string)=>esc(X.nm(o))).join(', '):'')+'.',0]);});
    let tErr:any=null;
    if(!illegal)s.list.forEach((p:any,ti:number)=>{if(tErr)return;const v=s.tg[ti];if(!v){if(!p.opt)tErr='nincs megadva a kötelező '+(ti+1)+'. célpont';return;}
      const why=X.tgWhy(it,p,v,ti,'play');if(why.length)tErr=(ti+1)+'. célpont nem választható: '+why.join(' ').replace(/\.\s*$/,'');});
    if(!illegal&&!tErr&&s.list.some((p:any)=>p.same)){const ls=s.tg.filter(Boolean).map((v:string)=>X.O[v]&&X.O[v].loc);if(ls.length>1&&ls.some((l:string)=>l!==ls[0]))tErr='a célpontoknak ugyanazon a locationön kell állniuk';}
    if(!illegal&&!tErr&&s.list.some((p:any)=>p.split)){const n=s.list.map((p:any,ti:number)=>p.split&&s.tg[ti]?1:0).reduce((a:number,b:number)=>a+b,0);const sx=(interp(s,s).find((x:any)=>x.act.split)||{}).act||{};
      let T0=sx.k==='dmg'?sx.n:null;if(sx.k==='dmgM'){const f=s.tg.find((v:string,ti:number)=>v&&!s.list[ti].split);T0=f?X.mightOf(f):null;}
      if(T0!=null){const b=X.bonusDmg(s.pl);if(b)T0+=b;if(n>T0)tErr='osztott damage: legfeljebb '+T0+' célpont választható (355.14.c'+(b?', a Bonus Damage-dzsel együtt, 715.3':'')+'), most '+n;}}
    /* trashből választott célpont (355.9.a, 355.10.a): a lerakáskor legálisnak kell lennie (355.8) */
    if(!illegal&&!tErr&&s.zp)interp(s,s).forEach((x:any,xi:number)=>{const ids=s.zp[xi];if(tErr||!ids||!ids.length)return;const zr=zoneRefOf(x.t,c.n);if(!zr)return;
      const gone=ids.filter((id:string)=>!X.O[id]||!X.O[id].card);if(gone.length){tErr='nincs megadva a '+(xi+1)+'. utasítás lapja: a kiválasztott lap már nincs a helyzetben (törölték), újra kell választani';return;}
      if(!zr.target)return;
      const w=X.zcWhy(zr,ids,it.pl,false,X.zctx(it,s));if(w)tErr=(xi+1)+'. utasítás célpontja a trashben nem választható: '+w+' (355.9.a, 355.9.b)';else{it.zpGen=it.zpGen||{};ids.forEach((id:string)=>{it.zpGen[id]=X.O[id].gen||0;});}});
    /* Show Off költségfeltétellel (Rousing Display): a felfedett vagy kiválasztott lap nyomtatott költsége (832.1.c, 206) */
    if(!illegal&&!tErr&&s.so&&/\[Show Off\]/.test(c.txt||'')){const sl=(c.txt||'').split('\n').find((l:string)=>/\[Show Off\]/.test(l))||'';const cc=costCondOf(sl);
      if(cc){const sc=String(s.so).startsWith('h:')?vsCard(String(s.so).slice(2)):X.O[s.so]&&X.O[s.so].card;const w=sc?costCheck(cc,sc,{}):'';if(w)tErr='Show Off: '+sc.n+' nem választható, '+w.replace(/ \(206\)$/,'')+' (832.1.c, 206)';}}
    let trigBad:any=null;if(tErr){if(perm&&s.trig)trigBad=tErr;else{illegal=tErr;s.illTarget=true;}}
    s.illegal=illegal;
    if(illegal){if(s.k==='tg'){X.rows+=X.line('403.4, 403.4.a',esc(Verb)+' '+what+', de nincs legális választás: '+illegal+'. A trigger lekerül a chainről (ez nem counter).',0);X.story.push(Art(c.n)+' triggere lekerül a chainről, mert '+illegal.replace(/<[^>]+>/g,'')+'.');return;}
      X.rows+=X.line(s.illTiming?(s.k==='ab'?'358.4, 338.1.a.1, 813.1.c.2':'358.4, 338.1.a.1, 813.1.c.1'):s.illTarget?'355.8':'358','<span class="stbad">Nem szabályos:</span> '+esc(Verb)+' '+what+'? '+illegal+'. Kimarad.',0);X.story.push((s.pl==='A'?'Nem '+(s.k==='ab'?'aktiválhatod':'játszhatod ki'):'Az ellenfél nem '+(s.k==='ab'?'aktiválhatja':'játszhatja ki'))+' '+what.replace(/<[^>]+>/g,'')+' így: '+illegal.replace(/<[^>]+>/g,'').replace(/ \([0-9.]+\)/g,'')+'.');if(X.O['s'+s.j])X.O['s'+s.j].zone='none';return;}
    // legális
    if(X.ZC&&s.k==='card'&&['hand','trash',undefined,null,''].includes(s.from)){const fz=s.from==='trash'?'trash':'hand';const zid=Object.keys(X.O).find(id=>X.O[id].type==='zc'&&X.O[id].zone===fz&&X.O[id].own===s.pl&&X.O[id].card.n===c.n);if(zid)X.zcMove(zid,'played');}
    const timingTxt=s.k==='tg'?'a játék teszi a chainre, priority nem kell hozzá':!empty?(tm==='reaction'?'[Reaction], ezért válaszként jöhet':'facedown-ból [Reaction]-ként jön'):(tm==='none'&&c.t==='Spell'?'üres chain mellett, a saját körödben':'üres chain mellett');
    X.rows+=X.line(s.k==='tg'?'383.3, 401':!empty?(tm==='reaction'?(s.k==='ab'?'813.1.c.2':'813.1.c.1'):'811.6'):(s.k==='ab'?'381':c.t==='Spell'?'155':'337.2'),esc(Verb)+' '+what+' ('+timingTxt+').'+(s.from&&s.from!=='hand'&&s.k==='card'?' Honnan: '+({facedown:'facedown',trash:'trash',champ:'Champion Zone',other:'nem kézből'} as any)[s.from]+'.':''),0);
    pick.forEach((a:any)=>{X.rows+=X.line(a[0],a[1],a[2]);});
    if(s.modes&&s.modes.length)X.rows+=X.line('355.3','Választott mód ("Choose one"): '+esc(s.modes[Math.max(0,Math.min(s.mode||0,s.modes.length-1))].replace(/\.$/,''))+'. A mód a kijátszáskor dől el, a builderben állítható.',0);
    if(s.rep&&s.repModes)X.rows+=X.line('820.1.d.1, 820.2'+(s.modes&&s.modes.length?', 820.2.a':''),'[Repeat] költség kifizetve '+(s.rep>1?s.rep+' alkalommal ('+s.repN+' külön költségből)':'')+': a hatás a resolve-kor '+(s.rep>1?s.rep+' további alkalommal':'még egyszer')+' végrehajtódik'+(s.modes&&s.modes.length?', a további végrehajtások módja: '+s.repModes.slice(1).map((m:number)=>esc(s.modes[Math.max(0,Math.min(m,s.modes.length-1))].replace(/\.$/,''))).join('; ')+' (más mód és más célpont is választható)':'')+'. A célpontok sorrendje a végrehajtás sorrendje.',0);
    if(s.k==='ab'&&s.src&&X.O[s.src]&&/\[T\]|\[E\]/.test(s.ab.cost||'')){X.O[s.src].ex=true;X.rows+=X.line('415','Költség: '+esc(X.O[s.src].name)+' exhausted lesz.',0);}
    if(s.k==='ab'&&s.src&&X.O[s.src]&&/disempower me/i.test(s.ab.cost||'')){X.O[s.src].emp=false;X.rows+=X.line('443','Költség: '+esc(X.O[s.src].name)+' disempowered lesz.',0);}
    if(costV){const parts:string[]=[];const refs:string[]=[];const r=X.killObj(costV,'additional cost',parts,refs);X.EV.push({k:'cost',id:costV});X.rows+=X.line('356.2.a, 357.2'+(r==='neg'?', 357.2.a':''),'Költség: '+parts.join(' ')+(r==='neg'?' A halált replacement helyettesítette, a költség ettől még ki van fizetve (357.2.a).':''),0);X.story.push('Költségként '+(r==='neg'?'meg kellene halnia '+art(X.O[costV].name)+' lapnak, de a halált replacement helyettesíti; a költség így is ki van fizetve.':'meghal '+art(X.O[costV].name)+'.'));}
    if(s.k==='tg'&&s.killSelf){if(s.src&&X.onB(s.src)){const parts:string[]=[];const refs:string[]=[];const r=X.killObj(s.src,'a trigger költsége',parts,refs);X.rows+=X.line('204.1.c, 383.3.b'+(r==='neg'?', 357.2.a':''),'A trigger költsége ("kill me") a finalizáláskor: '+parts.join(' '),0);X.story.push(Art(c.n)+' a trigger költségeként meghal, mielőtt a hatás a chainre kerül.');}
      else{X.rows+=X.line('204.1.c','A "kill me" költség nem fizethető ki (a forrás nincs a boardon), ezért a trigger nem kerül a chainre.',0);s.illegal='költség';return;}}
    if(perm){X.O['s'+s.j].zone='board';const er=X.enterReady(c,s.pl,!!s.accel,X.O['s'+s.j].loc,s.erd,'s'+s.j,!!s.addc);if(c.t==='Unit')X.O['s'+s.j].ex=!er.ready;X.EV.push({k:'enter',id:'s'+s.j,name:c.n,loc:X.O['s'+s.j].loc});X.rows+=X.line('337.2'+(c.t==='Unit'?(er.ready?', 143.4.a':', 143.4'):''),'A '+c.t.toLowerCase()+' azonnal resolve-ol és ide kerül: '+esc(X.locLabel(X.O['s'+s.j].loc))+'.'+(c.t==='Unit'?(er.ready?' Ready lép be ('+er.why+').':' Exhausted lép be (143.4).')+(er.note?' '+er.note:''):'')+(s.trig?' A "When you play" hatása triggerként a chainre kerül (355.5.b).':''),er.note&&/bizonytalan|nem követett/.test(er.note)?1:0);}
    else if(X.O['s'+s.j])X.O['s'+s.j].zone='chain';
    s.tg.forEach((v:string,ti:number)=>{if(v)X.rows+=X.line('355.7','<span class="stok">'+(ti+1)+'. célpont:</span> '+esc(X.nm(v))+(X.O[v]&&X.O[v].loc?' ('+esc(X.locLabel(X.O[v].loc))+(X.mightOf(v)!=null?', '+X.mightOf(v)+' Might':'')+')':'')+'.',0);});
    const defl=s.tg.filter((v:string)=>v&&X.O[v]&&X.O[v].card&&X.O[v].type!=='ability'&&X.O[v].type!=='spell'&&X.O[v].ctrl!==it.pl&&/\[Deflect/.test(X.O[v].card.txt||'')).map((v:string)=>{const m=/\[Deflect(?: (\d+))?\]/.exec(X.O[v].card.txt);return X.O[v].name+' ('+(m&&m[1]?m[1]:1)+')';});
    if(defl.length){s.defl=defl;X.rows+=X.line('809.1.c, 356.2.a','Deflect: '+esc(defl.join(', '))+' kiválasztásáért ennyi plusz Powert kell fizetni additional costként.',0);}
    let trigOK=!perm||!s.trig||s.cond!=='paid'||s.addc;
    if(perm&&s.trig&&s.cond==='facedown'&&s.from!=='facedown'){trigOK=false;X.rows+=X.line('383.2.a','A play trigger feltétele ("When you play me from face down") nem teljesül: nem facedown-ból játszották ki, ezért nem triggerel.',0);}
    else if(perm&&s.trig&&s.cond==='facedown')X.rows+=X.line('383.2.a, 811.1.d.3','Facedown-ból kijátszva: a "When you play me from face down" trigger a chainre kerül.',0);
    if(perm&&s.trig&&trigOK&&s.tcond){const cv=X.evalCond(s.tcond,it,s,-1,null);if(cv===false){trigOK=false;X.rows+=X.line('383.2.a.1','A play trigger feltétele ("if '+esc(s.tcond.t)+'") a kijátszáskor nem teljesül '+esc(X.condSrc(s.tcond))+', ezért nem triggerel.',0);X.story.push('A "When you play" trigger nem triggerel, mert a feltétele ("if '+s.tcond.t+'") nem teljesül.');}
      else X.rows+=X.line('383.2.a.1','A play trigger feltétele ("if '+esc(s.tcond.t)+'") a kijátszáskor teljesül '+esc(X.condSrc(s.tcond))+', ezért a chainre kerül; a resolve-kor már nem ellenőrzi újra.',0);}
    if(perm&&s.trig&&!trigOK){if(s.cond==='paid')X.rows+=X.line('383.2.a.1','A play effect feltétele ("if you paid the additional cost") nem teljesül, ezért nem triggerel.',0);}
    else if(trigBad){trigOK=false;X.rows+=X.line('403.4, 403.4.a','A play effectnek nincs legális választása ('+trigBad+'). A '+c.t.toLowerCase()+' ettől még a boardra kerül, a trigger lekerül a chainről (403.4; ez nem counter).',0);X.story.push('A play effectnek nincs legális célpontja, ezért a trigger lekerül a chainről.');s.trigBad=trigBad;}
    if(perm&&s.trig&&!trigOK){}
    else if(s.may&&(s.k==='tg'||perm&&trigOK))X.rows+=X.line('383.3.a, 383.3.a.2','"You may" a triggered ability elején: '+WHO[it.pl]+' a chainre tételkor (finalizálás) dönt'+(it.pl==='A'?'öd':'i')+' el, végrehajtja-e; ha nem, lekerül. Az elemzés igennel számol.',0);
    else if(s.may)X.rows+=X.line('355.18, 355.12','"You may": a döntés a resolve-kor születik (355.18); a célpontokat a kijátszáskor kell kiválasztani, a game action végrehajtásáról szóló döntéstől függetlenül (355.12). Az elemzés igennel számol.',0);
    X.story.push(Verb+' '+what.replace(/<[^>]+>/g,'')+(perm?', ami azonnal ide kerül: '+X.locLabel(X.O['s'+s.j].loc)+(s.trig&&trigOK?', a "When you play" hatása pedig a chainre':''):', ez a chain tetejére kerül')+'.');
    if(it.isTg&&s.tr&&s.tr.dk){it.dk=true;it.sent=!!(X.O[s.src]&&X.O[s.src].zone==='trash');}
    if(s.k==='ab'||s.k==='tg'||c.t==='Spell')X.chain.push(it);
    else if(s.trig&&trigOK)X.pushTrig(it);
    // unit és gear kijátszása azonnal resolve-ol (337.2), ezért a "When you play" triggerek most triggerelnek; spellnél csak a resolve-kor (420.4.a)
    if(s.k==='ab'&&s.ab)X.abTrigs(s).forEach((t:any)=>{X.pushTrig(t);X.rows+=X.line('206.1, 383.2','Trigger: '+esc(X.O[t.src].name)+' '+t.why,1);X.story.push(Art(X.O[t.src].name)+' triggerel az ability aktiválására.');});
    if(perm){X.playTrigs(s).forEach((t:any)=>{X.pushTrig(t);X.rows+=X.line('420.4.a, 337.2','Trigger: '+esc(X.O[t.src].name)+' '+t.why+' A '+c.t.toLowerCase()+' kijátszása a resolve-jával befejeződött, ezért most triggerel.',1);X.story.push(Art(X.O[t.src].name)+' képessége triggerel erre a kijátszásra, és a chainre kerül.');});}
    else if(s.k==='card'&&X.playTrigs(s).length)X.rows+=X.line('420.4.a, 420.4.a.1','A "When you play a spell" típusú triggerek ('+X.playTrigs(s).map((t:any)=>esc(t.label)).join(', ')+') csak akkor triggerelnek, amikor '+esc(c.n)+' resolve-ol; ha counterelik, nem triggerelnek.',0);
    // a költségből vagy kijátszásból keletkezett triggerek (Deathknell, leave, play) a kijátszott elem fölé kerülnek
    if(X.PEND.length){const n=X.PEND.length;const lab=X.PEND.map((t:any)=>esc(t.label)).join(', ');X.flushPend(X.chain);X.rows+=X.line('337.1.b, 359.3.b, 340.1','A kijátszás közben keletkezett trigger'+(n>1?'ek':'')+' ('+lab+') a chain tetejére kerül'+(n>1?'nek':'')+', ezért előbb resolve-ol'+(n>1?'nak':'')+'.',1);}
  }finally{const lab=(s.k==='tg'?(s.it?s.it.pl:s.pl):s.pl)==='A'?'Te':'Ellenfél';X.snap(s.k==='tg'?'Trigger: '+s.c.n+(s.illegal?' (lekerül)':''):lab+': '+(s.k==='ab'?'aktiválás':'kijátszás')+', '+(s.k==='ab'?s.c.n+' abilityje':s.c.n)+(s.illegal?' (nem szabályos, kimarad)':''),X.chain,s.j);}});
  /* ---- 2. lefutás ---- */
  X.done=X.out.done;
  /** Cleanup (319.5, 323): lethal damage-es unitok meghalnak, csatolatlan gear battlefielden és idegen base-ben álló permanentek recall-olódnak (323.6). */
  X.cleanup=()=>{const dead=Object.keys(X.O).filter(id=>X.lethal(id));const parts:string[]=[];const refs:string[]=[];const names:string[]=[];
    dead.forEach(id=>{const r=X.killObj(id,'lethal damage, cleanup',parts,refs);names.push(X.O[id].name+(r==='neg'?' (helyettesítve)':''));});
    if(dead.length){X.REC.push(['323.4, 142.4.b, 429.1.a.2','Cleanup: '+plainOf(parts.join(' '))]);X.ALL.push(X.REC[X.REC.length-1]);}
    const rc=Object.keys(X.O).filter(id=>{const g=X.O[id];return g.zone==='board'&&!g.on&&((g.type==='gear'&&g.loc!=='base')||(g.loc==='base'&&g.baseOf&&g.ctrl&&g.baseOf!==g.ctrl));});
    rc.forEach(id=>{const g=X.O[id];const why=g.loc!=='base'?'csatolatlan gear battlefielden':'nem a saját irányítója base-ében áll';g.loc='base';g.baseOf=g.ctrl;X.EV.push({k:'recall',id,name:g.name,cleanup:true});
      X.REC.push(['323.6'+(why[0]==='c'?', 436.4.a':''),g.name+': '+why+', ezért a cleanupban recall-olódik a base-be.']);X.ALL.push(X.REC[X.REC.length-1]);names.push(g.name+' recall');X.story.push(Art(g.name)+' a cleanupban a base-be kerül ('+why+').');});
    X.flushPend(X.stack);if(names.length)X.snap('Cleanup: '+names.join(', '),X.stack);};
  X.guard=0;X.resolveAll=()=>{while(X.stack.length&&X.guard++<80){const it=X.stack.pop();const d0=X.done.length;try{X.resolveItem(it);X.flushPend(X.stack);}finally{const dn=X.done.length>d0?X.done[X.done.length-1]:null;X.snap('Resolve: '+it.label+(dn?', '+(RES[dn.res]||dn.res):''),X.stack);X.cleanup();}}};
  X.evalState=(cd:any,it:any,s:any,tv:string|null):boolean|null=>{const c=cd.t;const pl=it.pl;let m;const T=tv&&X.O[tv]?X.O[tv]:null;const S=it.src&&X.O[it.src]?X.O[it.src]:null;const here=S&&S.zone==='board'?S.loc:null;
    const cntU=(f:(o:any)=>boolean)=>Object.values(X.O).filter((o:any)=>o.zone==='board'&&f(o)).length;cd.from='state';
    if((m=/^Level (\d+)$/i.exec(c))){cd.val='XP: '+X.xpOf(pl);return X.xpOf(pl)>=+m[1];}
    if(/^Legion$/i.test(c)){const pb=X.playedBefore(pl,s?s.j:999);cd.val='korábban kijátszott lap: '+(pb.size||+X.PSv(pl,'played')?'van':'nincs');return pb.size>0||+X.PSv(pl,'played')>0;}
    if(/^you've played a spell this turn$/i.test(c)){const pb=X.playedBefore(pl,s?s.j:999);return pb.has('spell');}
    if(/^you've played a non-token unit, a non-token gear, and a spell this turn$/i.test(c)){const pb=X.playedBefore(pl,s?s.j:999);cd.val=[...pb].join(', ')||'semmi';return pb.has('unit')&&pb.has('gear')&&pb.has('spell');}
    if(/an opponent's score is within 3 points of the Victory Score/i.test(c)){cd.val='ellenfél pontja: '+X.scoreOf(other(pl))+', Victory Score: '+X.VS();return X.VS()-X.scoreOf(other(pl))<=3;}
    if(/your score is not within 3 points of the Victory Score/i.test(c)){cd.val='pontod: '+X.scoreOf(pl);return X.VS()-X.scoreOf(pl)>3;}
    if((m=/^you control (\d+) or (fewer|more) runes$/i.exec(c))){const r=X.runesOf(pl);cd.val='rune-ok: '+r;return m[2]==='fewer'?r<=+m[1]:r>=+m[1];}
    if((m=/^you control exactly (\d+) runes$/i.exec(c)))return X.runesOf(pl)===+m[1];
    if(/^your Rune Deck is empty$/i.test(c)){cd.val='rune deck: '+X.runeDeckOf(pl);return X.runeDeckOf(pl)===0;}
    if(/^you can't$/i.test(c)){cd.val='rune deck a resolve előtt: '+it.rdBefore;return (it.rdBefore??X.runeDeckOf(pl))<1;}
    if((m=/^you couldn't channel (\d+) runes? this way$/i.exec(c))){cd.val='rune deck a resolve előtt: '+it.rdBefore;return (it.rdBefore??X.runeDeckOf(pl))<+m[1];}
    if(/^it's your Beginning Phase$/i.test(c)){cd.val='fázis: '+(X.CS.phase||'main');return X.CS.phase==='beginning'&&X.TP===pl;}
    if((m=/^you spent \[(\d+)\] or more$/i.exec(c))){cd.val='elköltve: '+X.PSv(pl,'spent');return +X.PSv(pl,'spent')>=+m[1];}
    if(/^you showed off/i.test(c)){cd.val=s&&s.so?'Show Off: '+(X.O[s.so]?X.O[s.so].name:String(s.so).replace(/^h:/,'')):'nincs Show Off';return !!(s&&s.so);}
    if(/^it's attacking$/i.test(c))return !!(T&&T.atk==='a');
    if((m=/^you control a facedown card( here| at a battlefield)?$/i.exec(c))){const bfs=['bf0','bf1'].filter((l,i)=>(X.CS.bf[i]||{}).fd===pl&&(!m[1]||!/here/i.test(m[1])||l===here));return bfs.length>0;}
    if(/^I didn't die alone$/i.test(c))return !!(S&&S.lk&&S.lk.alone===false);if(/^I died alone$/i.test(c))return !!(S&&S.lk&&S.lk.alone===true);
    if(/^I was \[?Mighty\]?$/i.test(c))return !!(S&&S.lk&&S.lk.m>=5);
    if(/^I haven't been dealt damage this turn$/i.test(c))return !(S&&S.dealt);
    if(/^I am at a battlefield$/i.test(c))return !!(here&&here!=='base');
    if((m=/^you control a (\w+)$/i.exec(c))){const tg=m[1].toLowerCase();return cntU((o:any)=>o.ctrl===pl&&o.card&&((o.card.tg||[]).some((x:string)=>x.toLowerCase()===tg)||new RegExp('\\b'+m[1]+'\\b','i').test(o.card.n)))>0;}
    if(/^there is a friendly gear with \[Deploy\] here$/i.test(c))return cntU((o:any)=>o.ctrl===pl&&o.type==='gear'&&o.loc===here&&/\[Deploy\]/.test((o.card&&o.card.txt)||''))>0;
    if(/^there's an enemy unit alone at that battlefield$/i.test(c)){const l=T?(T.zone==='board'&&T.loc!=='base'?T.loc:(T.lk&&T.lk.loc)):null;return !!l&&cntU((o:any)=>o.type==='unit'&&o.ctrl!==pl&&o.loc===l)===1;}
    if(/^it's already stunned$/i.test(c))return !!(T&&T.st);
    if((m=/^there are (\d+) or more units there$/i.exec(c))){const f=(it.tg||[]).find((v:string)=>v==='F0'||v==='F1');const l=f==='F1'?'bf1':'bf0';return cntU((o:any)=>o.type==='unit'&&o.loc===l)>=+m[1];}
    if(/^it's your turn and you played this from face down$/i.test(c))return X.TP===pl&&it.from==='facedown';
    return null;};
  /** A feltétel forrásának szövege a felületen. */
  X.condSrc=(cd:any)=>cd.how==='open'?(cd.from==='field'?'(nyitott kérdés, judge dönt: '+cd.why+'; a lapnál így megadva)':'(nyitott kérdés, judge dönt: '+cd.why+'; feltételezés: nem teljesül, a lapnál állítható)'):cd.how==='hidden'?(cd.from==='field'?'(a lapnál megadva)':cd.from==='zone'?'(a deck felső lapja a pályás építőben megadva: '+cd.zn+', 108.4.e, 128.3)':'(feltételezés: nem teljesül; '+(cd.why||'rejtett adat')+', a lapnál állítható)'):cd.how==='state'?'(játékállapotból'+(cd.val?': '+cd.val:'')+'; a kezdőérték a builderben állítható)':'(a boardon ellenőrizve)';
  /** Feltétel kiértékelése: true, false, vagy null (nem követett adat, a builderben nincs megadva). */
  X.evalCond=(cd:any,it:any,s:any,xi:number,tv:string|null):boolean|null=>{if(!cd)return true;const c=cd.t.toLowerCase();
    if(/^you paid (?:the|my) additional cost/.test(c))return !!(s&&s.addc);if(/^you played this from your hand/.test(c))return (it.from||'hand')==='hand';
    if(cd.how==='hidden'||cd.how==='open'){const v=s&&s.cnd?s.cnd[xi]:null;if(v==='1'||v==='0'){cd.from='field';return v==='1';}
      if(/^you revealed a card with the lowest energy cost$/i.test(cd.t)&&it.zEachTop&&X.O[it.zEachTop.A]&&X.O[it.zEachTop.B]){const eA=printedCost(X.O[it.zEachTop.A].card).e,eB=printedCost(X.O[it.zEachTop.B].card).e;const mine=it.pl==='A'?eA:eB,theirs=it.pl==='A'?eB:eA;cd.from='zone';cd.zn=X.O[it.zEachTop[it.pl]].name+' '+mine+' Energy, a másik '+theirs+' Energy'+(mine===theirs?'; döntetlen: a Core Rules nem dönti el, hogy egyenlő költségnél "a legalacsonyabb"-e (nyitott kérdés, judge dönt; az elemzés igennel számol)':'');if(mine===theirs)cd.tie=true;return mine<=theirs;}
      const zm=/^it's an? (gear|spell|unit)$|^it is a (unit)$/i.exec(cd.t);if(zm&&it.zTop&&X.O[it.zTop]){cd.from='zone';cd.zn=X.O[it.zTop].name;return String(X.O[it.zTop].card.t).toLowerCase()===(zm[1]||zm[2]).toLowerCase();}
      cd.from='default';return false;}
    if(cd.how==='state'){const r=X.evalState(cd,it,s,tv);return r;}
    if(cd.how!=='board')return null;
    const T=tv&&X.O[tv]?X.O[tv]:null;const S=it.src&&X.O[it.src]?X.O[it.src]:null;const here=S&&S.zone==='board'?S.loc:null;
    const cntU=(f:(o:any)=>boolean)=>Object.values(X.O).filter((o:any)=>o.zone==='board'&&f(o)).length;
    let m;
    if(/empowered/.test(c))return /^(?:i'm|this is)/.test(c)?!!(S&&S.emp):!!(T&&T.emp);
    if(/already buffed/.test(c))return !!(T&&T.bu);if(/is stunned/.test(c))return !!(T&&T.st);
    if(/mighty/.test(c)){const mt=T?X.mightOf(T.id):null;return mt==null?null:mt>=5;}
    if(/^i'm at a battlefield/.test(c))return !!(here&&here!=='base');
    if((m=/^it has (\d+) \[s\] or less/.exec(c))){const mt=T?X.mightOf(T.id):null;return mt==null?null:mt<=+m[1];}
    if(/^it's your turn/.test(c))return X.TP===it.pl;if(/^it's not your turn/.test(c))return X.TP!==it.pl;
    if(/exactly one other unit you control here/.test(c))return cntU((o:any)=>o.type==='unit'&&o.ctrl===it.pl&&o.loc===here&&o.id!==it.src)===1;
    if(/^an enemy unit is alone here/.test(c))return cntU((o:any)=>o.type==='unit'&&o.ctrl!==it.pl&&o.loc===here)===1;
    if((m=/^it was (?:a|an) (friendly|enemy) unit/.exec(c))){if(!T)return null;const tc=(T.lk&&T.lk.ctrl)||T.ctrl;return m[1]==='friendly'?tc===it.pl:tc!==it.pl;}
    if(/^you control this battlefield/.test(c)){const l=here;return l&&l!=='base'?X.BF[l].ctrl===it.pl:null;}
    if((m=/^you (?:control|have) (a|an|two or more|\d+ or more|exactly \d+|exactly two|\d+\+) (other )?(?:friendly )?(units?|gear)(?: (here|there|at that battlefield))?/.exec(c))){
      const w=m[4]==='here'?here:m[4]?(T?T.loc:here):null;const n=cntU((o:any)=>o.ctrl===it.pl&&o.type===(/gear/.test(m[3])?'gear':'unit')&&(!m[2]||o.id!==it.src)&&(!w||o.loc===w));
      const q=m[1];if(q==='a'||q==='an')return n>=1;if(q==='two or more')return n>=2;let k;if((k=/^(\d+)(?: or more|\+)$/.exec(q)))return n>=+k[1];if((k=/^exactly (\d+|two)$/.exec(q)))return n===numOf(k[1]);}
    return null;};
  /** Osztott damage (355.14): a kiosztás a resolve-kor dől el (355.14.e); ha kevesebb a damage, mint a célpont, legfeljebb annyi célpont eshet ki, hogy ne legyen kevesebb célpont, mint damage (355.14.h, 355.14.h.1). */
  X.splitRun=(x:any,prev:any)=>{const refs0=['355.14'];const legalT:number[]=[];
    x.tis.forEach((ti:number)=>{const v=X.it0.tg[ti];if(!v)return;X.tot0.n++;const w=X.tgWhy(X.it0,X.it0.list[ti],v,ti,'res');if(w.length){X.tgOut0[ti]='ign';X.mtT0.push({n:X.O[v].name,ok:false,why:w.join(', ')});if(X.O[v].zone==='board')X.MTIDS.add(v);}else{legalT.push(ti);X.tgOut0[ti]='ok';X.mtT0.push({n:X.O[v].name,ok:true});X.legal0.n++;}});
    let T:number|null=x.act.n;if(x.act.k==='dmgM'){const pv=prev?prev.tis.map((ti:number)=>X.it0.tg[ti]).find((v:string)=>v&&X.O[v]&&X.O[v].zone==='board'):null;T=pv?X.mightOf(pv):null;}
    if(T==null){x.st='ignored';x.ref='359.3.e.12';x.why='a szétosztandó damage értéke nem elérhető';return;}
    const b=X.bonusDmg(X.it0.pl);if(b){T+=b;refs0.push('715.3');}
    if(!legalT.length){x.st='ignored';x.ref='359.3.e.6';x.why='minden célpontja illegális';return;}
    const need=Math.min(T,legalT.length);const sp=(X.it0.s&&X.it0.s.split)||{};
    const asg:any={};legalT.forEach((ti:number)=>{const a=+sp[ti]||0;if(a>0)asg[ti]=a;});const keys=Object.keys(asg).map(Number);const sum=keys.reduce((q,k)=>q+asg[k],0);
    let why='';if(!keys.length)why='nincs megadva kiosztás';else if(sum!==T)why='a megadott kiosztás összege '+sum+', de a szétosztandó damage '+T;else if(keys.length<need)why='csak '+keys.length+' célpont kapna damage-et, de nem lehet kevesebb célpont, mint damage ('+need+', 355.14.h.1)';
    if(why){const kept=legalT.slice(0,need);kept.forEach((ti:number)=>{asg[ti]=0;});Object.keys(asg).forEach(k=>{if(!kept.includes(+k))delete asg[k];});kept.forEach((ti:number,i:number)=>{asg[ti]=1+(i===0?T!-need:0);});
      X.parts0.push('Osztott damage: '+T+' damage, '+legalT.length+' legális célpont. '+esc(why)+'; a kiosztást a játékos dönti el (355.14.e), az elemzés javaslata: '+kept.map((ti:number)=>esc(X.O[X.it0.tg[ti]].name)+' '+asg[ti]).join(', ')+'.');}
    else X.parts0.push('Osztott damage: '+T+' damage a builderben megadott kiosztás szerint.');
    if(legalT.length>T)refs0.push('355.14.h','355.14.h.1');
    legalT.forEach((ti:number)=>{const v=X.it0.tg[ti];if(!asg[ti]){X.parts0.push(esc(X.O[v].name)+' nem kap damage-et, kiesik a célpontok közül (355.14.h).');return;}const d=X.dealDmg(v,asg[ti],X.parts0,refs0);if(d>0){X.it0.hit=(X.it0.hit||[]).concat([v]);X.story.push(Art(X.it0.name||X.it0.label)+' '+d+' damage-et oszt '+art(X.O[v].name)+' lapra (osztott damage).');}});
    refs0.forEach(r=>X.refs1.push(r));x.st=legalT.length<x.tis.filter((ti:number)=>X.it0.tg[ti]).length?'partial':'executed';x.ref='355.14';x.why=x.st==='partial'?'csak a legális célpontokra':'';};
  X.it0=null;X.parts0=[];X.refs1=[];X.tgOut0=[];X.mtT0=[];X.tot0={n:0};X.legal0={n:0};
  X.INRES=false;
  X.resolveItem=(it:any)=>{const rec0=X.REC.length;const all0=X.ALL.length;const ir0=X.INRES;X.INRES=true;try{X.resolveItem0(it);}finally{X.INRES=ir0;
      /* az elem saját sora kerüljön előre a "Mi változott?" listában, utána a közben történt mellékhatások (leválás, kontroll) */
      if(X.REC.length>rec0+1&&X.ALL.length>all0+1){const a=X.REC.pop();X.REC.splice(rec0,0,a);const b=X.ALL.pop();X.ALL.splice(all0,0,b);}}};
  X.resolveItem0=(it:any)=>{it.rdBefore=X.runeDeckOf(it.pl);it.ev0=X.EV.length;const s=it.s||null;const perm=!!it.perm;const self=it.objId?X.O[it.objId]:null;const srcName=it.name||it.label;
    const head='<b>'+esc(srcName)+'</b>'+(perm?' play triggere':it.kind==='auto'?' ('+esc(it.why)+')':'')+' resolve-ol. ';
    if(self&&self.zone==='countered'){if(self.toHand){self.zone='hand';self.zone0='countered';}const pt=it.kind==='step'&&s&&s.k==='card'?X.playTrigs(s):[];X.rr+=X.line('426.1'+(pt.length?', 420.4.a.1, 426.1.b':''),head+(self.type==='ability'?'Counterelték: nem csinál semmit, lekerül a chainről és megszűnik.':'Counterelték: nem csinál semmit, '+(self.toHand?'a tulajdonosa kezébe kerül':'a trashbe kerül')+', a költség nem jár vissza, és nem számít kijátszottnak.')+(pt.length?' Ezért nem triggerel: '+pt.map((tr:any)=>esc(tr.label)).join(', ')+'.':''),0);X.story.push(Art(srcName)+' sorra kerülne, de counterelték: nem történik semmi.');X.done.push({name:srcName,pl:it.pl,res:'countered'});X.out.items.push({name:srcName,res:'countered',instr:[],targets:[]});return;}
    if((it.kind==='auto'&&it.why==='Deathknell'&&it.sent===false)||(it.isTg&&it.dk&&!it.sent)){X.rr+=X.line('808.1.d.1, 808.1.d',head+'A forrás nem került a trashbe (nem halt meg), ezért a trigger lekerül a chainről.',0);X.done.push({name:it.label,pl:it.pl,res:'removed'});X.out.items.push({name:it.label,res:'removed',instr:[],targets:[]});return;}
    if(it.kind==='auto'&&it.why==='Deathknell'&&it.sent&&X.O[it.src]&&X.O[it.src].zone!=='trash')X.rr+=X.line('808.1.d.1, 808.1.d','<b>'+esc(srcName)+'</b>: a forrás a trashbe került, de onnan a resolve előtt elmozdult. A trigger ettől még lefut, mert a 808.1.d.1 csak azt az esetet nevezi meg, amikor a lap nem kerül a trashbe.',1);
    let t=head;let fl=it.kind==='auto'?1:0;const refs=['340.1'];
    if(perm&&self&&self.zone!=='board'){X.story.push(Art(srcName)+' már nincs a boardon, de a play triggere a chainen maradt, ezért lefut.');t+='A forrás már nincs a boardon, de a trigger független objektum, ezért lefut (355.9.c). A forrásra vonatkozó információ ("me", "here", "my") a végrehajtáskor nem elérhető, az erre épülő utasítás Ignored (359.3.f.2, 359.3.e.6). ';fl=1;}
    if(it.endTrig&&it.src&&X.O[it.src]&&!['board','legend'].includes(X.O[it.src].zone)){t+='A forrás már nincs a boardon, de a trigger feltétele a triggereléskor teljesült, ezért a trigger lefut (383.2.a.1). ';refs.push('383.2.a.1');}
    if(it.kind==='step'&&s.k==='ab'&&it.src&&X.O[it.src]&&!['board','legend'].includes(X.O[it.src].zone)){t+='Az ability forrása már nincs a boardon, de az ability ettől még lefut (355.9.c). ';fl=1;}
    const INS=it.kind==='step'?interp(s,s):interp({},{eff:it.eff,list:it.list&&it.list.length?it.list:phrasesTxt(it.eff||''),c:it.src&&X.O[it.src]?X.O[it.src].card:null});X.MAN=INS.some((x:any)=>x.manual);if(it.pre&&it.pre.length&&INS[0])INS[0].lk=true;
    const parts:string[]=[];let legal=0,tot=0;const tgOut:any[]=[];const mtT:any[]=[];let lastT:any=null;if(it.pre&&it.pre.length){const base=(it.tg||[]).length;it.tg=(it.tg||[]).concat(it.pre);it.list=(it.list||[]).concat(it.pre.map((v:string)=>({type:X.O[v]?X.O[v].type:'unit',rel:'any',max:null,bf:false,opt:true,pre:true})));it.pre.forEach((_:any,i:number)=>{tgOut[base+i]='ok';});lastT={tis:it.pre.map((_:any,i:number)=>base+i),st:'executed',act:{k:'pre'},t:'(a delayed hatás létrehozásakor megjelölt célpont)'};}X.it0=it;X.parts0=parts;X.refs1=refs;X.tgOut0=tgOut;X.mtT0=mtT;
    const runTarget=(x:any,ti:number)=>{const p=it.list[ti];const v=it.tg[ti];if(!v)return;tot++;if(v==='F0'||v==='F1'){legal++;tgOut[ti]='ok';return;}const ob=X.O[v];
      const wS=X.tgWhy(it,p,v,ti,'res');
      if(wS.length){tgOut[ti]='ign';mtT.push({n:ob.name,ok:false,why:wS.join(', ')});if(ob.zone==='board')X.MTIDS.add(v);X.EV.push({k:'mistarget',id:v,name:ob.name,item:srcName});
        parts.push('<span class="stbad">'+(ti+1)+'. célpont illegális</span> ('+esc(ob.name)+' '+wS.join(', ')+'): mistarget, rá a hatás elmarad (359.3.e.2, 359.3.e.5).');refs.push('359.3.e.9');X.story.push(Art(srcName)+(perm?' triggere':'')+' sorra kerül, de '+(it.list.length>1?((ti===0||ti===4)?'az ':'a ')+(ti+1)+'.':'a')+' célpontja ('+ob.name+') '+wS.join(', ').replace(/ \([0-9.,a-z ]+\)/g,'')+': mistarget, rá a hatás elmarad.');return;}
      legal++;mtT.push({n:ob.name,ok:true});const xa=x.act;if(it.prot758&&it.prot758.length){parts.push([...new Set(it.prot758)].join(' ')+'.');refs.push(/758\.2\.a/.test(it.prot758.join(''))?'758.2.a':'758.2');it.prot758=[];}
      if(xa.k==='counter'&&ob.type==='spell'&&xa.unless&&it.pays){tgOut[ti]='neg';parts.push(esc(ob.name)+' irányítója kifizeti a kért költséget, ezért a counter nem történik meg.');X.story.push(Art(srcName)+' lefut, de '+art(ob.name)+' gazdája kifizeti a kért költséget, így a spell marad.');return;}
      if(['draw','channel','discard','choose','deck','xp','score','pay','showoff','fight','win','perm'].includes(xa.k)){tgOut[ti]='ok';if(xa.k==='choose')parts.push(esc(ob.name)+' kiválasztva.');return;}
      if(xa.k==='note'||xa.k==='copy'){tgOut[ti]='ok';if(!x.noted){x.noted=1;parts.push((xa.open?'<span class="cbuns">nyitott kérdés</span> ':'')+esc(ob.name)+': "'+esc(x.t)+'": '+esc(xa.d||'')+(xa.refs?' ('+xa.refs+')':'')+'.');if(xa.refs)xa.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));}fl=Math.max(fl,xa.open?2:1);return;}
      if(xa.k==='other'||xa.k==='delayed'||xa.k==='playcard'||xa.k==='replay'||xa.k==='token'){tgOut[ti]='ok';parts.push(esc(ob.name)+': "'+esc(x.t)+'" lefut, ezt az elemzés nem követi részletesen.');fl=Math.max(fl,1);return;}
      const r=X.applyTo(v,Object.assign({t:x.t},xa),it,parts,refs);tgOut[ti]=r==='neg'?'neg':r==='ign'?'ign':'ok';if(r==='ign')legal--;};
    // Bellows Breath típus: "at the same location" csoport a resolve-kor (355.11.b, 355.11.b.1)
    if(it.list.some((p:any)=>p.same)){const live=it.tg.map((v:string,ti:number)=>v&&X.O[v]&&X.O[v].zone==='board'?{v,ti,loc:X.O[v].loc}:null).filter(Boolean);const groups:any={};live.forEach((x:any)=>{(groups[x.loc]=groups[x.loc]||[]).push(x);});const keys=Object.keys(groups);
      if(keys.length>1){keys.sort((a,b)=>groups[b].length-groups[a].length);const keep=keys[0];
        parts.push('A célpontok már nem állnak egy locationön, ezért '+WHO[it.pl]+' választ egy legális részhalmazt (355.11.b). A részhalmaznak az adott locationön álló összes eredeti célpontot tartalmaznia kell (355.11.b.1), de bármelyik location választható: '+keys.map(k=>esc(X.locLabel(k))+': '+groups[k].map((x:any)=>esc(X.O[x.v].name)).join(', ')).join('; vagy ')+'. Az elemzés ezt számolja: '+esc(X.locLabel(keep))+'; a másik választással a hatás a másik csoportra jutna.');refs.push('355.11.b','355.11.b.1');
        live.forEach((x:any)=>{if(x.loc!==keep){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});}}
    // Összesített Might megkötés (Fox-Fire, 355.11.b): ha a megmaradt célpontok együtt már nem felelnek meg, legális részhalmaz kell
    const tmP=it.list.find((p:any)=>p.totalMax!=null);
    if(tmP){const live=it.tg.map((v:string,ti:number)=>v&&X.O[v]&&X.O[v].zone==='board'&&X.O[v].loc!=='base'&&!(it.dropT&&it.dropT.has(ti))?{v,ti,m:X.mightOf(v)||0}:null).filter(Boolean);const sum=live.reduce((a:number,x:any)=>a+x.m,0);
      if(sum>tmP.totalMax){let keep:any[];const sub=s&&Array.isArray(s.sub)?s.sub.map(Number):null;const subL=sub?live.filter((x:any)=>sub.includes(x.ti)):null;
        if(subL&&subL.length&&subL.reduce((a:number,x:any)=>a+x.m,0)<=tmP.totalMax){keep=subL;parts.push('A célpontok együttes Mightja ('+sum+') már nagyobb, mint '+tmP.totalMax+', ezért '+WHO[it.pl]+' a lapnál megadott legális részhalmazt választja: '+keep.map((x:any)=>esc(X.O[x.v].name)+' ('+x.m+')').join(', ')+' (355.11.b).');}
        else{keep=[];let acc=0;live.slice().sort((a:any,b:any)=>a.m-b.m||a.ti-b.ti).forEach((x:any)=>{if(acc+x.m<=tmP.totalMax){keep.push(x);acc+=x.m;}});keep.sort((a:any,b:any)=>a.ti-b.ti);
          parts.push('A célpontok együttes Mightja ('+sum+') már nagyobb, mint '+tmP.totalMax+', ezért '+WHO[it.pl]+' az eredeti célpontok egy legális részhalmazát választja (355.11.b). '+(sub?'A lapnál megadott részhalmaz nem legális, ezért ':'')+'Feltételezés: a lehető legtöbb célpont marad ('+keep.map((x:any)=>esc(X.O[x.v].name)+' '+x.m+' Might').join(', ')+'); a részhalmaz a lapnál választható. Új, eredetileg nem választott unit nem kerülhet bele.');}
        refs.push('355.11.b');live.forEach((x:any)=>{if(!keep.includes(x)){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});
        X.story.push(Art(srcName)+' célpontjai együtt már '+sum+' Mightúak, ezért csak egy legális részhalmazukra hat ('+keep.map((x:any)=>X.O[x.v].name).join(', ')+').');}}
    const runT0=runTarget;const runTargetX=(x:any,ti:number)=>{if(it.dropT&&it.dropT.has(ti)){tot++;tgOut[ti]='ign';mtT.push({n:X.O[it.tg[ti]].name,ok:false,why:'kimarad a választott részhalmazból (355.11.b)'});return;}runT0(x,ti);};
    // "If ..., X instead": a feltétel teljesülése esetén az előző utasítás helyett ez hajtódik végre (369.1)
    INS.forEach((x:any,xi:number)=>{if(x.act.k==='counterToHand'){const b=INS.slice(0,xi).reverse().find((y:any)=>y.act.k==='counter');if(b){b.act=Object.assign({},b.act,{toHand:true});x.prep='a counterelt spell a kézbe kerül';}}
      if(x.act.k==='bonusTrashName'){const b=INS.slice(0,xi).reverse().find((y:any)=>y.act.k==='dmg');const fv=s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!==''?+s.hv[xi]:0;const nm2=(it.s&&it.s.c&&it.s.c.n)||'';const tc=Object.values(X.O).filter((o:any)=>o.zone==='trash'&&o.own===it.pl&&o.card&&o.card.n===nm2&&o.id!==it.objId).length;
        if(b){b.act=Object.assign({},b.act,{bonus:fv+tc});x.prep='Bonus Damage: '+(fv+tc)+' ('+fv+' a lapnál megadott korábbi, '+tc+' ebben az elemzésben a trashbe került példány)';}}});
    INS.forEach((x:any,xi:number)=>{if(!x.act.alt)return;let pi=xi-1;while(pi>=0&&INS[pi].act.alt)pi--;const base=INS[pi];if(!base)return;
      const tv=base.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]);const cv=X.evalCond(x.act.cond,it,s,xi,tv);x.cv=cv;
      if(cv===true){base.act=Object.assign({},x.act,{alt:false,cond:null});base.altBy=x.t;x.altUsed=true;}});
    INS.forEach((x:any,xi:number)=>{
      const dir=x.dir;const lk=x.lk;const prev=lk?lastT:null;
      if(x.det.unsure&&!x.manual){parts.push('<span class="cbuns">bizonytalan</span> "'+esc(x.t)+'": '+esc(x.det.unsure)+'.');fl=Math.max(fl,1);}
      if(x.act.alt){x.st=x.altUsed?'executed':'skipped';x.ref='369.1';x.why='a feltétel ("'+x.act.cond.t+'") '+(x.altUsed?'teljesül':'nem teljesül')+' '+X.condSrc(x.act.cond)+(x.altUsed?', ezért ez hajtódik végre az előző utasítás helyett':', ezért az eredeti utasítás marad');
        parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');if(x.act.cond.how==='hidden'&&x.act.cond.from==='default')fl=Math.max(fl,1);return;}
      const cf=/^if you played this from your hand\b/i.test(x.t)?(it.from||'hand')==='hand':/^if you paid the additional cost\b/i.test(x.t)?!!(s&&s.addc):null;
      if(cf===false){x.st='skipped';x.ref='135.2.b.7';x.why='a feltétel ("'+x.t.split(',')[0]+'") nem teljesül, a resolve-kor ellenőrizve';return;}
      if(x.act.otherwise){const pc=INS.slice(0,xi).reverse().find((y:any)=>y.act.cond&&!y.act.otherwise&&y.cv!=null);
        if(pc&&pc.cv===true){x.st='skipped';x.ref='135.2.b.5.a';x.why='az előző feltétel ("'+pc.act.cond.t+'") teljesült, ezért az "Otherwise" ág nem hajtódik végre';parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');return;}
        if(pc)parts.push('"'+esc(x.t)+'": az előző feltétel ("'+esc(pc.act.cond.t)+'") nem teljesült, ezért az "Otherwise" ág hajtódik végre.');}
      const cd=x.act.cond;if(cd&&cd.how!=='known'&&!(prev&&prev.st==='ignored')){const tv=lastT?lastT.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]):null;const cv=X.evalCond(cd,it,s,xi,tv);x.cv=cv===null?true:cv;
        if(cd.how==='open'){fl=2;parts.push('<span class="cbuns">nyitott kérdés</span> ('+esc(cd.refs||'')+')');}
        if(cd.from==='zone'){parts.push('"'+esc(x.t)+'": a feltétel ("'+esc(cd.t)+'") '+(cv?'teljesül':'nem teljesül')+' '+X.condSrc(cd)+'.');if(cd.tie){fl=2;parts.push('<span class="cbuns">nyitott kérdés</span>');}}
        if(cv===false){x.st='skipped';x.why='a feltétel ("'+cd.t+'") nem teljesül '+X.condSrc(cd);parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');if(cd.how==='hidden'&&cd.from==='default')fl=Math.max(fl,1);return;}
        if(cv==null){parts.push('"'+esc(x.t)+'": a feltétel ("'+esc(cd.t)+'") az adott helyzetben nem értékelhető ki (nincs hozzá célpont vagy forrás); az elemzés teljesültnek veszi.');fl=Math.max(fl,1);}
        else parts.push('"'+esc(x.t)+'": a feltétel ("'+esc(cd.t)+'") teljesül '+esc(X.condSrc(cd))+'.');}
      if(x.act.k==='reflex'&&!(prev&&prev.st==='ignored')&&!(prev&&prev.st==='negated'&&dir)){x.st='executed';x.ref='388';
        let times=1;const tm=/do this (\w+) times/i.exec(x.t);if(tm)times=numOf(tm[1]);
        if(/for each unit this kills/i.test(x.t)){times=(it.hit||[]).filter((v:string)=>X.lethal(v)||X.O[v].zone==='trash').length;x.why='reflexív trigger, annyiszor kerül a chainre, ahány unitot ez megölt ('+times+'; a lethal damage-es unitok a következő cleanupban halnak meg, 429.5.c)';}
        else x.why='reflexív trigger ("do this"), külön chain elemként kerül a chainre (388.1)';
        if(x.act.cond&&x.act.cond.how!=='known'){const cv=X.evalCond(x.act.cond,it,s,xi,null);if(cv===false){times=0;x.why='a reflexív trigger feltétele nem teljesül';}}
        for(let q=0;q<times;q++)X.pushTrig({kind:'auto',label:srcName+' reflexív triggere',name:srcName+' reflexív triggere',src:it.src,pl:it.pl,eff:x.act.body,why:'do this',list:x.tis.map((ti:number)=>it.list[ti]),tg:x.tis.map((ti:number)=>it.tg[ti]),from:it.from,loc:it.loc,perm:false});
        parts.push('Reflexív trigger: "'+esc(x.act.body)+'"'+(times!==1?' ('+times+' alkalommal)':'')+' a chainre kerül, és ez után resolve-ol (388, 388.1).');refs.push('388');if(x.tis.length)lastT=x;return;}
      if(x.act.field)x.act.fv=s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!==''?s.hv[xi]:x.act.field.def;
      /* az eldobott lap a pályás építőben kiválasztva: a rejtett adat helyett a lap tényleges értéke */
      if(x.act.field&&x.act.hidden&&/eldobott lap/i.test(x.act.field.label||'')&&it.zDisc&&X.O[it.zDisc]&&!(s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!=='')){const dc=X.O[it.zDisc].card;x.act=Object.assign({},x.act,{fv:x.act.field.type==='num'?(dc.e!=null&&dc.e!==''?+dc.e:0):String(dc.t).toLowerCase()});parts.push('Az eldobott lap: '+esc(dc.n)+' ('+(x.act.field.type==='num'?'Energy költség '+x.act.fv:dc.t)+'), a kézből kiválasztva.');}
      if(x.act.fromPrev&&prev){const pv=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]);x.act=Object.assign({},x.act,{fv:pv&&X.O[pv].card&&X.O[pv].card.e!=null?+X.O[pv].card.e:0});if(pv)parts.push(esc(X.O[pv].name)+' Energy költsége: '+x.act.fv+'.');}
      if(x.act.k==='attachOrDetach')x.act=Object.assign({},x.act,{k:x.act.fv||'detach'});
      if(x.act.k==='might'&&x.act.onlyThere)x.act=Object.assign({},x.act,{k:'mightOnlyThere'});
      if(x.act.k==='raiseTo'&&prev)it.raiseBase=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]&&X.O[v].zone==='board')||null;
      if(x.act.k==='payChoice'){x.st=x.act.fv==='1'?'executed':'skipped';x.why=x.act.fv==='1'?'kifizetve':'nem fizette ki (a lapnál állítható, alap: nem)';it.paid=x.act.fv==='1';parts.push('"'+esc(x.t)+'": '+x.why+'.');lastT=lastT;return;}
      if(x.act.k==='counterOtherwise'){const tv=INS.slice(0,xi).flatMap((y:any)=>y.tis).map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]&&X.O[v].type==='spell');
        if(it.paid){x.st='skipped';x.why='a költséget kifizette, ezért nincs counter';parts.push('"'+esc(x.t)+'": '+x.why+'.');return;}
        if(tv&&X.O[tv].zone==='chain'){X.O[tv].zone='countered';X.EV.push({k:'counter',id:tv,name:X.O[tv].name});parts.push(esc(X.O[tv].name)+' counterelve (426.1).');refs.push('426.1');x.st='executed';}else{x.st='ignored';x.ref='359.3.e.6';x.why='a spell már nincs a chainen';}return;}
      if((x.act.k==='attach2'||x.act.k==='attachTo')&&!(prev&&prev.st==='ignored')){const own=x.tis.map((ti:number)=>it.tg[ti]).filter(Boolean);const pv=prev?prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]&&X.O[v].type==='unit'&&X.O[v].zone==='board'):null;
        const G=own.map((v:string)=>X.O[v]).find((o:any)=>o&&o.type==='gear'&&o.zone==='board');const U=x.act.k==='attach2'?own.map((v:string)=>X.O[v]).find((o:any)=>o&&o.type==='unit'&&o.zone==='board'):(pv?X.O[pv]:null);
        x.tis.forEach((ti:number)=>{if(it.tg[ti]){tot++;legal++;tgOut[ti]='ok';mtT.push({n:X.O[it.tg[ti]].name,ok:true});}});
        if(!G||!U){x.st=G||own.length?'ignored':'executed';x.why=G?'nincs érvényes unit':'nincs választott Equipment';parts.push('"'+esc(x.t)+'": '+x.why+'.');lastT=x;return;}
        if(G.on===U.id){x.st='negated';x.ref='359.3.e.6';x.why='már ezen a uniton van (435.1.g)';parts.push(esc(G.name)+' már '+esc(U.name)+' lapon van (435.1.g).');lastT=x;return;}
        const from=G.on;G.on=U.id;G.loc=U.loc;X.EV.push({k:'attach',id:G.id,name:G.name,to:U.id});parts.push(esc(G.name)+' csatolva: '+esc(U.name)+(from&&X.O[from]?' (leválik '+esc(X.O[from].name)+' lapról, 435.1.f)':'')+' (435).');refs.push('435');x.st='executed';lastT=x;return;}
      if(x.act.k==='mightFromSpell'&&prev){const pts=prev.tis.map((ti:number)=>it.tg[ti]).filter(Boolean);const U=pts.map((v:string)=>X.O[v]).find((o:any)=>o&&o.type==='unit'&&o.zone==='board');const SP=pts.map((v:string)=>X.O[v]).find((o:any)=>o&&o.type==='spell');
        if(!U||!SP){x.st='ignored';x.ref='359.3.e.14.a';x.why='a unit vagy a spell nem érvényes';return;}const n=+(SP.card&&SP.card.e||0);const b0=X.mightOf(U.id);U.mods.push({n});X.EV.push({k:'might',id:U.id,name:U.name,from:b0,to:X.mightOf(U.id)});parts.push(esc(U.name)+' +'+n+' Might ('+esc(SP.name)+' nyomtatott Energy költsége, 206).');x.st='executed';return;}
      if(x.act.k==='dmgKw'&&x.act.who==='linked'&&prev)it.kwSrc=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]&&X.O[v].zone==='board')||null;
      if(x.act.k==='swapMight'&&x.tis.length===2&&!(prev&&prev.st==='ignored')){const vs=x.tis.map((ti:number)=>it.tg[ti]);
        const bad=x.tis.filter((ti:number)=>!it.tg[ti]||X.tgWhy(it,it.list[ti],it.tg[ti],ti,'res').length);x.tis.forEach((ti:number)=>{if(it.tg[ti]){tot++;if(!bad.includes(ti)){legal++;tgOut[ti]='ok';mtT.push({n:X.O[it.tg[ti]].name,ok:true});}else{tgOut[ti]='ign';mtT.push({n:X.O[it.tg[ti]].name,ok:false,why:'illegális célpont'});}}});
        if(bad.length){x.st='ignored';x.ref='359.3.e.6';x.why='a két unit közül legalább egy illegális célpont';lastT=x;return;}
        const m1=X.mightOf(vs[0]),m2=X.mightOf(vs[1]);if(m1==null||m2==null){x.st='ignored';x.ref='359.3.e.12';x.why='a Might nem ismert';lastT=x;return;}
        X.O[vs[0]].mods.push({n:m2-m1});X.O[vs[1]].mods.push({n:m1-m2});X.EV.push({k:'might',id:vs[0],name:X.O[vs[0]].name,from:m1,to:m2});X.EV.push({k:'might',id:vs[1],name:X.O[vs[1]].name,from:m2,to:m1});
        parts.push(esc(X.O[vs[0]].name)+' és '+esc(X.O[vs[1]].name)+' Mightja felcserélődik ebben a körben: '+m1+' ↔ '+m2+' (434.1).');refs.push('434.1');x.st='executed';lastT=x;return;}
      if(x.act.split&&x.tis.length&&!(prev&&prev.st==='ignored')){X.tot0.n=0;X.legal0.n=0;X.splitRun(x,prev);tot+=X.tot0.n;legal+=X.legal0.n;lastT=x;return;}
      if(prev&&(prev.st==='ignored')){x.st='ignored';x.ref='359.3.e.14.a';x.why='linked instruction, a korábbi utasítás Ignored lett, ezért ez is Ignored';
        if(x.act.split&&x.act.k==='dmgM'){x.ref='359.3.e.12, 359.3.e.14.a';x.why='a szétosztandó damage a kiválasztott unit Mightja, de az a unit már nem érvényes célpont, így a Mightja null (359.3.e.12); az erre épülő utasítás Ignored';}
        x.tis.forEach((ti:number)=>{const v=it.tg[ti];if(v){tot++;tgOut[ti]='ign';mtT.push({n:X.nm(v),ok:false,skip:true,why:'a linked instruction Ignored, ezért rá sem hat'});}});}
      else if(dir&&xi>0&&INS[xi-1].act.k==='payChoice'&&INS[xi-1].st==='skipped'){x.st='skipped';x.ref='359.3.e.14.b';x.why='az előző utasítás (a költség kifizetése) nem történt meg, ezért ez sem';parts.push('"'+esc(x.t)+'": '+x.why+'.');}
      else if(prev&&prev.st==='negated'&&dir){x.st='skipped';x.ref='359.3.e.14.b';x.why='közvetlenül a korábbi game actionre hivatkozik ("if you do"), az pedig Negated lett, ezért nem hajtódik végre';}
      else if(x.tis.length){if(prev&&x.act.k==='mightEq'){const lv=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]);it.lkMight=lv?(X.O[lv].lk&&X.O[lv].lk.m!=null&&X.O[lv].zone!=='board'?X.O[lv].lk.m:X.mightOf(lv)):null;}
        x.tis.forEach((ti:number)=>runTargetX(x,ti));const ch=x.tis.filter((ti:number)=>tgOut[ti]);const ig=ch.filter((ti:number)=>tgOut[ti]==='ign').length,ng=ch.filter((ti:number)=>tgOut[ti]==='neg').length;
        if(!ch.length){x.st='executed';x.why='nincs választott célpont';}
        else if(ig===ch.length){x.st='ignored';x.ref=ch.length>1?'359.3.e.6, 359.3.e.7':'359.3.e.6';x.why='minden célpontja illegális (mistarget) vagy a szükséges információ nem elérhető';}
        else if(ng===ch.length-ig&&ng){x.st='negated';x.ref='359.3.e.6';x.why='a célpont legális, de a game action nem hajtható végre vagy helyettesítődik';}
        else if(ig){x.st='partial';x.ref='359.3.e.8';x.why='csak a legális célpontokra hat';}
        else{x.st='executed';x.why='';}}
      else{x.st='executed';
        if(prev&&prev.st==='negated'){x.ref='359.3.e.14.b';x.why='linked instruction, a korábbi Negated lett, de erre nem hat (nem hivatkozik közvetlenül a game actionre)';}
        else if(prev&&prev.st==='partial'){x.ref='359.3.e.14.a';x.why='linked instruction: csak a legális célpontokra vonatkozik';}
        else if(!lk&&INS.some((y:any,yi:number)=>yi<xi&&y.st==='ignored')){x.ref='359.3.e.5';x.why='nem linked, ezért a korábbi mistarget ellenére végrehajtódik';}
        let live=prev?prev.tis.filter((ti:number)=>it.tg[ti]&&tgOut[ti]&&tgOut[ti]!=='ign'&&X.O[it.tg[ti]]):[];
        if(/\bthe friendly unit\b/i.test(x.t))live=live.filter((ti:number)=>X.O[it.tg[ti]].ctrl===it.pl);else if(/\bthe enemy unit\b/i.test(x.t))live=live.filter((ti:number)=>X.O[it.tg[ti]].ctrl&&X.O[it.tg[ti]].ctrl!==it.pl);
        const a=x.act;const sc=allScope(x.t);
        const zr0=X.ZC&&s?zoneRefOf(x.t,s.c&&s.c.n):null;
        const zEach=zr0&&zr0.who==='each'?zr0:null;
        const zpick=zr0&&!zEach?(s.zp&&s.zp[xi]&&s.zp[xi].length?s.zp[xi]:zr0.z==='deck'&&zr0.top?X.zoneIds('deck',zr0.who==='they'?other(it.pl):it.pl).slice(0,zr0.n):null):null;
        const amongIt=X.ZC&&INS.some((y:any)=>{const z=zoneRefOf(y.t);return z&&z.z==='among';});
        const zTopUse=X.ZC&&it.zTop&&!amongIt&&/\b(?:draw it|put it (?:in|into) your hand)\b/i.test(x.t)&&X.O[it.zTop]&&X.O[it.zTop].zone==='deck';
        const restM=X.ZC&&it.zLook&&it.zLook.length&&!(zr0&&zr0.z==='among'&&zpick&&zpick.length)&&/\b(?:the rest|the remaining cards)\b/i.test(x.t);
        const eachOn=zEach&&(zEach.act==='revealEach'?X.zoneIds('deck','A').length>0&&X.zoneIds('deck','B').length>0:!!(s&&s.zp&&s.zp[xi]&&s.zp[xi].length));
        if(eachOn){/* minden játékos a saját lapjai közül (355.10.e, 412.1); a választás a resolve-kor (355.18) */
          const ze=zEach as ZoneRef;const turnP=X.CS.turn||it.pl;
          if(ze.act==='revealEach'){const tops:any={A:X.zoneIds('deck','A')[0],B:X.zoneIds('deck','B')[0]};it.zEachTop=tops;it.zLook=[tops.A,tops.B];it.zTop=tops[it.pl];
            parts.push('"'+esc(x.t)+'": felfedve (nyilvános, 128.5): '+['A','B'].map((p:string)=>WHOC[p]+': '+esc(X.O[tops[p]].name)+' ('+printedCost(X.O[tops[p]].card).e+' Energy)').join('; ')+'; a deck felső lapjai a pályás építőben megadva (108.4.e).');refs.push('128.5','108.4.e');}
          else if(ze.act==='banishEach'){const ids=s.zp[xi];const ch:any={};const bad:string[]=[];const looks:any={A:X.zoneIds('deck','A').slice(0,ze.n),B:X.zoneIds('deck','B').slice(0,ze.n)};
            ids.forEach((id:string)=>{const ob=X.O[id];if(!ob||!ob.card){bad.push('a kiválasztott lap már nincs a helyzetben');return;}const p=ob.own;if(!looks[p].includes(id)){bad.push(ob.name+' nincs '+WHO[p]+' felső '+ze.n+' lapja között');return;}if(ch[p]){bad.push(WHOC[p]+' csak egy lapot banishelhet');return;}ch[p]=id;});
            it.zLook=[...looks.A,...looks.B];it.zEach=ch;
            ['A','B'].forEach((p:string)=>{if(ch[p]){X.zcMove(ch[p],'banish');parts.push(WHOC[p]+' banisheli: '+esc(X.O[ch[p]].name)+' (a saját felső '+ze.n+' lapja közül, 412.1).');}else if(looks[p].length)parts.push(WHOC[p]+' választása nincs megadva.');});
            if(bad.length){parts.push('Nem számít: '+esc(bad.join('; '))+'.');fl=Math.max(fl,1);}
            parts.push('Minden játékos a saját megnézett lapjai közül választ, ez nem célpont (355.10.e); a megnézett lapok rejtett adat (128.4).');refs.push('355.10.e','412.1','128.4');}
          else{const ids=s.zp[xi];const cnt:any=ze.counts||{};const ch:any={A:[],B:[]};const bad:string[]=[];
            ids.forEach((id:string)=>{const ob=X.O[id];if(!ob||!ob.card){bad.push('a kiválasztott lap már nincs a helyzetben');return;}const p=ob.type==='zc'?ob.own:ob.ctrl;const k=ob.zone==='hand'?'card':ob.type==='unit'?'unit':ob.type==='gear'?'gear':'';
              if(!k||(ob.zone!=='hand'&&ob.zone!=='board')){bad.push(ob.name+' nem választható (unit, gear vagy kézben lévő lap kell)');return;}
              if(ch[p].filter((x:any)=>x.k===k).length>=(cnt[k]||0)){bad.push(WHOC[p]+' legfeljebb '+(cnt[k]||0)+' '+k+' lapot választhat');return;}ch[p].push({id,k});});
            const keep=new Set([...ch.A,...ch.B].map((x:any)=>x.id));it.zKeep=keep;it.zDivine=true;
            parts.push('"'+esc(x.t)+'": '+['A','B'].map((p:string)=>WHOC[p]+' választása: '+(ch[p].length?ch[p].map((x:any)=>esc(X.O[x.id].name)).join(', '):'nincs megadva')).join('; ')+'. Minden játékos a saját lapjai közül választ, ez nem célpont (355.10.e, 412.1); a kézben választott lap rejtett adat (128.4). A rune-ok választását az elemzés nem követi (a builder csak rune-számot ismer).');refs.push('355.10.e','412.1');
            if(bad.length){parts.push('Nem számít: '+esc(bad.join('; '))+'.');fl=Math.max(fl,1);}}}
        else if(X.ZC&&it.zDivine&&/^recycle the rest\.?$/i.test(x.t)){const keep=it.zKeep;const gone:string[]=[];
          Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(keep.has(id))return;if((ob.type==='unit'||ob.type==='gear')&&ob.zone==='board'){X.leaveBoard(id,'deck');gone.push(ob.name);}else if(ob.type==='zc'&&ob.zone==='hand'){X.zcMove(id,'deck');ob.ord=900+(ob.ord||0);gone.push(ob.name);}});
          parts.push('"'+esc(x.t)+'": '+(gone.length?esc(gone.join(', '))+': recycle, a tulajdonos Main Deckjének aljára (417).':'nincs más lap.'));refs.push('417');}
        else if(X.ZC&&it.zEach&&/^starting with the next player, each player plays those cards/i.test(x.t)){const order=[other(X.CS.turn||it.pl),X.CS.turn||it.pl];
          order.forEach((p:string)=>{const id=it.zEach[p];if(!id||!X.O[id]||X.O[id].zone!=='banish')return;const pc=X.O[id].card;X.zcMove(id,'played');
            if(pc.t==='Unit'||pc.t==='Gear'){const pid='pe'+(s?s.j:'x')+'_'+p;X.O[pid]={id:pid,name:pc.n,card:pc,ctrl:p,own:p,loc:'base',baseOf:p,m:pc.t==='Unit'&&pc.m!=null?+pc.m:null,dmg:0,mods:[],kws:[],zone:'board',type:pc.t==='Unit'?'unit':'gear',ex:pc.t==='Unit'};X.EV.push({k:'enter',id:pid,name:pc.n,loc:'base'});parts.push(WHOC[p]+' kijátssza: '+esc(pc.n)+' (base, Energy költség nélkül; 420.3, 356.1.b.2).');}
            else{X.pushTrig({kind:'auto',label:pc.n+' (hatásból kijátszott spell)',name:pc.n,src:null,pl:p,eff:effOf(pc),why:'kijátszás hatásból',list:[],tg:[],from:'banish'});parts.push(WHOC[p]+' kijátssza: '+esc(pc.n)+' spell a chainre kerül (420.3.b).');}});
          refs.push('420.3','356.1.b.2');}
        else if(amongIt&&it.zAmongDone&&/^(?:then,?\s*)?(?:you may )?draw it\b/i.test(x.t)){parts.push('"'+esc(x.t)+'": a megnézett lapok közül választott lap már a kézbe került (az előző utasítás része).');}
        else if(X.ZC&&it.zAmongCard&&X.O[it.zAmongCard]&&X.O[it.zAmongCard].zone==='deck'&&/^(?:then,?\s*)?(?:you may )?banish it\b/i.test(x.t)){X.zcMove(it.zAmongCard,'banish');parts.push('"'+esc(x.t)+'": '+esc(X.O[it.zAmongCard].name)+' banishelve (108.6).');refs.push('108.6');}
        else if(restM){const rest=it.zLook.filter((id:string)=>X.O[id]&&X.O[id].zone==='deck');const toTrash=/\btrash\b/i.test(x.t);
          rest.forEach((id:string)=>{if(toTrash)X.zcMove(id,'trash');else{X.O[id].ord=900+(X.O[id].ord||0);X.EV.push({k:'zcard',id,name:X.O[id].name,to:'deck'});}});
          parts.push('"'+esc(x.t)+'": '+(rest.length?rest.map((id:string)=>esc(X.O[id].name)).join(', ')+(toTrash?' a trashbe kerül (108.2).':': recycle, a Main Deck aljára (417).'):'nincs több megnézett lap.'));refs.push(toTrash?'108.2':'417');}
        else if(zTopUse){const ob=X.O[it.zTop];X.zcMove(ob.id,'hand');X.EV.push({k:'draw',pl:ob.own,n:1});parts.push('"'+esc(x.t)+'": '+esc(ob.name)+' a deckből a kézbe kerül (a deck felső lapja a pályás építőben megadva).');refs.push('414.1');}
        else if(zr0&&zpick&&zpick.length){/* kéz, deck vagy trash lapja (355.9.a, 355.10.a, 355.18): a választott lap végigkövetve */
          const zp=zr0;const okIds:string[]=[];const bad:string[]=[];const who=zp.who==='they'?other(it.pl):it.pl;
          zpick.forEach((id:string)=>{const ob=X.O[id];const w=zp.z==='among'?(!ob||!ob.card?'nincs megadva: a kiválasztott lap már nincs a helyzetben':!(it.zLook||[]).includes(id)?ob.name+' nincs a megnézett lapok között (a deck felső lapjai a pályás építőben megadva)':ob.zone!=='deck'?ob.name+' már nincs a deckben':(()=>{const z=zoneCheck(zp,ob,it.pl,X.zctx(it,s));return z?ob.name+' '+z:'';})()):X.zcWhy(zp,[id],it.pl,true,X.zctx(it,s));const g=it.zpGen&&it.zpGen[id];
            if(!w&&zp.target&&g!=null&&(ob.gen||0)!==g){bad.push(ob.name+' közben elhagyta a trasht és visszakerült, ezért új objektum, már nem az eredeti célpont (359.3.e.4)');return;}
            if(w)bad.push(w);else okIds.push(id);});
          const zhu=zp.z==='trash'?'trashből':zp.z==='hand'?'kézből':zp.z==='among'?'megnézett lapok közül':'deckből';
          if(!okIds.length){
            if(zp.target){x.st='ignored';x.ref='359.3.e.5, 359.3.e.6';x.why='a '+zhu+' választott célpont már nem legális: '+bad.join('; ');zpick.forEach((id:string)=>mtT.push({n:X.O[id]?X.O[id].name:id,ok:false,why:bad.join('; ')}));refs.push('359.3.e.5','359.3.e.6');}
            else{const typed=zp.z!=='trash'&&(zp.type.length>0||zp.tags.length>0);x.st='negated';x.ref='359.3.e.6, 355.18'+(typed?', 128.6.a':'');x.why='a '+zhu+' választás a resolve-kor történik (355.18), de a megadott lap nem választható: '+bad.join('; ')+'; az elemzés helyette nem választ másikat, ezért az utasítás nem hajtódik végre (levezetés: más okból elmaradó utasítás, Negated)'+(typed?'. Nyitott kérdés: a lap típust ír elő egy nem nyilvános zónában, ilyenkor a játékos az utasítást figyelmen kívül hagyhatja, és a 128.6.a ezt "Ignored"-nak nevezi; hogy ez a 359.3.e.6 szerinti Ignored-e, a Core Rules nem dönti el, judge dönt':'');fl=Math.max(fl,typed?2:1);refs.push('355.18','359.3.e.6');if(typed)refs.push('128.6.a');}
            parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');X.story.push(Art(srcName)+': a '+zhu+' választott lap már nem választható, a "'+x.t+'" utasítás elmarad.');}
          else{if(bad.length){x.st='partial';x.ref=zp.target?'359.3.e.8':'359.3.e.11';x.why='csak a még legális lapokra hat ('+bad.join('; ')+')';parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');}
            if(zp.target)parts.push('A '+zhu+' választott lap célpont, mert a trash nyilvános zóna; a lerakáskor kellett kiválasztani (355.10.a, 355.8, 108.2.d).');
            else if(zp.z==='hand')parts.push('A kéz nem nyilvános zóna, ezért a választás nem célpont, a resolve-kor történik; a lapot csak a tulajdonosa látja (355.10.a, 355.18, 128.4).');
            else if(zp.z==='among')parts.push('A megnézett lapokat csak a tulajdonosuk látja, felfedés után nyilvánosak; rejtett adat: a deck felső lapjai a pályás építőben megadott feltételezés (128.4, 128.5, 108.4.e). A választás a resolve-kor történik (355.18).');
            else parts.push('A deck sorrendje titkos információ: a felső lap a pályás építőben megadott feltételezés (108.4.e, 128.3).');
            refs.push(zp.target?'355.10.a':zp.z==='hand'?'355.18':'108.4.e');
            if(zp.cost){const cx=X.zctx(it,s);const vs=[zp.cost.e,zp.cost.p].filter((r:any)=>r&&typeof r[1]==='string').map((r:any)=>COSTVAR[r[1]]+': '+cx[r[1]]+(r[1]==='points'?' (a Játékállapot kezdő pontszáma plusz a lépésekben szerzett pontok; ha nincs megadva, 0)':r[1].startsWith('rel')?' (visszatekintés a költségként megölt unitra, 359.3.e.13)':''));
              parts.push('Költségfeltétel: "'+esc(zp.cost.t)+'", a nyomtatott költség számít (206)'+(vs.length?'; '+vs.join('; '):'')+'.');refs.push('206');}
            okIds.forEach((id:string,k:number)=>{const ob=X.O[id];const mv=(to:string)=>{if(ob.type==='zc')X.zcMove(id,to);else{ob.zone=to;ob.gen=(ob.gen||0)+1;X.EV.push({k:'zcard',id,name:ob.name,to});}};
              const recyc=zp.act==='recycle'||(INS[xi+1]&&/\brecycle (?:them|it)\b/i.test(INS[xi+1].t));
              if(recyc){mv('deck');ob.ord=999;if(INS[xi+1])INS[xi+1].zDone=true;parts.push(esc(ob.name)+': '+zhu+' recycle, a tulajdonosa Main Deckjének aljára kerül (417).');refs.push('417');X.story.push(Art(ob.name)+' a '+zhu+' a deck aljára kerül (recycle).');}
              else if(zp.act==='hand'){mv('hand');if(zp.z==='among'){it.zAmongDone=true;X.EV.push({k:'draw',pl:ob.own,n:1});refs.push('414.1');}parts.push(esc(ob.name)+': '+zhu+' a tulajdonosa kezébe kerül.');X.story.push(Art(ob.name)+' a '+zhu+' kézbe kerül.');}
              else if(zp.act==='choose'){it.zAmongCard=id;parts.push(esc(ob.name)+' kiválasztva a megnézett lapok közül.');}
              else if(zp.act==='banish'){mv('banish');if(zp.z==='among')it.zAmongCard=id;parts.push(esc(ob.name)+' banishelve ('+zhu+').');refs.push('108.6');X.story.push(Art(ob.name)+' banishelve.');}
              else if(zp.act==='discard'){mv('trash');it.zDisc=id;X.EV.push({k:'discard',pl:ob.own,n:1});parts.push(WHOC[ob.own]+' eldobja: '+esc(ob.name)+' (423.1).');refs.push('423.1');X.story.push(WHOC[ob.own]+' eldobja '+art(ob.name)+' lapot.');}
              else if(zp.act==='playcard'){const pc=ob.card;mv('played');const isP=pc.t==='Unit'||pc.t==='Gear';const to=(s&&s.pll&&s.pll[xi])||(/\bhere\b/i.test(x.t)?X.srcLoc(it)||'base':'base');refs.push('420.3','420.3.b');
                if(isP){const pid='p'+(s?s.j:'x')+'_'+xi+'_'+k;X.O[pid]={id:pid,name:pc.n,card:pc,ctrl:it.pl,own:ob.own||it.pl,loc:to,baseOf:it.pl,m:pc.t==='Unit'&&pc.m!=null?+pc.m:null,dmg:0,mods:[],kws:[],zone:'board',type:pc.t==='Unit'?'unit':'gear',ex:false};const erP=X.enterReady(pc,it.pl,false,to,undefined,pid);if(pc.t==='Unit')X.O[pid].ex=!erP.ready;X.EV.push({k:'enter',id:pid,name:pc.n,loc:to,from:zp.z});
                  parts.push(esc(pc.n)+' kijátszva hatásból ('+zhu+', '+esc(X.locLabel(to))+'). A '+pc.t.toLowerCase()+' azonnal resolve-ol (337.2)'+(pc.t==='Unit'?(erP.ready?', ready lép be ('+erP.why+')':', exhausted lép be (143.4)'):'')+'.');X.story.push(Art(pc.n)+' a '+zhu+' a boardra kerül: '+X.locLabel(to)+'.');}
                else{X.pushTrig({kind:'auto',label:pc.n+' (hatásból kijátszott spell)',name:pc.n,src:null,pl:it.pl,eff:effOf(pc),why:'kijátszás hatásból',list:[],tg:[],from:zp.z});parts.push(esc(pc.n)+' spell a '+zhu+' a chainre kerül, és később resolve-ol (420.3.b); célpontjait az elemzés nem követi.');}}
              else{if(zp.z==='deck'&&zp.top&&k===0){it.zTop=id;it.zLook=okIds.slice();parts.push((/\breveals?\b/i.test(x.t)?'Felfedett lapok (nyilvánossá válnak, 128.5)':'Megnézett lapok (rejtett adat, csak a tulajdonos látja, 128.4)')+': '+okIds.map((z:string)=>esc(X.O[z].name)).join(', ')+'; a deck felső lapjai a pályás építőben megadva (108.4.e).');}parts.push('"'+esc(x.t)+'": '+esc(ob.name)+(zp.z==='deck'?' (a deck '+(ob.ord+1)+'. lapja)':'')+'.');}});
            if(zp.z==='among'&&/\b(?:the rest|the remaining cards)\b/i.test(x.t)){const rest=(it.zLook||[]).filter((id:string)=>X.O[id]&&X.O[id].zone==='deck');const toTrash=/\btrash\b/i.test(x.t.split(/\b(?:the rest|the remaining cards)\b/i).pop()||'');
              rest.forEach((id:string)=>{if(toTrash)X.zcMove(id,'trash');else{X.O[id].ord=900+(X.O[id].ord||0);X.EV.push({k:'zcard',id,name:X.O[id].name,to:'deck'});}});
              if(rest.length){parts.push(rest.map((id:string)=>esc(X.O[id].name)).join(', ')+(toTrash?' a trashbe kerül (108.2).':': recycle, a Main Deck aljára (417).'));refs.push(toTrash?'108.2':'417');}}
            x.st=x.st==='partial'?'partial':'executed';}}
        else if(a.k==='draw'||a.k==='channel'||a.k==='discard'){let n=a.n!=null?a.n:1;if(a.each&&a.each.cnt){const k=X.countEach(a.each.cnt,it,null);if(k!=null){parts.push('Szorzó: '+k+' ('+esc(a.each.txt)+').');n=n*k;}}const verbs:any={draw:['húz',' lapot','414.1'],channel:['channelöl',' rune-t','431.1'],discard:['eldob',' lapot','423.1']};const vb=verbs[a.k];
          let who:any=it.pl;let whoTxt=it.pl==='A'?'Te':'Az ellenfél';
          if(/\b(its|their) (controller|owner)s?\b/i.test(x.t)){if(prev&&live.length){const ob=X.O[it.tg[live[0]]];const own=/owner/i.test(x.t);who=own?ob.own:(ob.zone==='board'?ob.ctrl:(ob.lk&&ob.lk.ctrl)||ob.own);whoTxt='A célpont '+(own?'tulajdonosa':'irányítója')+' ('+WHO[who]+')';}
            else if(prev&&!live.length){x.st='ignored';x.ref='359.3.e.14.a';x.why='a hivatkozott célpont nem érvényes';who=null;}
            else{who=null;parts.push('A szöveg a célpont '+(/owner/i.test(x.t)?'tulajdonosára':'irányítójára')+' hivatkozik, de nem linked utasításként szerepel, így az elemzés nem tudja, ki '+vb[0]+' '+n+vb[1]+'.');}}
          else if(/^they\b/i.test(x.t)&&prev&&live.length){const ob=X.O[it.tg[live[0]]];who=ob.ctrl;whoTxt=WHOC[who];}
          else if(/^each player\b/i.test(x.t)){X.EV.push({k:a.k,pl:other(it.pl),n});parts.push(WHOC[other(it.pl)]+' '+vb[0]+' '+n+vb[1]+'.');whoTxt='Te'===WHOC[it.pl]?'Te':WHOC[it.pl];}
          if(who){X.EV.push({k:a.k,pl:who,n});parts.push(whoTxt+' '+vb[0]+' '+n+vb[1]+(/for each/i.test(x.t)?' (a "for each" szorzót az elemzés nem számolja)':'')+'.');refs.push(vb[2]);X.story.push(whoTxt+' '+vb[0]+' '+n+vb[1]+'.');}}
        else if(a.k==='counterToHand'||a.k==='bonusTrashName'){parts.push('"'+esc(x.t)+'": '+esc(x.prep||a.d)+' ('+a.refs+').');a.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));}
        else if(a.k==='note'||a.k==='copy'){parts.push((a.open?'<span class="cbuns">nyitott kérdés</span> ':'')+'"'+esc(x.t)+'": '+esc(a.d||'')+(a.field?' ('+esc(a.field.label)+': '+esc(String(a.fv))+')':'')+(a.refs?' ('+a.refs+')':'')+'.');if(a.refs)a.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));fl=Math.max(fl,a.open?2:1);}
        else if(a.k==='dmgAllAt'){const l=it.dest&&it.dest!=='base'?it.dest:'bf0';const n=+(a.fv||0);const vs=Object.keys(X.O).filter(id=>X.O[id].zone==='board'&&X.O[id].type==='unit'&&X.O[id].ctrl!==it.pl&&X.O[id].loc===l);
          parts.push('"'+esc(x.t)+'": '+n+' damage minden enemy unitra itt: '+esc(X.locLabel(l))+' (a kifizetett mennyiség és a battlefield a lapnál állítható).');if(n>0)vs.forEach(v=>X.dealDmg(v,n,parts,refs));}
        else if(a.k==='channelNum'){const n=+(a.fv||0);if(n>0)X.EV.push({k:'channel',pl:it.pl,n});parts.push(WHOC[it.pl]+' channelöl '+n+' rune-t exhausted (a lapnál megadott érték, 431).');refs.push('431');}
        else if(a.k==='tokenPerChoice'){const n=a.fv==='1'?1:0;parts.push('"'+esc(x.t)+'": '+(n?'egy':'nincs')+' Gold token (az ellenfél választása a lapnál állítható).');if(n)X.createTokens('play a Gold gear token exhausted.',it,parts,refs,1);}
        else if(a.k==='buffBonus'){X.BUFF2[it.pl]=true;parts.push('"'+esc(x.t)+'": ebben a körben '+WHO[it.pl]+' unitjainak buffja +2 Mightot ad (703).');refs.push('703');}
        else if(a.k==='preventAllSA'){X.PREVSA.on=true;parts.push('"'+esc(x.t)+'": '+esc(a.d)+' ('+a.refs+'; levezetés).');refs.push('438.1.b');fl=Math.max(fl,1);}
        else if(a.k==='choosePerPlayer'){const mp0=(s&&s.mp&&s.mp[xi])||{};const ws=a.who==='all'?['A','B']:[other(it.pl)];const mp:any={};const used=new Set<string>();
          ws.forEach((p:string)=>{const v=mp0[p];if(!v)return;if(a.opts){if(a.opts.includes(v))mp[p]=v;return;}const o=X.O[v];
            const ok=o&&o.zone==='board'&&(a.scope==='notCaster'?o.type==='unit'&&o.ctrl!==it.pl:a.scope==='ownGearKill'?o.type==='gear'&&o.ctrl===p:o.type==='unit'&&o.ctrl===p);
            if(!ok){parts.push(WHOC[p]+' választása ('+esc(o?o.name:v)+') nem felel meg a lap megkötésének, ezért nem számít.');return;}
            if(a.distinct&&used.has(v)){parts.push(WHOC[p]+' választása ('+esc(o.name)+') már erre a spellre választott unit ("that hasn\'t been chosen for this spell"), ezért nem számít.');return;}
            used.add(v);mp[p]=v;});
          if(a.distinct)parts.push('Megkötés: csak olyan unit, amelyet erre a spellre még senki nem választott; két játékosnál egy választás van, ezért ez nem szűkít.');
          it.mp=mp;
          parts.push('"'+esc(x.t)+'": '+ws.map((p:string)=>WHOC[p]+' választása: '+(mp[p]?(X.O[mp[p]]?X.O[mp[p]].name:mp[p]):'nincs megadva')).join('; ')+' (a lapnál állítható, 412.1).');refs.push('412.1');
          if(a.scope==='ownKill'||a.scope==='ownGearKill')ws.forEach((p:string)=>{const v=mp[p];if(v&&X.O[v]&&X.O[v].zone==='board'&&X.O[v].ctrl===p)X.killObj(v,'saját választás',parts,refs,srcName);});}
        else if(a.k==='killRest'||a.k==='killChosen'){const mp=it.mp||{};const chosen=new Set(Object.values(mp));const vs=Object.keys(X.O).filter(id=>X.O[id].zone==='board'&&X.O[id].type==='unit'&&(a.k==='killRest'?!chosen.has(id):chosen.has(id)));vs.forEach(v=>X.killObj(v,'',parts,refs,srcName));if(!vs.length)parts.push('"'+esc(x.t)+'": nincs érintett unit.');}
        else if(a.k==='pfEach'){const mp=it.mp||{};const who=Object.entries(mp).filter(([,v])=>v===a.pick).map(([p])=>p);const ps=who.length?[it.pl,...who]:[];ps.forEach((p:string)=>X.EV.push({k:a.act,pl:p,n:1}));parts.push('"'+esc(x.t)+'": '+(ps.length?ps.map((p:string)=>WHOC[p]).join(' és ')+' '+(a.act==='draw'?'húz 1-et':'channelöl 1 rune-t'):'senki nem választotta ('+a.pick+')')+'.');}
        else if(a.k==='nextReady'){X.READYNEXT[it.pl]=true;parts.push('"'+esc(x.t)+'": a következő unit, amit '+WHO[it.pl]+' ebben a körben kijátszik, ready lép be (143.4.a).');refs.push('143.4.a');}
        else if(a.k==='enterReady'){X.READY[it.pl]=true;parts.push('"'+esc(x.t)+'": a kör hátralevő részében '+WHO[it.pl]+' által kijátszott unitok ready lépnek be (143.4.a).');refs.push('143.4.a');}
        else if(a.k==='spendBuffReady'){const us=Object.keys(X.O).filter(id=>X.O[id].zone==='board'&&X.O[id].type==='unit'&&X.O[id].ctrl===it.pl&&X.O[id].bu);us.forEach(id=>{X.O[id].bu=false;X.O[id].ex=false;X.EV.push({k:'ready',id,name:X.O[id].name,spent:true});});
          parts.push('"'+esc(x.t)+'": '+(us.length?us.map(id=>esc(X.O[id].name)).join(', ')+': a buff elköltve, ready lesz (416); "you may": a játékos unitonként dönt, az elemzés minden buffolt unitnál igennel számol':'nincs buffolt friendly unit')+'.');refs.push('416');}
        else if(a.k==='playcard'){const zac=!a.self&&!(s&&s.plc&&s.plc[xi])&&X.ZC&&it.zAmongCard&&X.O[it.zAmongCard]&&['banish','deck'].includes(X.O[it.zAmongCard].zone)&&/\bplay it\b/i.test(x.t)?it.zAmongCard:null;
          if(zac){parts.push('A kijátszott lap a megnézett lapok közül választott '+esc(X.O[zac].name)+'.');X.zcMove(zac,'played');it.zAmongCard=null;}
          const pc=zac?X.O[zac].card:a.self?(it.src&&X.O[it.src]&&X.O[it.src].card)||(s&&s.c):vsCard(s&&s.plc?s.plc[xi]:'');
          const pcW=pc&&!a.self?costCheck(costCondOf(x.t),pc,X.zctx(it,s)):'';
          if(pcW){x.st='negated';x.ref='206, 359.3.e.6';x.why='a megadott lap ('+pc.n+') nem felel meg a költségfeltételnek: '+pcW;parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');refs.push('206');}
          else if(!pc){x.why='a kijátszott lapot a builderben kell megadni';parts.push('"'+esc(x.t)+'": kijátszás hatásból (420.3). Melyik lap? Add meg a builderben (Így értelmezem blokk), és az elemzés követi.');fl=Math.max(fl,1);}
          else{if(a.self&&it.src&&X.O[it.src]&&X.O[it.src].zone==='trash'){const so0=X.O[it.src];if(so0.type==='zc')X.zcMove(it.src,'played');else{so0.zone='gone';so0.gen=(so0.gen||0)+1;}parts.push(esc(pc.n)+' a trashből kerül kijátszásra.');}
            const pid='p'+(s?s.j:'x')+'_'+xi;const isP=pc.t==='Unit'||pc.t==='Gear';const to=(s&&s.pll&&s.pll[xi])||(/\bhere\b/i.test(x.t)?X.srcLoc(it)||'base':'base');
            refs.push('420.3','420.3.b');
            if(isP){X.O[pid]={id:pid,name:pc.n,card:pc,ctrl:it.pl,own:it.pl,loc:to,baseOf:it.pl,m:pc.t==='Unit'&&pc.m!=null?+pc.m:null,dmg:0,mods:[],kws:[],zone:'board',type:pc.t==='Unit'?'unit':'gear',ex:false};const erP=X.enterReady(pc,it.pl,false,to,undefined,pid);if(pc.t==='Unit')X.O[pid].ex=!erP.ready;X.EV.push({k:'enter',id:pid,name:pc.n,loc:to,from:a.from});
              parts.push(esc(pc.n)+' kijátszva hatásból ('+({trash:'trashből',hand:'kézből',banish:'banishmentből',other:'nem kézből'} as any)[a.from]+', '+esc(X.locLabel(to))+(a.free?', költség nélkül':'')+'). A '+pc.t.toLowerCase()+' azonnal resolve-ol (337.2)'+(pc.t==='Unit'?(erP.ready?', ready lép be ('+erP.why+')':', exhausted lép be (143.4)'):'')+'.'+(erP.note?' '+erP.note:''));X.story.push(Art(pc.n)+' hatásból a boardra kerül: '+X.locLabel(to)+'.');
              X.playTrigs({c:pc,j:-1,pl:it.pl,from:a.from==='hand'?'hand':'other',objId:pid}).forEach((t:any)=>{X.pushTrig(t);parts.push('Triggerel: '+esc(t.label)+' (420.4.a).');});
              const own=triggersOf(pc).find((t:any)=>/^when you play (?:me|this)\b/i.test(t.why));if(own){X.pushTrig({kind:'auto',label:pc.n+' play triggere',name:pc.n+' play triggere',src:pid,pl:it.pl,eff:own.eff,why:own.why,list:[],tg:[]});parts.push(esc(pc.n)+' play effectje is triggerel; a célpontját az elemzés nem követi.');}}
            else{X.pushTrig({kind:'auto',label:pc.n+' (hatásból kijátszott spell)',name:pc.n,src:null,pl:it.pl,eff:effOf(pc),why:'kijátszás hatásból',list:[],tg:[],from:a.from});parts.push(esc(pc.n)+' spell a chainre kerül, és később resolve-ol (420.3.b); célpontjait az elemzés nem követi.');}}}
        else if(a.k==='none'){if(x.manual)parts.push('"'+esc(x.t)+'": a kézi értelmezés szerint nem csinál semmit.');}
        else if(a.k==='delayed'){X.out.delayed.push({t:x.t,who:it.pl,src:srcName,srcId:it.src||it.objId||null,on:live.map((ti:number)=>X.O[it.tg[ti]].name),ids:live.map((ti:number)=>it.tg[ti]),n:X.EV.slice(it.ev0||0).filter((e:any)=>e.k==='zone'&&e.to==='trash'&&X.O[e.id]&&X.O[e.id].type!=='spell').length});X.EV.push({k:'delayed',t:x.t});parts.push('Delayed ability jön létre: "'+esc(x.t)+'". A megadott időpontban triggerel, és akkor kerül a chainre (391.2, 392); ez a mostani chainen kívül esik, ezért az elemzés itt nem futtatja le.');refs.push('391.2','392');X.story.push('Delayed hatás jön létre: "'+x.t+'" (később fut le).');}
        else if(a.k==='loseCtrl'){const ids=(prev?prev.tis.map((ti:number)=>it.tg[ti]):[]).filter((v:string)=>v&&X.O[v]&&X.O[v].zone==='board');
          if(!ids.length)parts.push('"'+esc(x.t)+'": nincs a boardon olyan unit, amelynek a kontrollja visszaállna.');
          ids.forEach((v:string)=>{const ob=X.O[v];const to=(ob.until&&ob.until.prev)||ob.own;if(ob.ctrl===it.pl&&to!==it.pl){X.setCtrl(v,to,'391.2','levezetés: a kontroll elvesztésével az előző irányítóhoz kerül vissza');parts.push(esc(ob.name)+' irányítása visszakerül: '+WHO[to]+' (levezetés).');}else parts.push(esc(ob.name)+': '+WHO[it.pl]+' már nem irányítja, nincs mit elveszíteni.');});x.tis=prev?prev.tis.slice():[];}
        else if(a.k==='fight'){const pt=prev?prev.tis.map((ti:number)=>it.tg[ti]).filter(Boolean):[];const lv=pt.filter((v:string)=>X.onB(v)&&live.some((ti:number)=>it.tg[ti]===v));
          if(lv.length===2&&pt.length===2){const [p1,p2]=lv;const m1=X.mightOf(p1),m2=X.mightOf(p2);
            [[p1,m2,p2],[p2,m1,p1]].forEach(([v,n,by]:any)=>{if(n==null)return;X.dealDmg(v,n,parts,refs,'forrás: '+X.O[by].name+', 418.6.b.3');});refs.push('418.6.b.3');X.story.push(Art(X.O[p1].name)+' és '+art(X.O[p2].name)+' sebzi egymást ('+m1+' és '+m2+' Might).');}
          else{x.st='ignored';x.ref='359.3.e.14.a, 359.3.e.12';x.why='a két kiválasztott unit közül legalább egy nem érvényes célpont, a Mightja nem elérhető';}}
        else if(lk&&live.length&&!['other','playcard','token','deck','xp','score','choose','runes','add'].includes(a.k)&&!((a.k==='empower'||a.k==='disempower')&&X.selfRef(x.t))){const gl=live.filter((ti:number)=>X.O[it.tg[ti]].type==='gear');const tl=(a.k==='detach'||a.k==='attach')&&gl.length?gl:live;
          if(a.k==='attach'&&gl.length&&live.length>gl.length&&!a.toSelf){const u=live.find((ti:number)=>X.O[it.tg[ti]].type==='unit');const G=X.O[it.tg[gl[0]]],U=X.O[it.tg[u]];if(G.on===U.id){parts.push(esc(G.name)+' már ezen a uniton van, a csatolásnak nincs hatása (435.1.g, 435.1.i); az elemzés ezt Negated-nek veszi (levezetés).');x.st='negated';x.ref='359.3.e.6';it.flL=true;}else{G.on=U.id;G.loc=U.loc;X.EV.push({k:'attach',id:G.id,name:G.name,to:U.id});parts.push('Felcsatolva: '+esc(G.name)+' → '+esc(U.name)+' (435).');refs.push('435');}}
          else tl.forEach((ti:number)=>{const r=X.applyTo(it.tg[ti],Object.assign({t:x.t},a),it,parts,refs);if(r==='neg'){x.st='negated';x.ref='359.3.e.6';}else if(r==='ign'){x.st='ignored';x.ref=a.k==='ctrlUntil'?'359.3.e.16':'359.3.e.6';x.why=a.k==='ctrlUntil'?'a delayed kontroll időtartama már véget ért, mielőtt létrejött volna':'a végrehajtáshoz szükséges információ nem elérhető';}});}
        else if(lk&&prev&&!live.length&&a.k!=='other'){x.st='ignored';x.ref='359.3.e.14.a';x.why='a hivatkozott célpont nem érvényes, ezért nincs mire hatnia';}
        else if(!lk&&sc&&['dmg','kill','stun','hand','banish','recall','ready','exhaust','might','buff'].includes(a.k)&&!x.tis.length){const hereLoc=sc.there?(it.tg.find((v:string)=>v==='F0'||v==='F1')==='F1'?'bf1':'bf0'):X.srcLoc(it);let hit=0;
          Object.keys(X.O).forEach(v=>{const ob=X.O[v];if(ob.zone!=='board'||ob.type!==sc.type)return;if(sc.rel==='enemy'&&ob.ctrl===it.pl)return;if(sc.rel==='friendly'&&ob.ctrl!==it.pl)return;if((sc.here||sc.there)&&ob.loc!==hereLoc)return;if(sc.atbf&&ob.loc==='base')return;if(sc.inbase&&ob.loc!=='base')return;if(sc.other&&v===it.src)return;hit++;X.applyTo(v,Object.assign({t:x.t},a),it,parts,refs);});
          if(!hit)parts.push('"'+esc(x.t)+'": nincs olyan lap a boardon, amire hatna.');}
        else if((X.selfRef(x.t)||a.fromPlayed)&&['ready','exhaust','might','kw','empower','disempower','kill','banish','recall','buff','stun','heal','dmg','setbase'].includes(a.k)&&!(a.k==='might'&&!a.self&&!/\bme\b/i.test(x.t))){
          if(it.src&&(X.onB(it.src)||(X.O[it.src]&&X.O[it.src].zone==='legend'))){if(a.k==='disempower'){X.O[it.src].emp=false;parts.push(esc(X.O[it.src].name)+' disempowered lesz.');}else if(a.k==='empower'){X.O[it.src].emp=true;X.EV.push({k:'empower',id:it.src,name:X.O[it.src].name});parts.push(esc(X.O[it.src].name)+' Empowered lesz (442).');refs.push('442');X.story.push(Art(X.O[it.src].name)+' Empowered lesz.');}else{if(a.fromPlayed)parts.push('A kijátszott lap ('+esc((it.trigBy&&it.trigBy.n)||'?')+') Energy költsége: '+((it.trigBy&&it.trigBy.e)||0)+'.');const r=X.applyTo(it.src,Object.assign({t:x.t},a,a.fromPlayed?{n:+((it.trigBy&&it.trigBy.e)||0)}:{}),it,parts,refs);if(r==='neg'){x.st='negated';x.ref='359.3.e.6';}}}
          else{x.st='ignored';x.ref='359.3.e.6, 359.3.f.2';x.why='a forrásra ("me", "this") hivatkozik, de a forrás már nincs a boardon, az információ nem elérhető';}}
        else if(a.k==='attach'&&a.toSelf&&prev){x.st='ignored';x.ref='359.3.e.14.a';x.why='a csatolandó lap nem érvényes';}
        else if(a.k==='ctrlUntil'&&a.until==='src'&&!(it.src&&X.onB(it.src))){x.st='ignored';x.ref='359.3.e.16';x.why='a delayed kontroll időtartama ("until I leave the board") már véget ért, mielőtt létrejött volna, ezért nem jön létre';parts.push('"'+esc(x.t)+'": '+esc(srcName.replace(/ triggere$/,''))+' már nincs a boardon, ezért a kontroll nem változik, egy pillanatra sem (359.3.e.16).');refs.push('359.3.e.16');}
        else if(['dmg','kill','stun','hand','banish','recall','base','move','might','buff','ready','exhaust','counter'].includes(a.k)&&!lk&&!x.tis.length&&it.kind!=='auto'){parts.push('"'+esc(x.t)+'": nincs kiválasztott célpont vagy hatókör, ezért nincs mire hatnia.');}
        else if(a.k==='other'||a.k==='playcard'||a.k==='replay'||a.unsure){parts.push('"'+esc(x.t)+'": lefut, ezt az elemzés nem követi részletesen.');fl=Math.max(fl,1);}
        else if(['token','deck','xp','score','runes','choose','add','pay','costmod','restrict','showoff','win','extraturn','perm'].includes(a.k)){
          if(a.k==='token'){X.createTokens(a.tokenText||x.t,it,parts,refs,1);}else{const L:any={win:'a játék megnyerése, ha a feltétel teljesül',extraturn:'extra kör (735), a chainet nem érinti',perm:'engedély vagy tiltás a kör hátralevő részére, a chain lefutását nem érinti',deck:'pakli művelet (felfedés, recycle, Predict)',xp:'XP változás',score:'pontszerzés',runes:'rune-ok readyre állítása',choose:'választás',add:'erőforrás hozzáadása',pay:'költség fizetése az utasításon belül (204.3.a)',costmod:'költségmódosítás, a chain lefutását nem érinti',restrict:'korlátozás, a chain lefutását nem érinti',showoff:'Show Off (832)'};parts.push('"'+esc(x.t)+'": '+L[a.k]+'.');X.EV.push({k:a.k,pl:it.pl,t:x.t});}}
        else if(x.manual&&a.k!=='other')parts.push('"'+esc(x.t)+'": kézzel '+(OV_LBL[a.k]||a.k)+' műveletre állítva, de nincs mire hatnia (nincs célpontja, és nem linked).');}
      if(x.tis.length||['control','choose'].includes(x.act.k)&&x.tis.length)lastT=x;});
    const insShown=INS.length>1||INS.some((x:any)=>x.st!=='executed');
    if(X.MAN)parts.push('<b>Kézzel beállított értelmezés:</b> '+INS.filter((x:any)=>x.manual).map((x:any)=>'"'+esc(x.t)+'" = '+esc((OV_LBL[x.act.k]||x.act.k).replace(/ N$/,''))+(OV_N.has(x.act.k)?' '+x.act.n:'')+(x.lk?', linked':'')).join('; ')+'.');
    if(insShown){parts.push('Utasítások: '+INS.map((x:any)=>'"'+esc(x.t)+'": '+INS_ST[x.st]+(x.ref?' ('+x.ref+')':'')+(x.manual?' [kézi]':'')).join('; ')+'.');
      INS.forEach((x:any)=>{if(x.ref)x.ref.split(/,\s*/).forEach((r:string)=>refs.push(r));});
      INS.forEach((x:any,xi:number)=>{if(xi&&(x.st==='ignored'||x.st==='skipped'))X.story.push('"'+x.t+'": '+INS_ST[x.st]+', mert '+x.why+'.');});}
    if(tot&&(mtT.some((q:any)=>!q.ok)||INS.some((x:any)=>x.st==='negated'||x.st==='skipped')))
      X.MT={item:srcName+(perm?' (play trigger)':''),kind:!legal?'full':mtT.some((q:any)=>!q.ok)?'partial':'none',targets:mtT,instr:INS.map((x:any)=>({t:x.t,st:x.st,ref:x.ref,why:x.why,man:x.manual}))};
    else if(!tot&&INS.some((x:any)=>x.st==='negated'||x.st==='skipped'||x.st==='ignored'))X.MT={item:srcName,kind:'none',targets:[],instr:INS.map((x:any)=>({t:x.t,st:x.st,ref:x.ref,why:x.why,man:x.manual}))};
    if(!parts.length){parts.push(it.kind==='step'&&s.k==='card'&&s.c.sh?'Hatás: '+esc(s.c.sh):'Hatás: '+esc(it.eff||''));fl=Math.max(fl,1);X.story.push(Art(srcName)+' lefut'+(it.kind==='step'&&s.k==='card'&&s.c.sh?': '+s.c.sh:': '+it.eff));}
    if(tot&&!legal&&mtT.some((q:any)=>q.skip)){parts.push('A célponttól függő utasítások Ignored-ok (359.3.e.14.a'+(INS.some((x:any)=>/359\.3\.e\.12/.test(x.ref||''))?', 359.3.e.12':'')+'), a hatás ezekre elmarad.');refs.push('359.3.e.14.a');}
    else if(tot&&!legal){const rest=INS.some((x:any)=>x.st==='executed'&&!x.tis.length);if(rest){parts.push('Teljes mistarget: minden célpontja illegális lett, a célponthoz nem kötött utasítás viszont végrehajtódik.');refs.push('359.3.e.7');}else{parts.push('Teljes mistarget: minden célpontja illegális lett, ezért hatás nélkül resolve-ol'+(perm||it.kind!=='step'||s.k!=='card'?'':', de kijátszottnak számít (359.3.e.10)')+'.');refs.push('359.3.e.7');X.story.push(Art(srcName)+' így hatás nélkül fejeződik be.');}}
    else if(tot&&legal<tot&&tot>1)refs.push('359.3.e.8');
    if(self&&self.type==='spell')self.zone='trash';if(self&&self.type==='ability'&&self.zone==='chain')self.zone='none';
    if(it.kind==='step'&&s&&s.k==='card'&&s.c.t==='Spell'){const pt=X.playTrigs(s);pt.forEach((tr:any)=>X.pushTrig(tr));if(pt.length){parts.push('A kijátszás most fejeződött be a resolve-val, ezért triggerel: '+pt.map((tr:any)=>esc(tr.label)).join(', ')+' (420.4.a; akkor is, ha egyik utasítás sem hajtódott végre, 359.3.e.10).');refs.push('420.4.a');}}
    const res=(tot&&!legal)?'fizzle':(tot&&legal<tot)?'partial':'ok';
    X.done.push({name:it.label,pl:it.pl,res});X.out.items.push({name:it.label,res,instr:INS.map((x:any)=>({t:x.t,k:x.act.k,st:x.st,ref:x.ref,lk:x.lk})),targets:mtT});
    if(it.flL)fl=Math.max(fl,1);X.rr+=X.line(refs.join(','),t+parts.join(' '),fl);X.MAN=false;};
  X.ENDED=false;
  X.endStep=()=>{X.ENDED=true;
    X.story.push('A chain kiürült, jön az Ending Phase.');X.rr+=X.line('317, 317.1',esc('A chain kiürült. A kör az Ending Phase-be lép, Ending Step: a kör végi hatások triggerelnek (317.1.a).'),0);
    const ET:any[]=[];
    X.out.delayed.forEach((d:any)=>{if(!/\bat (?:the )?end of (?:this )?turn\b/i.test(d.t))return;d.done=true;
      let eff=d.t.replace(/,?\s*\bat (?:the )?end of (?:this )?turn\b,?\s*/i,' ').replace(/\s+\./g,'.').trim();if(/\bthat many\b/i.test(eff))eff=eff.replace(/\bthat many\b/i,String(d.n||0));
      eff=eff.charAt(0).toUpperCase()+eff.slice(1);if(!/\.$/.test(eff))eff+='.';
      ET.push({kind:'auto',label:d.src+' delayed hatása (kör vége)',name:d.src+' delayed hatása',src:d.srcId&&X.O[d.srcId]?d.srcId:null,pl:d.who,eff,why:'"'+d.t+'"',list:[],tg:[],pre:(d.ids||[]).filter((v:string)=>X.O[v]),dl:true});
      X.rr+=X.line('317.1.a, 391.2',esc(d.src+' delayed hatása triggerel: "'+d.t+'"'+(d.ids&&d.ids.length?' ('+d.ids.map((v:string)=>X.O[v]?X.O[v].name:v).join(', ')+')':'')+'.'),0);X.story.push(d.src+' delayed hatása triggerel: '+eff);});
    const endCond=(c:string,ob:any)=>{if(/^I'm at a battlefield$/i.test(c))return ob.zone==='board'&&ob.loc!=='base';
      if(/^you control this battlefield$/i.test(c))return ob.zone==='board'&&!!X.BF[ob.loc]&&X.BF[ob.loc].ctrl===ob.ctrl;
      const cd:any=condOf('if '+c+', x.');return cd?X.evalCond(cd,{pl:ob.ctrl,src:ob.id},null,0,null)===true:false;};
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(!ob.card||!(ob.zone==='board'||ob.zone==='legend'))return;(ob.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{
      const m=/^At the end of (your|each) turn,\s*(.*)$/i.exec(l);if(!m)return;if(m[1].toLowerCase()==='your'&&ob.ctrl!==X.TP)return;
      let eff=m[2];const ic=/^if ([^,]+),\s*(.*)$/i.exec(eff);
      if(ic){const ok=endCond(ic[1],ob);eff=ic[2];X.rr+=X.line('383.2.a.1',esc(ob.name+': a trigger feltétele ("if '+ic[1]+'") a kör végén '+(ok?'teljesül, ezért a trigger a chainre kerül; ha utána a forrás eltűnik, a trigger ettől még lefut':'nem teljesül, ezért nem triggerel')+'.'),0);
        X.story.push(Art(ob.name)+(ok?' kör végi triggere a chainre kerül.':' kör végi triggere nem triggerel, mert a feltétele ("if '+ic[1]+'") nem teljesül.'));if(!ok)return;}
      else X.story.push(Art(ob.name)+' kör végi triggere a chainre kerül.');
      ET.push({kind:'auto',label:ob.name+' triggere (kör vége)',name:ob.name+' triggere',src:id,pl:ob.ctrl,eff,why:'"'+l+'"',list:[],tg:[],endTrig:!!ic});});});
    ET.forEach((t:any)=>X.pushTrig(t));X.flushPend(X.stack);
    if(X.stack.length)X.snap('Ending Step: kör végi triggerek a chainen',X.stack);
    else X.rr+=X.line('317.1.a',esc('Nincs kör végi hatás.'),0);};
  X.expiration=()=>{
    /* Expiration Step (317.2): Ending Special Cleanup a 323 lépéseivel: 3a lethal damage-es unitok meghalnak, 3c heal (317.2.b),
       3d a "this turn" hatások lejárnak (317.2.c) és a stun megszűnik (424.1.a.2), 3e a Rune Pool kiürül (317.2.d);
       ha közben chain elem keletkezett és lefutott (FEPR), vissza az Expiration Step elejére (317.2.f). */
    for(let round=0;round<4;round++){
      X.rr+=X.line('317.2, 317.2.a',esc('Expiration Step'+(round?' (újra, 317.2.f)':'')+': Ending Special Cleanup (318).'),0);
      const kp:string[]=[];const kr:string[]=[];const dead=Object.keys(X.O).filter(id=>X.lethal(id));dead.forEach(id=>{X.killObj(id,'lethal damage, Ending Special Cleanup',kp,kr);});
      if(dead.length)X.rr+=X.line('323.4, 142.4.b',esc('3a: '+plainOf(kp.join(' '))),0);
      const heal:string[]=[];const exp:string[]=[];const stun:string[]=[];
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.zone!=='board')return;
        if(ob.type==='unit'&&ob.dmg){heal.push(ob.name+' ('+ob.dmg+')');ob.dmg=0;}});
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.zone!=='board')return;
        const e:string[]=[];if(ob.mods&&ob.mods.length){e.push('Might módosítók');ob.mods=[];}if(ob.kws&&ob.kws.length){e.push('kapott keywordök ('+ob.kws.join(', ')+')');ob.kws=[];}
        if(ob.baseSet!=null){e.push('alap Might beállítás');ob.baseSet=null;}if(ob.untgt){e.push('célozhatatlanság');ob.untgt=null;}if(ob.save){e.push('mentés');ob.save=null;}
        if(ob.dieTo){e.push('halál helyettesítés');ob.dieTo=null;}if(ob.dbl){e.push('damage duplázás');ob.dbl=null;}if(ob.prev){e.push('Prevent');ob.prev=null;}if(ob.shields){e.push('Shield módosítás');ob.shields=null;}
        if(e.length)exp.push(ob.name+': '+e.join(', '));
        if(ob.type==='unit'&&ob.st){ob.st=false;stun.push(ob.name);}});
      ['A','B'].forEach(p=>{X.READY[p]=false;X.BUFF2[p]=false;if(X.READYNEXT[p])exp.push(WHOC[p]+': "the next unit you play this turn enters ready"');X.READYNEXT[p]=false;});X.PREVSA.on=false;
      X.rr+=X.line('317.2.b',esc('3c: minden unit gyógyul'+(heal.length?': '+heal.join(', '):' (egyiken sincs damage)')+'.'),0);
      X.rr+=X.line('317.2.c, 424.1.a.2',esc('3d: minden "this turn" hatás egyszerre lejár'+(exp.length?': '+exp.join('; '):' (nincs ilyen)')+'; a stun megszűnik'+(stun.length?': '+stun.join(', '):' (nincs stunned unit)')+'.'),0);
      X.rr+=X.line('317.2.d',esc('3e: a Rune Pool kiürül, az el nem költött Energy és Power elvész.'),0);
      if(!round)X.story.push('Expiration Step: '+(dead.length?'a lethal damage-es unitok meghalnak, ':'')+'minden unit gyógyul, a "this turn" hatások lejárnak, a stun megszűnik.');
      X.cleanup();X.snap('Ending Phase: Expiration Step'+(round?' (újra)':''),X.stack);
      if(!X.stack.length)break;
      X.rr+=X.line('317.2.f',esc('Az Expiration Step közben chain elem keletkezett ('+X.stack.map((t:any)=>t.label).join(', ')+'); lefut, utána az Expiration Step elölről kezdődik.'),0);
      X.resolveAll();}
    X.out.delayed=X.out.delayed.filter((d:any)=>!d.done);};
  X.playMain();X.stack=X.chain.slice();
  X.resolveAll();
  /* Combat utáni triggerek: a Combat panel kiosztása szerinti eredmény, majd új chain a felvett triggerekkel (célpontokkal). */
  if(X.POST.length){const cb=X.POST[0].cb||{bf:'bf0',dead:[],recall:[],ctrl:'',label:''};const bl=cb.bf==='bf1'?'bf1':'bf0';
    X.story.push('A chain kiürült. Ezután jön a combat '+X.locLabel(bl)+' battlefielden, a Combat panel kiosztása szerint.');
    (cb.dead||[]).forEach((id:string)=>{const ob=X.O[id];if(ob&&ob.zone==='board'){X.leaveBoard(id,'trash');X.REC.push(['467.2.d, 323.4',ob.name+': a combat damage-től meghal, a trashbe kerül.']);X.story.push(Art(ob.name)+' meghal a combatban.');}});
    (cb.recall||[]).forEach((id:string)=>{const ob=X.O[id];if(ob&&ob.zone==='board'){ob.loc='base';ob.baseOf=ob.ctrl;X.REC.push(['468.1.a.2',ob.name+': attackerként recall-olódik a base-be.']);}});
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.zone==='board'&&ob.type==='unit'&&(ob.loc===bl||(cb.recall||[]).includes(id))&&ob.dmg){ob.dmg=0;}});X.REC.push(['468.1.a.1','A túlélők damage-e a Combat Cleanupban gyógyul.']);
    if(cb.ctrl&&X.BF[bl].ctrl!==cb.ctrl){X.BF[bl].ctrl=cb.ctrl;X.REC.push(['468.5',(cb.ctrl==='A'?'Te':'Az ellenfél')+' Establishes Control: '+X.locLabel(bl)+'.']);}
    X.snap('Combat: '+(cb.label||X.locLabel(bl)),[]);
    X.POST.forEach((s:any)=>{let id=s.src;if(!id||!X.O[id]){id='X'+s.j;X.O[id]={id,name:s.c.n,card:s.c.t?s.c:null,ctrl:s.pl,own:s.pl,loc:s.loc||bl,zone:'legend',type:'trigsrc'};}
      const it={kind:'step',s,label:X.O[id].name+' triggere ('+(s.why||'trigger')+')',name:X.O[id].name+' triggere',pl:s.pl,eff:s.eff,list:s.list,tg:s.tg,src:id,perm:false,from:null,loc:null,objId:null,dest:s.dest,ov:s.ov,isTr:true};
      const bad:string[]=[];s.list.forEach((p:any,ti:number)=>{const v=s.tg[ti];if(!v){if(!p.opt)bad.push('nincs megadva a kötelező '+(ti+1)+'. célpont');return;}const w=X.tgWhy(it,p,v,ti,'play');if(w.length)bad.push((ti+1)+'. célpont nem választható: '+w.join(' '));});
      if(bad.length){X.REC.push(['403.4',X.O[id].name+' triggere ('+(s.why||'trigger')+') nem kerülhet a chainre legális választás nélkül: '+plainOf(bad.join('; '))+'. Lekerül (403.4).']);X.story.push(Art(X.O[id].name)+' triggere lekerül, mert nincs legális célpontja.');return;}
      X.pushTrig(it);X.REC.push([s.why==='Deathknell'?'808.1.c, 808.1.d.2':/Conquer/i.test(s.why||'')?'383.4.c.2':'383.3',X.O[id].name+' triggere ('+(s.why||'trigger')+') a chainre kerül: '+s.eff]);X.story.push(Art(X.O[id].name)+' triggere ('+(s.why||'trigger')+') a chainre kerül.');});
    X.flushPend(X.stack);X.snap('Combat utáni triggerek a chainen',X.stack);X.resolveAll();}
  /* ---- Kör vége (317), ha a builderben kérik: Ending Step ("at end of turn" delayed és "At the end of your turn" triggerek, 317.1.a, 391.2,
     383.2.a.1), majd Expiration Step (317.2): Ending Special Cleanup, heal, a "this turn" hatások lejárnak, a Rune Pool kiürül. */
  if(X.CS.end&&!X.ENDED){X.endStep();X.resolveAll();}
  if(X.ENDED)X.expiration();
  X.story.push('A chain kiürült.');
  X.REC.push(['','A chain kiürült.']);if(X.out.delayed.length)X.REC.push(['391.2',X.out.delayed.length+' delayed hatás vár későbbi időpontra: '+X.out.delayed.map((d:any)=>'"'+d.t+'"'+(d.on.length?' ('+d.on.join(', ')+')':'')).join('; ')]);X.snap('Végállapot: a chain üres',[]);X.REC=null;
  // ---- a riport adatai: a HTML-t a render/html/chainReport.ts készíti; nem felsorolható mező, így a kimenet (JSON) változatlan ----
  Object.defineProperty(X.out,'report',{value:{S:X.S,O:X.O,BF:X.BF,CS:X.CS,done:X.done,story:X.story,notes:X.notes,rows:X.rows,rr:X.rr,delayed:X.out.delayed,locLabel:X.locLabel,mightOf:X.mightOf},enumerable:false});
  void LOCK;
  return X.out;
}
