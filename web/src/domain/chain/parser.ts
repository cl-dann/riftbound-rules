/* Lapszöveg felbontása: utasításforrások, Choose one, költség, abilityk, triggerek, célpont-kifejezések, utasítás felbontás. (a chainCore.ts 1-405. sorából, S19) */
import { costCondOf } from './cost';
import { COST_LINE, DK_LINE, KW_HEAD, KW_ONLY, TRIG_LINE, stripRem } from './text';
import type { Ability, CardLike, CostInfo, TargetParam, Trigger } from './types';

/** Egy utasításforrás: k = opt, cost, trig, act, spell; e a szöveg. */
export type InstrSource = { k: string; e: string; why?: string; cost?: string };

/** Egy lap utasításforrásai: spell sorok, play effect, triggered és activated abilityk hatása (a lefedettségi statisztikához és a builderhez). */
export function instrSources(c:CardLike|null|undefined){const out:InstrSource[]=[];if(!c)return out;
  (c.txt||'').split('\n').map(stripRem).filter(Boolean).forEach((l:string)=>{
    if(KW_ONLY.test(l))return;
    if(/^[-\u2014\u2013]\s+\S/.test(l)&&!/^[-\u2014\u2013]\s*\[[^\]]*\](?:\s*\/\s*\[[^\]]*\])+/.test(l)){out.push({k:'opt',e:l.replace(/^[-\u2014\u2013]\s*/,'')});return;}
    if(COST_LINE.test(l)){out.push({k:'cost',e:l});return;}
    let m;
    if((m=DK_LINE.exec(l))){const e=l.slice(m[0].length);if(e)out.push({k:'trig',e,why:m[1]});return;}
    if((m=TRIG_LINE.exec(l))){out.push({k:'trig',e:l.slice(m[0].length),why:l.slice(0,m[0].length).replace(/,\s*$/,'')});return;}
    const k=l.indexOf(':');
    if(k>0&&!/^(?:when|if|while|at)\b/i.test(l)&&/(\[[^\]]+\]|\bkill (?:this|me)\b|\brecycle\b|\bexhaust\b|\bdisempower\b|\bbanish (?:this|me)\b|\bspend\b|\bpay\b|\bdiscard\b)/i.test(l.slice(0,k))){out.push({k:'act',e:l.slice(k+1).replace(/^\s*\[Reaction\]\s*/,'').trim(),cost:l.slice(0,k)});return;}
    if(c.t==='Spell')out.push({k:'spell',e:l.replace(KW_HEAD,'').trim()});
  });return out;}

export const effOf=(c:CardLike)=>stripRem(((c.txt||'').split('\n').map(stripRem).filter((l:string)=>l&&!KW_ONLY.test(l)&&!COST_LINE.test(l)).map((l:string)=>l.replace(KW_HEAD,'').trim()).join(' '))+' '+(c.eff&&c.t==='Spell'?c.eff:''));

/** "Choose one" módok: a fejléc sora és a "- " kezdetű opciók (Rocket Barrage, 820.2.a). mode: a választott opció indexe. */
export function modalSplit(lines:string[],mode?:number){const hi=lines.findIndex(l=>/\bchoose one\b(?! of\b)|^do one of the following\b/i.test(l)&&!/based on/i.test(l));const opts:string[]=[];
  if(hi>=0){let k=hi+1;while(k<lines.length&&/^[-\u2014\u2013]\s+/.test(lines[k])){opts.push(lines[k].replace(/^[-\u2014\u2013]\s*/,''));k++;}}
  if(!opts.length)return {lines,opts};const md=Math.max(0,Math.min(mode||0,opts.length-1));
  const head=lines[hi].replace(/(?:then,?\s*)?(?:you may )?choose one\b.*$/i,'').trim();
  return {lines:lines.slice(0,hi).concat(head?[head]:[],[opts[md]],lines.slice(hi+opts.length+1)),opts,mode:md,head:lines[hi]};}
