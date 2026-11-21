/* Damage és szorzók: Bonus Damage, damage kiosztás, keyword érték, for each számolás (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { WHO } from './labels';

export function installDamage(X: EngineCtx) {
  X.bonusDmg=(pl:string)=>Object.values(X.O).reduce((a:number,o:any)=>{if(o.zone!=='board'||o.ctrl!==pl||!o.card)return a;const m=/your spells and abilities deal (\d+) bonus damage/i.exec(o.card.txt||'');return a+(m?+m[1]:0);},0);
  X.dealDmg=(v:string,n:number,parts:string[],refs:string[],note?:string)=>{const ob=X.O[v];const base=Math.max(0,n);const rp:string[]=[];
    if(X.PREVSA.on&&base>0){X.EV.push({k:'prevented',id:v,name:ob.name,n:base});parts.push(esc(ob.name)+': '+base+' spell vagy ability damage megelőzve (Unyielding Spirit, 438.1.b.1.b, 438.4; levezetés).');refs.push('438.4');return 0;}
    const sh=(ob.shields||[]).map((x:any)=>Object.assign({},x));const pv=sh.reduce((q:number,x:any)=>q+x.n,0);
    const run=(order:'pd'|'dp')=>{let d=base;let left=pv;const step=()=>{const k=Math.min(d,left);d-=k;left-=k;return k;};let prevd=0;
      if(order==='pd'){prevd=step();if(ob.dbl)d=d*2;}else{if(ob.dbl)d=d*2;prevd=step();}return {d,prevd,left:pv>=99?'All':left};};
    let r=run('pd');
    if(ob.dbl&&pv>0&&base>0){const A=run('pd'),B=run('dp');refs.push('372','467.2.c.5','433.1.b');
      rp.push('két replacement él (Prevent és duplázás), a sorrendet '+WHO[ob.ctrl]+' választja (372): Prevent előbb '+A.d+' damage (megmaradó Prevent: '+A.left+'), duplázás előbb '+B.d+' damage (megmaradó Prevent: '+B.left+'); az elemzés '+(A.d<=B.d?'a Prevent előbb':'a duplázás előbb')+' sorrenddel számol');r=A.d<=B.d?A:B;}
    else if(ob.dbl&&base>0){rp.push('duplázva (433.1.b)');refs.push('433.1.b');}
    if(r.prevd>0){rp.push(r.prevd+' megelőzve (438.2)');refs.push('438.2','438.3');}
    let used=r.prevd;(ob.shields||[]).forEach((x:any)=>{if(used<=0&&!x.next)return;const k=Math.min(x.n,used);if(x.n<99)x.n-=k;used-=k;if(x.next&&base>0||x.n<=0)x.used=true;});
    ob.shields=(ob.shields||[]).filter((x:any)=>!x.used);
    const d=r.d;
    if(d<=0&&base>0){X.EV.push({k:'prevented',id:v,name:ob.name,n:base});parts.push(esc(ob.name)+': '+base+' damage teljesen megelőzve, nem számít megtörtént damage-nek (438.4)'+(rp.length?' ['+rp.join(', ')+']':'')+'.');refs.push('438.4');return 0;}
    ob.dmg+=d;ob.dealt=true;const mt=X.mightOf(v);X.EV.push({k:'dmg',id:v,name:ob.name,n:d});
    parts.push(esc(ob.name)+' '+d+' damage-et kap'+(note?' ('+note+')':'')+(rp.length?' ['+rp.join(', ')+']':'')+(mt!=null?' (Might '+mt+', összesen '+ob.dmg+' damage)':'')+'.');refs.push('418');
    if(mt!=null&&ob.dmg>=mt&&ob.dmg>0){parts.push('Lethal damage: a következő cleanupban meghal (142.4.b, 323.4).');refs.push('142.4.b');}
    return d;};
  X.kwVal=(id:string,kw:string)=>{const ob=X.O[id];if(!ob)return 0;let n=0;const t=(ob.card&&ob.card.txt)||'';const re=new RegExp('^\\['+kw+'(?: (\\d+))?\\]','m');const m=re.exec(t);if(m)n+=m[1]?+m[1]:1;
    (ob.kws||[]).forEach((k:string)=>{const q=new RegExp('^'+kw+'(?: (\\d+))?$').exec(k);if(q)n+=q[1]?+q[1]:1;});return n;};
  X.countEach=(cnt:any,it:any,tv?:string)=>{if(cnt.kills)return null;
    if(cnt.bfs){const here=X.srcLoc(it);return ['bf0','bf1'].filter(l=>X.BF[l].c&&X.BF[l].ctrl===it.pl&&!(cnt.other&&l===here)).length;}if(cnt.eqOn){const host=cnt.eqOn==='me'?it.src:tv;return Object.values(X.O).filter((g:any)=>g.on===host&&g.zone==='board'&&g.card&&(g.card.tg||[]).includes('Equipment')).length;}
    const here=X.srcLoc(it);const there=tv&&X.O[tv]?X.O[tv].loc:null;
    return Object.keys(X.O).filter(id=>{const ob=X.O[id];if(ob.zone!=='board'||ob.type!==cnt.type)return false;if(cnt.other&&(id===it.src||id===tv))return false;
      if(cnt.rel==='friendly'&&ob.ctrl!==it.pl)return false;if(cnt.rel==='enemy'&&ob.ctrl===it.pl)return false;
      if(cnt.mighty&&!((X.mightOf(id)??0)>=5))return false;
      if(cnt.st==='exhausted'&&!ob.ex||cnt.st==='ready'&&ob.ex||cnt.st==='stunned'&&!ob.st||cnt.st==='buffed'&&!ob.bu)return false;
      if(cnt.where==='here'&&ob.loc!==here)return false;if(cnt.where==='there'&&ob.loc!==there)return false;if(cnt.where==='bf'&&ob.loc==='base')return false;if(cnt.where==='base'&&ob.loc!=='base')return false;return true;}).length;};
}
