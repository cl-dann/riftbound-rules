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
