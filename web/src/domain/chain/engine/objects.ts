// @ts-nocheck
/* Objektumok: hely, Might, lethal, zónás lapok, nevek, szabálysor (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { vsCard } from '../../data/store';
import { printedCost } from '../cost';
import { plainOf } from '../text';
import { ZONE_HU, type ZoneRef, zoneCheck } from '../zones';
import { lineH } from './labels';

export function installObjects(X: EngineCtx) {
  X.LOCS=()=>[['base','Base'],['bf0',(X.CS.bf[0].n||'1. battlefield')],['bf1',(X.CS.bf[1].n||'2. battlefield')]];
  X.locLabel=(l:string)=>(X.LOCS().find(x=>x[0]===l)||['',l])[1];
  X.line=(ref:string,txt:string,fl?:number)=>{const r=[...new Set(String(ref).split(',').map(r=>r.trim()).filter(Boolean))].join(', ');const p=plainOf(txt);if(X.REC)X.REC.push([r,p].concat(X.MAN?[1]:[]));X.ALL.push([r,p]);return lineH(r,txt,fl);};
  X.bfC=(n:string)=>{const c=vsCard(n);return c&&c.t==='Battlefield'?c:null;};
  X.onB=(id:string)=>!!X.O[id]&&X.O[id].zone==='board';
  X.mightOf=(id:string):number|null=>{const ob=X.O[id];if(!ob||ob.m==null||ob.zone!=='board')return null;let m=(ob.baseSet!=null?ob.baseSet:ob.m)+(ob.bu?(X.BUF2(ob.ctrl)?2:1):0);
    Object.values(X.O).forEach((g:any)=>{if(g.on===id&&g.zone==='board'&&g.card&&g.card.m)m+=+g.card.m;});
    const t=(ob.card&&ob.card.txt)||'';let x;
    if((x=/while there's a stunned enemy unit here, I have \+(\d+) \[S\]/i.exec(t))&&Object.values(X.O).some((u:any)=>u.zone==='board'&&u.type==='unit'&&u.st&&u.ctrl!==ob.ctrl&&u.loc===ob.loc))m+=+x[1];
    if((x=/^\[Empowered\]\[>\]\s*I have \+(\d+) \[S\]/m.exec(t))&&ob.emp)m+=+x[1];
    (ob.mods||[]).forEach((md:any)=>{m=m+md.n;if(md.min!=null&&md.n<0)m=Math.max(m,md.min);if(md.dbl)m=m+Math.max(0,m);});
    return m;};
  X.BUF2=(p:string)=>typeof X.BUFF2!=='undefined'&&X.BUFF2[p];
  X.lethal=(id:string)=>{const ob=X.O[id];if(!X.onB(id)||ob.type!=='unit')return false;const m=X.mightOf(id);return m!=null&&ob.dmg>0&&ob.dmg>=m;};
  X.zcMove=(id:string,to:string)=>{const ob=X.O[id];if(!ob)return;ob.zone=to;ob.gen=(ob.gen||0)+1;X.EV.push({k:'zcard',id,name:ob.name,to});};
  X.zoneIds=(z:string,p:string)=>Object.keys(X.O).filter(id=>{const ob=X.O[id];return ob.card&&ob.zone===z&&(ob.own||ob.ctrl)===p&&(ob.type==='zc'||ob.type==='unit'||ob.type==='gear'||ob.type==='spell');}).sort((a,b)=>(X.O[a].ord??99)-(X.O[b].ord??99));
  X.zcWhy=(zr:ZoneRef,ids:string[],pl:string,res:boolean,ctx?:any)=>{const out:string[]=[];
    if(ids.length>zr.n)out.push('legfeljebb '+zr.n+' lap választható');
    ids.forEach(id=>{const ob=X.O[id];if(!ob||!ob.card){out.push('nincs megadva: a kiválasztott lap már nincs a helyzetben (törölték), újra kell választani');return;}
      if(ob.zone!==zr.z){out.push(ob.name+' nincs '+(zr.z==='trash'?'a trashben':zr.z==='hand'?'a kézben':'a deckben')+(res?' a resolve-kor':'')+' (most: '+(ZONE_HU[ob.zone]||ob.zone)+')');return;}
      const w=zoneCheck(zr,ob,pl,ctx);if(w)out.push(ob.name+' '+w);});
    return out.join('; ');};
  X.zctx=(it:any,s:any)=>{const k=s&&s.costTg&&X.O[s.costTg]&&X.O[s.costTg].card?printedCost(X.O[s.costTg].card):null;const kv=s&&s.tg&&s.tg[0]&&X.O[s.tg[0]]&&X.O[s.tg[0]].type==='unit'?s.tg[0]:null;const killedM=kv?(X.onB(kv)?X.mightOf(kv):X.O[kv].lk?X.O[kv].lk.m:null):null;
    return {might:it.src&&X.onB(it.src)?X.mightOf(it.src):null,points:X.scoreOf(it.pl),relE:k?k.e:null,relP:k?k.p:null,killedM};};
  X.nm=(id:string)=>id==='F0'?X.locLabel('bf0'):id==='F1'?X.locLabel('bf1'):X.O[id]?X.O[id].name:id;
}
