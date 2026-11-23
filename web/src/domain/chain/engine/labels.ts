/* A chain elemzés címkéi és szöveg segédei (a runChain() és a riport közös része). */
import { FL, FLT } from '../../rules/flags';
import { refHash } from '../../rules/refs';

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
/** A resolve sor olvasható alakja: számozott lépések rövid mondatokkal, a szabályszámok a lépés végén kis linkként; a rejtett adat
    magyarázata és az "Utasítások" összesítő a lenyitható "Részletek" alatt; ismétlődő mondat nélkül. A szöveges sor (rows) nem változik. */
export const fmtResolve=(txt:string,extra?:string)=>{const i=txt.indexOf(' resolve-ol. ');if(i<0)return txt+(extra||'');
  const head=txt.slice(0,i+12);const ss=sentences(txt.slice(i+13));if(ss.length<2&&!extra)return txt;
  const seen=new Set<string>();const steps:string[]=[];const det:string[]=[];const hasRev=ss.some((x)=>/^(?:Felfedett|Megnézett) lapok/.test(plainS(x)));
  ss.forEach((x)=>{const p=plainS(x);if(seen.has(p))return;seen.add(p);
    if(DETAIL.test(p)){det.push(x);return;}
    if(hasRev&&/^"[^"]+": [^"]+ \(a deck \d+\. lapja\)\.$/.test(p))return;
    const refs:string[]=[];const y=x.replace(/\s?\(((?:\d{3}(?:\.[0-9a-z]+)*)(?:,\s*\d{3}(?:\.[0-9a-z]+)*)*)\)/g,(_m,g:string)=>{g.split(/,\s*/).forEach((r)=>{if(!refs.includes(r))refs.push(r);});return '';});
    steps.push('<li>'+y+(refs.length?' <span class="cbr">'+refs.map(refA).join(' ')+'</span>':'')+'</li>');});
  return head+(steps.length?'<ol class="cbsteps">'+steps.join('')+'</ol>':'')+(extra||'')+(det.length?'<details class="cbdet"><summary>Részletek</summary>'+det.join(' ')+'</details>':'');};
/** Egy szabálysor HTML-je (szabályszám linkek a szabály hash-ével, szöveg, flag), a chain riport táblázataihoz. */
export const lineH=(ref:string,txt:string,fl?:number|null,extra?:string)=>'<tr><td class="r">'+String(ref).split(',').filter(r=>r.trim()).map(r=>refA(r.trim())).join('')+'</td><td>'+fmtResolve(txt,extra)+'</td><td class="f">'+(fl!=null?'<span class="fl f'+fl+'" title="'+FLT[fl]+'">'+FL[fl]+'</span>':'')+'</td></tr>';
/** Nyitott kérdés (flag 2): a két értelmezés eredménye egymás mellett. */
export const ALT2=(a:string,b:string)=>' <span class="cbalt"><b>1. értelmezés:</b> '+a+' <b>2. értelmezés:</b> '+b+'</span>';
