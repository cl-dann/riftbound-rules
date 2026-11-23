/* Kéz, trash és deck hivatkozások (zoneRefOf, zoneCheck). (a chainCore.ts 1-405. sorából, S19) */
import { actOfCard } from './actions';
import { type CostCond, type CostCtx, costCheck, costCondOf } from './cost';
import { stripRem } from './text';
import type { CardLike } from './types';
/** A választott lap a zónában (a hívó játékobjektuma): tulajdonos, irányító, lap. */
export type ZoneObj={own?:string|null;ctrl?:string|null;card?:CardLike|null};
export type ZoneRef={mightRel?:number;counts?:Record<string,number>;z:'trash'|'hand'|'deck'|'among'|'choose';who:'you'|'they'|'any'|'each';n:number;type:string[];tags:string[];target:boolean;act:string;opt:boolean;top:boolean;t:string;cost?:CostCond|null};
export const ZNUM:Record<string,number>={a:1,an:1,one:1,two:2,three:3,four:4,five:5};
export function zoneRefOf(t0:string,cardName?:string|null):ZoneRef|null{const r=zoneRef0(t0,cardName);if(r){const cc=costCondOf(r.t);if(cc)r.cost=cc;}return r;}
export function zoneRef0(t0:string,cardName?:string|null):ZoneRef|null{const t=stripRem(String(t0||'')).replace(/^[-\u2014\u2013]\s*/,'');let m:RegExpExecArray|null;
  const typesOf=(s:string)=>{const out:string[]=[];if(/\bunits?\b/i.test(s))out.push('unit');if(/\bspells?\b/i.test(s))out.push('spell');if(/\b(gear|equipment)\b/i.test(s))out.push('gear');return out;};
  const nOf=(s:string)=>{const u=/\bup to (\d+|one|two|three|four|five)\b/i.exec(s);if(u)return /^\d+$/.test(u[1])?+u[1]:ZNUM[u[1].toLowerCase()];const d=/\b(\d+|one|two|three)\s+(?:cards?|units?|spells?|gear)\b/i.exec(s);if(d)return /^\d+$/.test(d[1])?+d[1]:ZNUM[d[1].toLowerCase()];return 1;};
  const act=actOfCard(t,cardName).k;const opt=/\byou may\b|\bup to\b/i.test(t);
  // Chronobreak: a kifizetett Power számú saját unit a resolve-kor választva (nem célpont, 355.10.d mintájára a mennyiség a költségtől függ)
  if(/^banish that many units you control\b/i.test(t))return {z:'choose',who:'you',n:99,type:['unit'],tags:[],target:false,act:'chrono',opt:false,top:false,t};
  // "each player": minden játékos a saját lapjai közül választ (355.10.e, 412.1)
  if((m=/^each player looks at the top (\d+) cards? of their main deck, banishes one of them/i.exec(t)))return {z:'deck',who:'each',n:+m[1],type:[],tags:[],target:false,act:'banishEach',opt:false,top:true,t};
  if(/^each player reveals the top card of their main deck/i.test(t))return {z:'deck',who:'each',n:1,type:[],tags:[],target:false,act:'revealEach',opt:false,top:true,t};
  if((m=/^each player chooses (.+?) in their hands?\b/i.exec(t))){const cnt:Record<string,number>={};m[1].replace(/(\d+) (units?|gear|runes?|cards)/gi,(_:string,n:string,k:string)=>{cnt[k.toLowerCase().replace(/s$/,'').replace('gear','gear')]=+n;return '';});
    return {z:'choose',who:'each',n:99,counts:cnt,type:[],tags:[],target:false,act:'divine',opt:false,top:false,t};}
  // trash: nyilvános zóna, a választott lap célpont (355.10.a); "all" vagy "this/me" nem választás (355.10.d, saját lap)
  if((m=/\bfrom (your|their|any|an opponent's|opponents') trash(?:es)?\b|\bin (your|their) trash\b/i.exec(t))&&!/\b(?:all|each)\b[^.]{0,40}\btrash\b/i.test(t)&&!/\b(?:play|return) (?:this|me)\b/i.test(t)&&!/\bcards? in your trash\b[^.]*\b(?:for each|equal)\b/i.test(t)){
    const w=(m[1]||m[2]).toLowerCase().replace("opponents'","their");const head=t.slice(0,m.index);
    const tags=(/\b(Bird|Cat|Dog|Poro)\b/.test(head)?['Bird','Cat','Dog','Poro']:/\[Hidden\]/.test(head)?['[Hidden]']:[]);
    if(!/\b(return|play|banish|recycle|put|give|choose)\b/i.test(head))return null;
    if(m[2]&&/\bput\b/i.test(head))return null;
    return {z:'trash',who:w==='your'?'you':w==='their'||w==="an opponent's"?'they':'any',n:nOf(head),type:typesOf(head.split(/\b(?:return|play|banish|recycle|put|give|choose)\b/i).pop()||''),tags,target:true,act,opt,top:false,t};}
  // kéz: nem nyilvános, a választás a resolve-kor (355.10.a, 355.18)
  if((m=/\bfrom (your|their) hand\b|\bfrom hand\b/i.exec(t))&&/\bplay\b/i.test(t)&&!/\bplay (?:this|me)\b/i.test(t))return {z:'hand',who:m[1]&&m[1].toLowerCase()==='their'?'they':'you',n:nOf(t.slice(0,m.index)),type:typesOf(t.slice(0,m.index)),tags:[],target:false,act:'playcard',opt,top:false,t};
  if((m=/^(?:then,?\s*)?(?:(they|each player|you may)\s+)?discards? (\d+|one|two)\b/i.exec(t))){const w=(m[1]||'').toLowerCase();return {z:'hand',who:w==='they'?'they':w==='each player'?'each':'you',n:/^\d+$/.test(m[2])?+m[2]:ZNUM[m[2].toLowerCase()],type:[],tags:[],target:false,act:'discard',opt:w==='you may'||opt,top:false,t};}
  // a megnézett vagy felfedett lapok közül választás ("from among them", "Put 1 into your hand", "banish one", "Choose one and banish it")
  if(/^choose one\.?$/i.test(t))return {z:'among',who:'any',n:1,type:[],tags:[],target:false,act:'choose',opt:false,top:false,t};
  if(/\bfrom among them\b/i.test(t)||/^(?:then,?\s*)?(?:you may )?(?:put 1 into your hand|banish one\b|choose one and banish it)/i.test(t)){const head=t.split(/\bfrom among them\b/i)[0];
    const tags=/\b(Bird|Cat|Dog|Poro)\b/.test(head)?['Bird','Cat','Dog','Poro']:[];
    const tyS=typesOf(head).length?head:t.replace(/\bfrom among them\b/i,'').replace(/\b(?:Energy|Power) cost\b/gi,'');
    const mr=/\bMight up to (\d+) more than the killed unit\b/i.exec(t);
    return {z:'among',...(mr?{mightRel:+mr[1]}:{}),who:'any',n:1,type:/\bcards?\b/i.test(head)?[]:typesOf(tyS),tags,target:false,act:/\bplay it\b/i.test(t)?'playcard':/\bdraw it\b|\binto your hand\b/i.test(t)?'hand':/\bbanish\b/i.test(t)?'banish':'hand',opt:/\byou may\b/i.test(t),top:false,t};}
  // deck: titkos sorrend (108.4.e, 128.3); a felső lap(ok) vagy keresés ("from your Main Deck")
  if((m=/\btop (card|\d+ cards|two cards|three cards) of (your|their|each opponent's) (?:main )?deck\b/i.exec(t))){const k=m[1].toLowerCase();const n=k==='card'?1:k.startsWith('two')?2:k.startsWith('three')?3:parseInt(k,10);return {z:'deck',who:m[2].toLowerCase()==='your'?'you':'they',n,type:[],tags:[],target:false,act,opt,top:true,t};}
  if((m=/\bfrom your (?:main )?deck\b/i.exec(t))&&/\b(search|play|put|reveal|look)\b/i.test(t))return {z:'deck',who:'you',n:nOf(t.slice(0,m.index)),type:typesOf(t.slice(0,m.index)),tags:[],target:false,act,opt,top:false,t};
  return null;}
/** Rejtett adatot kérő utasítás, amely a pályás építőben konkrét lap kiválasztásával kiváltható (kéz, deck felső lapja, trash, eldobott lap). */
export function zoneResolvable(t:string,c:CardLike|null|undefined){if(zoneRefOf(t,c&&c.n))return true;const a=actOfCard(t,c&&c.n);
  if(a.field&&/eldobott lap/i.test(a.field.label||''))return true;
  if(a.cond&&a.cond.how==='hidden'&&/^it's an? (?:gear|spell|unit)$|^it is a unit$/i.test(a.cond.t)&&/\btop (?:card|\d+ cards) of (?:your|their) main deck\b|\bfrom your hand\b/i.test((c&&c.txt)||''))return true;
  if(a.cond&&a.cond.how==='hidden'&&/^(?:you revealed a Bird|it has that type|you have exactly \d+ cards in hand|you revealed a card with the lowest Energy cost|there are four spells banished with me)/i.test(a.cond.t))return true;
  // "play it": a megnézett, felfedett vagy banishelt lap (from among them, a deck felső lapja, trash), a pályás építőben megadva
  if(a.k==='playcard'&&/\bplay it\b/i.test(t)&&/\bfrom among them\b|\btop (?:card|\d+ cards) of (?:your|their|each opponent's) main deck\b|\bin your trash\b|\breveals the top card\b/i.test((c&&c.txt)||''))return true;
  // a felfedett, égetett vagy kézben lévő lapból számolt érték (Pakaa, Ravenbloom, Forgotten Relic, Teemo, Invert Timelines)
  return ZONE_DERIVED.test(stripRem(String(t||'')));}
const ZONE_DERIVED=/^(?:Do one of the following based on its domain|Starting with the next player, each player plays those cards|Otherwise, put it in your trash|If it's a spell, put it in your hand|When you burn a unit this way|Deal 1 to that unit for each card with \[Hidden\] revealed this way|Each player discards their hand)/i;
/** A zónából választott lap megfelel-e a lap szövegének (kinek a zónája, típus, tag); '' ha igen. A zóna-tagságot a hívó ellenőrzi. */
export function zoneCheck(zr:ZoneRef,ob:ZoneObj|null|undefined,pl:string,ctx?:CostCtx){const own=zr.who==='you'?[pl]:zr.who==='they'?[pl==='A'?'B':'A']:['A','B'];if(!ob||!ob.card)return 'ismeretlen lap';
  if(!own.includes((ob.own||ob.ctrl) as string))return 'nem '+(zr.who==='you'?'a saját':'az ellenfél')+' '+(zr.z==='trash'?'trashében':zr.z==='hand'?'kezében':'deckjében')+' van';
  if(zr.type.length&&!zr.type.includes(String(ob.card.t).toLowerCase()))return 'nem '+zr.type.join(' vagy ')+' ('+ob.card.t+')';
  if(zr.tags.length&&!zr.tags.some(t=>t==='[Hidden]'?/\[Hidden\]/.test(ob.card!.txt||''):(ob.card!.tg||[]).includes(t)))return 'nem '+zr.tags.join(', ');
  if(zr.mightRel!=null){const km=ctx?ctx.killedM:null;if(km==null)return 'a feltétel nem ellenőrizhető: a megölt unit Mightja nem elérhető, az erre épülő ellenőrzés null (359.3.e.12)';
    const m=ob.card.m!=null&&(ob.card.m as unknown)!==''?+ob.card.m:0;if(m>km+zr.mightRel)return 'Mightja '+m+', a feltétel legfeljebb '+(km+zr.mightRel)+' (a megölt unit Mightja '+km+' + '+zr.mightRel+'; visszatekintés, 359.3.e.13)';}
  return costCheck(zr.cost,ob.card,ctx);}
export const ZONE_HU:Record<string,string>={trash:'trash',hand:'kéz',deck:'deck',banish:'banishment',board:'board',gone:'nem a zónában',played:'kijátszva',chain:'chain'};

