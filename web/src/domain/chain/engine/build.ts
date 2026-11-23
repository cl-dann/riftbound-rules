/* Felépítés: tétel a lépésből, a chain felépítése (playMain), cleanup (a runChain() csoportja, S20) */
import type { EngineCtx, PlayRun } from './ctx';
import type { Act, Instr } from '../types';
import { esc } from '../../text/norm';
import { vsCard } from '../../data/store';
import { interp, isPermC, timingOf } from '../actions';
import { costCheck, costCondOf } from '../cost';
import { plainOf } from '../text';
import { zoneRefOf } from '../zones';
import { RES, art, Art, WHO } from './labels';

export function installBuild(X: EngineCtx) {
  X.itemOf=(s)=>{const c=s.c;const perm=s.k==='card'&&isPermC(c);
    const so=X.O['s'+s.j];const abn=so&&(s.k==='ab'||s.k==='tg')?so.name:c.n+(s.k==='ab'?' abilityje':' triggere');
    const label=s.k==='ab'||s.k==='tg'?abn:((so&&so.name)||c.n)+(perm?' (play trigger)':'');
    const src=s.k==='ab'||s.k==='tg'?s.src:perm?'s'+s.j:null;
    return {kind:'step',s,label,name:s.k==='ab'||s.k==='tg'?abn:so&&so.no?so.name:c.n,pl:s.k==='tg'?((X.O[s.src!]&&X.O[s.src!].ctrl)||s.pl):s.pl,eff:s.eff,list:s.list,tg:s.tg,src,perm,from:s.k==='card'?s.from:null,loc:s.k==='card'?(s.loc||(s.from==='facedown'?'bf0':'base')):null,objId:s.k==='card'||s.k==='ab'||s.k==='tg'?'s'+s.j:null,dest:s.dest,ov:s.ov,pays:s.pays,may:s.may,isTg:s.k==='tg',evPlay:X.EV.length,soM:s.so?(String(s.so).startsWith('h:')?((vsCard(String(s.so).slice(2))||{}).m??null):(X.O[s.so]?X.mightOf(s.so):null)):null,soName:s.so?(String(s.so).startsWith('h:')?String(s.so).slice(2)+' (kézből felfedve)':(X.O[s.so]?X.O[s.so].name:'')):'',notedLoc:s.k==='tg'&&s.tr&&/\bmove from a location\b/i.test(s.tr.why||'')?(s.mfrom||'base'):null};};
  X.playMain=()=>X.MAIN.forEach((s,ix)=>{
    if(s.k==='end'){X.playEnd();return;}
    if(X.NEXT){X.rows+=X.line('315','<span class="stbad">Nem szabályos:</span> a "Következő kör" az utolsó lépés: az elemzés a következő kör Main Phase-ének elején megáll, az utána felvett lépés kimarad.',0);return;}
    if(s.k==='next'){X.playEnd();X.NEXT=true;return;}
    if(s.k==='res'){X.playRes();return;}
    try{X.playStep(s,ix);}finally{const lab=(s.k==='tg'?(s.it?s.it.pl:s.pl):s.pl)==='A'?'Te':'Ellenfél';X.snap(s.k==='tg'?'Trigger: '+s.c.n+(s.illegal?' (lekerül)':''):lab+': '+(s.k==='ab'?'aktiválás':'kijátszás')+', '+(s.k==='ab'?s.c.n+' abilityje':s.c.n)+(s.illegal?' (nem szabályos, kimarad)':''),X.chain,s.j);}});
  /** Kör vége: a chain lefut, majd Ending Step (317.1); a további lépések a kör végi triggerekre válaszolnak. */
  X.playEnd=()=>{
      X.stack=X.chain;if(X.chain.length){X.rows+=X.line('340.1','Mindkét játékos passzol: a chain teljes egészében lefut, utána jön az Ending Phase.',0);X.resolveAll();}
      if(!X.ENDED){X.rows+=X.line('317, 317.1','Kör vége: Ending Phase, Ending Step.',0);X.endStep();}};
  /** "Mindenki passzol": a chain legfelső eleme most resolve-ol (340.1), utána a cleanup; a következő lépések erre az állapotra épülnek. */
  X.playRes=()=>{
      if(!X.chain.length){X.rows+=X.line('340.1','Resolve lépés: a chain üres, nincs mit lefuttatni.',0);return;}
      X.stack=X.chain;const top=X.chain.pop();X.rows+=X.line('340.1','Mindkét játékos passzol: a chain legfelső eleme ('+esc(top!.label)+') most resolve-ol, a következő lépések ez után jönnek.',0);
      const d0=X.done.length;try{X.resolveItem(top!);X.flushPend(X.chain);}finally{const dn=X.done.length>d0?X.done[X.done.length-1]:null;X.snap('Resolve: '+top!.label+(dn?', '+(RES[dn.res]||dn.res):''),X.chain);X.cleanup();}};
  /** Kijátszás, aktiválás vagy trigger: a tétel, a legalitás (playCheck), majd a szabályos kijátszás (playLegal). */
  X.playStep=(s,ix)=>{
    const c=s.c;const tm=s.k==='ab'?(s.ab?s.ab!.tm:'none'):s.k==='tg'?'trig':timingOf(c);const perm=s.k==='card'&&isPermC(c);const empty=!X.chain.length;
    const verb=s.k==='tg'?Art(c.n)+' triggerel':s.pl==='A'?(ix&&!empty?'Válaszként ':'')+(s.k==='ab'?'aktiválod':'kijátszod'):'Az ellenfél '+(ix&&!empty?'válaszként ':'')+(s.k==='ab'?'aktiválja':'kijátssza');
    const what=s.k==='tg'?'('+esc(s.tr?s.tr.why:'?')+')':s.k==='ab'?art(c.n)+' abilityjét ('+esc(s.ab?s.ab!.label:'?')+')':art(c.n)+' lapot';
    const Verb=verb[0].toUpperCase()+verb.slice(1);
    const it=X.itemOf(s);s.it=it;if(X.ZC)X.out.zsnap![s.j]={board:Object.keys(X.O).filter((id:string)=>(X.O[id].type==='unit'||X.O[id].type==='gear')&&X.O[id].zone==='board'),ctx:X.zctx(it,s),hand:{A:X.zoneIds('hand','A'),B:X.zoneIds('hand','B')},trash:{A:X.zoneIds('trash','A'),B:X.zoneIds('trash','B')},deck:{A:X.zoneIds('deck','A'),B:X.zoneIds('deck','B')}};
    const P:PlayRun={s,ix,c,tm,perm,empty,Verb,what,it,costV:null,pick:[],trigBad:null};
    if(X.playCheck(P))return;
    if(perm&&c.t==='Unit'&&X.ACCELNEXT[s.pl]){X.ACCELNEXT[s.pl]=false;X.O['s'+s.j].accelG=true;} // a kijátszáskor kapja meg (805.1.b), nem a belépéskor
    X.playLegal(P);};
  /** A kijátszás legalitása (358, 355.8, 403.4): igaz, ha a lépés itt véget ér (nem szabályos, vagy azonnal resolve-ol). */
  /* Ambush (822.1.b): a unit [Reaction]-t kap, amíg olyan battlefieldre játsszák ki, ahol a játékos unitot kontrollál; ha ott nincs unitja, nem (822.3) */
  X.ambushOK=(s,c)=>{if(s.k!=='card'||!c||c.t!=='Unit'||!/^\[Ambush\]/m.test(c.txt||''))return false;const loc=s.loc||'base';if(loc==='base')return false;
    return Object.values(X.O).some((o)=>o.zone==='board'&&o.type==='unit'&&o.ctrl===s.pl&&o.loc===loc);};
  X.ambushWhy=(s,c)=>{if(s.k!=='card'||!c||c.t!=='Unit'||!/^\[Ambush\]/m.test(c.txt||''))return '';const loc=s.loc||'base';
    return 'a lap [Ambush], de csak olyan battlefieldre kap [Reaction]-t, ahol unitod van (822.1.b, 822.3); '+(loc==='base'?'a base nem battlefield':esc(X.locLabel(loc))+' helyen nincs unitod')+', ezért amíg van valami a chainen, nem jöhet';};
  X.playCheck=(P)=>{const {s,c,tm,perm,empty,Verb,what,it,pick}=P;
    let illegal:string|null=null;
    if(s.k==='ab'&&!s.ab)illegal='nincs kiválasztva ability';
    else if(s.k==='tg'&&!s.tr)illegal='nincs kiválasztva trigger';
    else if(s.k==='ab'&&s.ab!.add){X.rows+=X.line('430.2, 337.2',esc(Verb)+' '+what+'. Erőforrást ad: azonnal resolve-ol, nem kerül a chainre, és nem lehet rá válaszolni.',0);X.story.push(Verb+' '+what+': azonnal erőforrást ad, nem kerül a chainre.');return true;}
    else if(s.k!=='tg'&&!empty&&!(tm==='reaction'||tm==='hidden'&&s.from==='facedown'||X.ambushOK(s,c))&&(s.illTiming=true))illegal=X.ambushWhy(s,c)||(s.k==='ab'?'az ability':'a lap')+' nem [Reaction]'+(tm==='hidden'?' (kézből; csak facedown-ból kapna [Reaction]-t)':'')+', ezért amíg van valami a chainen, nem jöhet';
    if(!illegal&&s.k==='tg'&&s.src&&X.O[s.src!]&&!['board','legend'].includes(X.O[s.src!].zone)&&!s.tr!.dk)illegal='a trigger forrása nincs a boardon';
    if(!illegal&&s.repBad){illegal=s.repBad;}
    if(!illegal&&perm&&X.bfBlocksPlay(X.O['s'+s.j].loc))illegal=esc(X.locLabel(X.O['s'+s.j].loc))+' szövege szerint ide nem játszható ki';
    if(!illegal&&s.k==='ab'&&s.src&&X.O[s.src!]){const sc=X.O[s.src!];
      if(sc.ex&&/\[T\]|\[E\]/.test(s.ab!.cost||s.ab!.label))illegal='a forrás már exhausted, az [Exhaust] költség nem fizethető ki';
      else if(s.ab!.empower&&sc.emp)illegal='a forrás már Empowered; az Empower csak akkor aktiválható, ha nem az (827.1.b, a lap emlékeztető szövege)';
      else if(/disempower me/i.test(s.ab!.cost||'')&&!sc.emp)illegal='a "Disempower me" költséghez a forrásnak Empowered állapotban kell lennie';
      else if(!['board','legend'].includes(sc.zone))illegal='a forrás nincs a boardon';}
    /* Ezreal, Prodigal Explorer: "Use only if you've chosen enemy units and/or gear twice this turn with spells or unit abilities" (355.7: a választás célzás) */
    if(!illegal&&s.k==='ab'&&s.src&&X.O[s.src!]&&/use only if you've chosen enemy units and\/or gear twice this turn/i.test(X.O[s.src!].card!.txt||'')){const ch=X.CHOSE[s.pl!]||{items:0,objs:0};
      if(ch.items>=2)X.rows+=X.line('355.7','A feltétel ("Use only if you\'ve chosen enemy units and/or gear twice this turn with spells or unit abilities") teljesül: ebben a körben '+ch.items+' spell vagy unit ability választott enemy unitot vagy geart.',0);
      else if(ch.objs>=2){X.rows+=X.line('355.7','<span class="cbuns">nyitott kérdés</span> A feltétel ("chosen ... twice"): egyetlen spell vagy ability választott '+ch.objs+' enemy célpontot. A Core Rules nem dönti el, hogy ez egy vagy két választásnak számít; az elemzés aktiválhatónak veszi (két választás). Ha egynek számít, az ability nem aktiválható.',2);}
      else illegal='a feltétel ("Use only if you\'ve chosen enemy units and/or gear twice this turn with spells or unit abilities") nem teljesül: ebben a körben eddig '+ch.items+' spell vagy unit ability választott enemy unitot vagy geart';}
    // additional cost: kill
    const ck=s.k==='card'&&s.cost&&s.cost.kill;
    if(!illegal&&ck&&(!ck.opt||s.addc)){P.costV=s.costTg||'';if(!P.costV)illegal='az additional cost kill célpontja nincs megadva';else{const ob=X.O[P.costV];
      if(!ob||ob.zone!=='board'||ob.type!=='unit')illegal='a költségként megölendő unit nincs a boardon';else if(ob.ctrl!==s.pl)illegal='költségként csak friendly unit ölhető meg';else if(ck.mighty&&(X.mightOf(P.costV)==null||X.mightOf(P.costV)!<5))illegal=esc(ob.name)+' nem Mighty (5 vagy több Might kell, 708)';}}
    // célpontok (355.8). A kijátszott permanent már a boardon van, mire a play effectje célpontot választ (337.2), így önmagát is választhatja (355.9.c).
    if(perm&&!illegal&&X.O['s'+s.j].zone==='pending')X.O['s'+s.j].zone='board';
    // trigger (play effect, chainre tett trigger): ha van legális választás, kötelező azt választani (403.4.b); ha nincs, lekerül (403.4)
    if(!illegal&&(perm&&s.trig||s.k==='tg'))s.list.forEach((p,ti)=>{const v=s.tg[ti];if(!v&&p.opt)return;if(v&&!X.tgWhy(it!,p,v,ti,'play').length)return;
      const opts=X.legalOpts(it!,p,ti);if(!opts.length)return;const was=v?X.nm(v):'';const wy=v?X.tgWhy(it!,p,v,ti,'play').join(' '):'';s.tg[ti]=opts[0];
      pick.push(['403.4.b, 403.2','A trigger '+(ti+1)+'. célpontja '+(was?'('+esc(was)+') nem legális: '+wy.replace(/\.\s*$/,'')+';':'nincs megadva;')+' de van legális választás, ezért kötelező azt választani (403.4.b). Az elemzés ezzel számol: '+esc(X.nm(opts[0]))+(opts.length>1?'; '+WHO[it!.pl]+' választhatja helyette ezek egyikét is: '+opts.slice(1).map((o:string)=>esc(X.nm(o))).join(', '):'')+'.',0]);});
    let tErr:string|null=null;
    if(!illegal)s.list.forEach((p,ti)=>{if(tErr)return;const v=s.tg[ti];if(!v){if(!p.opt)tErr='nincs megadva a kötelező '+(ti+1)+'. célpont';return;}
      const why=X.tgWhy(it!,p,v,ti,'play');if(why.length)tErr=(ti+1)+'. célpont nem választható: '+why.join(' ').replace(/\.\s*$/,'');});
    if(!illegal&&!tErr&&s.list.some((p)=>p.same)){const ls=s.tg.filter(Boolean).map((v:string)=>X.O[v]&&X.O[v].loc);if(ls.length>1&&ls.some((l)=>l!==ls[0]))tErr='a célpontoknak ugyanazon a locationön kell állniuk';}
    if(!illegal&&!tErr&&s.list.some((p)=>p.split)){const n=s.list.map((p,ti)=>p.split&&s.tg[ti]?1:0).reduce((a:number,b:number)=>a+b,0);const sx: Partial<Act>=(interp(s,s).find((x)=>x.act.split)||{} as Partial<Instr>).act||{};
      let T0=sx.k==='dmg'?sx.n:null;if(sx.k==='dmgM'){const f=s.tg.find((v:string,ti:number)=>v&&!s.list[ti].split);T0=f?X.mightOf(f):null;}
      if(T0!=null){const b=X.bonusDmg(s.pl);if(b)T0+=b;if(n>T0)tErr='osztott damage: legfeljebb '+T0+' célpont választható (355.14.c'+(b?', a Bonus Damage-dzsel együtt, 715.3':'')+'), most '+n;}}
    /* trashből választott célpont (355.9.a, 355.10.a): a lerakáskor legálisnak kell lennie (355.8) */
    if(!illegal&&!tErr&&s.zp)interp(s,s).forEach((x,xi)=>{const ids=s.zp![xi];if(tErr||!ids||!ids.length)return;const zr=zoneRefOf(x.t,c.n);if(!zr)return;
      const gone=ids.filter((id:string)=>!X.O[id]||!X.O[id].card);if(gone.length){tErr='nincs megadva a '+(xi+1)+'. utasítás lapja: a kiválasztott lap már nincs a helyzetben (törölték), újra kell választani';return;}
      if(!zr.target)return;
      const w=X.zcWhy(zr,ids,it!.pl,false,X.zctx(it!,s));if(w)tErr=(xi+1)+'. utasítás célpontja a trashben nem választható: '+w+' (355.9.a, 355.9.b)';else{it!.zpGen=it!.zpGen||{};ids.forEach((id:string)=>{it!.zpGen![id]=X.O[id].gen||0;});}});
    /* Show Off költségfeltétellel (Rousing Display): a felfedett vagy kiválasztott lap nyomtatott költsége (832.1.c, 206) */
    if(!illegal&&!tErr&&s.so&&/\[Show Off\]/.test(c.txt||'')){const sl=(c.txt||'').split('\n').find((l:string)=>/\[Show Off\]/.test(l))||'';const cc=costCondOf(sl);
      if(cc){const sc=String(s.so).startsWith('h:')?vsCard(String(s.so).slice(2)):X.O[s.so]&&X.O[s.so].card;const w=sc?costCheck(cc,sc,{}):'';if(w)tErr='Show Off: '+sc!.n+' nem választható, '+w.replace(/ \(206\)$/,'')+' (832.1.c, 206)';}}
    if(tErr){if(perm&&s.trig)P.trigBad=tErr;else{illegal=tErr;s.illTarget=true;}}
    s.illegal=illegal;
    if(illegal){if(s.k==='tg'){X.rows+=X.line('403.4, 403.4.a',esc(Verb)+' '+what+', de nincs legális választás: '+illegal+'. A trigger lekerül a chainről (ez nem counter).',0);X.story.push(Art(c.n)+' triggere lekerül a chainről, mert '+illegal.replace(/<[^>]+>/g,'')+'.');return true;}
      X.rows+=X.line(s.illTiming?(s.k==='ab'?'358.4, 338.1.a.1, 813.1.c.2':'358.4, 338.1.a.1, 813.1.c.1'):s.illTarget?'355.8':'358','<span class="stbad">Nem szabályos:</span> '+esc(Verb)+' '+what+'? '+illegal+'. Kimarad.',0);X.story.push((s.pl==='A'?'Nem '+(s.k==='ab'?'aktiválhatod':'játszhatod ki'):'Az ellenfél nem '+(s.k==='ab'?'aktiválhatja':'játszhatja ki'))+' '+what.replace(/<[^>]+>/g,'')+' így: '+illegal.replace(/<[^>]+>/g,'').replace(/ \([0-9.]+\)/g,'')+'.');if(X.O['s'+s.j])X.O['s'+s.j].zone='none';return true;}
    return false;};
  /** A szabályos kijátszás: költségek, belépés, célpontok, triggerek, a chainre tétel. */
  X.playLegal=(P)=>{const {s,c,tm,perm,empty,Verb,what,it,pick}=P;
    // legális
    if(X.ZC&&s.k==='card'&&['hand','trash',undefined,null,''].includes(s.from)){const fz=s.from==='trash'?'trash':'hand';const zid=Object.keys(X.O).find(id=>X.O[id].type==='zc'&&X.O[id].zone===fz&&X.O[id].own===s.pl&&X.O[id].card!.n===c.n);if(zid)X.zcMove(zid,'played');}
    const amb=s.k==='card'&&!empty&&tm!=='reaction'&&X.ambushOK(s,c);
    const timingTxt=s.k==='tg'?'a játék teszi a chainre, priority nem kell hozzá':!empty?(amb?'[Ambush]: olyan battlefieldre játssza ki, ahol unitja van, ezért [Reaction]-ként jön':tm==='reaction'?'[Reaction], ezért válaszként jöhet':'facedown-ból [Reaction]-ként jön'):(tm==='none'&&c.t==='Spell'?'üres chain mellett, a saját körödben':'üres chain mellett');
    X.rows+=X.line(s.k==='tg'?'383.3, 401':!empty?(amb?'822.1.b':tm==='reaction'?(s.k==='ab'?'813.1.c.2':'813.1.c.1'):'811.6'):(s.k==='ab'?'381':c.t==='Spell'?'155':'337.2'),esc(Verb)+' '+what+' ('+timingTxt+').'+(s.from&&s.from!=='hand'&&s.k==='card'?' Honnan: '+({facedown:'facedown',trash:'trash',champ:'Champion Zone',other:'nem kézből'} as Record<string,string>)[s.from]+'.':''),0);
    pick.forEach((a)=>{X.rows+=X.line(a[0],a[1],a[2]);});
    if(s.modes&&s.modes.length)X.rows+=X.line('355.3','Választott mód ("Choose one"): '+esc(s.modes[Math.max(0,Math.min(s.mode||0,s.modes.length-1))].replace(/\.$/,''))+'. A mód a kijátszáskor dől el, a builderben állítható.',0);
    if(s.rep&&s.repModes)X.rows+=X.line('820.1.d.1, 820.2'+(s.modes&&s.modes.length?', 820.2.a':''),'[Repeat] költség kifizetve '+(s.rep>1?s.rep+' alkalommal ('+s.repN+' külön költségből)':'')+': a hatás a resolve-kor '+(s.rep>1?s.rep+' további alkalommal':'még egyszer')+' végrehajtódik'+(s.modes&&s.modes.length?', a további végrehajtások módja: '+s.repModes.slice(1).map((m:number)=>esc(s.modes![Math.max(0,Math.min(m,s.modes!.length-1))].replace(/\.$/,''))).join('; ')+' (más mód és más célpont is választható)':'')+'. A célpontok sorrendje a végrehajtás sorrendje.',0);
    if(s.k==='ab'&&s.src&&X.O[s.src!]&&/\[T\]|\[E\]/.test(s.ab!.cost||'')){X.O[s.src!].ex=true;X.rows+=X.line('415','Költség: '+esc(X.O[s.src!].name)+' exhausted lesz.',0);}
    if(s.k==='ab'&&s.src&&X.O[s.src!]&&/disempower me/i.test(s.ab!.cost||'')){X.O[s.src!].emp=false;X.rows+=X.line('443','Költség: '+esc(X.O[s.src!].name)+' disempowered lesz.',0);}
    if(P.costV){const parts:string[]=[];const refs:string[]=[];const r=X.killObj(P.costV,'additional cost',parts,refs);X.EV.push({k:'cost',id:P.costV});X.rows+=X.line('356.2.a, 357.2'+(r==='neg'?', 357.2.a':''),'Költség: '+parts.join(' ')+(r==='neg'?' A halált replacement helyettesítette, a költség ettől még ki van fizetve (357.2.a).':''),0);X.story.push('Költségként '+(r==='neg'?'meg kellene halnia '+art(X.O[P.costV].name)+' lapnak, de a halált replacement helyettesíti; a költség így is ki van fizetve.':'meghal '+art(X.O[P.costV].name)+'.'));}
    if(s.k==='tg'&&s.killSelf){if(s.src&&X.onB(s.src)){const parts:string[]=[];const refs:string[]=[];const r=X.killObj(s.src,'a trigger költsége',parts,refs);X.rows+=X.line('204.1.c, 383.3.b'+(r==='neg'?', 357.2.a':''),'A trigger költsége ("kill me") a finalizáláskor: '+parts.join(' '),0);X.story.push(Art(c.n)+' a trigger költségeként meghal, mielőtt a hatás a chainre kerül.');}
      else{X.rows+=X.line('204.1.c','A "kill me" költség nem fizethető ki (a forrás nincs a boardon), ezért a trigger nem kerül a chainre.',0);s.illegal='költség';return;}}
    if(perm){X.O['s'+s.j].zone='board';const er=X.enterReady(c,s.pl,!!s.accel,X.O['s'+s.j].loc,s.erd,'s'+s.j,!!s.addc);if(c.t==='Unit')X.O['s'+s.j].ex=!er.ready;X.EV.push({k:'enter',id:'s'+s.j,name:c.n,loc:X.O['s'+s.j].loc});X.rows+=X.line('337.2'+(c.t==='Unit'?(er.ready?', 143.4.a':', 143.4'):''),'A '+c.t.toLowerCase()+' azonnal resolve-ol és ide kerül: '+esc(X.locLabel(X.O['s'+s.j].loc))+'.'+(c.t==='Unit'?(er.ready?' Ready lép be ('+er.why+').':' Exhausted lép be (143.4).')+(er.note?' '+er.note:''):'')+(s.trig?' A "When you play" hatása triggerként a chainre kerül (355.5.b).':''),er.note&&/bizonytalan|nem követett/.test(er.note)?1:0);}
    else if(X.O['s'+s.j])X.O['s'+s.j].zone='chain';
    s.tg.forEach((v:string,ti:number)=>{if(v)X.rows+=X.line('355.7','<span class="stok">'+(ti+1)+'. célpont:</span> '+esc(X.nm(v))+(X.O[v]&&X.O[v].loc?' ('+esc(X.locLabel(X.O[v].loc))+(X.mightOf(v)!=null?', '+X.mightOf(v)+' Might':'')+')':'')+'.',0);});
    /* Deflect a lap szövegéből; a [Level N] sorban csak a controller N+ XP-je mellett aktív (824.1.c) */
    const dfl=(v:string)=>{let n=0;let off='';(X.O[v].card!.txt||'').split('\n').forEach((l:string)=>{const m=/\[Deflect(?: (\d+))?\]/.exec(l);if(!m)return;const lv=/^\[Level (\d+)\]/i.exec(l);if(lv&&X.xpOf(X.O[v].ctrl!)<+lv[1]){off='[Level '+lv[1]+'] (XP: '+X.xpOf(X.O[v].ctrl!)+')';return;}n+=m[1]?+m[1]:1;});return {n,off};};
    const tgD=s.tg.filter((v:string)=>v&&X.O[v]&&X.O[v].card&&X.O[v].type!=='ability'&&X.O[v].type!=='spell'&&X.O[v].ctrl!==it!.pl&&/\[Deflect/.test(X.O[v].card.txt||''));
    tgD.filter((v:string)=>!dfl(v).n&&dfl(v).off).forEach((v:string)=>{X.rows+=X.line('824.1.c, 809.1.c',esc(X.O[v].name)+' Deflectje a '+esc(dfl(v).off)+' feltételhez kötött, és ez nem teljesül, ezért a kiválasztásáért nem kell plusz Powert fizetni.',0);});
    const defl=tgD.filter((v:string)=>dfl(v).n>0).map((v:string)=>X.O[v].name+' ('+dfl(v).n+')');
    if(defl.length){s.defl=defl;X.rows+=X.line('809.1.c, 356.2.a','Deflect: '+esc(defl.join(', '))+' kiválasztásáért ennyi plusz Powert kell fizetni additional costként.',0);}
    let trigOK=!perm||!s.trig||s.cond!=='paid'||s.addc;
    if(perm&&s.trig&&s.cond==='facedown'&&s.from!=='facedown'){trigOK=false;X.rows+=X.line('383.2.a','A play trigger feltétele ("When you play me from face down") nem teljesül: nem facedown-ból játszották ki, ezért nem triggerel.',0);}
    else if(perm&&s.trig&&s.cond==='facedown')X.rows+=X.line('383.2.a, 811.1.d.3','Facedown-ból kijátszva: a "When you play me from face down" trigger a chainre kerül.',0);
    if(perm&&s.trig&&trigOK&&s.tcond){const cv=X.evalCond(s.tcond,it,s,-1,null);if(cv===false){trigOK=false;X.rows+=X.line('383.2.a.1','A play trigger feltétele ("if '+esc(s.tcond.t)+'") a kijátszáskor nem teljesül '+esc(X.condSrc(s.tcond))+', ezért nem triggerel.',0);X.story.push('A "When you play" trigger nem triggerel, mert a feltétele ("if '+s.tcond.t+'") nem teljesül.');}
      else X.rows+=X.line('383.2.a.1','A play trigger feltétele ("if '+esc(s.tcond.t)+'") a kijátszáskor teljesül '+esc(X.condSrc(s.tcond))+', ezért a chainre kerül; a resolve-kor már nem ellenőrzi újra.',0);}
    if(perm&&s.trig&&!trigOK){if(s.cond==='paid')X.rows+=X.line('383.2.a.1','A play effect feltétele ("if you paid the additional cost") nem teljesül, ezért nem triggerel.',0);}
    else if(P.trigBad){trigOK=false;X.rows+=X.line('403.4, 403.4.a','A play effectnek nincs legális választása ('+P.trigBad+'). A '+c.t.toLowerCase()+' ettől még a boardra kerül, a trigger lekerül a chainről (403.4; ez nem counter).',0);X.story.push('A play effectnek nincs legális célpontja, ezért a trigger lekerül a chainről.');s.trigBad=P.trigBad;}
    if(perm&&s.trig&&!trigOK){/* nem triggerel, a sor fent már kiírva */}
    else if(s.may&&(s.k==='tg'||perm&&trigOK))X.rows+=X.line('383.3.a, 383.3.a.2','"You may" a triggered ability elején: '+WHO[it.pl]+' a chainre tételkor (finalizálás) dönt'+(it.pl==='A'?'öd':'i')+' el, végrehajtja-e; ha nem, lekerül. Az elemzés igennel számol.',0);
    else if(s.may)X.rows+=X.line('355.18, 355.12','"You may": a döntés a resolve-kor születik (355.18); a célpontokat a kijátszáskor kell kiválasztani, a game action végrehajtásáról szóló döntéstől függetlenül (355.12). Az elemzés igennel számol.',0);
    X.story.push(Verb+' '+what.replace(/<[^>]+>/g,'')+(perm?', ami azonnal ide kerül: '+X.locLabel(X.O['s'+s.j].loc)+(s.trig&&trigOK?', a "When you play" hatása pedig a chainre':''):', ez a chain tetejére kerül')+'.');
    if(it.isTg&&s.tr&&s.tr.dk){it.dk=true;it.sent=!!(X.O[s.src!]&&X.O[s.src!].zone==='trash');}
    if(s.k==='ab'||s.k==='tg'||c.t==='Spell')X.chain.push(it);
    { const su=s.src&&X.O[s.src]?X.O[s.src].type:'';const en=(it.tg||[]).filter((v:string)=>v&&X.O[v]&&X.O[v].zone==='board'&&(X.O[v].type==='unit'||X.O[v].type==='gear')&&X.O[v].ctrl!==it.pl);
      if(en.length&&(s.k==='card'&&c.t==='Spell'||(s.k==='ab'||s.k==='tg')&&su==='unit')){const ch=X.CHOSE[it.pl]||(X.CHOSE[it.pl]={items:0,objs:0});ch.items++;ch.objs+=en.length;} }
    if((s.k==='ab'||c.t==='Spell')&&it.tg&&it.tg.length)X.chooseTrigs(it,s.k==='card').forEach((t)=>{X.pushTrig(t);X.rows+=X.line('383.4.b, 383.4.b.2','Trigger: '+esc(t.label)+' '+t.why+'. A célpont kiválasztásakor triggerel, és a kiváltó elem fölé kerül.',0);X.story.push(Art(X.O[t.src!].name)+' triggerel a célpont kiválasztására.');});
    else if(s.trig&&trigOK)X.pushTrig(it);
    // unit és gear kijátszása azonnal resolve-ol (337.2), ezért a "When you play" triggerek most triggerelnek; spellnél csak a resolve-kor (420.4.a)
    if(s.k==='ab'&&s.ab)X.abTrigs(s).forEach((t)=>{X.pushTrig(t);X.rows+=X.line('206.1, 383.2','Trigger: '+esc(X.O[t.src!].name)+' '+t.why,1);X.story.push(Art(X.O[t.src!].name)+' triggerel az ability aktiválására.');});
    if(perm&&c.t==='Unit'){const w=X.wmTrig('s'+s.j,s.pl!,(s.wm as string|undefined)||(s.tg||[]).find((v:string)=>X.O[v]&&X.O[v].type==='gear')||null);if(w){if(w.it)X.pushTrig(w.it);X.rows+=X.line('821.1.c, 821.1.c.3',w.txt,w.it&&w.it.wm?2:0);}}
    if(perm){X.playTrigs(s).forEach((t)=>{X.pushTrig(t);X.rows+=X.line('420.4.a, 337.2','Trigger: '+esc(X.O[t.src!].name)+' '+t.why+' A '+c.t.toLowerCase()+' kijátszása a resolve-jával befejeződött, ezért most triggerel.',1);X.story.push(Art(X.O[t.src!].name)+' képessége triggerel erre a kijátszásra, és a chainre kerül.');});}
    else if(s.k==='card'&&X.playTrigs(s).length)X.rows+=X.line('420.4.a, 420.4.a.1','A "When you play a spell" típusú triggerek ('+X.playTrigs(s).map((t)=>esc(t.label)).join(', ')+') csak akkor triggerelnek, amikor '+esc(c.n)+' resolve-ol; ha counterelik, nem triggerelnek.',0);
    // a költségből vagy kijátszásból keletkezett triggerek (Deathknell, leave, play) a kijátszott elem fölé kerülnek
    if(X.PEND.length){const n=X.PEND.length;const lab=X.PEND.map((t)=>esc(t.label)).join(', ');X.flushPend(X.chain);X.rows+=X.line('337.1.b, 359.3.b, 340.1','A kijátszás közben keletkezett trigger'+(n>1?'ek':'')+' ('+lab+') a chain tetejére kerül'+(n>1?'nek':'')+', ezért előbb resolve-ol'+(n>1?'nak':'')+'.',1);}};
  X.cleanup=()=>{const dead=Object.keys(X.O).filter(id=>X.lethal(id));const parts:string[]=[];const refs:string[]=[];const names:string[]=[];
    X.copyEnd().forEach((t)=>{X.REC!.push(['479.1.b',t]);X.ALL.push(X.REC![X.REC!.length-1]);});
    dead.forEach(id=>{const r=X.killObj(id,'lethal damage, cleanup',parts,refs);names.push(X.O[id].name+(r==='neg'?' (helyettesítve)':''));});
    if(dead.length){X.REC!.push(['323.4, 142.4.b, 429.1.a.2','Cleanup: '+plainOf(parts.join(' '))]);X.ALL.push(X.REC![X.REC!.length-1]);}
    const rc=Object.keys(X.O).filter(id=>{const g=X.O[id];return g.zone==='board'&&!g.on&&((g.type==='gear'&&g.loc!=='base')||(g.loc==='base'&&g.baseOf&&g.ctrl&&g.baseOf!==g.ctrl));});
    rc.forEach(id=>{const g=X.O[id];const why=g.loc!=='base'?'csatolatlan gear battlefielden':'nem a saját irányítója base-ében áll';g.loc='base';g.baseOf=g.ctrl;X.EV.push({k:'recall',id,name:g.name,cleanup:true});
      X.REC!.push(['323.6'+(why[0]==='c'?', 436.4.a':''),g.name+': '+why+', ezért a cleanupban recall-olódik a base-be.']);X.ALL.push(X.REC![X.REC!.length-1]);names.push(g.name+' recall');X.story.push(Art(g.name)+' a cleanupban a base-be kerül ('+why+').');});
    X.flushPend(X.stack);if(names.length)X.snap('Cleanup: '+names.join(', '),X.stack);};
}
