/* Játékállapot: battlefield tiltások, játékállapot mezők, korábbi kijátszások, enter ready (a runChain() csoportja, S20) */
import type { EngineCtx, GameObj, ReadyInfo } from './ctx';
import { esc } from '../../text/norm';
import { enterReadyCond } from '../conditions';
import { stripRem } from '../text';
import { other } from './labels';

export function installState(X: EngineCtx) {
  X.bfBlocksBase=(l)=>X.BF[l!]&&X.BF[l!].c&&/can.t move from here to base/i.test(X.BF[l!].c!.txt||'');
  X.bfBlocksPlay=(l)=>X.BF[l!]&&X.BF[l!].c&&/can.t be played here/i.test(X.BF[l!].c!.txt||'');
  X.PSv=(p,k)=>{const v=((X.CS.ps||{})[p]||{})[k];return v==null||v===''?X.PSD[k]:v;};
  X.VS=()=>+(X.CS.vs||8);
  X.evSum=(k,p)=>X.EV.filter((e)=>e.k===k&&e.pl===p).reduce((a:number,e)=>a+(e.n||0),0);
  X.xpOf=(p)=>+X.PSv(p,'xp')+X.evSum('xp',p);
  X.scoreOf=(p)=>+X.PSv(p,'score')+X.evSum('score',p);
  X.runesOf=(p)=>+X.PSv(p,'runes')+X.evSum('channel',p);
  X.runeDeckOf=(p)=>Math.max(0,+X.PSv(p,'runeDeck')-X.evSum('channel',p));
  X.playedBefore=(p,j)=>{const out=new Set<string>();X.MAIN.forEach((t)=>{if(t.k==='card'&&t.j<j&&t.pl===p&&!t.illegal&&t.c){const tok=/token/i.test((t.c.st||[]).join(' '));out.add((tok?'token':'')+t.c.t.toLowerCase());}});
    String(X.PSv(p,'playedT')||'').split(',').filter(Boolean).forEach((x:string)=>out.add(x));return out;};
  X.enterReady=(c,pl,accel,loc?,erd?,selfId?,addc?)=>{const out:ReadyInfo={ready:false,why:'',note:''};if(!c||c.t!=='Unit')return out;
    const yes=(w:string)=>{out.ready=true;out.why=out.why||w;};
    const gr=!!(selfId&&X.O[selfId]&&X.O[selfId].accelG);
    if(accel&&/^\[Accelerate\]/m.test(c.txt||''))yes('Accelerate kifizetve, 143.4.a, 805.6');
    else if(accel&&gr)yes('a kapott Accelerate kifizetve (Firelights\' Hideout: "the next unit you play this turn has [Accelerate]"), 805.1.b, 805.6');
    const ec=enterReadyCond(c);
    if(ec){if(ec.how==='always')yes('"I enter ready", 369.3');
      else if(ec.how==='addc'){if(addc)yes('"'+ec.t+'": az additional cost kifizetve, 143.4.a');else out.note='"'+esc(ec.t)+'": az additional cost nincs kifizetve, ezért exhausted lép be.';}
      else{let v:boolean|null=null;const l=ec.t;let m:RegExpExecArray|null;const cnt=(f:(o:GameObj)=>unknown)=>Object.values(X.O).filter((o)=>o.zone==='board'&&o.id!==selfId&&f(o)).length;
        if((m=/if you control another (\w+)/i.exec(l)))v=cnt((o)=>o.ctrl===pl&&o.card&&((o.card.tg||[]).some((t:string)=>t.toLowerCase()===m![1].toLowerCase())||new RegExp('\\b'+m![1]+'\\b','i').test(o.card.n)))>0;
        else if(/if you control no other units/i.test(l))v=cnt((o)=>o.ctrl===pl&&o.type==='unit')===0;
        else if(/two or more other units in your base/i.test(l))v=cnt((o)=>o.ctrl===pl&&o.type==='unit'&&o.loc==='base'&&(o.baseOf||o.ctrl)===pl)>=2;
        else if(/if you play me to a battlefield/i.test(l))v=!!loc&&loc!=='base';
        else if(/if an opponent controls a battlefield/i.test(l))v=['bf0','bf1'].some(k=>X.BF[k].c&&X.BF[k].ctrl===other(pl));
        else if(/if an opponent controls a stunned unit/i.test(l))v=cnt((o)=>o.ctrl===other(pl)&&o.type==='unit'&&o.st)>0;
        else if(ec.how==='state'&&X.ST.xpOf){if((m=/^\[Level (\d+)\]/i.exec(l)))v=X.ST.xpOf(pl)>=+m[1];
          else if(/^If your score is not within 3 points/i.test(l))v=X.ST.VS()-X.ST.scoreOf(pl)>3;
          else if(/^If an opponent's score is within 3 points/i.test(l))v=X.ST.VS()-X.ST.scoreOf(other(pl))<=3;
          else if(/died this turn/i.test(l)){const fr=/friendly unit or gear/i.test(l);v=/^If a unit died/i.test(l)?X.ST.diedT('A',false)||X.ST.diedT('B',false):X.ST.diedT(pl,fr);}
          else if(/a card with my name in your trash/i.test(l))v=Object.values(X.O).some((o)=>o.zone==='trash'&&o.own===pl&&o.card&&o.card.n===c.n)||erd==='1';
          if(v===false&&erd==='1'&&!/in your trash/i.test(l))v=true;}
        else if(erd==='1')v=true;else if(erd==='0')v=false;
        if(v===true)yes('"'+l+'" teljesül'+(ec.how==='state'?' (a játékállapotból számolva)':ec.how!=='board'?' (a lapnál megadva)':' (a boardon ellenőrizve)')+', 143.4.a');
        else if(v==null)out.note='"'+esc(l)+'": a feltétel rejtett vagy builderen kívüli adattól függ; a lapnál állítható, feltételezés: nem teljesül, ezért exhausted lép be (143.4).';
        else out.note='"'+esc(l)+'": a feltétel nem teljesül'+(ec.how==='state'?' (a játékállapotból számolva)':ec.how!=='board'?' (a builderben így állítva)':' (a boardon ellenőrizve)')+'.';}}
    if(X.READY[pl])yes('"Units you play this turn / Friendly units enter ready" hatás, 143.4.a');
    if(X.READYNEXT[pl]){X.READYNEXT[pl]=false;yes('Sun Disc: "The next unit you play this turn enters ready", 143.4.a');}
    const isTok=/token/i.test((c.st||[]).join(' ')+' '+(c.tg||[]).join(' '));const nt:string[]=[];
    Object.values(X.O).forEach((o)=>{if(!o.card||!(o.zone==='board'||o.zone==='legend')||o.id===selfId)return;(o.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{
      if(/^Other friendly units enter ready\b/i.test(l)&&o.ctrl===pl)yes(o.name+': "'+l+'", 143.4.a');
      else if(/^Other units enter ready\b/i.test(l))yes(o.name+': "'+l+'", 143.4.a');
      else if(/^Your tokens enter ready\b/i.test(l)&&o.ctrl===pl&&isTok)yes(o.name+': "'+l+'", 143.4.a');
      else if(/^Units you play to battlefields you control enter ready\b/i.test(l)&&o.ctrl===pl&&loc&&loc!=='base'&&X.BF[loc]&&X.BF[loc].ctrl===pl)yes(o.name+': "'+l+'", 143.4.a');
      else if(/enter ready\b/i.test(l)&&o.ctrl===pl&&!/^I enter ready|^If |^I enter ready if/i.test(l)&&!/^(?:Other friendly units|Other units|Your tokens|Units you play to battlefields you control) enter ready/i.test(l))nt.push(o.name+' ("'+l+'")');});});
    if(nt.length&&!out.ready)out.note=(out.note?out.note+' ':'')+'<span class="cbuns">nem követett ready belépés</span>: '+esc(nt.join(', '))+'; ha él, a unit ready lép be.';
    return out;};
}
