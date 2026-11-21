/* Fogalom-kiemelés (glossify) a HTML szövegben. (a korábbi legacy/core.ts része, S15) */
import { TERMS, TERM_RES, TRE } from '../../domain/data/store';
export function termOf(w:string){for(let i=0;i<TERMS.length;i++){if(TERM_RES[i].test(w))return TERMS[i];}return null;}
export const NOHL=new Set(['unit','spell','gear','legend']);
export function glossify(html:string,seen?:Set<string>){
  if(!TRE)return html;seen=seen||new Set();
  return html.replace(/(<[^>]+>)|([^<]+)/g,(_m:string,tag:string,txt:string)=>tag?tag:txt.replace(TRE!,(w:string)=>{const x=termOf(w);if(!x||NOHL.has(x.t)||seen!.has(x.t))return w;seen!.add(x.t);return '<span class="gl" tabindex="0" data-t="'+TERMS.indexOf(x)+'">'+w+'</span>';}));
}
