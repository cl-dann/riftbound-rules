/* Lefutás: a chain feloldása, feltételek kiértékelése, osztott damage, egy tétel végrehajtása (a runChain() csoportja, S20) */
import type { EngineCtx, EStep, GameObj, MtTarget, ResolveRun } from './ctx';
import type { CardLike, Instr, TargetParam } from '../types';
import { esc } from '../../text/norm';
import { OV_LBL, OV_N, interp } from '../actions';
import { printedCost } from '../cost';
import { numOf, phrasesTxt } from '../parser';
import { stripRem as stripRemT } from '../text';
import { INS_ST, RES, art, Art, other, WHO } from './labels';

/** A következő körre szóló késleltetett hatás ("at the start of your next Main Phase", "until your next Ending Phase"). */
const NEXT_TURN=/\b(?:at the start of|until) your next\b/i;
export function installResolve(X: EngineCtx) {
  X.resolveAll=()=>{while(X.stack.length&&X.guard++<80){const it=X.stack.pop()!;const d0=X.done.length;try{X.resolveItem(it);X.flushPend(X.stack);}finally{const dn=X.done.length>d0?X.done[X.done.length-1]:null;X.snap('Resolve: '+it.label+(dn?', '+(RES[dn.res]||dn.res):''),X.stack);X.cleanup();}}};
  X.evalState=(cd,it,s,tv)=>{const c=cd.t;const pl=it.pl;let m:RegExpExecArray|null;const T=tv&&X.O[tv]?X.O[tv]:null;const S=it.src&&X.O[it.src!]?X.O[it.src!]:null;const here=S&&S.zone==='board'?S.loc:null;
    const cntU=(f:(o:GameObj)=>unknown)=>Object.values(X.O).filter((o)=>o.zone==='board'&&f(o)).length;cd.from='state';
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
    if((m=/^you control a facedown card( here| at a battlefield)?$/i.exec(c))){const bfs=['bf0','bf1'].filter((l,i)=>(X.CS.bf[i]||{}).fd===pl&&(!m![1]||!/here/i.test(m![1])||l===here));return bfs.length>0;}
    if(/^I didn't die alone$/i.test(c))return !!(S&&S.lk&&S.lk.alone===false);if(/^I died alone$/i.test(c))return !!(S&&S.lk&&S.lk.alone===true);
    if(/^I was \[?Mighty\]?$/i.test(c))return !!(S&&S.lk&&S.lk.m!>=5);
    if(/^I haven't been dealt damage this turn$/i.test(c))return !(S&&S.dealt);
    if(/^I am at a battlefield$/i.test(c))return !!(here&&here!=='base');
    if((m=/^you control a (\w+)$/i.exec(c))){const tg=m[1].toLowerCase();return cntU((o)=>o.ctrl===pl&&o.card&&((o.card.tg||[]).some((x:string)=>x.toLowerCase()===tg)||new RegExp('\\b'+m![1]+'\\b','i').test(o.card.n)))>0;}
    if(/^there is a friendly gear with \[Deploy\] here$/i.test(c))return cntU((o)=>o.ctrl===pl&&o.type==='gear'&&o.loc===here&&/\[Deploy\]/.test((o.card&&o.card.txt)||''))>0;
    if(/^there's an enemy unit alone at that battlefield$/i.test(c)){const l=T?(T.zone==='board'&&T.loc!=='base'?T.loc:(T.lk&&T.lk.loc)):null;return !!l&&cntU((o)=>o.type==='unit'&&o.ctrl!==pl&&o.loc===l)===1;}
    if(/^it's already stunned$/i.test(c))return !!(T&&T.st);
    if((m=/^there are (\d+) or more units there$/i.exec(c))){const f=(it.tg||[]).find((v:string)=>v==='F0'||v==='F1');const l=f==='F1'?'bf1':'bf0';return cntU((o)=>o.type==='unit'&&o.loc===l)>=+m[1];}
    if(/^it's your turn and you played this from face down$/i.test(c))return X.TP===pl&&it.from==='facedown';
    return null;};
  X.condSrc=(cd)=>cd.how==='open'?(cd.from==='field'?'(nyitott kérdés, judge dönt: '+cd.why+'; a lapnál így megadva)':'(nyitott kérdés, judge dönt: '+cd.why+'; feltételezés: nem teljesül, a lapnál állítható)'):cd.how==='hidden'?(cd.from==='field'?'(a lapnál megadva)':cd.from==='zone'?'(a deck felső lapja a pályás építőben megadva: '+cd.zn+', 108.4.e, 128.3)':cd.from==='zone2'?'(a pályás építőben megadott lapok alapján: '+cd.zn+')':cd.from==='lk'?'('+cd.zn+')':'(feltételezés: nem teljesül; '+(cd.why||'rejtett adat')+', a lapnál állítható)'):cd.how==='state'?'(játékállapotból'+(cd.val?': '+cd.val:'')+'; a kezdőérték a builderben állítható)':'(a boardon ellenőrizve)';
  X.evalCond=(cd,it,s,xi,tv)=>{if(!cd)return true;const c=cd.t.toLowerCase();let m:RegExpExecArray|null;
    if(/^you paid (?:the|my) additional cost/.test(c))return !!(s&&s.addc);if(/^you played this from your hand/.test(c))return (it.from||'hand')==='hand';
    if(cd.how==='hidden'||cd.how==='open'){const v=s&&s.cnd?s.cnd[xi]:null;if(v==='1'||v==='0'){cd.from='field';return v==='1';}
      if(/^you revealed a card with the lowest energy cost$/i.test(cd.t)&&it.zEachTop&&X.O[it.zEachTop.A]&&X.O[it.zEachTop.B]){const eA=printedCost(X.O[it.zEachTop.A].card).e,eB=printedCost(X.O[it.zEachTop.B].card).e;const mine=it.pl==='A'?eA:eB,theirs=it.pl==='A'?eB:eA;cd.from='zone';cd.zn=X.O[it.zEachTop[it.pl]].name+' '+mine+' Energy, a másik '+theirs+' Energy'+(mine===theirs?'; döntetlen: a Core Rules nem dönti el, hogy egyenlő költségnél "a legalacsonyabb"-e (nyitott kérdés, judge dönt; az elemzés igennel számol)':'');if(mine===theirs)cd.tie=true;return mine<=theirs;}
      const zm=/^it's an? (gear|spell|unit)$|^it is a (unit)$/i.exec(cd.t);
      /* az előző utasítás hatásból kijátszott lapja (Ava Achiever: a kézből, Rek'Sai: a banishelt lap) */
      if(zm&&it.zLastT){cd.from='zone2';cd.zn=it.zLastN+' ('+it.zLastT+')';return it.zLastT===(zm[1]||zm[2]).toLowerCase();}
      /* "if it had N [S] or less": a célpont utolsó ismert Mightja, visszatekintéssel (359.3.e.13) */
      if((m=/^it had (\d+) \[S\] or less$/i.exec(cd.t))&&tv&&X.O[tv]){const T=X.O[tv];const mt=T.zone!=='board'&&T.lk&&T.lk.m!=null?T.lk.m:X.mightOf(tv);if(mt!=null){cd.from='lk';cd.zn=T.name+' utolsó ismert Mightja '+mt+' (visszatekintés, 359.3.e.13)';return mt<=+m[1];}}
      if(/^there are four spells banished with me$/i.test(cd.t)&&it.src){const n=Object.values(X.O).filter((o)=>o.banWith===it.src&&o.zone==='banish'&&o.card&&o.card.t==='Spell').length;const pre=+X.PSv(it.pl,'jhinBan')||0;cd.from='zone2';cd.zn='ebben a helyzetben '+n+' spell banishelve vele, korábban '+pre+' (a Játékállapotban megadott feltételezés, alap 0)';return n+pre>=4;}
      if(/^you revealed a Bird\b/i.test(cd.t)&&X.ZC&&it.zLook){const ob=it.zRev?X.O[it.zRev]:null;cd.from='zone2';cd.zn=ob?ob.name+(ob.card&&(ob.card.tg||[]).length?' ('+(ob.card.tg||[]).join(', ')+')':''):'nem fedett fel lapot';return !!(ob&&ob.card)&&['Bird','Cat','Dog','Poro'].some((t)=>(ob.card!.tg||[]).includes(t));}
      if(/^it has that type$/i.test(cd.t)&&it.zGuess&&it.zTop&&X.O[it.zTop]){const t=String(X.O[it.zTop].card!.t).toLowerCase();cd.from='zone2';cd.zn='tipp: '+it.zGuess+', felfedve: '+X.O[it.zTop].name+' ('+t+')';return t===it.zGuess;}
      if((m=/^you have exactly (\d+) cards in hand and exactly (\d+) units at battlefields$/i.exec(cd.t))&&X.ZC){const h=X.zoneIds('hand',it.pl).length;const u=Object.values(X.O).filter((o)=>o.zone==='board'&&o.type==='unit'&&o.ctrl===it.pl&&o.loc&&o.loc!=='base').length;cd.from='zone2';cd.zn='kéz: '+h+' lap (a pályás építőben megadott kéz, 128.4), battlefielden: '+u+' unit';return h===+m[1]&&u===+m[2];}
      if(zm&&it.zTop&&X.O[it.zTop]){cd.from='zone';cd.zn=X.O[it.zTop].name;return String(X.O[it.zTop].card!.t).toLowerCase()===(zm[1]||zm[2]).toLowerCase();}
      cd.from='default';return false;}
    if(cd.how==='state'){const r=X.evalState(cd,it,s,tv);return r;}
    if(cd.how!=='board')return null;
    const T=tv&&X.O[tv]?X.O[tv]:null;const S=it.src&&X.O[it.src!]?X.O[it.src!]:null;const here=S&&S.zone==='board'?S.loc:null;
    const cntU=(f:(o:GameObj)=>unknown)=>Object.values(X.O).filter((o)=>o.zone==='board'&&f(o)).length;
    if(/empowered/.test(c))return /^(?:i'm|this is)/.test(c)?!!(S&&S.emp):!!(T&&T.emp);
    if(/already buffed/.test(c))return !!(T&&T.bu);if(/is stunned/.test(c))return !!(T&&T.st);
    if(/mighty/.test(c)){const mt=T?X.mightOf(T.id):null;return mt==null?null:mt>=5;}
    if(/^i'm at a battlefield/.test(c))return !!(here&&here!=='base');
    if((m=/^it has (\d+) \[s\] or less/.exec(c))){const mt=T?X.mightOf(T.id):null;return mt==null?null:mt<=+m[1];}
    if(/^it's your turn/.test(c))return X.TP===it.pl;if(/^it's not your turn/.test(c))return X.TP!==it.pl;
    if(/exactly one other unit you control here/.test(c))return cntU((o)=>o.type==='unit'&&o.ctrl===it.pl&&o.loc===here&&o.id!==it.src)===1;
    if(/^an enemy unit is alone here/.test(c))return cntU((o)=>o.type==='unit'&&o.ctrl!==it.pl&&o.loc===here)===1;
    if((m=/^it was (?:a|an) (friendly|enemy) unit/.exec(c))){if(!T)return null;const tc=(T.lk&&T.lk.ctrl)||T.ctrl;return m[1]==='friendly'?tc===it.pl:tc!==it.pl;}
    if(/^you control this battlefield/.test(c)){const l=here;return l&&l!=='base'?X.BF[l].ctrl===it.pl:null;}
    if((m=/^you (?:control|have) (a|an|two or more|\d+ or more|exactly \d+|exactly two|\d+\+) (other )?(?:friendly )?(units?|gear)(?: (here|there|at that battlefield))?/.exec(c))){
      const w=m[4]==='here'?here:m[4]?(T?T.loc:here):null;const n=cntU((o)=>o.ctrl===it.pl&&o.type===(/gear/.test(m![3])?'gear':'unit')&&(!m![2]||o.id!==it.src)&&(!w||o.loc===w));
      const q=m[1];if(q==='a'||q==='an')return n>=1;if(q==='two or more')return n>=2;let k;if((k=/^(\d+)(?: or more|\+)$/.exec(q)))return n>=+k[1];if((k=/^exactly (\d+|two)$/.exec(q)))return n===numOf(k[1]);}
    return null;};
  X.splitRun=(x,prev)=>{const refs0=['355.14'];const legalT:number[]=[];
    x.tis.forEach((ti:number)=>{const v=X.it0!.tg[ti];if(!v)return;X.tot0.n++;const w=X.tgWhy(X.it0!,X.it0!.list[ti],v,ti,'res');if(w.length){X.tgOut0[ti]='ign';X.mtT0.push({n:X.O[v].name,ok:false,why:w.join(', ')});if(X.O[v].zone==='board')X.MTIDS.add(v);}else{legalT.push(ti);X.tgOut0[ti]='ok';X.mtT0.push({n:X.O[v].name,ok:true});X.legal0.n++;}});
    let T:number|null|undefined=x.act.n;if(x.act.k==='dmgM'){const pv=prev?prev.tis.map((ti:number)=>X.it0!.tg[ti]).find((v:string)=>v&&X.O[v]&&X.O[v].zone==='board'):null;T=pv?X.mightOf(pv):null;}
    if(T==null){x.st='ignored';x.ref='359.3.e.12';x.why='a szétosztandó damage értéke nem elérhető';return;}
    const b=X.bonusDmg(X.it0!.pl);if(b){T+=b;refs0.push('715.3');}
    if(!legalT.length){x.st='ignored';x.ref='359.3.e.6';x.why='minden célpontja illegális';return;}
    const need=Math.min(T,legalT.length);const sp=(X.it0!.s&&X.it0!.s.split)||{};
    const asg:Record<string,number>={};legalT.forEach((ti:number)=>{const a=+sp[ti]!||0;if(a>0)asg[ti]=a;});const keys=Object.keys(asg).map(Number);const sum=keys.reduce((q,k)=>q+asg[k],0);
    let why='';if(!keys.length)why='nincs megadva kiosztás';else if(sum!==T)why='a megadott kiosztás összege '+sum+', de a szétosztandó damage '+T;else if(keys.length<need)why='csak '+keys.length+' célpont kapna damage-et, de nem lehet kevesebb célpont, mint damage ('+need+', 355.14.h.1)';
    if(why){const kept=legalT.slice(0,need);kept.forEach((ti:number)=>{asg[ti]=0;});Object.keys(asg).forEach(k=>{if(!kept.includes(+k))delete asg[k];});kept.forEach((ti:number,i:number)=>{asg[ti]=1+(i===0?T!-need:0);});
      X.parts0.push('Osztott damage: '+T+' damage, '+legalT.length+' legális célpont. '+esc(why)+'; a kiosztást a játékos dönti el (355.14.e), az elemzés javaslata: '+kept.map((ti:number)=>esc(X.O[X.it0!.tg[ti]].name)+' '+asg[ti]).join(', ')+'.');}
    else X.parts0.push('Osztott damage: '+T+' damage a builderben megadott kiosztás szerint.');
    if(legalT.length>T)refs0.push('355.14.h','355.14.h.1');
    legalT.forEach((ti:number)=>{const v=X.it0!.tg[ti];if(!asg[ti]){X.parts0.push(esc(X.O[v].name)+' nem kap damage-et, kiesik a célpontok közül (355.14.h).');return;}const d=X.dealDmg(v,asg[ti],X.parts0,refs0);if(d>0){X.it0!.hit=(X.it0!.hit||[]).concat([v]);X.story.push(Art(X.it0!.name||X.it0!.label)+' '+d+' damage-et oszt '+art(X.O[v].name)+' lapra (osztott damage).');}});
    refs0.forEach(r=>X.refs1.push(r));x.st=legalT.length<x.tis.filter((ti:number)=>X.it0!.tg[ti]).length?'partial':'executed';x.ref='355.14';x.why=x.st==='partial'?'csak a legális célpontokra':'';};
  /** "Do one of the following based on ...": a lap felsorolt pontjai ("* [R] ...", "* Spell ...") az utasítás után kerülnek, és csak a döntő érték szerinti pont hajtódik végre (a lap szövege, 388.1.b). */
  X.expandBased=(it,INS)=>{const xi=INS.findIndex((x)=>/\bbased on\b/i.test(x.t)&&x.act.field&&x.act.field.type==='sel');if(xi<0||xi!==INS.length-1)return;
    const card=(it.kind==='step'&&it.s&&it.s.c)||(it.src&&X.O[it.src]?X.O[it.src].card:null)||it.fxCard;if(!card)return;
    const bl=(card.txt||'').split('\n').map((l:string)=>/^\*\s*(\[[A-Z]\]|[A-Za-z]+)\s*[\u2014\u2013-]\s*(.+)$/.exec(l.trim())).filter((m):m is RegExpExecArray=>!!m);if(!bl.length)return;
    it.list=(it.list||[]).slice();it.tg=(it.tg||[]).slice();const add:Instr[]=[];
    bl.forEach((m)=>{const key=m[1].replace(/[[\]]/g,'').toLowerCase();const eff=stripRemT(m[2]).replace(/ and (\d+) to all other enemy units here\./i,'. Deal $1 to all other enemy units here.');const L=phrasesTxt(eff);const base=it.list.length;
      interp({},{eff,list:L,c:card}).forEach((y)=>{y.tis=y.tis.map((t:number)=>t+base);y.basedOn={xi,key};add.push(y);});it.list=it.list.concat(L);L.forEach(()=>it.tg.push(''));});
    INS.splice(xi+1,0,...add);};
  X.resolveItem=(it)=>{const rec0=X.REC!.length;const all0=X.ALL.length;const ir0=X.INRES;X.INRES=true;try{X.resolveItem0(it);}finally{X.INRES=ir0;
      /* az elem saját sora kerüljön előre a "Mi változott?" listában, utána a közben történt mellékhatások (leválás, kontroll) */
      if(X.REC!.length>rec0+1&&X.ALL.length>all0+1){const a=X.REC!.pop()!;X.REC!.splice(rec0,0,a);const b=X.ALL.pop()!;X.ALL.splice(all0,0,b);}}};
  X.resolveItem0=(it)=>{it.rdBefore=X.runeDeckOf(it.pl);it.ev0=X.EV.length;const s=(it.s||null) as EStep;const perm=!!it.perm;const self=it.objId?X.O[it.objId]:null;const srcName=it.name||it.label;
    const head='<b>'+esc(srcName)+'</b>'+(perm?' play triggere':it.kind==='auto'?' ('+esc(it.why)+')':'')+' resolve-ol. ';
    if(self&&self.zone==='countered'){if(self.toHand){self.zone='hand';self.zone0='countered';}const pt=it.kind==='step'&&s&&s.k==='card'?X.playTrigs(s):[];X.rr+=X.line('426.1'+(pt.length?', 420.4.a.1, 426.1.b':''),head+(self.type==='ability'?'Counterelték: nem csinál semmit, lekerül a chainről és megszűnik.':'Counterelték: nem csinál semmit, '+(self.toHand?'a tulajdonosa kezébe kerül':'a trashbe kerül')+', a költség nem jár vissza, és nem számít kijátszottnak.')+(pt.length?' Ezért nem triggerel: '+pt.map((tr)=>esc(tr.label)).join(', ')+'.':''),0);X.story.push(Art(srcName)+' sorra kerülne, de counterelték: nem történik semmi.');X.done.push({name:srcName,pl:it.pl,res:'countered'});X.out.items.push({name:srcName,res:'countered',instr:[],targets:[]});return;}
    if((it.kind==='auto'&&it.why==='Deathknell'&&it.sent===false)||(it.isTg&&it.dk&&!it.sent)){X.rr+=X.line('808.1.d.1, 808.1.d',head+'A forrás nem került a trashbe (nem halt meg), ezért a trigger lekerül a chainről.',0);X.done.push({name:it.label,pl:it.pl,res:'removed'});X.out.items.push({name:it.label,res:'removed',instr:[],targets:[]});return;}
    /* hold trigger, amelynek hatása egy delayed trigger (Iascylla, Blue Sentinel): a delayed trigger most jön létre, a választás a lefutásakor (391.2) */
    if(it.mkDelay){const nm=it.src&&X.O[it.src]?X.O[it.src].name:srcName;X.out.delayed.push({t:it.eff,who:it.pl,src:nm,srcId:it.src||null,on:[],ids:[],...(it.notedLoc?{loc:it.notedLoc}:{})});X.EV.push({k:'delayed',t:it.eff});
      X.rr+=X.line('340.1, 391.2',head+'Delayed trigger jön létre: "'+esc(it.eff)+'". A megadott időpontban triggerel, a választás (célpont) akkor történik.',0);X.story.push(Art(srcName)+' lefut: delayed hatás jön létre.');
      X.done.push({name:it.label,pl:it.pl,res:'ok'});X.out.items.push({name:it.label,res:'ok',instr:[{t:it.eff,k:'delayed',st:'executed',ref:'391.2'}],targets:[]});return;}
    if(it.kind==='auto'&&it.why==='Deathknell'&&it.sent&&X.O[it.src!]&&X.O[it.src!].zone!=='trash')X.rr+=X.line('808.1.d.1, 808.1.d','<b>'+esc(srcName)+'</b>: a forrás a trashbe került, de onnan a resolve előtt elmozdult. A trigger ettől még lefut, mert a 808.1.d.1 csak azt az esetet nevezi meg, amikor a lap nem kerül a trashbe.',1);
    let t=head;let fl=it.kind==='auto'?1:0;const refs=['340.1'];
    if(perm&&self&&self.zone!=='board'){X.story.push(Art(srcName)+' már nincs a boardon, de a play triggere a chainen maradt, ezért lefut.');t+='A forrás már nincs a boardon, de a trigger független objektum, ezért lefut (355.9.c). A forrásra vonatkozó információ ("me", "here", "my") a végrehajtáskor nem elérhető, az erre épülő utasítás Ignored (359.3.f.2, 359.3.e.6). ';fl=1;}
    if(it.endTrig&&it.src&&X.O[it.src!]&&!['board','legend'].includes(X.O[it.src!].zone)){t+='A forrás már nincs a boardon, de a trigger feltétele a triggereléskor teljesült, ezért a trigger lefut (383.2.a.1). ';refs.push('383.2.a.1');}
    if(it.kind==='step'&&s.k==='ab'&&it.src&&X.O[it.src!]&&!['board','legend'].includes(X.O[it.src!].zone)){t+='Az ability forrása már nincs a boardon, de az ability ettől még lefut (355.9.c). ';fl=1;}
    const INS=it.kind==='step'?interp(s,s):interp({},{eff:it.eff,list:it.list&&it.list.length?it.list:phrasesTxt(it.eff||''),c:(it.src&&X.O[it.src!]?X.O[it.src!].card:it.fxCard||null) as CardLike});X.MAN=INS.some((x)=>x.manual);if(it.pre&&it.pre.length&&INS[0])INS[0].lk=true;
    X.expandBased(it,INS);
    const parts:string[]=[];const tgOut:string[]=[];const mtT:MtTarget[]=[];let lastT:Pick<Instr,'tis'|'st'|'act'|'t'>|null=null;if(it.pre&&it.pre.length){const base=(it.tg||[]).length;it.tg=(it.tg||[]).concat(it.pre);it.list=(it.list||[]).concat(it.pre.map((v:string)=>({type:X.O[v]?X.O[v].type:'unit',rel:'any',max:null,bf:false,opt:true,pre:true} as TargetParam)));it.pre.forEach((_,i)=>{tgOut[base+i]='ok';});lastT={tis:it.pre.map((_,i)=>base+i),st:'executed',act:{k:'pre'},t:'(a delayed hatás létrehozásakor megjelölt célpont)'};}X.it0=it;X.parts0=parts;X.refs1=refs;X.tgOut0=tgOut;X.mtT0=mtT;
    const R:ResolveRun={it,s,perm,self,srcName,INS,parts,refs,tgOut,mtT,t,fl,legal:0,tot:0,lastT};
    X.resolveSubsets(R);
    // "If ..., X instead": a feltétel teljesülése esetén az előző utasítás helyett ez hajtódik végre (369.1)
    INS.forEach((x,xi)=>{if(x.act.k==='counterToHand'){const b=INS.slice(0,xi).reverse().find((y)=>y.act.k==='counter');if(b){b.act=Object.assign({},b.act,{toHand:true});x.prep='a counterelt spell a kézbe kerül';}}
      /* Dancing Grenade: az újra kijátszott példány Bonus Damage-et kap annyival, ahányszor ez a spell ebben a körben már damage-et osztott (715.1; levezetés: az "If they do" az újra kijátszásra vonatkozik) */
      if(/additional Bonus Damage for each time this spell has dealt damage this turn/i.test(x.t)&&it.fxCard){const b=INS.slice(0,xi).reverse().find((y)=>y.act.k==='dmg');const k=X.out.items.filter((q)=>q.name.replace(/ \(hatásból kijátszott spell\)$/,'')===it.fxCard!.n&&q.instr.some((z)=>z.k==='dmg'&&z.st==='executed')).length;
        if(b&&k){b.act=Object.assign({},b.act,{bonus:k});x.prep='Bonus Damage: '+k+' (ennyiszer osztott damage-et ez a spell ebben a körben ebben az elemzésben)';}}
      if(x.act.k==='bonusTrashName'){const b=INS.slice(0,xi).reverse().find((y)=>y.act.k==='dmg');const fv=s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!==''?+s.hv[xi]:0;const nm2=(it.s&&it.s.c&&it.s.c.n)||'';const tc=Object.values(X.O).filter((o)=>o.zone==='trash'&&o.own===it.pl&&o.card&&o.card.n===nm2&&o.id!==it.objId).length;
        if(b){b.act=Object.assign({},b.act,{bonus:fv+tc});x.prep='Bonus Damage: '+(fv+tc)+' ('+fv+' a lapnál megadott korábbi, '+tc+' ebben az elemzésben a trashbe került példány)';}}});
    INS.forEach((x,xi)=>{if(!x.act.alt)return;let pi=xi-1;while(pi>=0&&INS[pi].act.alt)pi--;const base=INS[pi];if(!base)return;
      const tv=base.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&X.O[v]);const cv=X.evalCond(x.act.cond,it,s,xi,tv);x.cv=cv;
      if(cv===true){base.act=Object.assign({},x.act,{alt:false,cond:null});base.altBy=x.t;x.altUsed=true;}});
    INS.forEach((x,xi)=>X.resolveInstr(R,x,xi));
    X.resolveFinish(R);};
  /** Egy célpont végrehajtása az utasításon (359.3.e: a legalitás a resolve-kor). */
  X.resolveTarget=(R,x,ti)=>{const {it,perm,srcName,parts,refs,tgOut,mtT}=R;
    const p=it.list[ti];const v=it.tg[ti];if(!v)return;if(p&&p.copySrc){tgOut[ti]='ok';return;}R.tot++;if(v==='F0'||v==='F1'){R.legal++;tgOut[ti]='ok';return;}const ob=X.O[v];
      const wS=X.tgWhy(it,p,v,ti,'res');
      if(wS.length){tgOut[ti]='ign';mtT.push({n:ob.name,ok:false,why:wS.join(', ')});if(ob.zone==='board')X.MTIDS.add(v);X.EV.push({k:'mistarget',id:v,name:ob.name,item:srcName});
        parts.push('<span class="stbad">'+(ti+1)+'. célpont illegális</span> ('+esc(ob.name)+' '+wS.join(', ')+'): mistarget, rá a hatás elmarad (359.3.e.2, 359.3.e.5).');refs.push('359.3.e.9');X.story.push(Art(srcName)+(perm?' triggere':'')+' sorra kerül, de '+(it.list.length>1?((ti===0||ti===4)?'az ':'a ')+(ti+1)+'.':'a')+' célpontja ('+ob.name+') '+wS.join(', ').replace(/ \([0-9.,a-z ]+\)/g,'')+': mistarget, rá a hatás elmarad.');return;}
      R.legal++;mtT.push({n:ob.name,ok:true});const xa=x.act;if(it.prot758&&it.prot758.length){parts.push([...new Set(it.prot758)].join(' ')+'.');refs.push(/758\.2\.a/.test(it.prot758.join(''))?'758.2.a':'758.2');it.prot758=[];}
      if(xa.k==='counter'&&ob.type==='spell'&&xa.unless&&it.pays){tgOut[ti]='neg';parts.push(esc(ob.name)+' irányítója kifizeti a kért költséget, ezért a counter nem történik meg.');X.story.push(Art(srcName)+' lefut, de '+art(ob.name)+' gazdája kifizeti a kért költséget, így a spell marad.');return;}
      if(['draw','channel','discard','choose','deck','xp','score','pay','showoff','fight','win','perm'].includes(xa.k)){tgOut[ti]='ok';if(xa.k==='choose')parts.push(esc(ob.name)+' kiválasztva.');return;}
      if(xa.k==='copy'){tgOut[ti]='ok';const made=R.made||[];if(made.length){X.copyOnto(made,v,parts,refs);R.copied=made;}else parts.push('"'+esc(x.t)+'": nincs ebben a resolve-ban létrehozott token, ami '+esc(ob.name)+' másolatává válhatna.');return;}
      if(xa.k==='note'){tgOut[ti]='ok';if(!x.noted){x.noted=1;parts.push((xa.open?'<span class="cbuns">nyitott kérdés</span> ':'')+esc(ob.name)+': "'+esc(x.t)+'": '+esc(xa.d||'')+(xa.refs?' ('+xa.refs+')':'')+'.');if(xa.refs)xa.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));}R.fl=Math.max(R.fl,xa.open?2:1);return;}
      if(xa.k==='delayed'&&NEXT_TURN.test(x.t)){tgOut[ti]='ok';if(!x.dlMade){x.dlMade=1;X.out.delayed.push({t:x.t,who:it.pl,src:srcName,srcId:it.src||it.objId||null,on:[],ids:[],...(it.notedLoc?{loc:it.notedLoc}:{})});}parts.push(esc(ob.name)+': "'+esc(x.t)+'": delayed trigger jön létre a következő körre (391.2, 391.4); a választás a lefutásakor történik, a lefutását a "Következő kör" lépés mutatja.');refs.push('391.2');R.fl=Math.max(R.fl,1);return;}
      if(xa.k==='other'||xa.k==='delayed'||xa.k==='playcard'||xa.k==='replay'||xa.k==='token'){tgOut[ti]='ok';parts.push(esc(ob.name)+': "'+esc(x.t)+'" lefut, ezt az elemzés nem követi részletesen.');R.fl=Math.max(R.fl,1);return;}
      const r=X.applyTo(v,Object.assign({t:x.t},xa),it,parts,refs);tgOut[ti]=r==='neg'?'neg':r==='ign'?'ign':'ok';if(r==='ign')R.legal--;};
  /** A választott részhalmazból kimaradt célpont (355.11.b) Ignored, a többi végrehajtódik. */
  X.resolveTargetX=(R,x,ti)=>{const {it,tgOut,mtT}=R;
    if(it.dropT&&it.dropT.has(ti)){R.tot++;tgOut[ti]='ign';mtT.push({n:X.O[it.tg[ti]].name,ok:false,why:'kimarad a választott részhalmazból (355.11.b)'});return;}X.resolveTarget(R,x,ti);};
  /** Részhalmaz a resolve-kor: azonos location (355.11.b, 355.11.b.1) és összesített Might (Fox-Fire, 355.11.b). */
  X.resolveSubsets=(R)=>{const {it,s,srcName,parts,refs}=R;
    // Bellows Breath típus: "at the same location" csoport a resolve-kor (355.11.b, 355.11.b.1)
    if(it.list.some((p)=>p.same)){const live=it.tg.map((v:string,ti:number)=>v&&X.O[v]&&X.O[v].zone==='board'?{v,ti,loc:X.O[v].loc}:null).filter((x)=>x!==null);const groups:Record<string,typeof live>={};live.forEach((x)=>{(groups[x.loc!]=groups[x.loc!]||[]).push(x);});const keys=Object.keys(groups);
      if(keys.length>1){keys.sort((a,b)=>groups[b].length-groups[a].length);const keep=keys[0];
        parts.push('A célpontok már nem állnak egy locationön, ezért '+WHO[it.pl]+' választ egy legális részhalmazt (355.11.b). A részhalmaznak az adott locationön álló összes eredeti célpontot tartalmaznia kell (355.11.b.1), de bármelyik location választható: '+keys.map(k=>esc(X.locLabel(k))+': '+groups[k].map((x)=>esc(X.O[x.v].name)).join(', ')).join('; vagy ')+'. Az elemzés ezt számolja: '+esc(X.locLabel(keep))+'; a másik választással a hatás a másik csoportra jutna.');refs.push('355.11.b','355.11.b.1');
        live.forEach((x)=>{if(x.loc!==keep){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});}}
    // Összesített Might megkötés (Fox-Fire, 355.11.b): ha a megmaradt célpontok együtt már nem felelnek meg, legális részhalmaz kell
    const tmP=it.list.find((p)=>p.totalMax!=null);
    if(tmP){const live=it.tg.map((v:string,ti:number)=>v&&X.O[v]&&X.O[v].zone==='board'&&X.O[v].loc!=='base'&&!(it.dropT&&it.dropT.has(ti))?{v,ti,m:X.mightOf(v)||0}:null).filter((x)=>x!==null);const sum=live.reduce((a:number,x)=>a+x.m,0);
      if(sum>tmP.totalMax!){let keep:typeof live;const sub=s&&Array.isArray(s.sub)?s.sub.map(Number):null;const subL=sub?live.filter((x)=>sub.includes(x.ti)):null;
        if(subL&&subL.length&&subL.reduce((a:number,x)=>a+x.m,0)<=tmP.totalMax!){keep=subL;parts.push('A célpontok együttes Mightja ('+sum+') már nagyobb, mint '+tmP.totalMax+', ezért '+WHO[it.pl]+' a lapnál megadott legális részhalmazt választja: '+keep.map((x)=>esc(X.O[x.v].name)+' ('+x.m+')').join(', ')+' (355.11.b).');}
        else{keep=[];let acc=0;live.slice().sort((a,b)=>a.m-b.m||a.ti-b.ti).forEach((x)=>{if(acc+x.m<=tmP.totalMax!){keep.push(x);acc+=x.m;}});keep.sort((a,b)=>a.ti-b.ti);
          parts.push('A célpontok együttes Mightja ('+sum+') már nagyobb, mint '+tmP.totalMax+', ezért '+WHO[it.pl]+' az eredeti célpontok egy legális részhalmazát választja (355.11.b). '+(sub?'A lapnál megadott részhalmaz nem legális, ezért ':'')+'Feltételezés: a lehető legtöbb célpont marad ('+keep.map((x)=>esc(X.O[x.v].name)+' '+x.m+' Might').join(', ')+'); a részhalmaz a lapnál választható. Új, eredetileg nem választott unit nem kerülhet bele.');}
        refs.push('355.11.b');live.forEach((x)=>{if(!keep.includes(x)){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});
        X.story.push(Art(srcName)+' célpontjai együtt már '+sum+' Mightúak, ezért csak egy legális részhalmazukra hat ('+keep.map((x)=>X.O[x.v].name).join(', ')+').');}}};
  /** A resolve összegzése: utasítások, mistarget panel, eredmény, szabálysor. */
  X.resolveFinish=(R)=>{const {it,s,perm,self,srcName,INS,parts,refs,mtT}=R;
    const insShown=INS.length>1||INS.some((x)=>x.st!=='executed');
    if(X.MAN)parts.push('<b>Kézzel beállított értelmezés:</b> '+INS.filter((x)=>x.manual).map((x)=>'"'+esc(x.t)+'" = '+esc((OV_LBL[x.act.k]||x.act.k).replace(/ N$/,''))+(OV_N.has(x.act.k)?' '+x.act.n:'')+(x.lk?', linked':'')).join('; ')+'.');
    if(insShown){parts.push('Utasítások: '+INS.map((x)=>'"'+esc(x.t)+'": '+INS_ST[x.st]+(x.ref?' ('+x.ref+')':'')+(x.manual?' [kézi]':'')).join('; ')+'.');
      INS.forEach((x)=>{if(x.ref)x.ref.split(/,\s*/).forEach((r:string)=>refs.push(r));});
      INS.forEach((x,xi)=>{if(xi&&(x.st==='ignored'||x.st==='skipped'))X.story.push('"'+x.t+'": '+INS_ST[x.st]+', mert '+x.why+'.');});}
    if(R.tot&&(mtT.some((q)=>!q.ok)||INS.some((x)=>x.st==='negated'||x.st==='skipped')))
      X.MT={item:srcName+(perm?' (play trigger)':''),kind:!R.legal?'full':mtT.some((q)=>!q.ok)?'partial':'none',targets:mtT,instr:INS.map((x)=>({t:x.t,st:x.st,ref:x.ref,why:x.why,man:x.manual}))};
    else if(!R.tot&&INS.some((x)=>x.st==='negated'||x.st==='skipped'||x.st==='ignored'))X.MT={item:srcName,kind:'none',targets:[],instr:INS.map((x)=>({t:x.t,st:x.st,ref:x.ref,why:x.why,man:x.manual}))};
    if(!parts.length){parts.push(it.kind==='step'&&s.k==='card'&&s.c.sh?'Hatás: '+esc(s.c.sh):'Hatás: '+esc(it.eff||''));R.fl=Math.max(R.fl,1);X.story.push(Art(srcName)+' lefut'+(it.kind==='step'&&s.k==='card'&&s.c.sh?': '+s.c.sh:': '+it.eff));}
    if(R.tot&&!R.legal&&mtT.some((q)=>q.skip)){parts.push('A célponttól függő utasítások Ignored-ok (359.3.e.14.a'+(INS.some((x)=>/359\.3\.e\.12/.test(x.ref||''))?', 359.3.e.12':'')+'), a hatás ezekre elmarad.');refs.push('359.3.e.14.a');}
    else if(R.tot&&!R.legal){const rest=INS.some((x)=>x.st==='executed'&&!x.tis.length);if(rest){parts.push('Teljes mistarget: minden célpontja illegális lett, a célponthoz nem kötött utasítás viszont végrehajtódik.');refs.push('359.3.e.7');}else{parts.push('Teljes mistarget: minden célpontja illegális lett, ezért hatás nélkül resolve-ol'+(perm||it.kind!=='step'||s.k!=='card'?'':', de kijátszottnak számít (359.3.e.10)')+'.');refs.push('359.3.e.7');X.story.push(Art(srcName)+' így hatás nélkül fejeződik be.');}}
    else if(R.tot&&R.legal<R.tot&&R.tot>1)refs.push('359.3.e.8');
    if(self&&self.type==='spell')self.zone='trash';if(self&&self.type==='ability'&&self.zone==='chain')self.zone='none';
    if(it.kind==='step'&&s&&s.k==='card'&&s.c.t==='Spell'){const pt=X.playTrigs(s);pt.forEach((tr)=>X.pushTrig(tr));if(pt.length){parts.push('A kijátszás most fejeződött be a resolve-val, ezért triggerel: '+pt.map((tr)=>esc(tr.label)).join(', ')+' (420.4.a; akkor is, ha egyik utasítás sem hajtódott végre, 359.3.e.10).');refs.push('420.4.a');}}
    const res=(R.tot&&!R.legal)?'fizzle':(R.tot&&R.legal<R.tot)?'partial':'ok';
    X.done.push({name:it.label,pl:it.pl,res});X.out.items.push({name:it.label,res,instr:INS.map((x)=>({t:x.t,k:x.act.k,st:x.st,ref:x.ref,lk:x.lk})),targets:mtT});
    if(it.flL)R.fl=Math.max(R.fl,1);if(it.fl2)R.fl=2;X.rr+=X.line(refs.join(','),R.t+parts.join(' '),R.fl);X.MAN=false;};
}
