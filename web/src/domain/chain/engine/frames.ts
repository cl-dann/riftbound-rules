/* Frame-ek: pillanatképek a lejátszáshoz (a runChain() csoportja, S20) */
import type { EngineCtx, Frame, UnitView } from './ctx';

export function installFrames(X: EngineCtx) {
  X.pside=(p)=>p==='A'?'me':p==='B'?'opp':null;
  X.itemName=(it)=>it.label;
  X.snap=(label,items,sj?)=>{
    const vis=(items||[]).filter((it)=>!(it.objId&&X.O[it.objId]&&X.O[it.objId].zone==='countered')).slice().reverse();
    const mk=()=>({base:[] as UnitView[],trash:[] as string[],banish:[] as string[],hand:[] as string[]});const side:Record<string,ReturnType<typeof mk>>={A:mk(),B:mk()};const bfs=[0,1].map(i=>({name:X.CS.bf[i].n||(i+1)+'. battlefield',ctrl:X.pside(X.BF['bf'+i].ctrl),me:[] as UnitView[],opp:[] as UnitView[],i}));
    const shown=new Set<string>();
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.type!=='unit'&&ob.type!=='gear')return;const p=ob.ctrl==='B'?'B':'A';
      if(ob.zone==='gone')return;
      if(ob.zone!=='board'){const nmC=ob.card?ob.card.n:ob.name;const op=ob.own==='B'?'B':'A';if(ob.zone==='trash')side[op].trash.push(nmC);else if(ob.zone==='banish')side[op].banish.push(nmC);else if(ob.zone==='hand')side[op].hand.push(nmC);return;}
      if(ob.type==='gear'&&ob.on&&X.onB(ob.on))return;
      const mt=ob.type==='unit'?X.mightOf(id):null;const st:string[]=[];
      if(ob.st)st.push('stunned');if(ob.bu)st.push('buffed');if(ob.emp)st.push('empowered');if(ob.type==='unit'&&X.lethal(id))st.push('dying');if(X.MTIDS.has(id))st.push('mistarget');
      if(X.DET.has(id))st.push('detached');if((ob.shields||[]).length)st.push('shield');if(ob.save||ob.dieTo)st.push('save');if(ob.dbl)st.push('dbl');if(X.REPL.has(id))st.push('repl');if(ob.ctrl&&ob.own&&ob.ctrl!==ob.own)st.push(X.NEWCTRL.has(id)?'ctrlnew':'ctrl');
      (ob.kws||[]).forEach((k:string)=>st.push('kw:'+k));
      const gear=Object.values(X.O).filter((g)=>g.on===id&&g.zone==='board').map((g)=>g.card?g.card.n:g.name);
      const u:UnitView={id,n:ob.card?ob.card.n:ob.name,m:mt!=null?mt:0,dmg:ob.dmg||0,ex:!!ob.ex,gear,status:st};
      if(ob.type==='gear'){u.kind='gear';u.base=0;u.m=0;}
      if(ob.type==='unit'&&mt==null){u.base=0;u.mods=['Might ismeretlen'];}
      if(ob.card&&/token/i.test((ob.card.st||[]).join(' ')+' '+(ob.card.tg||[]).join(' ')))u.token=true;
      shown.add(id);
      if(ob.loc==='base'){const bp=ob.baseOf==='B'?'B':ob.baseOf==='A'?'A':p;side[bp].base.push(Object.assign(u,bp!==p?{tag:'idegen base'}:{}));}else{const f=bfs[ob.loc==='bf1'?1:0];(p==='A'?f.me:f.opp).push(u);}});
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.type!=='spell')return;const p=ob.own==='B'?'B':'A';if(ob.zone==='trash'||ob.zone==='countered')side[p].trash.push(ob.card!.n);});
    const zids:Record<string,{hand:string[];trash:string[]}>={A:{hand:[],trash:[]},B:{hand:[],trash:[]}};
    if(X.ZC){/* a kéz és a trash lapjainak azonosítói, a kirajzolt listával azonos sorrendben (a pályás építő ezzel választ) */
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.type!=='unit'&&ob.type!=='gear')return;if(ob.zone==='trash'||ob.zone==='hand')zids[ob.own==='B'?'B':'A'][ob.zone].push(id);});
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.type==='spell'&&(ob.zone==='trash'||ob.zone==='countered'))zids[ob.own==='B'?'B':'A'].trash.push(id);});
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.type!=='zc')return;const p=ob.own==='B'?'B':'A';if(ob.zone==='trash'||ob.zone==='hand'||ob.zone==='banish'){side[p][ob.zone].push(ob.card!.n);if(ob.zone!=='banish')zids[p][ob.zone].push(id);}});}
    const used=bfs.filter(f=>X.CS.bf[f.i].n||f.me.length||f.opp.length);const bfPos=(i:number)=>used.findIndex(f=>f.i===i);
    const arrows:Frame['arrows']=[];
    vis.forEach((it,ci)=>{(it.list||[]).forEach((_p,ti)=>{const v=(it.tg||[])[ti];if(!v)return;
      if(v==='F0'||v==='F1'){const k=bfPos(+v[1]);if(k>=0)arrows.push({from:ci,to:'bf:'+k});return;}
      const ob=X.O[v];if(!ob)return;
      if(ob.type==='spell'||ob.type==='ability'){const k=vis.findIndex((x)=>x.objId===v);if(k>=0)arrows.push({from:ci,to:'c:'+k});return;}
      if(shown.has(v))arrows.push({from:ci,to:'u:'+v});else if(ob.type==='gear'&&ob.on&&shown.has(ob.on))arrows.push({from:ci,to:'u:'+ob.on});});});
    const lg=(p:string)=>X.O['L'+p]?X.O['L'+p].card!.n:undefined;
    const ps=(p:string)=>Object.assign({legend:lg(p),legendEx:!!(X.O['L'+p]&&X.O['L'+p].ex),base:side[p].base,hand:side[p].hand,trash:side[p].trash,banish:side[p].banish},X.ZC?{zids:zids[p],deck:(((X.CS.deck||{}) as Record<string,unknown[]|undefined>)[p]||[]).length?Object.values(X.O).filter((o)=>o.type==='zc'&&o.zone==='deck'&&o.own===p).length:undefined}:{});
    X.FR.push({label,board:{me:ps('A'),opp:ps('B'),bfs:used.map(({i,...f})=>f),chain:vis.map(X.itemName)},changes:X.REC||[],arrows,bfi:used.map(f=>f.i),mt:X.MT,sj});X.REC=[];X.MT=null;X.MTIDS.clear();X.DET.clear();X.NEWCTRL.clear();X.REPL.clear();};
}
