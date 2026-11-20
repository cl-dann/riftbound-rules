/* Kártya segédek: típussor, hasonló lapok. (a korábbi legacy/core.ts része, S15) */
import { CARDS, TOPICS } from './store';
import type { Card } from './schema';
export const typeLine=(c: Pick<Card, 't' | 'st'>)=>[...(c.st||[]).filter(s=>s!=='Basic'&&s!=='Token'),c.t,(c.st||[]).includes('Token')?'Token':''].filter(Boolean).join(' ');
export const GENERIC_TAGS=new Set(['Equipment']);
/** A leghasonlóbb n lap: közös kulcsszó, Game Action, tag, típus, domain és Energy alapján. */
export function similar(c: Card,n: number): [number, Card, string[]][]{
  const kw=new Set(c._kw),act=new Set(c.tp.filter(p=>TOPICS[p[0]].g==='act').map(p=>p[0])),tg=new Set((c.tg||[]).filter(x=>!GENERIC_TAGS.has(x)));
  const out: [number, Card, string[]][]=[];
  CARDS.forEach(o=>{if(o===c||o.n===c.n||o.ban===1)return;
    let s=0;const why: string[]=[];
    const sk=o._kw.filter(k=>kw.has(k));if(sk.length){s+=3*sk.length;why.push(...sk);}
    const sa=o.tp.filter(p=>TOPICS[p[0]].g==='act'&&act.has(p[0]));s+=sa.length;
    if(o.t===c.t)s+=2;
    const st=(o.tg||[]).filter(x=>tg.has(x));if(st.length){s+=2*st.length;why.push(...st);}
    if((o.d||[]).some(d=>(c.d||[]).includes(d)))s+=1;
    if(c.e!=null&&o.e!=null)s-=Math.min(3,Math.abs(c.e-o.e))*0.5;
    if(s>=5)out.push([s,o,why.slice(0,3)]);});
  out.sort((a,b)=>b[0]-a[0]);return out.slice(0,n);
}
