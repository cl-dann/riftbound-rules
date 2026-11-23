/* Célpont-legalitás: saját hivatkozás, forrás helye, Choose one, célpont indoklás, legális opciók (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { costCheck } from '../cost';
import { other } from './labels';

export function installTargeting(X: EngineCtx) {
  X.selfRef=(t)=>/\b(?:me|myself)\b(?! to\b)|\b(?:kill|banish|recall|exhaust|ready) this\b|\bI (?:get|gain|have)\b/i.test(t)&&!/\bto me\b/i.test(t);
  X.srcLoc=(it,phase?)=>phase==='play'&&it.perm?it.loc:it.src&&X.O[it.src!]&&X.O[it.src!].zone==='board'?X.O[it.src!].loc:null;
  X.chooseOnlyWhy=(it,ob,_phase)=>{const mine=(it.tg||[])[0];const st=[...X.MAIN,...(X.AFTER||[])].find((x)=>'s'+x.j===ob.id);const tg=st?(st.tg||[]):[];
    const cnt=tg.filter((v:string)=>v&&X.O[v]&&X.O[v].type==='unit'&&X.O[v].zone==='board'&&X.O[v].ctrl===it.pl);const gone=tg.filter((v:string)=>v&&X.O[v]&&X.O[v].type==='unit'&&X.O[v].zone!=='board');
    const N=esc(ob.name);const out:string[]=[];
    if(!mine||!tg.includes(mine))out.push(N+' nem választja ki '+(mine&&X.O[mine]?esc(X.O[mine].name)+' lapot':'a kiválasztott friendly unitot'));
    else if(cnt.length!==1)out.push(N+' '+cnt.length+' friendly unitot választott, amelyek a boardon vannak ('+cnt.map((v:string)=>esc(X.O[v].name)).join(', ')+'); a mistargetelt, de a boardon maradt választások is számítanak (359.3.e.9.a)');
    if(!out.length&&gone.length)it.coNote=N+' célpontjai közül '+gone.map((v:string)=>esc(X.O[v].name)).join(', ')+' nem a boardon van, ezért nem számít (359.3.e.9.a); így csak '+esc(X.O[mine].name)+' a választott friendly unit.';
    return out;};
  X.itemEnergy=(it)=>{const c=it.s&&it.s.c;return it.s&&it.s.k==='card'&&c&&c.e!=null?+c.e:0;};
  X.tgWhy=(it,p,v,ti,phase)=>{const w=X.tgWhy0(it,p,v,ti,phase);
    if(!w.length&&p&&p.cost&&v!=='F0'&&v!=='F1'&&X.O[v]&&X.O[v].card){const cw=costCheck(p.cost,X.O[v].card,{might:it.src&&X.onB(it.src!)?X.mightOf(it.src!):null,points:X.scoreOf(it.pl)});if(cw)w.push(esc(X.O[v].name)+': '+cw+'.');}
    return w;};
  X.tgWhy0=(it,p,v,ti,phase)=>{const why:string[]=[];if(v==='F0'||v==='F1'){if(p.type!=='battlefield')why.push('ez battlefield');return why;}
    const ob=X.O[v];if(!ob)return ['ismeretlen célpont'];const N=esc(ob.name);
    if(p.type==='spell'){if(!(ob.type==='spell'||p.orAb&&ob.type==='ability'))why.push(N+' nem spell'+(p.orAb?' vagy ability':'')+', hanem '+ob.type+' (355.9.a.2).');else if(ob.zone!=='chain')why.push(phase==='res'?'már nincs a chainen':N+' nincs a chainen.');
      if(!why.length&&p.rel==='enemy'&&ob.ctrl===it.pl)why.push(N+' nem enemy (a saját '+(ob.type==='ability'?'abilityd':'spelled')+').');
      if(!why.length&&p.chooseOnly)why.push(...X.chooseOnlyWhy(it,ob,phase));
      return why;}
    if(ob.type!==p.type&&!(p.type==='perm'&&(ob.type==='unit'||ob.type==='gear')))why.push(N+' '+ob.type+', nem '+p.type+'.');
    if(ob.zone!=='board'){why.push(phase==='res'?'már '+(ob.zone==='hand'?'kézben van':ob.zone==='trash'?'a trashben van':ob.zone==='banish'?'banishelve van':'nincs a boardon')+', zónát váltott (359.3.e.2)':N+' nincs a boardon.');return why;}
    if(p.equipOnly&&!(ob.card&&(ob.card.tg||[]).includes('Equipment')))why.push(N+' nem Equipment.');
    if(p.bf&&ob.loc==='base')why.push(phase==='res'?'már a base-ben áll, a lap pedig battlefielden álló célpontot kér':N+' base-ben áll, a lap battlefielden álló célpontot kér.');
    if(p.base&&ob.loc!=='base')why.push(N+' nem base-ben áll.');
    if(p.eq&&!p.equipOnly&&!Object.values(X.O).some((g)=>g.on===v&&g.zone==='board'))why.push(phase==='res'?'már nincs rajta Equipment, nem "equipped" (359.3.e.12)':N+' nem equipped.');
    if(p.stunned&&!ob.st)why.push(N+' nem stunned.');
    if(p.here){const hl=p.there&&it.notedLoc?it.notedLoc:X.srcLoc(it,phase);if(hl==null)why.push(phase==='res'?'a forrás már nincs a boardon, ezért a "here" nem értelmezhető (359.3.f.2)':'a forrás nincs a boardon ("here")');else if(ob.loc!==hl)why.push(phase==='res'?'már nem ott áll, ahol a forrás ("here" a végrehajtáskor, 359.3.f.2)':N+' nem ott áll, ahol a forrás ("here").');}
    if(p.free&&X.srcLoc(it,phase)!=null&&X.srcLoc(it,phase)===ob.loc)why.push(N+' ugyanott áll, a lap másik locationt kér.');
    if(p.max!=null){const mt=X.mightOf(v);if(mt==null)why.push('Add meg '+N+' Mightját.');else if(mt>p.max)why.push(N+' Mightja '+mt+', a lap legfeljebb '+p.max+' Mightút választhat.');}
    if(p.mighty){const mt=X.mightOf(v);if(mt!=null&&mt<5)why.push(N+' nem Mighty (Might '+mt+', 5 kell, 708).');}
    if(p.another&&it.tg&&it.tg.some((x:string,k:number)=>k!==ti&&x===v))why.push(N+' már egy másik célpont, a lap "another" egységet kér.');
    if(p.another&&it.src===v&&p.rel!=='enemy')why.push(N+' maga a forrás, a lap másik unitot kér.');
    if(it.from==='facedown'&&!p.free&&it.loc){const at=it.perm&&phase==='res'?(X.onB(it.objId!)?it.loc:null):it.loc;
      if(at==null)why.push('a facedown-ból kijátszott forrás már nincs a boardon, így nem tudni, melyik battlefieldről jött (811.1.d.3.a)');
      else if(ob.loc!==at)why.push(phase==='res'?'már nem azon a battlefielden áll, ahonnan a lapot facedown-ból kijátszották (811.1.d.2, 359.3.e.2.a)':'Facedown-ból kijátszva csak azon a battlefielden választhat ('+esc(X.locLabel(at))+'), '+(it.perm?'ahová a lap került (811.1.d.3)':'ahol el volt rejtve (811.1.d.2)')+'.');}
    if(p.rel!=='any'&&ob.ctrl){const need=p.rel==='enemy'?other(it.pl):it.pl;if(ob.ctrl!==need)why.push(phase==='res'?'megváltozott az irányítója, már nem '+(p.rel==='enemy'?'enemy':'friendly')+' (359.3.e.2)':N+' '+(ob.ctrl===it.pl?'saját':'ellenséges')+' lap, a választás '+(p.rel==='enemy'?'ellenséges':'saját')+' lapot kér');}
    if(ob.untgt&&ob.ctrl&&ob.ctrl!==it.pl)why.push(phase==='res'?'ebben a körben nem választható enemy spellel vagy abilityvel, így illegális célpont (758.1)':N+' ebben a körben nem választható enemy spellel vagy abilityvel (757.1).');
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/^I can.t be chosen by enemy spells or abilities with Energy cost less than my Might\b/im.test(ob.card.txt||'')){const ec=X.itemEnergy(it);const mt=X.mightOf(v);
      if(mt!=null&&ec!<mt)why.push(phase==='res'?'a Mightja ('+mt+') nagyobb, mint a forrás Energy költsége ('+ec+'), ezért nem választható, illegális célpont (757, 758.1)':N+' Mightja ('+mt+') nagyobb, mint a lap Energy költsége ('+ec+'), ezért nem választható (757).');
      else if(phase==='res'&&X.EV.slice(it.evPlay||0).some((e)=>e.k==='might'&&e.id===v&&e.to!=null&&(e.to as number)>ec!))it.prot758=(it.prot758||[]).concat([N+': a Mightja ('+mt+') már nem nagyobb, mint az Energy költség ('+ec+'), ezért újra legális célpont (758.2)']);}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&ob.type==='unit'&&ob.zone==='board'){const W=Object.values(X.O).find((w)=>w.id!==v&&w.zone==='board'&&w.ctrl===ob.ctrl&&w.loc===ob.loc&&w.card&&/^Your units here with less Might than me can.t be chosen by enemy spells and abilities\b/im.test(w.card.txt||'')&&(X.mightOf(w.id)||0)>(X.mightOf(v)||0));
      if(!W&&phase==='res'){const W2=Object.values(X.O).find((w)=>w.id!==v&&w.board&&w.own===ob.ctrl&&w.card&&/^Your units here with less Might than me can.t be chosen by enemy spells and abilities\b/im.test(w.card.txt||''));
        if(W2&&X.EV.slice(it.evPlay||0).some((e)=>e.k==='might'&&e.id===W2.id&&e.to!=null&&(e.to as number)>(X.mightOf(v)||0)))it.prot758=(it.prot758||[]).concat([N+': '+esc(W2.name)+' passzív képessége már nem vonatkozik rá ('+(W2.zone!=='board'?'nincs a boardon':W2.loc!==ob.loc?'nem ugyanott áll':'a Mightja nem nagyobb')+'), ezért a resolve-kor legális célpont (758.2.a)']);}
      if(W)why.push(phase==='res'?esc(W.name)+' passzív képessége miatt ('+X.mightOf(v)+' Might, kevesebb, mint '+X.mightOf(W.id)+') nem választható, illegális célpont (757, 758.1)':N+' nem választható: '+esc(W.name)+' ugyanott áll, és a Mightja nagyobb (757).');}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/can.t be chosen by enemy|cannot be chosen by enemy/i.test((ob.card.txt||'').split('\n').filter((l:string)=>!/with Energy cost less than my Might|^Your units here with less Might/i.test(l)).join('\n'))&&!/unless/i.test(ob.card.txt||''))why.push(phase==='res'?'enemy spell vagy ability nem választhatja, így illegális célpont (758.1)':N+' szövege szerint ellenséges spell vagy ability nem választhatja (757, 758).');
    return why;};
  X.legalOpts=(it,p,ti)=>{if(p.type==='battlefield')return ['F0','F1'].filter(f=>X.BF['bf'+f[1]].c);
    return Object.keys(X.O).filter(id=>(p.type==='spell'?X.O[id].zone==='chain':X.O[id].zone==='board')&&(X.O[id].type===p.type||p.orAb&&X.O[id].type==='ability'||p.type==='perm'&&(X.O[id].type==='unit'||X.O[id].type==='gear'))&&!(it.tg||[]).some((x:string,k:number)=>k!==ti&&x===id)&&!X.tgWhy(it,p,id,ti,'play').length);};
}
