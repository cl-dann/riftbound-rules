/* Chain elemző magja, DOM nélkül. A builder állapotából (CS: legendek, battlefieldek, board, lépések) kiszámolja a
   lejátszás frame-jeit, a szabálysorokat és az eseménynaplót. A legacy builder űrlapja és a unit tesztek a render/html/chainReport.ts analyze()-én át hívják.
   A lapszöveg értelmezése szöveges heurisztika; amit nem ismer fel biztosan, azt "bizonytalan" címkével jelöli. */
import { esc } from '../../text/norm';
import { vsCard } from '../../data/store';
import type { ChainState, ZoneEntry } from '../state';
import { isPermC } from '../actions';
import { stepInfo } from '../steps';
import { instName, instNos } from '../cs';
import { plainOf, stripRem } from '../text';
import type { ChainResult, EngineCtx, EStep, StateFns } from './ctx';
import { installEndOfTurn } from './endOfTurn';
import { installResolve } from './resolve';
import { installInstr } from './instr';
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
import { Art, other, WHO, LOCK, lineH } from './labels';

/** A chain lefuttatása a helyzetből (CS): frame-ek, szabálysorok, eseménynapló, objektumok. HTML-t nem készít
    (out.html üres); a riportot a render/html/chainReport.ts analyze() függvénye teszi hozzá. */
