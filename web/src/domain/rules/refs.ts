/* Szabályszám hivatkozások: kibontás, címke, hash. (a korábbi legacy/core.ts része, S15) */
import { RULES, heads, top3 } from '../data/store';
/** Egy hivatkozás ("103.2" vagy tartomány "140-146") a rules.json indexeire bontva. */
export function expand(ref: string){
  const out: number[]=[];
  const m=/^(\d{3})-(\d{3})$/.exec(ref);
  if(m){const a=+m[1],b=+m[2];for(let i=0;i<RULES.length;i++)if(top3[i]>=a&&top3[i]<=b)out.push(i);return out;}
  for(let i=0;i<RULES.length;i++){const id=RULES[i][0];if(id===ref||id.startsWith(ref+'.'))out.push(i);}
  return out;
}
export const expandAll=(refs: string[])=>{const s=new Set<number>();refs.forEach(r=>expand(r).forEach(i=>s.add(i)));return [...s].sort((a,b)=>a-b);};
export const refLabel=(refs: string[])=>refs.join(', ');
export const refHash=(ref: string)=>'#r-'+String(ref).trim().replace(/-/g,'--').replace(/\./g,'-');
export const hashRef=(h: string)=>h.slice(3).split('--').map(x=>x.replace(/-/g,'.')).join('-');
export function headExtent(i: number){const k=heads.indexOf(i);const end=k+1<heads.length?heads[k+1]:RULES.length;const a: number[]=[];for(let j=i;j<end;j++)a.push(j);return a;}
