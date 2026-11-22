/* A Chain helyzet (CS) segédei: helyek, célpont-opciók, játékállapot mezők, zónás lapok azonosítója és a lépések
   átrendezése (a builder űrlapja, a pályás építő és a tesztek közös része; korábban a chain.ts, majd a legacyForm.ts). */
import { vsCard } from '../data/store';
import { isPermC } from './actions';
import { srcCard, stepInfo } from './steps';
import type { ChainState } from './state';
import type { TargetParam } from './types';

export const locsOf=(CS:ChainState)=>[['base','Base'],['bf0',(CS.bf[0].n||'1. battlefield')],['bf1',(CS.bf[1].n||'2. battlefield')]];
export const locLabelOf=(CS:ChainState,l:string)=>(locsOf(CS).find(x=>x[0]===l)||['',l])[1];
/** Azonos nevű lapok példányszáma a pályán (#1, #2): előbb a board lapjai, majd a kijátszott unitok és gearek lépésrendben.
    Csak az a név kap számot, amelyből több példány van; a többi lap neve változatlan. */
export function instNos(CS:ChainState):Record<string,number>{const seq:[string,string][]=[];
  CS.bd.forEach((b,i)=>{const c=vsCard(b.n);if(c)seq.push(['b'+i,c.n]);});
  CS.steps.forEach((s,j)=>{if(s&&s.k==='card'){const c=vsCard(s.n);if(c&&isPermC(c))seq.push(['s'+j,c.n]);}});
  const cnt:Record<string,number>={};seq.forEach(([,n])=>{cnt[n]=(cnt[n]||0)+1;});
  const k:Record<string,number>={};const out:Record<string,number>={};seq.forEach(([id,n])=>{if(cnt[n]>1){k[n]=(k[n]||0)+1;out[id]=k[n];}});return out;}
/** Lapnév a példányszámmal ("Teemo #2"), ha van. */
export const instName=(n:string,no?:number)=>no?n+' #'+no:n;
export function bdLabelOf(CS:ChainState,i:number){const b=CS.bd[i];const c=vsCard(b.n);return (b.pl==='A'?'Te: ':'Ellenfél: ')+(c?instName(c.n,instNos(CS)['b'+i]):b.n||'?')+' ('+locLabelOf(CS,b.loc)+')';}
/** A j. lépés p célpont-paraméteréhez választható értékek (típus szerint; a legalitást az elemzés dönti el). */
export function tgOptionsOf(CS:ChainState,j:number,p:TargetParam){
  const o:[string,string][]=[['','nincs kiválasztva']];
  if(p.type==='battlefield'){o.push(['F0',locLabelOf(CS,'bf0')],['F1',locLabelOf(CS,'bf1')]);return o;}
  if(p.type!=='spell'){const okT=(t:string)=>p.type==='perm'?(t==='unit'||t==='gear'):t===p.type;CS.bd.forEach((b,i)=>{const c=vsCard(b.n);if(c&&okT(c.t.toLowerCase()))o.push(['b'+i,'Board: '+bdLabelOf(CS,i)]);});
    const nos=instNos(CS);for(let k=0;k<=j&&k<CS.steps.length;k++){const s=CS.steps[k];const c=vsCard(s.n);if(s.k==='card'&&isPermC(c)&&okT(c!.t.toLowerCase())){const nm=instName(c!.n,nos['s'+k]);o.push(['s'+k,k===j?'önmaga: '+nm+' (355.9.c)':(k+1)+'. lépés: '+nm+(nos['s'+k]?' ('+(s.pl==='B'?'ellenfél':'te')+', '+locLabelOf(CS,s.loc||(s.from==='facedown'?'bf0':'base'))+')':'')]);}}
    if(p.type!=='perm')o.push(['x','más '+p.type+' (nincs a board listában)']);}
  else for(let k=0;k<j;k++){const s=CS.steps[k];const c=vsCard(s.n);if(s.k==='card'&&c&&c.t==='Spell')o.push(['s'+k,(k+1)+'. lépés: '+c.n]);else if(p.orAb&&(s.k==='ab'||s.k==='tg')){const sc=srcCard(CS,s.src);if(sc)o.push(['s'+k,(k+1)+'. lépés: '+sc.n+(s.k==='ab'?' abilityje':' triggere')]);}}
  return o;
}
/** Játékállapot mezők, amelyekre a mostani lapok feltételei hivatkoznak. */
export function stateKeysOf(CS:ChainState){const k=new Set<string>();const addTxt=(t:string)=>{if(/\[Level \d+\]|\bXP\b/.test(t))k.add('xp');if(/Victory Score|\bscore\b|\byour points\b/i.test(t))k.add('score');if(/\bLegion\b|you've played/i.test(t)){k.add('played');k.add('playedT');}if(/\bcontrol \d+ or (?:fewer|more) runes|exactly \d+ runes/i.test(t))k.add('runes');if(/Rune Deck|couldn't channel|you can't/i.test(t))k.add('runeDeck');if(/you spent/i.test(t))k.add('spent');if(/died this turn/i.test(t))k.add('diedT');};
  CS.steps.forEach(s=>{const inf=stepInfo(CS,s);if(inf&&inf.c)addTxt(inf.c.txt||'');});CS.bd.forEach(b=>{const c=vsCard(b.n);if(c)addTxt(c.txt||'');});['A','B'].forEach(p=>{const c=vsCard(CS.lg[p]);if(c)addTxt(c.txt||'');});return [...k];}
/** Kéz, trash és deck lapjai állandó azonosítóval ({id, n}). A régi, névlistás forma (sorszámos "zhA0" hivatkozásokkal) betöltéskor ugyanazt az
    azonosítót kapja, amit az elemző sorszámból képezett, így a régi linkek és sablonok elemzése nem változik. Az új lapok "_" utáni sorszámot kapnak, ez soha nem ismétlődik. */
const ZK:Record<string,string>={hand:'h',trash:'t',deck:'d'};
export function normZones<T extends ChainState|null|undefined>(cs:T):T{if(!cs)return cs;(['hand','trash','deck'] as const).forEach(z=>{const zs=cs[z];if(!zs)return;(['A','B'] as const).forEach(p=>{zs[p]=(zs[p]||[]).map((e,i)=>typeof e==='string'?{id:'z'+ZK[z]+p+i,n:e}:e&&!e.id?Object.assign({},e,{id:'z'+ZK[z]+p+i}):e);});});return cs;}
export function newZid(cs:ChainState,z:string,p:string){cs.zseq=(cs.zseq||0)+1;return 'z'+ZK[z]+p+'_'+cs.zseq;}

/** Lépések törlése és átrendezése: az "sK" hivatkozásokat (célpont, költség, forrás) az új indexre írja át; a törölt vagy mögé került lépésre mutató hivatkozás törlődik. */
export function reorderSteps(CS:ChainState,order:number[]){const newOf:Record<number,number>={};order.forEach((o,ni)=>newOf[o]=ni);
  const steps=order.map(o=>CS.steps[o]);const fix=(v:string|undefined,ni:number)=>{const m=/^s(\d+)$/.exec(v||'');if(!m)return v;const t=newOf[+m[1]];return t!=null&&t<=ni?'s'+t:'';};
  steps.forEach((s,ni)=>{s.tg=(s.tg||[]).map(v=>fix(v,ni) as string);if(s.costTg)s.costTg=fix(s.costTg,ni);if(s.src&&/^s\d+$/.test(s.src))s.src=fix(s.src,ni);if(s.so&&/^s\d+$/.test(s.so))s.so=fix(s.so,ni);});
  CS.steps=steps;}