export { type ChainResult, type EngineCtx, WHO, lineH };
export function runChain(CS:ChainState):ChainResult{
  // Minden mező előre, rögzített sorrendben: így az objektum alakja (V8 hidden class) nem változik a futás alatt,
  // a mezőelérés gyors marad (a fokozatosan bővülő, 100 feletti mezős objektum lassú szótár módba váltana).
  const X=({CS,MT:undefined,MTIDS:undefined,S:undefined,POST:undefined,MAIN:undefined,out:undefined,REC:undefined,MAN:undefined,ALL:undefined,EV:undefined,story:undefined,rows:undefined,rr:undefined,notes:undefined,O:undefined,BF:undefined,ZC:undefined,zcK:undefined,cnt:undefined,FR:undefined,DET:undefined,NEWCTRL:undefined,chain:undefined,stack:undefined,REPL:undefined,READY:undefined,BUFF2:undefined,PREVSA:undefined,READYNEXT:undefined,ACCELNEXT:undefined,ZIL:undefined,LASTON:undefined,LKX:undefined,MORDE:undefined,mordeVictims:undefined,ST:undefined,PSD:undefined,TP:undefined,PEND:undefined,DIED:undefined,TOKN:undefined,PTN:undefined,done:undefined,guard:undefined,it0:undefined,parts0:undefined,refs1:undefined,tgOut0:undefined,mtT0:undefined,tot0:undefined,legal0:undefined,INRES:undefined,ENDED:undefined,itemOf:undefined,playMain:undefined,cleanup:undefined,bonusDmg:undefined,dealDmg:undefined,kwVal:undefined,countEach:undefined,endStep:undefined,expiration:undefined,applyTo:undefined,pside:undefined,itemName:undefined,snap:undefined,LOCS:undefined,locLabel:undefined,line:undefined,bfC:undefined,onB:undefined,mightOf:undefined,BUF2:undefined,lethal:undefined,zcMove:undefined,zoneIds:undefined,zcWhy:undefined,zctx:undefined,nm:undefined,deathRepl:undefined,killObj:undefined,resolveAll:undefined,evalState:undefined,condSrc:undefined,evalCond:undefined,splitRun:undefined,resolveItem:undefined,resolveItem0:undefined,bfBlocksBase:undefined,bfBlocksPlay:undefined,PSv:undefined,VS:undefined,evSum:undefined,xpOf:undefined,scoreOf:undefined,runesOf:undefined,runeDeckOf:undefined,playedBefore:undefined,enterReady:undefined,selfRef:undefined,srcLoc:undefined,chooseOnlyWhy:undefined,itemEnergy:undefined,tgWhy:undefined,tgWhy0:undefined,legalOpts:undefined,createTokens:undefined,copyOnto:undefined,playBanished:undefined,fxSpell:undefined,autoTg:undefined,equipCopy:undefined,copyEnd:undefined,pushTrig:undefined,deathWatch:undefined,flushPend:undefined,leaveTrigs:undefined,playTrigs:undefined,abTrigs:undefined,setCtrl:undefined,leaveBoard:undefined,moveObj:undefined,resolveTarget:undefined,resolveTargetX:undefined,resolveSubsets:undefined,resolveFinish:undefined,resolveInstr:undefined,resolvePlain:undefined,resolveZone:undefined,resolveAct:undefined,playEnd:undefined,playRes:undefined,playStep:undefined,playCheck:undefined,playLegal:undefined}) as unknown as EngineCtx;
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
  installInstr(X);
  installEndOfTurn(X);
  X.MT=null;X.MTIDS=new Set<string>();
  X.S=X.CS.steps.map((s,j)=>{if(s&&(s.k==='res'||s.k==='end'))return {k:s.k,j,pl:s.pl||'A',c:{n:'',t:'',txt:''},tg:[],ext:{},list:[]};const inf=stepInfo(X.CS,s);return inf&&inf.c?Object.assign({},s,inf,{j,tg:(s.tg||[]).slice(),ext:s.ext||{}}):null;}).filter(Boolean) as EStep[];
  X.POST=X.S.filter((s)=>s.k==='tr');X.MAIN=X.S.filter((s)=>s.k!=='tr');
  X.out={frames:[],html:'',story:[],done:[],rows:[],ev:[],objs:{},items:[],delayed:[],empty:false};
  if(!X.S.length){X.out.empty=true;return X.out;}
  X.REC=null;X.MAN=false;X.ALL=X.out.rows;X.EV=X.out.ev;
  X.story=X.out.story;X.rows='';X.rr='';X.notes=[];
  setupObjects(X);
  setupRun(X);
  X.playMain();X.stack=X.chain.slice();
  X.resolveAll();
  runPostCombat(X);
  finishRun(X);
  return X.out;
}
/** Az objektumok: a board lapjai, a legendek, a kéz, trash és deck lapjai, a lépések lapjai és a pályán kívüli célpontok. */
function setupObjects(X:EngineCtx){
  // ---- objektumok ----
  X.O={};X.out.objs=X.O;
  X.BF={bf0:{c:X.bfC(X.CS.bf[0].n),ctrl:X.CS.bf[0].c},bf1:{c:X.bfC(X.CS.bf[1].n),ctrl:X.CS.bf[1].c}};
  /** Aktuális Might (layer-egyszerűsítés): nyomtatott vagy megadott + buff + csatolt gear Might bonus + "this turn" módosítók + ismert statikus hatások. Nem boardon: null (359.3.e.12). */
  const nos=instNos(X.CS);
  X.CS.bd.forEach((b,i)=>{const c=vsCard(b.n);if(!c)return;X.O['b'+i]={id:'b'+i,name:instName(c.n,nos['b'+i]),card:c,ctrl:b.pl,own:b.pl,loc:b.loc,baseOf:b.pl,m:c.t==='Unit'?(b.m!=null?b.m:(c.m!=null?+c.m:null)):null,dmg:b.d||0,dealt:(b.d||0)>0,atk:b.atk||'',ex:!!b.ex,st:!!b.st,bu:!!b.bu,emp:!!b.emp,mods:[],kws:[],zone:'board',type:c.t.toLowerCase()==='unit'?'unit':c.t==='Gear'?'gear':c.t.toLowerCase(),board:true};if(nos['b'+i])X.O['b'+i].no=nos['b'+i];});
  X.CS.bd.forEach((b,i)=>{if(X.O['b'+i]&&b.on!=null&&X.O['b'+b.on]&&X.O['b'+i].type==='gear'){X.O['b'+i].on='b'+b.on;X.O['b'+i].loc=X.O['b'+b.on].loc;}});
  ['A','B'].forEach(p=>{const c=vsCard(X.CS.lg[p]);if(c)X.O['L'+p]={id:'L'+p,name:c.n,card:c,ctrl:p,own:p,zone:'legend',type:'legend',emp:false,ex:false};});
  /* Kéz, trash és deck tartalma (a pályás építő mezői, nem kötelező): "zc" objektumok, a többi lapszámítás nem látja őket. Ha nincs megadva, az elemzés változatlan. */
  X.ZC=!!(X.CS.hand||X.CS.trash||X.CS.deck||(X.CS.steps||[]).some((x)=>x&&x.zp));X.zcK={hand:'h',trash:'t',deck:'d'};
  if(X.ZC)(['hand','trash','deck'] as const).forEach(z=>['A','B'].forEach(p=>(((X.CS[z]||{}) as Record<string,ZoneEntry[]|undefined>)[p]||[]).forEach((e,i)=>{const n=typeof e==='string'?e:e&&e.n;const c=vsCard(n);if(!c)return;const id=typeof e==='string'||!e.id?'z'+X.zcK[z]+p+i:e.id;X.O[id]={id,name:c.n,card:c,own:p,ctrl:p,zone:z,type:'zc',ord:i,gen:0};})));
  /** Választható lapok egy zónában: zc objektumok és a játék közben oda került lapok (meghalt unit, lefutott spell a trashben). */
  X.out.zsnap={};
  /** Egy zónából választott lap legális-e (a lap szövegének megkötései: kinek a zónája, típus, tag, darabszám). Üres string: legális. */
  /** A költségfeltétel változói a választás pillanatában: a forrás Mightja, a játékos pontszáma, a költségként megölt unit nyomtatott költsége. */
  X.cnt={};X.S.forEach((s)=>{if(s.k!=='res'&&s.k!=='end')X.cnt[s.c.n]=(X.cnt[s.c.n]||0)+1;});
  X.MAIN.forEach((s)=>{const j=s.j;const c=s.c;if(s.k==='res'||s.k==='end')return;
    if(s.k==='ab'||s.k==='tg'){const sc=s.src&&X.O[s.src];X.O['s'+j]={id:'s'+j,name:(sc&&sc.no?sc.name:c.n)+(s.k==='ab'?' abilityje':' triggere'),card:c,ctrl:s.k==='tg'&&sc?sc.ctrl:s.pl,own:s.k==='tg'&&sc?sc.ctrl:s.pl,zone:'pending',type:'ability',src:s.src,stepJ:j};return;}
    const nmx=isPermC(c)&&nos['s'+j]?instName(c.n,nos['s'+j]):c.n+(X.cnt[c.n]>1?' ('+(j+1)+'.)':'');
    if(isPermC(c)){X.O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,loc:s.loc||(s.from==='facedown'?'bf0':'base'),baseOf:s.pl,m:c.t==='Unit'&&c.m!=null?+c.m:null,dmg:0,mods:[],kws:[],zone:'pending',type:c.t==='Unit'?'unit':'gear',ex:false,accel:!!s.accel};if(nos['s'+j])X.O['s'+j].no=nos['s'+j];}
    else X.O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,zone:'pending',type:'spell'};});
  X.S.forEach((s)=>{const c=s.c;const j=s.j;
    s.tg=s.tg.map((v:string,ti:number)=>{if(v!=='x')return v;const p=s.list[ti];if(!p)return '';const e=s.ext[ti]||{};const id='t'+j+'_'+ti;
      const ctrl=e.pl||(p.rel==='enemy'?other(s.pl):p.rel==='friendly'?s.pl:null);
      X.O[id]={id,name:c.n+' célpontja ('+(ctrl==='A'?'a te '+p.type+'od':ctrl==='B'?'az ellenfél '+p.type+'ja':p.type)+')',ctrl,own:ctrl,baseOf:ctrl,loc:e.loc||'bf0',m:e.m!=null?e.m:null,dmg:0,mods:[],kws:[],zone:'board',type:p.type};return id;});
    if(s.cost&&s.costTg==='x'){/* a költség célpontja a lépésnél (build) */}});
}
/** A lefutás állapota: frame-ek, battlefield hatások, játékállapot, a turn player és a kiinduló pillanatkép. */
function setupRun(X:EngineCtx){
  // ---- frame-ek ----
  X.FR=X.out.frames;X.REC=[];
  X.DET=new Set<string>();X.NEWCTRL=new Set<string>();
  // battlefield állandó hatások
  ['bf0','bf1'].forEach(l=>{const b=X.BF[l];if(b.c){const known=/can.t move from here to base|can.t be played here/i.test(b.c.txt||'');X.notes.push(X.line('169',esc(b.c.n)+' ('+(b.ctrl==='A'?'te irányítod':b.ctrl==='B'?'az ellenfél irányítja':'senki nem irányítja')+'): '+esc(stripRem(b.c.txt!))+(known?' <b>Ezt az állandó hatást az elemzés figyelembe veszi.</b>':' Ezt a hatást az elemzés nem értékeli ki, ha számít, vedd figyelembe.'),known?0:1));}});
  X.ALL.length=0;
  X.chain=[];X.stack=[];X.REPL=new Set<string>();X.READY={A:false,B:false};X.BUFF2={A:false,B:false};X.PREVSA={on:false};
  /** 143.4: a unit exhausted lép be. Kivétel (143.4.a): kifizetett Accelerate (805.6), a lap saját "I enter ready" sora (369.3; feltételes sornál a feltétel kiértékelve, vagy a builderben megadva),
      más lap folyamatos hatása (Confront, Bushwhack, Magma Wurm, Firebrand Raider, Renata, Riven legend, Sun Disc). Visszaadja: {ready, why, note}. */
  X.READYNEXT={A:false,B:false};X.ACCELNEXT={A:false,B:false};X.ZIL={A:false,B:false};X.LASTON={};X.LKX={};X.MORDE={};
  X.ST={} as StateFns;
  /* ---- játékállapot: builder mezők (kezdőértékek) és a lépésekből számolt változások ---- */
  X.PSD={xp:0,score:0,runes:0,runeDeck:12,played:0,playedT:'',spent:0,hand:0,diedT:0};
  /** A lépés előtt az adott játékos által (ebben a körben) kijátszott lapok típusai: a builder lépései és a korábbi kijátszások mezője. */
  X.ST.xpOf=X.xpOf;X.ST.scoreOf=X.scoreOf;X.ST.VS=X.VS;
  X.ST.diedT=(p:string,gearToo:boolean)=>+X.PSv(p,'diedT')>0||X.EV.some((e)=>e.k==='zone'&&e.to==='trash'&&X.O[e.id!]&&X.O[e.id!].own===p&&(X.O[e.id!].type==='unit'||gearToo&&X.O[e.id!].type==='gear'));
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
}
/** Combat utáni triggerek a Combat panel kiosztása szerint, majd új chain (467, 468). */
function runPostCombat(X:EngineCtx){
  /* Combat utáni triggerek: a Combat panel kiosztása szerinti eredmény, majd új chain a felvett triggerekkel (célpontokkal). */
  if(X.POST.length){const cb=X.POST[0].cb||{bf:'bf0',dead:[],recall:[],ctrl:'',label:''};const bl=cb.bf==='bf1'?'bf1':'bf0';
    X.story.push('A chain kiürült. Ezután jön a combat '+X.locLabel(bl)+' battlefielden, a Combat panel kiosztása szerint.');
    (cb.dead||[]).forEach((id:string)=>{const ob=X.O[id];if(ob&&ob.zone==='board'){X.leaveBoard(id,'trash');X.REC!.push(['467.2.d, 323.4',ob.name+': a combat damage-től meghal, a trashbe kerül.']);X.story.push(Art(ob.name)+' meghal a combatban.');}});
    (cb.recall||[]).forEach((id:string)=>{const ob=X.O[id];if(ob&&ob.zone==='board'){ob.loc='base';ob.baseOf=ob.ctrl;X.REC!.push(['468.1.a.2',ob.name+': attackerként recall-olódik a base-be.']);}});
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.zone==='board'&&ob.type==='unit'&&(ob.loc===bl||(cb.recall||[]).includes(id))&&ob.dmg){ob.dmg=0;}});X.REC!.push(['468.1.a.1','A túlélők damage-e a Combat Cleanupban gyógyul.']);
    if(cb.ctrl&&X.BF[bl].ctrl!==cb.ctrl){X.BF[bl].ctrl=cb.ctrl;X.REC!.push(['468.5',(cb.ctrl==='A'?'Te':'Az ellenfél')+' Establishes Control: '+X.locLabel(bl)+'.']);}
    X.snap('Combat: '+(cb.label||X.locLabel(bl)),[]);
    X.POST.forEach((s)=>{let id=s.src;if(!id||!X.O[id]){id='X'+s.j;X.O[id]={id,name:s.c.n,card:s.c.t?s.c:null,ctrl:s.pl,own:s.pl,loc:s.loc||bl,zone:'legend',type:'trigsrc'};}
      const it={kind:'step',s,label:X.O[id].name+' triggere ('+(s.why||'trigger')+')',name:X.O[id].name+' triggere',pl:s.pl,eff:s.eff,list:s.list,tg:s.tg,src:id,perm:false,from:null,loc:null,objId:null,dest:s.dest,ov:s.ov,isTr:true,notedLoc:/\b(?:conquer|hold)\b/i.test(s.why||'')?bl:null};
      const bad:string[]=[];s.list.forEach((p,ti)=>{const v=s.tg[ti];if(!v){if(!p.opt)bad.push('nincs megadva a kötelező '+(ti+1)+'. célpont');return;}const w=X.tgWhy(it,p,v,ti,'play');if(w.length)bad.push((ti+1)+'. célpont nem választható: '+w.join(' '));});
      if(bad.length){X.REC!.push(['403.4',X.O[id].name+' triggere ('+(s.why||'trigger')+') nem kerülhet a chainre legális választás nélkül: '+plainOf(bad.join('; '))+'. Lekerül (403.4).']);X.story.push(Art(X.O[id].name)+' triggere lekerül, mert nincs legális célpontja.');return;}
      X.pushTrig(it);X.REC!.push([s.why==='Deathknell'?'808.1.c, 808.1.d.2':/Conquer/i.test(s.why||'')?'383.4.c.2':'383.3',X.O[id].name+' triggere ('+(s.why||'trigger')+') a chainre kerül: '+s.eff]);X.story.push(Art(X.O[id].name)+' triggere ('+(s.why||'trigger')+') a chainre kerül.');});
    X.flushPend(X.stack);X.snap('Combat utáni triggerek a chainen',X.stack);X.resolveAll();}
}
/** Kör vége (317), a végállapot és a riport adatai. */
function finishRun(X:EngineCtx){
  /* ---- Kör vége (317), ha a builderben kérik: Ending Step ("at end of turn" delayed és "At the end of your turn" triggerek, 317.1.a, 391.2,
     383.2.a.1), majd Expiration Step (317.2): Ending Special Cleanup, heal, a "this turn" hatások lejárnak, a Rune Pool kiürül. */
  if(X.CS.end&&!X.ENDED){X.endStep();X.resolveAll();}
  if(X.ENDED)X.expiration();
  X.story.push('A chain kiürült.');
  X.REC!.push(['','A chain kiürült.']);if(X.out.delayed.length)X.REC!.push(['391.2',X.out.delayed.length+' delayed hatás vár későbbi időpontra: '+X.out.delayed.map((d)=>'"'+d.t+'"'+(d.on.length?' ('+d.on.join(', ')+')':'')).join('; ')]);X.snap('Végállapot: a chain üres',[]);X.REC=null;
  // ---- a riport adatai: a HTML-t a render/html/chainReport.ts készíti; nem felsorolható mező, így a kimenet (JSON) változatlan ----
  Object.defineProperty(X.out,'report',{value:{S:X.S,O:X.O,BF:X.BF,CS:X.CS,done:X.done,story:X.story,notes:X.notes,rows:X.rows,rr:X.rr,delayed:X.out.delayed,locLabel:X.locLabel,mightOf:X.mightOf},enumerable:false});
  void LOCK;
}
