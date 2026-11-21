/* Zónaváltás és kontroll: kontrollváltás, a board elhagyása, mozgatás (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { triggersOf } from '../parser';
import { art, Art } from './labels';

export function installZoneChange(X: EngineCtx) {
  X.setCtrl=(id,to,ref,why,until?)=>{const ob=X.O[id];if(!ob||!to||ob.ctrl===to)return false;const from=ob.ctrl;ob.ctrl=to;if(ob.loc==='base')ob.baseOf=ob.baseOf||from;
    if(until)ob.until={src:until,prev:from};X.NEWCTRL.add(id);X.EV.push({k:'ctrl',id,name:ob.name,from,to});
    Object.values(X.O).forEach((g)=>{if(g.on===id&&g.zone==='board'){}});
    X.REC!.push([ref,ob.name+': az irányítója '+(from==='A'?'te':'az ellenfél')+' helyett '+(to==='A'?'te':'az ellenfél')+' lesz'+(why?' ('+why+')':'')+'. A Playmaton átkerül a másik oldalra.']);X.ALL.push(X.REC![X.REC!.length-1]);return true;};
  X.leaveBoard=(id,zone)=>{const ob=X.O[id];const was=ob.zone==='board';ob.lk={m:X.mightOf(id),ctrl:ob.ctrl,loc:ob.loc,kws:(ob.kws||[]).slice(),alone:ob.zone==='board'?!Object.values(X.O).some((o)=>o.id!==id&&o.zone==='board'&&o.type==='unit'&&o.ctrl===ob.ctrl&&o.loc===ob.loc):null};ob.zone=zone;
    if(zone!=='board'){ob.dmg=0;ob.mods=[];ob.kws=[];ob.st=false;ob.bu=false;ob.shields=[];ob.save=null;ob.dbl=false;ob.dieTo=null;ob.baseSet=null;ob.untgt=false;if(ob.on){ob.on=null;}ob.ctrl=ob.own;ob.until=null;}
    X.EV.push({k:'zone',id,name:ob.name,to:zone});
    if(!was)return;
    Object.keys(X.O).forEach(k=>{const g=X.O[k];if(g.on===id&&g.zone==='board'){g.on=null;g.loc=ob.lk!.loc;X.DET.add(k);X.EV.push({k:'detach',id:k,name:g.name,from:id});
      X.REC!.push(['719.5, 436.4',g.name+' leválik '+ob.name+' lapról, és a helyén marad ('+X.locLabel(g.loc)+').'+(g.loc!=='base'?' Battlefielden álló, csatolatlan gear: a következő cleanupban recall-olódik (436.4.a, 323.6).':'')]);X.ALL.push(X.REC![X.REC!.length-1]);
      X.story.push(Art(g.name)+' leválik '+art(ob.name)+' lapról'+(g.loc!=='base'?', és a következő cleanupban a base-be kerül':'')+'.');}});
    Object.keys(X.O).forEach(k=>{const g=X.O[k];if(g.until&&g.until.src===id&&g.zone==='board'){const prev=g.until.prev;g.until=null;X.setCtrl(k,prev,'391.5.b, 391.5.a',ob.name+' elhagyta a boardot, a "until I leave the board" kontroll véget ért');X.story.push(Art(g.name)+' irányítása visszakerül, mert '+ob.name+' elhagyta a boardot.');}});};
  X.moveObj=(id,to,parts,refs,srcName,toBase?)=>{const ob=X.O[id];const from=ob.loc;const nb=toBase||ob.ctrl;
    if(from===to&&(to!=='base'||ob.baseOf===nb)){parts.push(esc(ob.name)+' már ott van ('+esc(X.locLabel(to))+'), nincs mozgás.');return 'neg';}
    if(to==='base'&&from!=='base'&&X.bfBlocksBase(from)){parts.push(esc(ob.name)+' nem mozoghat a base-be, mert '+esc(X.locLabel(from))+' tiltja: a mozgás Negated (358.3.a, 359.3.e.6).');refs.push('358.3.a','359.3.e.6');X.story.push(Art(ob.name)+' a base-be mozogna, de '+X.locLabel(from)+' ezt tiltja, így a helyén marad.');return 'neg';}
    ob.loc=to;if(to==='base')ob.baseOf=nb;X.EV.push({k:'move',id,name:ob.name,from,to,baseOf:to==='base'?nb:undefined});refs.push('421');
    Object.values(X.O).forEach((g)=>{if(g.on===id)g.loc=to;});
    const bTxt=to==='base'&&nb!==ob.ctrl?(nb==='A'?'a te base-edbe':'az ellenfél base-ébe'):to==='base'?'a base-be':X.locLabel(to);
    parts.push(esc(ob.name)+' mozog: '+esc(X.locLabel(from))+' → '+esc(bTxt)+'.');X.story.push(Art(srcName)+' lefut: '+ob.name+' '+(to==='base'?bTxt.replace(/^a /,'a ')+' mozog':'ide mozog: '+X.locLabel(to))+'.');
    const tr=triggersOf(ob.card).find((t)=>/^when I move\b/i.test(t.why));if(tr){X.pushTrig({kind:'auto',label:ob.name+' triggere ("When I move")',name:ob.name+' triggere',src:id,pl:ob.ctrl!,eff:tr.eff,why:'"When I move"',list:[],tg:[]});X.rr+=X.line('383','<b>'+esc(ob.name)+'</b> triggerel ("'+esc(tr.why)+'"), a chainre kerül.',1);}
    return 'ok';};
}
