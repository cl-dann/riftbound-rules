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
import { installResolve } from './resolve';
import { installBuild } from './build';
import { installTargeting } from './targeting';
import { installExecute } from './execute';
import { installTokens } from './tokens';
import { installDamage } from './damage';
import { installReplacement } from './replacement';
import { installZoneChange } from './zoneChange';
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
  installZoneChange(X);
  installReplacement(X);
  installDamage(X);
  installTokens(X);
  installExecute(X);
  installTargeting(X);
  installBuild(X);
  installResolve(X);
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
  /** Lap távozása a boardról: csatolt gear leválik (719.5), a "until I leave the board" kontroll megszűnik (391.5.b), a kontroll visszaáll a tulajdonosra. */
  /** Replacement a halál helyett (367, 369.1): saját "If I would die", csatolt gear Effect Textje (Guardian Angel), vagy friendly gear "If a friendly unit would die, kill this instead" (Zhonya's Hourglass). */
  /** Kill (429): replacement esetén Negated (359.3.e.14.b), Deathknell nem fut (808.1.d.1). */
  /** Damage egy unitra. Duplázás (433.1.b) és Prevent (438.2, 438.3) replacementek: ha mindkettő él, a sorrendet a unit controllere választja (372, 467.2.c.5 példa).
      Az elemzés mindkét sorrend eredményét kiírja, és a kevesebb damage-et adó sorrenddel számol (a controller ezt választaná, ha a túlélés a cél). */
  /** Keyword érték (Shield, Assault): a nyomtatott sor eleji keyword és a kapott keywordök összege (807.2, 814.2). */
  /** Szorzó számolása a frame boardján (418.8: egy damage példány). */
  /** Token létrehozása (440, 143.4): "play (N) (ready) (M [S]) <Név> unit|gear token(s) (exhausted) (with [Kw]) (here|there|to your base)". */
  X.TOKN=0;
  /** Egy művelet végrehajtása egy célponton. Visszatérés: 'neg' ha a game action nem történik meg (Negated). */
  /** Önmagára hivatkozó utasítás ("ready me", "give me +2", "empower me", "kill this"): a forrásra hat, ha még a boardon van (359.3.f.2). */
  /* ---- célpont legalitás ---- */
  /** A célpont legalitása. phase: 'play' (kijátszáskor, 355.8) vagy 'res' (resolve-kor, 359.3.e.2). Visszaadja az okok listáját. */
  /** "Counter an enemy spell or ability that chooses it and no other friendly unit" (Repulse): a választott chain elem célpontjai közül
      a friendly unitok száma 359.3.e.9.a szerint: a mistargetelt választások is számítanak a boardon (a célzó utasítás zónája), a boardot elhagyók nem. */
  /** Költségfeltétel a célpontra (Defy, Rebuttal, Pickpocket): a nyomtatott költség számít (206). */
  /** Legális választások egy célponthoz (403.4.b). */
  /* ---- 1. felépítés ---- */
  /** "When you play a [type] (that costs / with Energy cost / with Power cost ...)": a kijátszott lap nyomtatott (vagy copied) költsége dönt (206).
      A trashben lévő lap "play this/me from your trash" triggere is figyel (Forbidden Technique, Meticulous Restorationist). A döntés indoka egyszer kerül a sorok közé. */
  X.PTN=new Set<string>();
  /** "When you play a unit, gear, or activated ability with Energy cost [7] or more" (Nasus): az ability aktiválására, az ability alapköltségével (206.1). */
  X.snap('Kiinduló helyzet',[]);
  /* ---- 2. lefutás ---- */
  X.done=X.out.done;
  /** Cleanup (319.5, 323): lethal damage-es unitok meghalnak, csatolatlan gear battlefielden és idegen base-ben álló permanentek recall-olódnak (323.6). */
  X.guard=0;
  /** A feltétel forrásának szövege a felületen. */
  /** Feltétel kiértékelése: true, false, vagy null (nem követett adat, a builderben nincs megadva). */
  /** Osztott damage (355.14): a kiosztás a resolve-kor dől el (355.14.e); ha kevesebb a damage, mint a célpont, legfeljebb annyi célpont eshet ki, hogy ne legyen kevesebb célpont, mint damage (355.14.h, 355.14.h.1). */
  X.it0=null;X.parts0=[];X.refs1=[];X.tgOut0=[];X.mtT0=[];X.tot0={n:0};X.legal0={n:0};
  X.INRES=false;
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
