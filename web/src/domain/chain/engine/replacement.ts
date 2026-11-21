/* Halál és replacement: halál-helyettesítés, kill (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { triggersOf } from '../parser';
import { stripRem } from '../text';
import { art, Art } from './labels';

export function installReplacement(X: EngineCtx) {
  X.deathRepl=(id)=>{const ob=X.O[id];if(!ob||ob.type!=='unit')return null;
    if(ob.dieTo)return {by:null,dieTo:ob.dieTo,txt:'If it would die this turn, banish it instead.'};
    if(ob.save)return {by:null,save:true,txt:ob.save.src+': heal, exhaust, recall instead'};
    if(ob.card&&/\bif I would die\b/i.test(ob.card.txt||''))return {by:id,txt:stripRem((/[^\n]*if I would die[^\n]*/i.exec(ob.card.txt!)||[''])[0]),self:true};
    const ga=Object.values(X.O).find((g)=>g.on===id&&g.zone==='board'&&g.card&&/\bif I would die\b/i.test(g.card.eff||''));if(ga)return {by:ga.id,txt:ga.card!.eff};
    const zh=Object.values(X.O).find((g)=>g.zone==='board'&&g.id!==id&&!g.on&&g.ctrl===ob.ctrl&&g.card&&/\bif a friendly unit would die, kill this instead\b/i.test(g.card.txt||''));if(zh)return {by:zh.id,txt:stripRem((/[^\n]*would die[^\n]*/i.exec(zh.card!.txt!)||[''])[0])};
    return null;};
  X.killObj=(id,why,parts,refs,srcName?)=>{const ob=X.O[id];const rp=X.deathRepl(id);
    if(rp){X.EV.push({k:'replace',id,name:ob.name,by:rp.by});refs.push('367','369.1');
      if(rp.dieTo){parts.push(esc(ob.name)+' meghalna, de helyette banishelődik (replacement: "'+esc(rp.txt)+'"). A lap a replacement miatt nem a trashbe kerül: a halálra triggerelő abilityk nem triggerelnek (383.2.c.3.a), a "leaves the board" triggerek igen, mert a lap így is elhagyja a boardot.');X.story.push(Art(ob.name)+' meghalna, de helyette banishelődik.');X.leaveTrigs(id,false);X.leaveBoard(id,'banish');X.REPL.add(id);return 'neg';}
      if(rp.save){ob.save=null;parts.push(esc(ob.name)+' meghalna, de a replacement ('+esc(rp.txt)+') helyettesíti: meggyógyul, exhausted lesz és a base-be recall-olódik (457).');X.story.push(Art(ob.name)+' meghalna, de helyette gyógyulva a base-be kerül.');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;Object.values(X.O).forEach((g)=>{if(g.on===id)g.loc='base';});X.EV.push({k:'recall',id,name:ob.name});X.REPL.add(id);return 'neg';}
      if(rp.self){parts.push(esc(ob.name)+' meghalna, de a saját replacement effectje mást hajt végre helyette (367): "'+esc(rp.txt)+'". Ezt az elemzés nem követi tovább.');X.story.push(Art(ob.name)+' meghalna, de a saját replacement effectje helyettesíti a halált.');return 'neg';}
      const hasDK=triggersOf(ob.card).some((t)=>t.dk||/^when I die\b/i.test(t.why));
      const by=X.O[rp.by!];parts.push(esc(ob.name)+' meghalna, de '+esc(by.name)+' replacement effectje helyettesíti: "'+esc(rp.txt)+'". '+esc(by.name)+' a trashbe kerül, '+esc(ob.name)+' meggyógyul, exhausted lesz és a base-be recall-olódik (457).'+(hasDK?' A halálra triggerelő abilityje a chainre kerülne (808.1.d.2), de mivel a lap nem került a trashbe, lekerül (808.1.d.1).':''));refs.push('457');if(hasDK)refs.push('808.1.d.1','808.1.d.2');
      X.story.push(Art(ob.name)+' meghalna, de '+art(by.name)+' megmenti: '+by.name+' a trashbe kerül, '+ob.name+' gyógyulva, exhausted állapotban a base-be kerül.');
      X.REPL.add(id);X.leaveTrigs(rp.by!,false);X.leaveBoard(rp.by!,'trash');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;X.EV.push({k:'recall',id,name:ob.name});return 'neg';}
    if(srcName)X.story.push(Art(srcName)+' lefut: '+ob.name+' meghal.');
    X.leaveTrigs(id,true);X.leaveBoard(id,'trash');if(ob.type==='unit')X.DIED.push(id);parts.push(esc(ob.name)+' meghal, a tulajdonosa trashébe kerül'+(why?' ('+why+')':'')+'.');refs.push('429');return 'ok';};
}
