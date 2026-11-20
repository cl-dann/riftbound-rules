// @ts-nocheck
/* A chain elemzés címkéi és szöveg segédei (a runChain() és a riport közös része). */
import { FL, FLT } from '../../rules/flags';

export const INS_ST:any={executed:'végrehajtódik',partial:'részben hajtódik végre',ignored:'Ignored',negated:'Negated',skipped:'nem hajtódik végre'};
export const RES:any={ok:'lefutott',partial:'részben futott le',fizzle:'hatás nélkül',countered:'counterelve',removed:'lekerült a chainről'};
export const art=(x:string)=>(/^[aáeéiíoóöőuúüű]/i.test(x)?'az ':'a ')+x;export const Art=(x:string)=>{const s=art(x);return s[0].toUpperCase()+s.slice(1);};
export const other=(p:string)=>p==='A'?'B':'A';export const WHO:any={A:'te',B:'az ellenfél'};export const WHOC:any={A:'Te',B:'Az ellenfél'};
export const LOCK=(l:string)=>l==='base'?'base':l;
/** Egy szabálysor HTML-je (szabályszám linkek, szöveg, flag), a chain riport táblázataihoz. */
export const lineH=(ref:string,txt:string,fl?:number)=>'<tr><td class="r">'+String(ref).split(',').filter(r=>r.trim()).map(r=>'<a href="#szabalyok" data-ref="'+r.trim()+'">'+r.trim()+'</a>').join('')+'</td><td>'+txt+'</td><td class="f">'+(fl!=null?'<span class="fl f'+fl+'" title="'+FLT[fl]+'">'+FL[fl]+'</span>':'')+'</td></tr>';
