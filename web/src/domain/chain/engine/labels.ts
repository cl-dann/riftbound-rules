/* A chain elemzés címkéi és szöveg segédei (a runChain() és a riport közös része). */
import { FL, FLT } from '../../rules/flags';
import { refHash } from '../../rules/refs';
import { vsCard } from '../../data/store';

export const INS_ST:Record<string,string>={executed:'végrehajtódik',partial:'részben hajtódik végre',ignored:'Ignored',negated:'Negated',skipped:'nem hajtódik végre'};
export const RES:Record<string,string>={ok:'lefutott',partial:'részben futott le',fizzle:'hatás nélkül',countered:'counterelve',removed:'lekerült a chainről'};
export const art=(x:string)=>(/^[aáeéiíoóöőuúüű]/i.test(x)?'az ':'a ')+x;export const Art=(x:string)=>{const s=art(x);return s[0].toUpperCase()+s.slice(1);};
export const other=(p:string)=>p==='A'?'B':'A';export const WHO:Record<string,string>={A:'te',B:'az ellenfél'};export const WHOC:Record<string,string>={A:'Te',B:'Az ellenfél'};
export const LOCK=(l:string)=>l==='base'?'base':l;
/** Egy szabálysor HTML-je (szabályszám linkek, szöveg, flag), a chain riport táblázataihoz. */
const refA=(r:string)=>'<a href="'+refHash(r)+'" data-ref="'+r+'">'+r+'</a>';
/** Mondatokra bontás: pont, szóköz, nagybetű vagy idézőjel előtt, idézőjelen és zárójelen kívül. */
const sentences=(t:string)=>{const out:string[]=[];let q=0,d=0,g=0,st=0;for(let i=0;i<t.length;i++){const c=t[i];
    if(c==='<'){if(t[i+1]==='/')g=Math.max(0,g-1);else if(/^<(?:span|b|a|button|p|details|summary|i|em|small)\b/.test(t.slice(i,i+9)))g++;const e=t.indexOf('>',i);if(e>0)i=e;continue;}
    if(c==='"')q^=1;else if(c==='('&&!q)d++;else if(c===')'&&!q&&d)d--;
    else if(c==='.'&&!q&&!d&&!g&&t[i+1]===' '&&/[A-ZÁÉÍÓÖŐÚÜŰ"<]/.test(t[i+2]||'')){out.push(t.slice(st,i+1).trim());st=i+2;}}const r=t.slice(st).trim();if(r)out.push(r);return out;};
const DETAIL=/titkos információ|rejtett adat|pályás építőben megadott feltételezés|^Utasítások:|A választás a resolve-kor történik|csak a tulajdonosuk látja|^A megnézett lapokat/;
const plainS=(x:string)=>x.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
/** Költségsor jelölője a resolve szövegében: üres elem, így a szöveges sorból (rows, plainOf) kimarad, a riportban külön lépés lesz. */
export const costMark=(t:string)=>'<s class="cbcm" data-c="'+t.replace(/"/g,'&quot;')+'"></s>';
const COSTM=/<s class="cbcm" data-c="([^"]*)"><\/s>/g;
const unEsc=(x:string)=>x.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&');
/** "errata szöveg szerint" jelzés, ha a resolve-oló lap (a fejléc első lapja) errata szöveggel fut. */
const errNote=(head:string)=>{const m=/<b>([^<]+)<\/b>/.exec(head);const c=m?vsCard(unEsc(m[1])):null;return c&&c.old&&c.n===unEsc(m![1])?' <span class="cberr">(errata szöveg szerint)</span>':'';};
/** A döntések sora ("Banish: X (a te választásod)") a megfelelő lépés helyére kerül, ha a lépés csak ezt mondja; a többi a sor alatt marad. */
const FOLD:[RegExp,RegExp][]=[[/^Banish$/,/^(.+) banishelve \([^)]*\)\.$/],[/^Választás$/,/^(.+) kiválasztva a megnézett lapok közül\.$/]];
const REDUNDANT=/^A kijátszott lap az előző utasítással választott vagy banishelt /;
/** A resolve sor olvasható alakja: számozott lépések rövid mondatokkal, a szabályszámok a lépés végén kis linkként; a rejtett adat
    magyarázata és az "Utasítások" összesítő a lenyitható "Részletek" alatt; ismétlődő mondat nélkül. A szöveges sor (rows) nem változik. */
export const fmtResolve=(txt:string,extra?:string)=>{const i=txt.indexOf(' resolve-ol. ');if(i<0)return txt.replace(COSTM,'')+(extra||'');
  const head=txt.slice(0,i)+' resolve-ol'+errNote(txt.slice(0,i))+'.';const ss=sentences(txt.slice(i+13));if(ss.length<2&&!extra)return head+' '+txt.slice(i+13).replace(COSTM,'');
  const chl=extra&&/^<p class="cbch">[^]*<\/p>$/.test(extra)?extra.slice(16,-4).split('<br>'):null;const used=new Set<number>();
  const seen=new Set<string>();const steps:string[]=[];const det:string[]=[];const hasRev=ss.some((x)=>/^(?:Felfedett|Megnézett) lapok/.test(plainS(x)));
  ss.forEach((x0)=>{const costs:string[]=[];const x=x0.replace(COSTM,(_m,c:string)=>{costs.push(c);return '';});const p=plainS(x);if(seen.has(p))return;seen.add(p);
    if(DETAIL.test(p)){det.push(x);return;}
    if(hasRev&&/^"[^"]+": [^"]+ \(a deck \d+\. lapja\)\.$/.test(p))return;
    if(REDUNDANT.test(p))return;
    const refs:string[]=[];let y=x.replace(/\s?\(((?:\d{3}(?:\.[0-9a-z]+)*)(?:,\s*\d{3}(?:\.[0-9a-z]+)*)*)\)/g,(_m,g:string)=>{g.split(/,\s*/).forEach((r)=>{if(!refs.includes(r))refs.push(r);});return '';});
    if(chl)chl.forEach((c,k)=>{if(used.has(k))return;const m=/^([^:]+): (.+) \((automatikus választás|a te választásod)\)$/.exec(plainS(c));if(!m)return;
      const f=FOLD.find(([l])=>l.test(m[1]));const fm=f?f[1].exec(p):null;if(fm&&fm[1]===m[2]){used.add(k);y=c+'.';}});
    const li=y+(refs.length?' <span class="cbr">'+refs.map(refA).join(' ')+'</span>':'');
    if(/^A (?:unit|gear) azonnal resolve-ol/.test(p)&&steps.length)steps[steps.length-1]=steps[steps.length-1].replace(/<\/li>$/,' '+li+'</li>');else steps.push('<li>'+li+'</li>');
    costs.forEach((c)=>{if(!steps.length){steps.push('<li><div class="cbcost">'+c+'</div></li>');return;}steps[steps.length-1]=steps[steps.length-1].replace(/<\/li>$/,'<div class="cbcost">'+c+'</div></li>');});});
  const rest=chl?chl.filter((_c,k)=>!used.has(k)):null;const ex=chl?(rest!.length?'<p class="cbch">'+rest!.join('<br>')+'</p>':''):(extra||'');
  return head+(steps.length?'<ol class="cbsteps">'+steps.join('')+'</ol>':'')+ex+(det.length?'<details class="cbdet"><summary>Részletek</summary>'+det.join(' ')+'</details>':'');};
/** Egy szabálysor HTML-je (szabályszám linkek a szabály hash-ével, szöveg, flag), a chain riport táblázataihoz. */
export const lineH=(ref:string,txt:string,fl?:number|null,extra?:string)=>'<tr><td class="r">'+String(ref).split(',').filter(r=>r.trim()).map(r=>refA(r.trim())).join('')+'</td><td>'+fmtResolve(txt,extra)+'</td><td class="f">'+(fl!=null?'<span class="fl f'+fl+'" title="'+FLT[fl]+'">'+FL[fl]+'</span>':'')+'</td></tr>';
/** Nyitott kérdés (flag 2): a két értelmezés eredménye egymás mellett. */
export const ALT2=(a:string,b:string)=>' <span class="cbalt"><b>1. értelmezés:</b> '+a+' <b>2. értelmezés:</b> '+b+'</span>';
