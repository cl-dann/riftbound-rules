/* Globális adat: a generált kártya-, szabály- és meta adat, az init() után élő kötésként olvasható. (a korábbi legacy/core.ts része, S15) */
import { isHead } from '../rules/head';
import { norm } from '../text/norm';
import type { AppData, BanFut, Card, Meta, Rule, Term, Topic } from './schema';
export let D: AppData, RULES: Rule[], TOPICS: Topic[], CARDS: Card[], META: Meta, BF: BanFut, BAN_ACTIVE=false, TERMS: Term[]=[], TRE: RegExp|null=null;
export const TODAY=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
export const byName=new Map<string, Card>();
export let top3:number[]=[];
export let TERM_RES:RegExp[]=[];
/** A kártyák részletei (nt, qa, sh, pr) betöltve-e (mergeDetails). */
export let DETAILS_READY=false;
/** A generált adatot (kártyák, szabályok, meta) a sémában leírt alakban kapja; a kártyákat kiegészíti és indexeli. */
export function init(data: Record<string, unknown>){
  D=data as unknown as AppData;RULES=D.rules;TOPICS=D.topics;CARDS=D.cards;META=D.meta;BF=META.banfut;BAN_ACTIVE=!!(BF&&TODAY>=BF.from);
  CARDS.forEach(c=>{if(c.banf&&TODAY>=c.banf){c.ban=1;c.banNew=1;}});
  top3=RULES.map(r=>parseInt(r[0].slice(0,3),10));
  TERMS=(D.extra&&D.extra.terms)||[];
  TERM_RES=TERMS.map(x=>new RegExp('^(?:'+x.m+')$','iu'));
  TRE=TERMS.length?new RegExp('(?<![\\p{L}\\[])('+TERMS.map(x=>x.m).sort((a,b)=>b.length-a.length).join('|')+')(?![\\p{L}])','giu'):null;
  CARDS.forEach(c=>{c._n=norm(c.n);c._s=norm([c.n].concat(c.a,c.tg||[],c.st||[],[c.t]).join(' '));c._t=norm(c.txt||'');[c.n].concat(c.a).forEach(a=>{const k=norm(a);if(!byName.has(k))byName.set(k,c);});});
  CARDS.forEach(c=>{c._kw=c.tp.filter(p=>TOPICS[p[0]].g==='kw').map(p=>TOPICS[p[0]].title);});
  heads.length=0;RULES.forEach((r,i)=>{if(isHead(r))heads.push(i);});
}
/** A cards-detail.json tartalma a kártyákba (azonos sorrend). Az objektum ugyanaz marad (a byName és a többi hivatkozás
    érvényes), a mezők sorrendje pedig a korábbi egyben exportált cards.json-é (pr az img után, sh, nt, qa az ex után),
    így a kártyát tartalmazó kimenetek (például az elemzés objektumai) JSON-ja változatlan. */
const AFTER: Record<string, string[]> = { img: ['pr'], ex: ['sh', 'nt', 'qa'] };
export function mergeDetails(det: Partial<Card>[]){
  CARDS.forEach((c,i)=>{
    const d=det[i]||{};const rec=c as unknown as Record<string, unknown>;const src=d as Record<string, unknown>;
    const entries:[string, unknown][]=[];
    for(const k of Object.keys(rec)){entries.push([k,rec[k]]);for(const x of AFTER[k]||[])if(x in src)entries.push([x,src[x]]);}
    for(const k of Object.keys(rec))delete rec[k];
    for(const [k,v] of entries)rec[k]=v;
  });
  DETAILS_READY=true;
}
export const banDate=()=>BAN_ACTIVE?BF.from:META.ban_updated;
export const heads:number[]=[];
export const IMGBASE='https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/';
/** Lap név szerint: pontos (normalizált) név vagy alias, különben az első, amelynek a neve így kezdődik. */
export const vsCard=(v: unknown): Card | null | undefined=>!v||!String(v).trim()?null:byName.get(norm(v))||CARDS.find(c=>norm(c.n).startsWith(norm(v)));
export const kwRef=(k: string)=>{const t=TOPICS.find(x=>x.k==='kw:'+k);return t?t.refs[0]:'';};