/** Additional cost: kötelező vagy választható kill (Sacrifice, Cruel Patron, Atakhan), illetve fizethető extra költség (Akshan). */
export function costOf(c:CardLike|null|undefined){const out:CostInfo={kill:null,opt:false,txt:''};if(!c)return out;
  (c.txt||'').split('\n').map(stripRem).forEach((l:string)=>{let m;
    if((m=/^as an additional cost to play (?:this|me), kill (?:a|another) friendly (\[Mighty\] )?unit/i.exec(l))){out.kill={opt:false,mighty:!!m[1]};out.txt=l;}
    else if(/^you may kill a friendly unit as an additional cost/i.test(l)){out.kill={opt:true,mighty:false};out.txt=l;}
    else if(/you may pay [^.]*as an additional cost|as you play (?:this|me), you may pay|^as an additional cost to play (?:this|me), you may\b/i.test(l)){out.opt=true;out.txt=l;}});
  return out;}

export function abilitiesOf(c:CardLike|null|undefined){const out:Ability[]=[];if(!c)return out;
  (c.txt||'').split('\n').forEach((raw:string)=>{const l=stripRem(raw);
    if(/^\[Equip\]/.test(l)){out.push({label:'Equip',eff:'Attach this to a unit you control.',tm:'none',equip:true,cost:l.replace(/^\[Equip\]\s*/,'')});return;}
    const k=l.indexOf(':');if(k<0)return;const cost=l.slice(0,k),eff=l.slice(k+1).replace(/^\s*\[Reaction\]\s*[,\u2014-]*\s*/,'').trim();
    if(/^when|^at the|^if |^while /i.test(cost))return;
    const tm=/\[Reaction\]/.test(l)?'reaction':/\[Action\]/.test(l)?'action':'none';
    out.push({label:cost.replace(/\[>\]/g,'').trim()+': '+eff.slice(0,60),eff,tm,add:/\[Add\]/.test(eff),cost});});
  /* Empower: activated ability keyword (827.1, 827.1.b), a lista végén, hogy a korábbi indexek ne változzanak */
  (c.txt||'').split('\n').forEach((raw:string)=>{const m=/^\[Empower\]\s*((?:\[[^\]]+\])+)/.exec(raw.trim());if(m)out.push({label:'Empower '+m[1]+': Empower me',eff:'Empower me.',tm:'none',add:false,cost:m[1],empower:true});});
  return out;}

/** Triggered abilityk: a lap saját szövege és (csatolt gearnél) az Effect Text. */
export function triggersOf(c:CardLike|null|undefined,extraEff?:string){const out:Trigger[]=[];if(!c)return out;
  const lines=(c.txt||'').split('\n').concat(extraEff?[extraEff]:[]).map(stripRem);
  lines.forEach((l:string,li:number)=>{let m;if(/^[-\u2014\u2013]\s+/.test(l)&&out.length){const last=out[out.length-1];if(last.modal)last.opts!.push(l.replace(/^[-\u2014\u2013]\s*/,''));return;}
    if((m=DK_LINE.exec(l))){const e=l.slice(m[0].length);if(e)out.push({label:'['+m[1]+'] '+e.slice(0,50),eff:e,why:m[1],dk:/Deathknell/i.test(m[1])});return;}
    if((m=TRIG_LINE.exec(l))){const why=l.slice(0,m[0].length).replace(/,\s*$/,'');const ef=l.slice(m[0].length);out.push({label:why+': '+ef.slice(0,50),eff:ef,why,modal:/\bchoose one\b(?! of\b)/i.test(ef)&&!/based on/i.test(ef),opts:[]});}void li;});
  return out;}

