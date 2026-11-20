// @ts-nocheck
/* Szabályszöveg és témablokk HTML. (a korábbi legacy/core.ts része, S15) */
import { RULES } from '../../domain/data/store';
import { isHead } from '../../domain/rules/head';
import { refHash, refLabel } from '../../domain/rules/refs';
import { esc } from '../../domain/text/norm';
export function ruleHTML(idxs:any,hl:any=null){
  if(!idxs.length)return '<p class="note">Nincs ilyen szabály.</p>';
  const base=Math.min(...idxs.map(i=>RULES[i][0].split('.').length));
  return idxs.map(i=>{
    const r=RULES[i],dp=Math.min(6,r[0].split('.').length-base);
    let tx=esc(r[1]);
    if(hl)tx=tx.replace(hl,m=>'<mark>'+m+'</mark>');
    const ex=(r[2]||[]).map(e=>'<div class="ex">'+(hl?esc(e).replace(hl,m=>'<mark>'+m+'</mark>'):esc(e))+'</div>').join('');
    return '<div class="rule dp'+dp+(isHead(r)?' h':'')+'" data-rid="'+r[0]+'"><a class="id" href="'+refHash(r[0])+'" title="Link erre a szabályra">'+r[0]+'.</a><div class="tx">'+tx+ex+'</div></div>';
  }).join('');
}
export const relLinks=rel=>rel&&rel.length?'<div class="rel">Kapcsolódó: '+rel.map(r=>'<a href="#szabalyok" data-ref="'+r+'">'+r+'</a>').join('')+'</div>':'';
export function whyOf(tp,m){
  if(tp.g==='kw')return 'kulcsszó a kártyán: <code>'+esc(m)+'</code>';
  if(tp.g==='type')return esc(tp.why);
  return 'a szövegben: <code>'+esc(m)+'</code>';
}
export const GROUPS=[['kw','Kulcsszavak'],['act','Game Actions a szövegben'],['oth','A szövegből következő további szabályok'],['type','Kártyatípus szabályai']];

export function topicBlock(tp,why,open){
  return '<details class="tp"'+(open?' open':'')+'><summary><span class="rn">'+refLabel(tp.refs)+'</span><span class="tt">'+esc(tp.title)+'</span><span class="why">'+why+'</span></summary><div class="rules" data-refs="'+tp.refs.join('|')+'"></div>'+relLinks(tp.rel)+'</details>';
}
