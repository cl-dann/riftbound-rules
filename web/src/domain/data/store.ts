/* Globális adat: a generált kártya-, szabály- és meta adat, az init() után élő kötésként olvasható. (a korábbi legacy/core.ts része, S15) */
import { isHead } from '../rules/head';
import { norm } from '../text/norm';
export let D:any, RULES:any[], TOPICS:any[], CARDS:any[], META:any, BF:any, BAN_ACTIVE=false, TERMS:any[]=[], TRE:RegExp|null=null;
export const TODAY=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
export const byName=new Map();
export let top3:number[]=[];
export let TERM_RES:RegExp[]=[];
export function init(data:any){
  D=data;RULES=D.rules;TOPICS=D.topics;CARDS=D.cards;META=D.meta;BF=META.banfut;BAN_ACTIVE=!!(BF&&TODAY>=BF.from);
  CARDS.forEach(c=>{if(c.banf&&TODAY>=c.banf){c.ban=1;c.banNew=1;}});
  top3=RULES.map(r=>parseInt(r[0].slice(0,3),10));
  TERMS=(D.extra&&D.extra.terms)||[];
  TERM_RES=TERMS.map(x=>new RegExp('^(?:'+x.m+')$','iu'));
  TRE=TERMS.length?new RegExp('(?<![\\p{L}\\[])('+TERMS.map(x=>x.m).sort((a,b)=>b.length-a.length).join('|')+')(?![\\p{L}])','giu'):null;
  CARDS.forEach(c=>{c._n=norm(c.n);c._s=norm([c.n].concat(c.a,c.tg||[],c.st||[],[c.t]).join(' '));c._t=norm(c.txt||'');[c.n].concat(c.a).forEach((a: string)=>{const k=norm(a);if(!byName.has(k))byName.set(k,c);});});
  CARDS.forEach(c=>{c._kw=c.tp.filter((p: [number, string])=>TOPICS[p[0]].g==='kw').map((p: [number, string])=>TOPICS[p[0]].title);});
  heads.length=0;RULES.forEach((r,i)=>{if(isHead(r))heads.push(i);});
}
export const banDate=()=>BAN_ACTIVE?BF.from:META.ban_updated;
export const heads:number[]=[];
export const IMGBASE='https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/';
export const vsCard=(v: unknown)=>!v||!String(v).trim()?null:byName.get(norm(v))||CARDS.find(c=>norm(c.n).startsWith(norm(v)));
export const kwRef=(k: string)=>{const t=TOPICS.find(x=>x.k==='kw:'+k);return t?t.refs[0]:'';};