export const NUMW:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6};
export const numOf=(x:string)=>x==null?1:/^\d+$/.test(x)?+x:NUMW[String(x).toLowerCase()]||1;
/** Célpont-kifejezések: "a unit", "up to two enemy units", "a friendly [Mighty] unit", "an Equipment", "a unit you control at another location". */
/** A régi (feltétel-tagmondatot is célpontnak vevő) felismerés, csak a régi lépések célpont-indexeinek átszámolásához (migrateTg). */
let LEGACY=false;
export function withLegacyPhrases<T>(f:()=>T):T{const o=LEGACY;LEGACY=true;try{return f();}finally{LEGACY=o;}}
/** Feltétel-tagmondatban ("if", "only if", "unless", "while" a mondatrész elejétől) álló kifejezés nem célpont: a feltétel a játékállapotot írja le. */
const inCondClause=(e:string,at:number)=>{const pre=e.slice(0,at);const cut=Math.max(pre.lastIndexOf('.'),pre.lastIndexOf(','),pre.lastIndexOf(';'));return /\b(?:if|unless|while)\b/i.test(pre.slice(cut+1));};
export function phrasesTxt(e:string){
  const out:TargetParam[]=[];
  const re=/\b(a|an|another|one|two|three|up to (\d+|one|two|three|four|five)|any number of)\s+((?:(?:other|another|friendly|enemy|attacking|defending|exhausted|ready|stunned|equipped|buffed|damaged|detached|attached|\[Mighty\]|Mighty)\s+)*)(units?|gear|spells?|equipment|abilit(?:y|ies))\b/gi;let m;
  const mm=/(\d+) \[S\] or less/i.exec(e);
  if(/\bchoose a battlefield\b/i.test(e))out.push({type:'battlefield',rel:'any',max:null,bf:false,opt:false});
  if(/\b(?:empower|disempower) something here\b/i.test(e))out.push({type:'perm',rel:'any',max:null,bf:false,here:true,opt:/\byou may\b/i.test(e)});
  /* osztott damage (355.14): "split among (any number of) (enemy) units ...": legfeljebb 5 célpont, mind választható (355.14.c: legfeljebb annyi, amennyi a damage) */
  const sm=/\bsplit among (?:any number of |up to \w+ )?(friendly |enemy )?(units?)((?: at (?:a single )?battlefields?| here| at a battlefield)?)/i.exec(e);
  const smA=sm?sm.index:-1,smB=sm?sm.index+sm[0].length:-1;
  const splitP=sm?{type:'unit',rel:(sm[1]||'any').trim().toLowerCase()||'any',max:null,bf:/battlefield/i.test(sm[3]),same:/single battlefield/i.test(sm[3]),here:/here/i.test(sm[3]),opt:true,split:true}:null;
  while((m=re.exec(e))){if(sm&&m.index>=smA&&m.index<smB)continue;const raw=m[4].toLowerCase();const ty=/^unit/.test(raw)?'unit':/^gear|^equipment/.test(raw)?'gear':/^spell/.test(raw)?'spell':'ability';
    const before=e.slice(Math.max(0,m.index-14),m.index);const tail=e.slice(m.index+m[0].length,m.index+m[0].length+90);const adj=(m[3]||'').toLowerCase();
    if(/\bplay\s*$/i.test(before)&&(/^[^.]*?\btokens?\b/i.test(tail)||/^\s*(?:from|you control|with)\b/i.test(tail)||ty==='spell'))continue; // kijátszás vagy token, nem célpont
    if(/\[Show Off\]\s*$|showed off\s*$|\bchooses\s*$/i.test(before))continue;
    if(!LEGACY&&inCondClause(e,m.index))continue; // feltétel-tagmondat, nem célpont
    if(/\bamong them\s*$/i.test(before))continue; // a megnézett lapok közül választás, nem célpont (128.4, 355.10.a) // Show Off választás (832), nem célpont
    if(/^\s*token\b/i.test(tail)||/\b(?:it's|it is|is|was|that's|as|becomes?)\s*$/i.test(before))continue; // feltétel, nem célpont
    if(/^\s*or (?:units?|gear|spells?) from among them\b/i.test(tail))continue; // a megnézett lapok közül választás, nem célpont
    if(/^\s*(?:from (?:your|their|its owner's|an opponent's|a player's) (?:hand|trash|deck|main deck)|from among|from (?:it|that unit|them|me)\b|in (?:your|their) (?:hand|trash)|you play|they control|in your trash)\b/i.test(tail))continue;
    if(/\b(?:for each|each|reveal|discard|draw)\s*$/i.test(before)&&!/each of\s*$/i.test(before))continue;
    if(ty==='ability'&&!/\bspell or\s*$/i.test(before)&&!/counter|gain control/i.test(e.slice(Math.max(0,m.index-30),m.index)))continue;
    const q=m[1].toLowerCase();const totM=/^[^.]*?\bwith total Might (\d+) or less\b/i.exec(tail);const n=m[2]?numOf(m[2]):q==='any number of'?(totM?6:3):(q==='two'?2:q==='three'?3:1);
    const rel=/friendly/.test(adj)||/^\s*(?:you control|of yours)\b/i.test(tail)?'friendly':/enemy/.test(adj)||/^\s*(?:an opponent controls|your opponent controls)\b/i.test(tail)?'enemy':'any';
    const sent=tail.split('.')[0].split(/\b(?:and|or)\s+(?:a|an|another|up to)\b/i)[0];
    const p:TargetParam={type:ty==='ability'?'spell':ty,rel,max:mm&&ty==='unit'?+mm[1]:null,
      bf:ty!=='spell'&&/^\s*(?:you control\s+)?at (?:a|the same|that) battlefield/i.test(sent)||/^\s*from a battlefield\b/i.test(sent),
      same:/\bat the same (?:battlefield|location)\b/i.test(sent)||!!totM,totalMax:totM?+totM[1]:null,opt:!!m[2]||q==='any number of',
      here:/^\s*(?:you control\s+|an opponent controls\s+)?(?:here|there)\b/i.test(sent),free:/\bat (?:another|a different) location\b/i.test(sent),
      base:/^\s*(?:you control\s+)?in (?:a|your|their|its owner's) base\b/i.test(sent),eq:/equipped/.test(adj)||raw==='equipment',equipOnly:raw==='equipment',
      ...(costCondOf(sent)?{cost:costCondOf(sent)}:{}),mighty:/mighty/.test(adj),another:q==='another'||/\bother\b/.test(adj),attacking:/attacking/.test(adj),stunned:/stunned/.test(adj),any:q==='any number of',orAb:ty==='spell'&&/^\s*or abilit/i.test(tail),chooseOnly:/^[^.]*\bthat chooses it and no other friendly unit\b/i.test(tail),...(LEGACY&&inCondClause(e,m.index)?{cond:true}:{}),...(/^\s*(?:you control\s+|an opponent controls\s+)?there\b/i.test(sent)?{there:true}:{})};
    for(let i=0;i<Math.min(n,totM?6:3);i++)out.push(Object.assign({},p,{opt:p.opt||(i>0&&!!m[2])}));}
  if(splitP){const dn=/\bdeal (\d+) damage split\b/i.exec(e);const slots=dn?Math.min(10,+dn[1]+3):10;for(let i=0;i<slots;i++)out.push(Object.assign({},splitP));}
  return out;
}

/** Instruction felbontás (359.3.e.14): mondatonként, ", then" és " and ready/stun/..." mentén. */
export const splitInstr=(eff:string)=>String(eff||'').replace(KW_HEAD,'').split(/(?<=\.)\s+/).flatMap(x=>DELAY_RE.test(x)||/\binstead\b|\bwould\b/i.test(x)?[x]:x.split(/,\s*then\s+|\s+and\s+(?=(?:ready|stun|exhaust|buff|draw|recall|give|channel|kill|deal|banish|discard)\b)/i)).map(x=>x.trim()).filter(Boolean);
export const DELAY_RE=/\bat (?:the )?end of (?:this |the )?turn\b|\bat the start of (?:your|its controller's|the) next\b|\buntil (?:your|the) next\b/i;
export const LINK_RE=/\b(it|its|them|their|they|that unit|the friendly unit|the enemy unit|that spell|that gear|that equipment|the killed unit|the chosen unit|those units|each other|it's)\b/i;
export const DIRECT_RE=/\bif you do\b|\bif (?:this|it) kills\b|\bif (?:it|that unit) dies\b|\bfor each unit this kills\b/i;

