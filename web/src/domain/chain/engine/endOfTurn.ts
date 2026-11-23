/* Kör vége: Ending Step és Expiration Step (a runChain() csoportja, S20) */
import type { ChainItem, EngineCtx, GameObj } from './ctx';
import { esc } from '../../text/norm';
import { condOf } from '../conditions';
import { plainOf, stripRem } from '../text';
import { Art, WHOC } from './labels';

export function installEndOfTurn(X: EngineCtx) {
  X.endStep=()=>{X.ENDED=true;
    X.story.push('A chain kiürült, jön az Ending Phase.');X.rr+=X.line('317, 317.1',esc('A chain kiürült. A kör az Ending Phase-be lép, Ending Step: a kör végi hatások triggerelnek (317.1.a).'),0);
    const ET:ChainItem[]=[];
    X.out.delayed.forEach((d)=>{if(!/\bat (?:the )?end of (?:this )?turn\b/i.test(d.t))return;d.done=true;
      let eff=d.t.replace(/,?\s*\bat (?:the )?end of (?:this )?turn\b,?\s*/i,' ').replace(/\s+\./g,'.').trim();if(/\bthat many\b/i.test(eff))eff=eff.replace(/\bthat many\b/i,String(d.n||0));
      eff=eff.charAt(0).toUpperCase()+eff.slice(1);if(!/\.$/.test(eff))eff+='.';
      ET.push({kind:'auto',label:d.src+' delayed hatása (kör vége)',name:d.src+' delayed hatása',src:d.srcId&&X.O[d.srcId]?d.srcId:null,pl:d.who,eff,why:'"'+d.t+'"',list:[],tg:[],pre:(d.ids||[]).filter((v:string)=>X.O[v]),dl:true});
      X.rr+=X.line('317.1.a, 391.2',esc(d.src+' delayed hatása triggerel: "'+d.t+'"'+(d.ids&&d.ids.length?' ('+d.ids.map((v:string)=>X.O[v]?X.O[v].name:v).join(', ')+')':'')+'.'),0);X.story.push(d.src+' delayed hatása triggerel: '+eff);});
    const endCond=(c:string,ob:GameObj)=>{if(/^I'm at a battlefield$/i.test(c))return ob.zone==='board'&&ob.loc!=='base';
      if(/^you control this battlefield$/i.test(c))return ob.zone==='board'&&!!X.BF[ob.loc!]&&X.BF[ob.loc!].ctrl===ob.ctrl;
      const cd=condOf('if '+c+', x.');return cd?X.evalCond(cd,{pl:ob.ctrl,src:ob.id} as ChainItem,null,0,null)===true:false;};
    Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(!ob.card||!(ob.zone==='board'||ob.zone==='legend'))return;(ob.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{
      const m=/^At the end of (your|each) turn,\s*(.*)$/i.exec(l);if(!m)return;if(m[1].toLowerCase()==='your'&&ob.ctrl!==X.TP)return;
      let eff=m[2];const ic=/^if ([^,]+),\s*(.*)$/i.exec(eff);
      if(ic){const ok=endCond(ic[1],ob);eff=ic[2];X.rr+=X.line('383.2.a.1',esc(ob.name+': a trigger feltétele ("if '+ic[1]+'") a kör végén '+(ok?'teljesül, ezért a trigger a chainre kerül; ha utána a forrás eltűnik, a trigger ettől még lefut':'nem teljesül, ezért nem triggerel')+'.'),0);
        X.story.push(Art(ob.name)+(ok?' kör végi triggere a chainre kerül.':' kör végi triggere nem triggerel, mert a feltétele ("if '+ic[1]+'") nem teljesül.'));if(!ok)return;}
      else X.story.push(Art(ob.name)+' kör végi triggere a chainre kerül.');
      ET.push({kind:'auto',label:ob.name+' triggere (kör vége)',name:ob.name+' triggere',src:id,pl:ob.ctrl!,eff,why:'"'+l+'"',list:[],tg:[],endTrig:!!ic});});});
    ET.forEach((t)=>X.pushTrig(t));X.flushPend(X.stack);
    if(X.stack.length)X.snap('Ending Step: kör végi triggerek a chainen',X.stack);
    else X.rr+=X.line('317.1.a',esc('Nincs kör végi hatás.'),0);};
  X.expiration=()=>{
    /* Expiration Step (317.2): Ending Special Cleanup a 323 lépéseivel: 3a lethal damage-es unitok meghalnak, 3c heal (317.2.b),
       3d a "this turn" hatások lejárnak (317.2.c) és a stun megszűnik (424.1.a.2), 3e a Rune Pool kiürül (317.2.d);
       ha közben chain elem keletkezett és lefutott (FEPR), vissza az Expiration Step elejére (317.2.f). */
    for(let round=0;round<4;round++){
      X.rr+=X.line('317.2, 317.2.a',esc('Expiration Step'+(round?' (újra, 317.2.f)':'')+': Ending Special Cleanup (318).'),0);
      const kp:string[]=[];const kr:string[]=[];const dead=Object.keys(X.O).filter(id=>X.lethal(id));dead.forEach(id=>{X.killObj(id,'lethal damage, Ending Special Cleanup',kp,kr);});
      if(dead.length)X.rr+=X.line('323.4, 142.4.b',esc('3a: '+plainOf(kp.join(' '))),0);
      const heal:string[]=[];const exp:string[]=[];const stun:string[]=[];
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.zone!=='board')return;
        if(ob.type==='unit'&&ob.dmg){heal.push(ob.name+' ('+ob.dmg!+')');ob.dmg=0;}});
      Object.keys(X.O).forEach(id=>{const ob=X.O[id];if(ob.zone!=='board')return;
        const e:string[]=[];if(ob.mods&&ob.mods!.length){e.push('Might módosítók');ob.mods=[];}if(ob.kws&&ob.kws!.length){e.push('kapott keywordök ('+ob.kws.join(', ')+')');ob.kws=[];}
        if(ob.baseSet!=null){e.push('alap Might beállítás');ob.baseSet=null;}if(ob.untgt){e.push('célozhatatlanság');ob.untgt=null;}if(ob.save){e.push('mentés');ob.save=null;}
        if(ob.dieTo){e.push('halál helyettesítés');ob.dieTo=null;}if(ob.dbl){e.push('damage duplázás');ob.dbl=null;}if(ob.prev){e.push('Prevent');ob.prev=null;}if(ob.shields){e.push('Shield módosítás');ob.shields=null;}
        if(e.length)exp.push(ob.name+': '+e.join(', '));
        if(ob.type==='unit'&&ob.st){ob.st=false;stun.push(ob.name);}});
      ['A','B'].forEach(p=>{X.READY[p]=false;X.BUFF2[p]=false;if(X.READYNEXT[p])exp.push(WHOC[p]+': "the next unit you play this turn enters ready"');X.READYNEXT[p]=false;if(X.ACCELNEXT[p])exp.push(WHOC[p]+': "the next unit you play this turn has [Accelerate]"');X.ACCELNEXT[p]=false;});X.PREVSA.on=false;
      X.rr+=X.line('317.2.b',esc('3c: minden unit gyógyul'+(heal.length?': '+heal.join(', '):' (egyiken sincs damage)')+'.'),0);
      X.rr+=X.line('317.2.c, 424.1.a.2',esc('3d: minden "this turn" hatás egyszerre lejár'+(exp.length?': '+exp.join('; '):' (nincs ilyen)')+'; a stun megszűnik'+(stun.length?': '+stun.join(', '):' (nincs stunned unit)')+'.'),0);
      X.rr+=X.line('317.2.d',esc('3e: a Rune Pool kiürül, az el nem költött Energy és Power elvész.'),0);
      if(!round)X.story.push('Expiration Step: '+(dead.length?'a lethal damage-es unitok meghalnak, ':'')+'minden unit gyógyul, a "this turn" hatások lejárnak, a stun megszűnik.');
      X.cleanup();X.snap('Ending Phase: Expiration Step'+(round?' (újra)':''),X.stack);
      if(!X.stack.length)break;
      X.rr+=X.line('317.2.f',esc('Az Expiration Step közben chain elem keletkezett ('+X.stack.map((t)=>t.label).join(', ')+'); lefut, utána az Expiration Step elölről kezdődik.'),0);
      X.resolveAll();}
    X.out.delayed=X.out.delayed.filter((d)=>!d.done);};
}
