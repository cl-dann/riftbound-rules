/* Token létrehozás (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { vsCard } from '../../data/store';
import { numOf } from '../parser';

export function installTokens(X: EngineCtx) {
  X.createTokens=(t,it,parts,refs,times)=>{const m=/\b(?:[Pp]lay|[Cc]reate)s? (a|an|one|two|three|four|five|six|\d+|that many)\s+(ready\s+)?(?:(\d+) \[S\]\s+)?([A-Z][\w'-]*(?: [A-Z][\w'-]*)*)(?:\s+(unit|gear))?\s+tokens?(\s+exhausted)?(?:\s+with\s+((?:\[[^\]]+\](?:,?\s*(?:and\s+)?)?)+))?([^.]*)/.exec(t);
    if(!m){parts.push('"'+esc(t)+'": token jön létre (440), az elemzés nem tudja pontosan, milyen.');return [];}
    let n=m[1].toLowerCase()==='that many'?0:numOf(m[1]);n=n*(times==null?1:times);const name=m[4];const card=vsCard(name);const kind=m[5]?m[5].toLowerCase():card&&card.t==='Gear'?'gear':'unit';const kws=(m[7]||'').match(/\[([^\]]+)\]/g)||[];const tail=m[8]||'';
    /* Zilean, Time Mage (replacement, 369.1): körönként egyszer, ha a controllere token unitot játszana ki, mialatt Zilean battlefielden áll,
       helyette a token és egy további másolata (446.3) jön létre. "You may": az elemzés úgy számol, hogy él vele. */
    const zil=kind==='unit'&&n>0&&!X.ZIL[it.pl]?Object.values(X.O).find((o)=>o.zone==='board'&&o.ctrl===it.pl&&o.card&&o.card.n==='Zilean, Time Mage'&&o.loc&&o.loc!=='base'):null;
    if(zil){X.ZIL[it.pl]=true;n+=1;parts.push(esc(zil.name)+' (replacement, körönként egyszer): a token mellett egy további másolata is létrejön (369.1, 446.3); "you may", az elemzés úgy számol, hogy él vele.');refs.push('369.1','446.3');}
    const here=X.srcLoc(it);const loc=/\bto a (?:single )?battlefield\b/i.test(tail)?(it.dest||(it.s&&it.s.dest)||'bf0'):/\bthere\b/i.test(tail)?(it.notedLoc||(it.lk&&it.lk.loc)||here||'base'):/\bhere\b/i.test(tail)?(here||'base'):'base';
    const ids:string[]=[];for(let q=0;q<n;q++){const id='k'+(++X.TOKN);const extra=kws.filter((k:string)=>!(card&&(card.txt||'').includes(k))).join('\n');const c=card?(extra?Object.assign({},card,{txt:(card.txt||'')+'\n'+extra}):card):{n:name,t:kind==='unit'?'Unit':'Gear',m:m[3]?+m[3]:null,st:['Token'],tg:[],txt:extra};
      const er=kind==='unit'?X.enterReady(Object.assign({},c,{t:'Unit',st:['Token']}),it.pl,false,loc,undefined,id):{ready:false,why:''};if(q===0&&er.why&&!m[2]&&!m[6])parts.push('Ready lép be: '+esc(er.why)+'.');
      X.O[id]={id,name:name+' token',card:c,ctrl:it.pl,own:it.pl,loc,baseOf:it.pl,m:kind==='unit'?(m[3]?+m[3]:(c.m!=null?+c.m:null)):null,dmg:0,mods:[],kws:[],zone:'board',type:kind,ex:m[6]?true:m[2]?false:kind==='unit'?!er.ready:false,token:true};
      ids.push(id);X.EV.push({k:'token',pl:it.pl,id,name,loc});}
    if(it.notedLoc&&/\bthere\b/i.test(tail)){parts.push('A "there" a trigger feltételéből a triggereléskor feljegyzett location ('+esc(X.locLabel(it.notedLoc))+'), a forrás későbbi mozgása nem számít (359.3.f.3).');refs.push('359.3.f.3');}
    parts.push(n+' db '+esc(name)+' '+kind+' token jön létre ('+esc(X.locLabel(loc))+(m[2]?', ready':m[6]?', exhausted':kind==='unit'?(X.O[ids[0]]&&!X.O[ids[0]].ex?', ready (143.4.a)':', exhausted (143.4)'):'')+(kws.length?', '+kws.join(' '):'')+') (350.2, 440.2).');refs.push('350.2','440.2');
    if(n)X.story.push(n+' '+name+' token kerül ide: '+X.locLabel(loc)+'.');
    ids.forEach(id=>{if(X.O[id].type==='unit')X.playTrigs({c:X.O[id].card!,j:-1,pl:it.pl,from:'other',objId:id}).forEach((tr)=>X.pushTrig(tr));});return ids;};
  /** Copy effect (446.1, 479.1.b): a tokenek a forrás másolatai lesznek. A másolható jellemzők a nyomtatottak, vagy ha a forrás maga is másolat,
      a másoltak; tokennél a létrehozáskoriak (479.1.b.1). A Might módosítások, buffok, damage és kapott keywordök nem másolódnak (479.1.c).
      A token token marad, a play effectek nem futnak le (a lap már a boardon van; a Reflection emlékeztető szövege). */
  /** Shady Spectacles (446.1, 479.1.b): csatoláskor a választott másik friendly unit másolata lesz, amíg az Equipment rajta van; a cleanup ellenőrzi a végét. */
  X.equipCopy=(G,U,srcId,pl,parts,refs)=>{const S=srcId?X.O[srcId]:null;
    if(!S){parts.push(esc(G.name)+': a másolandó másik friendly unit nincs megadva (a lépés 2. helye), ezért nincs copy effect.');return;}
    if(S.zone!=='board'||S.type!=='unit'||S.ctrl!==pl||S.id===U.id){parts.push(esc(G.name)+': '+esc(S.name)+' nem választható (másik friendly unit a boardon kell legyen), ezért nincs copy effect.');return;}
    const C=S.copyOf||S.card;if(!C)return;if(!U.orig)U.orig={card:U.card,name:U.name,m:U.m};U.copyOf=C;U.card=C;U.copyBy=G.id;U.name=C.n+' ('+U.orig.name+', másolat)';U.m=C.m!=null&&(C.m as unknown)!==''?+C.m:0;
    X.EV.push({k:'copy',id:U.id,name:U.name,from:U.orig.name});parts.push(esc(U.orig.name)+' '+esc(S.name)+' másolata lesz, amíg '+esc(G.name)+' rajta van: neve '+esc(C.n)+', Mightja '+(C.m!=null?C.m:0)+' (nyomtatott érték), a szövege a lapé; a saját Might módosításai és buffja megmaradnak, mert azok nem másolható jellemzők (446.1, 479.1.b, 479.1.b.1, 479.1.c).');refs.push('446.1','479.1.b','479.1.b.1','479.1.c');};
  X.copyEnd=()=>{const out:string[]=[];Object.values(X.O).forEach((U)=>{if(!U.copyBy||!U.orig)return;const G=X.O[U.copyBy];if(G&&G.zone==='board'&&G.on===U.id&&U.zone==='board')return;
      const nm=U.name;U.card=U.orig.card;U.name=U.orig.name;U.m=U.orig.m;U.copyOf=null;U.copyBy=null;U.orig=null;out.push(nm+': a copy effect véget ér ('+(G?G.name:'az Equipment')+' már nincs rajta), újra '+U.name+'.');});return out;};
  X.copyOnto=(ids,srcId,parts,refs)=>{const S=X.O[srcId];const C=S.copyOf||S.card;if(!C)return;
    ids.forEach(id=>{const T=X.O[id];if(!T||T.zone!=='board')return;const was=T.name;T.copyOf=C;T.card=Object.assign({},C,{st:[...new Set([...(C.st||[]),'Token'])]});T.name=C.n+' (másolat)';
      if(T.type==='unit')T.m=C.m!=null&&(C.m as unknown)!==''?+C.m:0;X.EV.push({k:'copy',id,name:T.name,from:was});});
    parts.push((ids.length>1?ids.length+' token':'A token')+' '+esc(S.name)+' másolata lesz: neve '+esc(C.n)+', Mightja '+(C.m!=null?C.m:0)+' (a nyomtatott érték; a forrás módosításai, buffja és damage-e nem másolódik), a szövege és keywordjei a lapé (446.1, 479.1.b, 479.1.b.1, 479.1.c). Token marad, a play effectje nem fut le.');
    refs.push('446.1','479.1.b','479.1.b.1','479.1.c');X.story.push(ids.map((id)=>X.O[id].name).join(', ')+': '+S.name+' másolata.');};
}
