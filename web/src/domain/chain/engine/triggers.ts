/* Triggerek: függő triggerek, halálfigyelés, chainre tétel, elhagyás, play és ability triggerek (a runChain() csoportja, S20) */
import type { ChainItem, EngineCtx } from './ctx';
import type { Trigger } from '../types';
import { esc } from '../../text/norm';
import { costCheck, costCondOf, printedCost } from '../cost';
import { phrasesTxt, triggersOf } from '../parser';
import { stripRem } from '../text';
import { Art, other, WHO } from './labels';

export function installTriggers(X: EngineCtx) {
  X.pushTrig=(t)=>{if(t.once)X.ONCET[t.once]=true;X.PEND.push(t);};
  X.deathWatch=()=>{if(!X.DIED.length)return;const died=X.DIED.splice(0);const unk=new Set<string>();
    Object.keys(X.O).forEach(wid=>{const W=X.O[wid];if(!W.card||!(W.zone==='board'||W.zone==='legend'))return;
      (W.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{const l2=l.replace(/^once each turn,\s*/i,'');
        if(!/^(?:when|whenever)\b[^,]*\bdies?\b/i.test(l2)||/^when I die\b/i.test(l2))return;
        /* halálra figyelő trigger (383.2.c.2): "(another|a|an|one or more) (non-X) (stunned|buffed) (friendly|enemy) unit|gear (here) (at a battlefield) (you control|an opponent controls) dies (while I'm at a battlefield)" */
        const m=/^(?:when|whenever) (one or more|another|a|an) (?:non-([A-Za-z]+) )?(stunned |buffed )?(friendly |enemy )?(units?|gear) (here )?(at a battlefield )?(you control |an opponent controls )?(?:dies|die)( while I'm at a battlefield)?,\s*(.*)$/i.exec(l2);
        if(!m){unk.add(W.name+': "'+l2+'"');return;}
        if(m[9]&&!(W.zone==='board'&&W.loc&&W.loc!=='base'))return;
        const many=/one or more/i.test(m[1]);const gear=/gear/i.test(m[5]);let fired=false;
        died.forEach(did=>{const D=X.O[did];if(!D||D.type!==(gear?'gear':'unit'))return;if(/another/i.test(m[1])&&did===wid)return;if(many&&fired)return;
          if(m[2]&&((D.card&&(D.card.n+' '+(D.card.tg||[]).join(' ')).toLowerCase().includes(m[2].toLowerCase()))))return;
          const dc=(D.lk&&D.lk.ctrl)||D.own;const fr=/friendly/i.test(m[4]||'')||/you control/i.test(m[8]||'');const en=/enemy/i.test(m[4]||'')||/opponent/i.test(m[8]||'');
          if(fr&&dc!==W.ctrl)return;if(en&&dc===W.ctrl)return;const dl=D.lk&&D.lk.loc;const lx=X.LKX[did]||{st:false,bu:false};
          if(m[6]&&!(W.zone==='board'&&dl===W.loc))return;if(m[7]&&!(dl&&dl!=='base'))return;
          if(/stunned/i.test(m[3]||'')&&!lx.st)return;if(/buffed/i.test(m[3]||'')&&!lx.bu)return;
          fired=true;const lab=many?'egy vagy több unit meghalt':D.name+' meghalt';
          const tri:ChainItem={kind:'auto',label:W.name+' triggere ('+lab+')',name:W.name+' triggere',src:wid,pl:W.ctrl!,eff:m[10],why:'"'+l2.split(',')[0]+'"',list:phrasesTxt(m[10]),tg:[],...(gear?{pre:[did]}:{})};const tt=X.autoTg(tri);X.pushTrig(tri);
          X.rr+=X.line('383, 383.2.c.2','<b>'+esc(W.name)+'</b> triggerel, mert '+esc(many?'egy vagy több unit':D.name)+' meghalt'+(m[6]?' itt':'')+(m[3]?' ('+m[3].trim()+' volt, utolsó ismert állapot)':'')+', és '+esc(W.name)+' a boardon maradt.'+(many?' Egyszerre több halál egyetlen triggert ad ("one or more").':'')+(tt?' Célpont (403.4.b): '+tt:''),0);X.story.push(Art(W.name)+' triggerel, mert '+(many?'egységek haltak meg':D.name+' meghalt')+'.');});});});
    unk.forEach(u=>{X.rr+=X.line('383','<span class="cbuns">nem követett</span> Halálra figyelő trigger, amelyet az elemzés nem ismer fel: '+esc(u)+'. Ha teljesül, vedd fel kézzel ("Trigger a chainre").',1);});};
  X.flushPend=(target)=>{X.deathWatch();if(!X.PEND.length)return;const list=X.PEND.splice(0);
    const byP=(p:string)=>list.filter((t)=>(t.pl||'A')===p);const ordered=byP(X.TP).concat(byP(other(X.TP)));
    const ctrls=[...new Set(list.map((t)=>t.pl||'A'))];
    if(ctrls.length>1){const L=X.line('383.3.d.1','Egyszerre triggerelt: '+ordered.map((t)=>esc(t.label)).join(', ')+'. Először a turn player ('+WHO[X.TP]+') teszi fel a sajátjait, utána '+WHO[other(X.TP)]+'; ami később kerül fel, az resolve-ol előbb.',0);X.rows+=L;X.rr+=L;}
    ctrls.forEach((p)=>{const own=byP(p);if(own.length>1){const L=X.line('383.3.d','Egyszerre triggerelt, azonos controller ('+WHO[p]+'): '+own.map((t)=>esc(t.label)).join(', ')+'. A sorrendet '+WHO[p]+' választja; az elemzés a felsorolt sorrendben teszi fel (az utolsó resolve-ol először).',1);X.rows+=L;X.rr+=L;}});
    ordered.forEach((t)=>target.push(t));};
  X.leaveTrigs=(id,dk)=>{const ob=X.O[id];if(!ob||!ob.card)return;const t=ob.card.txt||'';const lst:[Trigger,string][]=[];
    /* a csatolt Equipment Effect Textje a unit Rules Textjéhez fűződik (435.1.c, 136.2.c), így a belőle jövő Deathknell is triggerel */
    const gEff=Object.values(X.O).filter((g)=>g.on===id&&g.zone==='board'&&g.card&&g.card.eff).map((g)=>g.card!.eff).join('\n');
    triggersOf(ob.card,gEff||undefined).forEach((tr)=>{
      if(dk&&(tr.dk||/^when I die\b(?! in combat)/i.test(tr.why)))lst.push([tr,'808.1.d.2, 429.1.a.1.b']);
      else if(/^when (?:I|this) leaves? the board\b|^when I leave the board\b/i.test(tr.why))lst.push([tr,'383.2.c.3']);});
    /* "Your [Deathknell] effects trigger an additional time" (Karthus, Eternal): a controller boardon lévő ilyen lapjai egy-egy további triggert adnak (808.2) */
    if(dk){const kx=Object.values(X.O).filter((k)=>k.id!==id&&k.zone==='board'&&k.ctrl===ob.ctrl&&k.card&&/^Your \[Deathknell\] effects trigger an additional time/im.test(k.card.txt||''));
      lst.filter(([tr])=>tr.dk).slice().forEach(([tr])=>kx.forEach((k)=>{lst.push([tr,'808.2']);X.rr+=X.line('808.2',esc(k.name)+' miatt '+esc(ob.name)+' Deathknellje még egyszer triggerel ("Your [Deathknell] effects trigger an additional time"); a triggerek sorrendjét a controller választja (808.2.a).',0);}));}
    lst.forEach(([tr,ref])=>{X.pushTrig({kind:'auto',label:ob.name+' triggere ('+(tr.dk?'Deathknell':tr.why)+')',name:ob.name+' triggere',sent:true,src:id,pl:ob.ctrl!,eff:tr.eff,why:tr.dk?'Deathknell':tr.why,list:[],tg:[],lk:{loc:ob.loc}});
      X.rr+=X.line(ref,'<b>'+esc(ob.name)+'</b> triggere ('+esc(tr.dk?'Deathknell':tr.why)+') a chainre kerül, mielőtt a lap elhagyja a boardot. A helyét és adatait a játék feljegyzi (383.2.c.3.b).',0);X.story.push(Art(ob.name)+' triggere ('+(tr.dk?'Deathknell':tr.why)+') a chainre kerül.');});
    void t;};
  /* Targeting Effects (383.4.b): "When you choose a friendly unit" és "When you choose (or ready) me" akkor triggerel, amikor egy spell vagy ability
     célpontként választja (383.4.b.3); a kiváltó elem fölé kerül (383.4.b.2). "You may exhaust me" a finalizáláskor dől el (383.3.a, 383.3.b). */
  X.chooseTrigs=(it,spell)=>{const res:ChainItem[]=[];const seen=new Set<string>();
    (it.tg||[]).forEach((v:string)=>{const T=X.O[v];if(!v||seen.has(v)||!T||T.zone!=='board'||!(T.type==='unit'||T.type==='gear'))return;seen.add(v);
      Object.keys(X.O).forEach((wid)=>{const W=X.O[wid];if(!W.card||!(W.zone==='board'||W.zone==='legend')||W.ctrl!==it.pl)return;
        (W.card.txt||'').split('\n').map(stripRem).forEach((L:string)=>{let eff:string;let m=/^when you choose (?:a|an) (friendly |enemy )?(unit|gear),\s*(.*)$/i.exec(L);
          if(m){if(m[2].toLowerCase()!==T.type)return;if(/friendly/i.test(m[1]||'')&&T.ctrl!==W.ctrl)return;if(/enemy/i.test(m[1]||'')&&T.ctrl===W.ctrl)return;eff=m[3];}
          else if((m=/^when you choose (?:or ready )?me( with a spell)?,\s*(.*)$/i.exec(L))){if(v!==wid||(m[1]&&!spell))return;eff=m[2];}else return;
          const may=/^you may exhaust me (?:and pay (\[[^\]]+\](?:\[[^\]]+\])*) )?to\s+/i.exec(eff);
          if(may){if(W.ex){X.rows+=X.line('383.3.b, 383.3.b.1',esc(W.name)+': "'+esc(L)+'" triggerelne ('+esc(T.name)+' kiválasztva), de már exhausted, az exhaust költség nem fizethető ki, ezért nem kerül a chainre.',0);return;}
            W.ex=true;X.rows+=X.line('383.3.a, 383.3.b',esc(W.name)+' triggere: a "you may" döntés (igen) és a költség (exhaust'+(may[1]?' és '+esc(may[1]):'')+') a chainre tételkor; '+esc(W.name)+' exhausted lesz.',0);eff=eff.slice(may[0].length);}
          res.push({kind:'auto',label:W.name+' triggere ('+T.name+' kiválasztva)',name:W.name+' triggere',src:wid,pl:W.ctrl!,eff,why:'"'+L+'"',list:phrasesTxt(eff),tg:[],pre:[v]});});});});
    return res;};
  /* "When you ready me" / "When I become ready": a ready game action után triggerel (416) */
  X.readyTrigs=(id,by,parts)=>{const O=X.O[id];if(!O||!O.card||O.zone!=='board')return;
    (O.card.txt||'').split('\n').map(stripRem).forEach((L:string)=>{const m=/^when (?:you (?:choose or )?ready me|I become ready),\s*(.*)$/i.exec(L);if(!m)return;if(/^when you/i.test(L)&&O.ctrl!==by)return;
      X.pushTrig({kind:'auto',label:O.name+' triggere (ready lett)',name:O.name+' triggere',src:id,pl:O.ctrl!,eff:m[1],why:'"'+L+'"',list:phrasesTxt(m[1]),tg:[]});parts.push('Triggerel: '+esc(O.name)+' ("'+esc(L)+'").');});};
  /* Weaponmaster (821.1.c): play effect, a unit sajátja vagy a legend adja ("Sand Soldiers you play have [Weaponmaster]"); a választott Equipment (lépés wm mezője,
     különben az első friendly Equipment, elöl a csatolatlan) a unitra csatolódik. Az Equip költség [A]-val csökken (821.1.c); [A] nélküli költség nem csökken (821.1.c.3);
     a [C] (a lap domainjének Powere, 135.2.e.6) "tartalmaz-e" [A]-t, nyitott kérdés (flag 2). */
  X.wmTrig=(uid,pl,pick)=>{const U=X.O[uid];if(!U||!U.card||U.type!=='unit')return null;
    const own=/^\[Weaponmaster\]/m.test(U.card.txt||'');const L=X.O['L'+pl];const gr=L&&L.card&&/^Sand Soldiers you play have \[Weaponmaster\]/m.test(L.card.txt||'')&&/\bSand Soldier\b/.test(U.name)?L.name:'';
    if(!own&&!gr)return null;
    const eqs=Object.keys(X.O).filter((g)=>{const G=X.O[g];return G.zone==='board'&&G.type==='gear'&&G.ctrl===pl&&G.card&&(G.card.tg||[]).includes('Equipment')&&G.on!==uid;}).sort((a,b)=>(X.O[a].on?1:0)-(X.O[b].on?1:0));
    const eq=pick&&eqs.includes(pick)?pick:eqs[0];const src=own?'':' ('+gr+' adja)';
    if(!eq)return {it:null,txt:esc(U.name)+' [Weaponmaster]'+esc(src)+': nincs választható friendly Equipment, a play effect nem csinál semmit (821.1.c).'};
    const G=X.O[eq];const ec=(/\[Equip\]\s*((?:\[[^\]]+\])+)/.exec(G.card!.txt||'')||['',''])[1];
    const cst=!ec?'nincs Equip költsége, ezért nem fizethető ki, a csatolás elmarad (821.1.c.4)':/\[A\]/.test(ec)?'az Equip költség ('+ec+') [A]-val csökken (821.1.c)':/\[C\]/.test(ec)?'<span class="cbuns">nyitott kérdés</span> az Equip költség '+ec+'; a [C] a lap domainjének Powere (135.2.e.6), és a Core Rules nem dönti el, hogy ez "tartalmaz-e" [A]-t: ha igen, a költség [A]-val csökken ('+ec.replace('[C]','')+(ec.replace('[C]','')?'':'0')+'), ha nem, a teljes '+ec+' fizetendő, csökkentés nélkül (821.1.c.3); a csatolás mindkét esetben megtörténik':'az Equip költség ('+ec+') nem tartalmaz [A]-t, ezért nem csökken, de kifizethető (821.1.c.3)';
    const it:ChainItem={kind:'auto',label:U.name+' Weaponmaster triggere',name:U.name+' Weaponmaster triggere',src:uid,pl,eff:'Attach it to me.',why:'"[Weaponmaster]"'+src,list:phrasesTxt('Attach it to me.'),tg:[],pre:[eq],wm:/\[C\]/.test(ec)&&!/\[A\]/.test(ec)};if(it.wm)it.fl2=true;
    return {it,txt:'Trigger: '+esc(U.name)+' [Weaponmaster]'+esc(src)+' (821.1.c): a választott Equipment '+esc(G.name)+(G.on?' (most '+esc(X.O[G.on].name)+' rajta)':'')+'; '+cst+'.'};};
  X.playTrigs=(s)=>{const res:ChainItem[]=[];const ty=s.c.t.toLowerCase();
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(!ob.card||id==='s'+s.j||id===s.objId)return;
      const fromTrash=ob.zone==='trash'&&X.ZC;if(!(ob.zone==='board'||ob.zone==='legend'||fromTrash))return;
      (ob.card.txt||'').split('\n').forEach((l:string)=>{const L0=stripRem(l);const once=/^once each turn,\s*/i.test(L0);const L=L0.replace(/^once each turn,\s*/i,'');let m:RegExpExecArray|null;let types:string[];let cond='';let eff='';let who='';
        const mm=/^when (you|an opponent|a player) plays? a unit, gear, or activated ability([^,]*),\s*(.*)$/i.exec(L);
        if(mm){who=mm[1].toLowerCase();types=['unit','gear'];cond=mm[2];eff=mm[3];}
        else{m=/^when (you|an opponent|a player) plays? (?:a |an )?(card|spell|unit|gear)s?([^,]*),\s*(.*)$/i.exec(L);if(!m)return;who=m[1].toLowerCase();types=[m[2].toLowerCase()];cond=m[3];eff=m[4];}
        if(fromTrash&&!/\bfrom your trash\b/i.test(eff))return;
        if(!fromTrash&&ob.zone==='trash')return;
        if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        if(!types.includes('card')&&!types.includes(ty))return;
        if(/other than your hand/i.test(cond)&&(s.from||'hand')==='hand')return;
        if(/from your hand/i.test(cond)&&s.from&&s.from!=='hand')return;
        if(/from face ?down/i.test(cond)&&s.from!=='facedown')return;
        /* "Once each turn" (383.3.e.1): körönként egyszer triggerel */
        if(once&&X.ONCET[id]){const ok='once|'+id+'|'+(s.j??'x');if(X.INRES&&!X.PTN.has(ok)){X.PTN.add(ok);X.rr+=X.line('383.3.e.1',esc(ob.name)+': "'+esc(L0)+'" most nem triggerel, mert ebben a körben már egyszer triggerelt (383.3.e.1).',0);}return;}
        const cc=costCondOf(cond);let cw='';
        if(cc){const pc=printedCost(s.c);const w=costCheck(cc,s.c,{});const key=(s.j??'x')+'|'+id;
          cw=esc(s.c.n)+' nyomtatott költsége '+pc.e+' Energy és '+pc.p+' Power; a feltétel: "'+esc(cc.t||cond.trim())+'" (206).';
          if(w){if(!X.PTN.has(key)){X.PTN.add(key);const h=X.line('206, 383.2',esc(ob.name)+': "'+esc(L)+'" nem triggerel, mert '+cw.replace(/ \(206\)\.$/,'')+', és ez nem teljesül ('+w.replace(/ \(206\)$/,'')+').',0);if(X.INRES)X.rr+=h;else X.rows+=h;}return;}}
        const pi:ChainItem={kind:'auto',label:ob.name+' triggere',src:id,pl:ob.ctrl!,eff,...(once?{once:id}:{}),why:'"'+L0+'"'+(once?' (körönként egyszer, 383.3.e.1)':'')+(cw?' Triggerel, mert '+cw.replace(/^[^ ]+/,(x)=>x)+'':''),list:[],tg:[],trigBy:s.c,trigId:s.objId||(s.j!=null&&s.j>=0?'s'+s.j:undefined)};
        /* célpontot választó trigger (pl. Rengar, Pridestalker "give a unit +1"): a chainre tételkor az első legális választás (403.4.b) */
        const pl0=phrasesTxt(eff);if(pl0.length&&!/^\s*(?:you may|if)\b/i.test(eff)){pi.list=pl0;const tt=X.autoTg(pi);if(tt)pi.why+=' Célpont (403.4.b): '+tt.replace(/\.$/,'')+'.';}
        /* "... plays a unit ..., [Stun] it": az "it" a kijátszott permanent (a trigger feltételéből, 359.3.f.3 mintájára) */
        const tid=s.objId||(s.j!=null&&s.j>=0?'s'+s.j:'');if(!pi.list.length&&tid&&X.O[tid]&&X.O[tid].zone==='board'&&/^(?:\[[A-Za-z]+\] |[a-z]+ )?(?:it|that unit)\b/i.test(eff))pi.pre=[tid];
        res.push(pi);});});
    return res;};
  X.abTrigs=(s)=>{const res:ChainItem[]=[];const cost=String(s.ab!.cost||'');const e=(cost.match(/\[(\d+)\]/g)||[]).reduce((a:number,x:string)=>a+ +x.slice(1,-1),0);const p=(cost.match(/\[[ACRGBOPY]\]/g)||[]).length;
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(!ob.card||!(ob.zone==='board'||ob.zone==='legend'))return;
      (ob.card.txt||'').split('\n').forEach((l:string)=>{const L=stripRem(l);const m=/^when (you|an opponent|a player) plays? a unit, gear, or activated ability([^,]*),\s*(.*)$/i.exec(L);if(!m)return;
        const who=m[1].toLowerCase();if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        const cc=costCondOf(m[2]);const w=cc?costCheck(cc,{e,p},{}):'';const cw=esc(s.c.n)+' abilityjének alapköltsége '+e+' Energy és '+p+' Power; a feltétel: "'+esc(cc?cc.t:m[2].trim())+'" (206.1)';
        if(w){X.rows+=X.line('206.1, 383.2',esc(ob.name)+': "'+esc(L)+'" nem triggerel, mert '+cw+', és ez nem teljesül ('+w.replace(/ \(206\)$/,'')+').',0);return;}
        res.push({kind:'auto',label:ob.name+' triggere',src:id,pl:ob.ctrl!,eff:m[3],why:'"'+L+'" Triggerel, mert '+cw+'.',list:[],tg:[],trigBy:s.c});});});
    return res;};
}
