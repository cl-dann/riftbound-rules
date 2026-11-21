// @ts-nocheck
/* Triggerek: függő triggerek, halálfigyelés, chainre tétel, elhagyás, play és ability triggerek (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { costCheck, costCondOf, printedCost } from '../cost';
import { triggersOf } from '../parser';
import { stripRem } from '../text';
import { Art, other, WHO } from './labels';

export function installTriggers(X: EngineCtx) {
  X.pushTrig=(t:any)=>{X.PEND.push(t);};
  X.deathWatch=()=>{if(!X.DIED.length)return;const died=X.DIED.splice(0);const unk=new Set<string>();
    Object.keys(X.O).forEach(wid=>{const W=X.O[wid];if(!W.card||!(W.zone==='board'||W.zone==='legend'))return;
      (W.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{const l2=l.replace(/^once each turn,\s*/i,'');
        if(!/^(?:when|whenever)\b[^,]*\bdies?\b/i.test(l2)||/^when I die\b/i.test(l2))return;
        const m=/^(?:when|whenever) (another|a|an) (?:non-([A-Za-z]+) )?(friendly |enemy )?units? (you control |an opponent controls )?dies,\s*(.*)$/i.exec(l2);
        if(!m){unk.add(W.name+': "'+l2+'"');return;}
        died.forEach(did=>{const D=X.O[did];if(!D||D.type!=='unit')return;if(/another/i.test(m[1])&&did===wid)return;
          if(m[2]&&((D.card&&(D.card.n+' '+(D.card.tg||[]).join(' ')).toLowerCase().includes(m[2].toLowerCase()))))return;
          const dc=(D.lk&&D.lk.ctrl)||D.own;const fr=/friendly/i.test(m[3]||'')||/you control/i.test(m[4]||'');const en=/enemy/i.test(m[3]||'')||/opponent/i.test(m[4]||'');
          if(fr&&dc!==W.ctrl)return;if(en&&dc===W.ctrl)return;
          X.pushTrig({kind:'auto',label:W.name+' triggere ('+D.name+' meghalt)',name:W.name+' triggere',src:wid,pl:W.ctrl,eff:m[5],why:'"'+l2.split(',')[0]+'"',list:[],tg:[]});
          X.rr+=X.line('383, 383.2.c.2','<b>'+esc(W.name)+'</b> triggerel, mert '+esc(D.name)+' meghalt, és '+esc(W.name)+' a boardon maradt.',0);X.story.push(Art(W.name)+' triggerel, mert '+D.name+' meghalt.');});});});
    unk.forEach(u=>{X.rr+=X.line('383','<span class="cbuns">nem követett</span> Halálra figyelő trigger, amelyet az elemzés nem ismer fel: '+esc(u)+'. Ha teljesül, vedd fel kézzel ("Trigger a chainre").',1);});};
  X.flushPend=(target:any[])=>{X.deathWatch();if(!X.PEND.length)return;const list=X.PEND.splice(0);
    const byP=(p:string)=>list.filter((t:any)=>(t.pl||'A')===p);const ordered=byP(X.TP).concat(byP(other(X.TP)));
    const ctrls=[...new Set(list.map((t:any)=>t.pl||'A'))];
    if(ctrls.length>1){const L=X.line('383.3.d.1','Egyszerre triggerelt: '+ordered.map((t:any)=>esc(t.label)).join(', ')+'. Először a turn player ('+WHO[X.TP]+') teszi fel a sajátjait, utána '+WHO[other(X.TP)]+'; ami később kerül fel, az resolve-ol előbb.',0);X.rows+=L;X.rr+=L;}
    ctrls.forEach((p:any)=>{const own=byP(p);if(own.length>1){const L=X.line('383.3.d','Egyszerre triggerelt, azonos controller ('+WHO[p]+'): '+own.map((t:any)=>esc(t.label)).join(', ')+'. A sorrendet '+WHO[p]+' választja; az elemzés a felsorolt sorrendben teszi fel (az utolsó resolve-ol először).',1);X.rows+=L;X.rr+=L;}});
    ordered.forEach((t:any)=>target.push(t));};
  X.leaveTrigs=(id:string,dk:boolean)=>{const ob=X.O[id];if(!ob||!ob.card)return;const t=ob.card.txt||'';const lst:any[]=[];
    triggersOf(ob.card).forEach((tr:any)=>{
      if(dk&&(tr.dk||/^when I die\b(?! in combat)/i.test(tr.why)))lst.push([tr,'808.1.d.2, 429.1.a.1.b']);
      else if(/^when (?:I|this) leaves? the board\b|^when I leave the board\b/i.test(tr.why))lst.push([tr,'383.2.c.3']);});
    lst.forEach(([tr,ref])=>{X.pushTrig({kind:'auto',label:ob.name+' triggere ('+(tr.dk?'Deathknell':tr.why)+')',name:ob.name+' triggere',sent:true,src:id,pl:ob.ctrl,eff:tr.eff,why:tr.dk?'Deathknell':tr.why,list:[],tg:[],lk:{loc:ob.loc}});
      X.rr+=X.line(ref,'<b>'+esc(ob.name)+'</b> triggere ('+esc(tr.dk?'Deathknell':tr.why)+') a chainre kerül, mielőtt a lap elhagyja a boardot. A helyét és adatait a játék feljegyzi (383.2.c.3.b).',0);X.story.push(Art(ob.name)+' triggere ('+(tr.dk?'Deathknell':tr.why)+') a chainre kerül.');});
    void t;};
  X.playTrigs=(s:any)=>{const res:any[]=[];const ty=s.c.t.toLowerCase();
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(!ob.card||id==='s'+s.j||id===s.objId)return;
      const fromTrash=ob.zone==='trash'&&X.ZC;if(!(ob.zone==='board'||ob.zone==='legend'||fromTrash))return;
      (ob.card.txt||'').split('\n').forEach((l:string)=>{const L=stripRem(l);let m:any;let types:string[];let cond='';let eff='';let who='';
        const mm=/^when (you|an opponent|a player) plays? a unit, gear, or activated ability([^,]*),\s*(.*)$/i.exec(L);
        if(mm){who=mm[1].toLowerCase();types=['unit','gear'];cond=mm[2];eff=mm[3];}
        else{m=/^when (you|an opponent|a player) plays? (?:a |an )?(card|spell|unit|gear)s?([^,]*),\s*(.*)$/i.exec(L);if(!m)return;who=m[1].toLowerCase();types=[m[2].toLowerCase()];cond=m[3];eff=m[4];}
        if(fromTrash&&!/\bfrom your trash\b/i.test(eff))return;
        if(!fromTrash&&ob.zone==='trash')return;
        if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        if(!types.includes('card')&&!types.includes(ty))return;
        if(/other than your hand/i.test(cond)&&(s.from||'hand')==='hand')return;
        if(/from your hand/i.test(cond)&&s.from&&s.from!=='hand')return;
        const cc=costCondOf(cond);let cw='';
        if(cc){const pc=printedCost(s.c);const w=costCheck(cc,s.c,{});const key=(s.j??'x')+'|'+id;
          cw=esc(s.c.n)+' nyomtatott költsége '+pc.e+' Energy és '+pc.p+' Power; a feltétel: "'+esc(cc.t||cond.trim())+'" (206).';
          if(w){if(!X.PTN.has(key)){X.PTN.add(key);const h=X.line('206, 383.2',esc(ob.name)+': "'+esc(L)+'" nem triggerel, mert '+cw.replace(/ \(206\)\.$/,'')+', és ez nem teljesül ('+w.replace(/ \(206\)$/,'')+').',0);if(X.INRES)X.rr+=h;else X.rows+=h;}return;}}
        res.push({kind:'auto',label:ob.name+' triggere',src:id,pl:ob.ctrl,eff,why:'"'+L+'"'+(cw?' Triggerel, mert '+cw.replace(/^[^ ]+/,(x)=>x)+'':''),list:[],tg:[],trigBy:s.c});});});
    return res;};
  X.abTrigs=(s:any)=>{const res:any[]=[];const cost=String(s.ab.cost||'');const e=(cost.match(/\[(\d+)\]/g)||[]).reduce((a:number,x:string)=>a+ +x.slice(1,-1),0);const p=(cost.match(/\[[ACRGBOPY]\]/g)||[]).length;
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(!ob.card||!(ob.zone==='board'||ob.zone==='legend'))return;
      (ob.card.txt||'').split('\n').forEach((l:string)=>{const L=stripRem(l);const m=/^when (you|an opponent|a player) plays? a unit, gear, or activated ability([^,]*),\s*(.*)$/i.exec(L);if(!m)return;
        const who=m[1].toLowerCase();if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        const cc=costCondOf(m[2]);const w=cc?costCheck(cc,{e,p},{}):'';const cw=esc(s.c.n)+' abilityjének alapköltsége '+e+' Energy és '+p+' Power; a feltétel: "'+esc(cc?cc.t:m[2].trim())+'" (206.1)';
        if(w){X.rows+=X.line('206.1, 383.2',esc(ob.name)+': "'+esc(L)+'" nem triggerel, mert '+cw+', és ez nem teljesül ('+w.replace(/ \(206\)$/,'')+').',0);return;}
        res.push({kind:'auto',label:ob.name+' triggere',src:id,pl:ob.ctrl,eff:m[3],why:'"'+L+'" Triggerel, mert '+cw+'.',list:[],tg:[],trigBy:s.c});});});
    return res;};
}
