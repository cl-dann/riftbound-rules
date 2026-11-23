/* Kör vége: Ending Step és Expiration Step (a runChain() csoportja, S20) */
import type { ChainItem, EngineCtx, GameObj } from './ctx';
import { esc } from '../../text/norm';
import { condOf } from '../conditions';
import { plainOf, stripRem } from '../text';
import { Art, WHOC, other } from './labels';
import { phrasesTxt } from '../parser';

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
  /* Következő kör eleje (315, a "Következő kör" lépés): a következő játékos köre a Main Phase elejéig. Csak a Core Rules által leírt lépések:
     Awaken (315.1.b), Beginning Step (315.2.a.1: "at the start of your Beginning Phase" triggerek, Temporary 816.1.b, scoring előtt),
     Scoring Step (315.2.b.2: hold 471.2, 1 pont 473.1, hold triggerek 383.4.d, 473.2.b), Channel (315.3.b), Draw (315.4.b),
     a Main Phase eleje: a "start of your next Main Phase" delayed triggerek (391.2) és az "At the start of your Main Phase" triggerek. */
  X.nextTurn=()=>{const NP=other(X.TP);X.TP=NP;X.ONCET={};X.MORDE={};X.CHOSE={};X.ZIL={A:false,B:false};const KOR=NP==='A'?'a te köröd':'az ellenfél köre';const lines=(ob:GameObj)=>(ob.card&&(ob.card.txt||'').split('\n').map(stripRem))||[];
    const mine=()=>Object.keys(X.O).filter((id)=>{const o=X.O[id];return !!o.card&&(o.zone==='board'||o.zone==='legend')&&o.ctrl===NP;});
    const push=(id:string|null,name:string,eff0:string,why:string,lab:string,x:Partial<ChainItem>={})=>{let eff=eff0;
      /* "you may exhaust me to ...": a döntés és az exhaust költség a chainre tételkor (383.3.a, 383.3.b) */
      const may=/^you may exhaust me to\s+/i.exec(eff);if(may&&id&&X.O[id]){if(X.O[id].ex){X.rr+=X.line('383.3.b',esc(name+': "'+why+'" triggerelne, de már exhausted, az exhaust költség nem fizethető ki, ezért nem kerül a chainre.'),0);return;}
        X.O[id].ex=true;eff=eff.slice(may[0].length);eff=eff.charAt(0).toUpperCase()+eff.slice(1);X.rr+=X.line('383.3.a, 383.3.b',esc(name+' triggere: a "you may" döntés (igen) és az exhaust költség a chainre tételkor; '+name+' exhausted lesz.'),0);}
      /* a késleltetett rész választása a delayed trigger lefutásakor történik (391.2), nem most */
      const later=/\bat the start of your next\b/i.test(eff);
      const it:ChainItem={kind:'auto',label:name+' triggere ('+lab+')',name:name+' triggere',src:id,pl:NP,eff,why:'"'+why+'"',list:later?[]:phrasesTxt(eff),tg:[],...(later?{mkDelay:true}:{}),...x};const tt=later?'':X.autoTg(it);X.pushTrig(it);
      X.rr+=X.line(x.dl?'391.2':'383',esc(name+' triggerel ('+lab+'): "'+why+'"'+(tt?'. Célpont (403.4.b): '+tt.replace(/<[^>]+>/g,'').replace(/\.$/,''):'')+'.'),0);X.story.push(Art(name)+' triggerel ('+lab+').');};
    const run=(label:string)=>{X.flushPend(X.stack);X.snap(label,X.stack);if(X.stack.length)X.resolveAll();};
    X.rr+=X.line('315',esc('Következő kör: '+KOR+' kezdődik. Az elemzés a kör elejét a Main Phase elejéig követi.'),0);X.story.push('Jön a következő kör ('+KOR+').');
    /* Awaken (315.1.b) */
    const rd:string[]=[];Object.values(X.O).forEach((o)=>{if(o.ctrl===NP&&(o.zone==='board'||o.zone==='legend')&&o.ex){o.ex=false;rd.push(o.name);}});
    const rr=X.RPK[NP]?X.poolIds(NP).filter((id)=>X.O[id].ex):[];rr.forEach((id)=>{X.O[id].ex=false;});if(!X.RPK[NP])X.CHEX[NP]=0;
    X.rr+=X.line('315.1, 315.1.b',esc('Awaken Phase: '+(NP==='A'?'minden readyzhető objektumodat readyzed':'az ellenfél minden readyzhető objektumát readyzi')+(rd.length?': '+rd.join(', '):' (nem volt exhausted objektum)')+'; a rune-ok is ready-k lesznek.'),0);X.snap('Következő kör: Awaken Phase',[]);
    /* Beginning Step (315.2.a.1): "at the start of your Beginning Phase" és Temporary (816.1.b), a scoring előtt */
    mine().forEach((id)=>{const o=X.O[id];lines(o).forEach((l:string)=>{const m=/^(?:when you play (?:me|this) or )?at (?:the )?start of (your|each player's) Beginning Phase,\s*(.*)$/i.exec(l);if(m)push(id,o.name,m[2],l,'Beginning Phase eleje');});
      if(o.zone==='board'&&(/^\[Temporary\]/m.test((o.card&&o.card.txt)||'')||(o.kws||[]).includes('Temporary')))push(id,o.name,'Kill me.','[Temporary]','Temporary, 816.1.b');});
    Object.keys(X.O).forEach((id)=>{const o=X.O[id];if(o.ctrl===NP||!(o.zone==='board'||o.zone==='legend'))return;lines(o).forEach((l:string)=>{const m=/^at (?:the )?start of each player's Beginning Phase,\s*(.*)$/i.exec(l);if(m)push(id,o.name,m[1],l,'Beginning Phase eleje',{pl:o.ctrl!});});});
    X.rr+=X.line('315.2, 315.2.a, 315.2.a.1',esc('Beginning Phase, Beginning Step: a kör eleji hatások (a Temporary is, 816.1.b) a scoring előtt.'),0);run('Következő kör: Beginning Step');
    /* Scoring Step (315.2.b.2): hold (471.2), 1 pont (473.1), hold triggerek (383.4.d, 473.2.b) */
    const held=['bf0','bf1'].filter((l)=>X.BF[l]&&X.BF[l].ctrl===NP);
    held.forEach((bl)=>{X.EV.push({k:'score',pl:NP,n:1});X.rr+=X.line('315.2.b.2, 471.2, 473.1',esc((NP==='A'?'Holdolod: '+X.locLabel(bl)+', 1 pontot kapsz.':'Az ellenfél holdolja: '+X.locLabel(bl)+', 1 pontot kap.')),0);X.story.push((NP==='A'?'Holdolod: ':'Az ellenfél holdolja: ')+X.locLabel(bl)+'.');
      Object.keys(X.O).forEach((id)=>{const o=X.O[id];if(!o.card||o.ctrl!==NP||!(o.zone==='board'||o.zone==='legend'))return;lines(o).forEach((l:string)=>{
        let m=/^when (?:you play me or when )?I (?:conquer or )?hold,\s*(.*)$/i.exec(l);if(m&&o.zone==='board'&&o.loc===bl){push(id,o.name,m[1],l,'hold',{notedLoc:bl,dest:bl});return;}
        m=/^when (?:you|you or an ally) (?:conquer or )?hold,\s*(.*)$/i.exec(l);if(m)push(id,o.name,m[1],l,'hold',{notedLoc:bl,dest:bl});});});
      const bc=X.BF[bl].c;if(bc)(bc.txt||'').split('\n').map(stripRem).forEach((l:string)=>{const m=/^when you hold here,\s*(.*)$/i.exec(l);if(!m)return;const id='H'+bl;X.O[id]={id,name:bc.n,card:bc,ctrl:NP,own:NP,loc:bl,zone:'legend',type:'trigsrc'};push(id,bc.n,m[1],l,'hold',{notedLoc:bl,dest:bl});});});
    if(!held.length)X.rr+=X.line('315.2.b.2',esc((NP==='A'?'Egy battlefieldet sem irányítasz':'Az ellenfél egy battlefieldet sem irányít')+', nincs hold.'),0);
    run('Következő kör: Scoring Step (hold)');
    /* Channel (315.3.b) és Draw (315.4.b) */
    X.EV.push({k:'channel',pl:NP,n:2});X.rr+=X.line('315.3, 315.3.b',esc('Channel Phase: '+WHOC[NP]+' channelöl 2 rune-t.'+X.channelRunes(NP,2,false)),0);X.snap('Következő kör: Channel Phase',[]);
    const top=X.ZC?X.zoneIds('deck',NP)[0]:undefined;if(top)X.zcMove(top,'hand');X.EV.push({k:'draw',pl:NP,n:1});
    X.rr+=X.line('315.4, 315.4.b',esc('Draw Phase: '+WHOC[NP]+' húz 1 lapot'+(top?' ('+X.O[top].name+')':'')+'.'),0);X.snap('Következő kör: Draw Phase',[]);
    /* Main Phase eleje: delayed (391.2) és "At the start of your Main Phase" */
    X.out.delayed.forEach((d)=>{if(d.who!==NP||!/\bat the start of your next Main Phase\b/i.test(d.t))return;d.done=true;
      let eff=d.t.replace(/,?\s*\bat the start of your next Main Phase\b,?\s*/i,' ').replace(/\s+\./g,'.').trim();eff=eff.charAt(0).toUpperCase()+eff.slice(1);if(!/\.$/.test(eff))eff+='.';
      push(d.srcId&&X.O[d.srcId]?d.srcId:null,d.src,eff,d.t,'delayed, Main Phase eleje',{dl:true,notedLoc:d.loc||null,dest:d.loc||undefined,pre:(d.ids||[]).filter((v:string)=>X.O[v])});});
    X.out.delayed=X.out.delayed.filter((d)=>!d.done);
    mine().forEach((id)=>{const o=X.O[id];lines(o).forEach((l:string)=>{const m=/^at (?:the )?start of your Main Phase,\s*(.*)$/i.exec(l);if(m)push(id,o.name,m[1],l,'Main Phase eleje');});});
    X.rr+=X.line('391.2',esc('Main Phase eleje: a "start of your next Main Phase" delayed hatások és az "At the start of your Main Phase" triggerek.'),0);run('Következő kör: Main Phase eleje');
    X.rr+=X.line('315',esc('Az elemzés itt megáll: '+KOR+' Main Phase-szel folytatódik.'),0);};
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
