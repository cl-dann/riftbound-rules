// @ts-nocheck
/* Chain elemző magja, DOM nélkül. A builder állapotából (CS: legendek, battlefieldek, board, lépések) kiszámolja a
   lejátszás frame-jeit, a szabálysorokat, az eseménynaplót és a HTML kimenetet. A chain.ts (DOM) és a unit tesztek is ezt hívják.
   A lapszöveg értelmezése szöveges heurisztika; amit nem ismer fel biztosan, azt "bizonytalan" címkével jelöli. */
import {esc,FL,FLT,glossify,vsCard,vsPairs} from '../../src/legacy/core';

/* ---------- Szövegelemzés ---------- */
export const stripRem=(s:string)=>(s||'').replace(/\([^()]*\)/g,' ').replace(/\s+/g,' ').trim();
export const plainOf=(h:string)=>String(h).replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
/** Csak keywordöt (és költségjelet) tartalmazó sor, például "[Hidden]", "[Repeat] [2]", "[Equip] [C]". */
const KW_ONLY=/^(?:\[[A-Za-z' -]+(?: \d+)?\]\s*(?:\[[^\]]*\]\s*)*)+$/;
export const KW_HEAD=/^(?:\[(?:Reaction|Action|Hidden|Quick-Draw|Accelerate|Ganking|Deflect(?: \d+)?|Tank|Backline|Shield(?: \d+)?|Assault(?: \d+)?|Vision|Temporary|Legion|Repeat)\](?:\s*\[[^\]]*\])*\s*)+/i;
/** Költségsor (nem utasítás): kötelező vagy választható additional cost. */
const COST_LINE=/^(?:as an additional cost to play (?:this|me)\b|you may (?:pay [^.]*?|kill a friendly unit) as an additional cost|as you play (?:this|me), you may pay [^.]*? as an additional cost)/i;
const TRIG_LINE=/^(?:\[[^\]]+\]\s*)*(?:(?:when|whenever)\b[^,]*,|at (?:the )?(?:start|end|beginning)\b[^,]*,|the (?:first|next|second) time\b[^,]*,)\s*/i;
const DK_LINE=/^(?:\[[^\]]+\]\s*)*\[(Deathknell|Hunt(?: \d+)?)\]\s*(?:\[>\])?\s*(?:[\u2014-]\s*)?/i;

/** Egy lap utasításforrásai: spell sorok, play effect, triggered és activated abilityk hatása (a lefedettségi statisztikához és a builderhez). */
export function instrSources(c:any){const out:any[]=[];if(!c)return out;
  (c.txt||'').split('\n').map(stripRem).filter(Boolean).forEach((l:string)=>{
    if(KW_ONLY.test(l))return;
    if(COST_LINE.test(l)){out.push({k:'cost',e:l});return;}
    let m;
    if((m=DK_LINE.exec(l))){const e=l.slice(m[0].length);if(e)out.push({k:'trig',e,why:m[1]});return;}
    if((m=TRIG_LINE.exec(l))){out.push({k:'trig',e:l.slice(m[0].length),why:l.slice(0,m[0].length).replace(/,\s*$/,'')});return;}
    const k=l.indexOf(':');
    if(k>0&&!/^(?:when|if|while|at)\b/i.test(l)&&/(\[[^\]]+\]|\bkill (?:this|me)\b|\brecycle\b|\bexhaust\b|\bdisempower\b|\bbanish (?:this|me)\b|\bspend\b|\bpay\b|\bdiscard\b)/i.test(l.slice(0,k))){out.push({k:'act',e:l.slice(k+1).replace(/^\s*\[Reaction\]\s*/,'').trim(),cost:l.slice(0,k)});return;}
    if(c.t==='Spell')out.push({k:'spell',e:l.replace(KW_HEAD,'').trim()});
  });return out;}

export const effOf=(c:any)=>stripRem(((c.txt||'').split('\n').map(stripRem).filter((l:string)=>l&&!KW_ONLY.test(l)&&!COST_LINE.test(l)).map((l:string)=>l.replace(KW_HEAD,'').trim()).join(' '))+' '+(c.eff&&c.t==='Spell'?c.eff:''));

/** Additional cost: kötelező vagy választható kill (Sacrifice, Cruel Patron, Atakhan), illetve fizethető extra költség (Akshan). */
export function costOf(c:any){const out:any={kill:null,opt:false,txt:''};if(!c)return out;
  (c.txt||'').split('\n').map(stripRem).forEach((l:string)=>{let m;
    if((m=/^as an additional cost to play (?:this|me), kill (?:a|another) friendly (\[Mighty\] )?unit/i.exec(l))){out.kill={opt:false,mighty:!!m[1]};out.txt=l;}
    else if(/^you may kill a friendly unit as an additional cost/i.test(l)){out.kill={opt:true,mighty:false};out.txt=l;}
    else if(/you may pay [^.]*as an additional cost|as you play (?:this|me), you may pay/i.test(l)){out.opt=true;out.txt=l;}});
  return out;}

export function abilitiesOf(c:any){const out:any[]=[];if(!c)return out;
  (c.txt||'').split('\n').forEach((raw:string)=>{const l=stripRem(raw);
    if(/^\[Equip\]/.test(l)){out.push({label:'Equip',eff:'Attach this to a unit you control.',tm:'none',equip:true,cost:l.replace(/^\[Equip\]\s*/,'')});return;}
    const k=l.indexOf(':');if(k<0)return;const cost=l.slice(0,k),eff=l.slice(k+1).replace(/^\s*\[Reaction\]\s*[,\u2014-]*\s*/,'').trim();
    if(/^when|^at the|^if |^while /i.test(cost))return;
    const tm=/\[Reaction\]/.test(l)?'reaction':/\[Action\]/.test(l)?'action':'none';
    out.push({label:cost.replace(/\[>\]/g,'').trim()+': '+eff.slice(0,60),eff,tm,add:/\[Add\]/.test(eff),cost});});
  return out;}

/** Triggered abilityk: a lap saját szövege és (csatolt gearnél) az Effect Text. */
export function triggersOf(c:any,extraEff?:string){const out:any[]=[];if(!c)return out;
  const lines=(c.txt||'').split('\n').concat(extraEff?[extraEff]:[]);
  lines.map(stripRem).forEach((l:string)=>{let m;
    if((m=DK_LINE.exec(l))){const e=l.slice(m[0].length);if(e)out.push({label:'['+m[1]+'] '+e.slice(0,50),eff:e,why:m[1],dk:/Deathknell/i.test(m[1])});return;}
    if((m=TRIG_LINE.exec(l))){const why=l.slice(0,m[0].length).replace(/,\s*$/,'');out.push({label:why+': '+l.slice(m[0].length).slice(0,50),eff:l.slice(m[0].length),why});}});
  return out;}

const NUMW:any={one:1,two:2,three:3,four:4,five:5,six:6};
const numOf=(x:string)=>x==null?1:/^\d+$/.test(x)?+x:NUMW[String(x).toLowerCase()]||1;
/** Célpont-kifejezések: "a unit", "up to two enemy units", "a friendly [Mighty] unit", "an Equipment", "a unit you control at another location". */
export function phrasesTxt(e:string){
  const out:any[]=[];
  const re=/\b(a|an|another|one|two|three|up to (\d+|one|two|three|four|five)|any number of)\s+((?:(?:other|another|friendly|enemy|attacking|defending|exhausted|ready|stunned|equipped|buffed|damaged|\[Mighty\]|Mighty)\s+)*)(units?|gear|spells?|equipment|abilit(?:y|ies))\b/gi;let m;
  const mm=/(\d+) \[S\] or less/i.exec(e);
  if(/\bchoose a battlefield\b/i.test(e))out.push({type:'battlefield',rel:'any',max:null,bf:false,opt:false});
  while((m=re.exec(e))){const raw=m[4].toLowerCase();const ty=/^unit/.test(raw)?'unit':/^gear|^equipment/.test(raw)?'gear':/^spell/.test(raw)?'spell':'ability';
    const before=e.slice(Math.max(0,m.index-14),m.index);const tail=e.slice(m.index+m[0].length,m.index+m[0].length+90);const adj=(m[3]||'').toLowerCase();
    if(/\bplay\s*$/i.test(before)&&(/^[^.]*?\btokens?\b/i.test(tail)||/^\s*(?:from|you control|with)\b/i.test(tail)||ty==='spell'))continue; // kijátszás vagy token, nem célpont
    if(/^\s*token\b/i.test(tail)||/\b(?:it's|it is|is|was|that's|as|becomes?)\s*$/i.test(before))continue; // feltétel, nem célpont
    if(/^\s*(?:from (?:your|their|its owner's|an opponent's|a player's) (?:hand|trash|deck|main deck)|from among|from (?:it|that unit|them|me)\b|in (?:your|their) (?:hand|trash)|you play|they control|in your trash)\b/i.test(tail))continue;
    if(/\b(?:for each|each|reveal|discard|draw)\s*$/i.test(before)&&!/each of\s*$/i.test(before))continue;
    if(ty==='ability'&&!/\bspell or\s*$/i.test(before)&&!/counter|gain control/i.test(e.slice(Math.max(0,m.index-30),m.index)))continue;
    const q=m[1].toLowerCase();const n=m[2]?numOf(m[2]):q==='any number of'?3:(q==='two'?2:q==='three'?3:1);
    const rel=/friendly/.test(adj)||/^\s*(?:you control|of yours)\b/i.test(tail)?'friendly':/enemy/.test(adj)||/^\s*(?:an opponent controls|your opponent controls)\b/i.test(tail)?'enemy':'any';
    const sent=tail.split('.')[0].split(/\b(?:and|or)\s+(?:a|an|another|up to)\b/i)[0];
    const p:any={type:ty==='ability'?'spell':ty,rel,max:mm&&ty==='unit'?+mm[1]:null,
      bf:ty!=='spell'&&/^\s*(?:you control\s+)?at (?:a|the same|that) battlefield/i.test(sent)||/^\s*from a battlefield\b/i.test(sent),
      same:/\bat the same (?:battlefield|location)\b/i.test(sent),opt:!!m[2]||q==='any number of',
      here:/^\s*(?:you control\s+|an opponent controls\s+)?(?:here|there)\b/i.test(sent),free:/\bat (?:another|a different) location\b/i.test(sent),
      base:/^\s*(?:you control\s+)?in (?:a|your|their|its owner's) base\b/i.test(sent),eq:/equipped/.test(adj)||raw==='equipment',equipOnly:raw==='equipment',
      mighty:/mighty/.test(adj),another:q==='another'||/\bother\b/.test(adj),attacking:/attacking/.test(adj),stunned:/stunned/.test(adj),any:q==='any number of'};
    for(let i=0;i<Math.min(n,3);i++)out.push(Object.assign({},p,{opt:p.opt||(i>0&&!!m[2])}));}
  return out;
}

/** Instruction felbontás (359.3.e.14): mondatonként, ", then" és " and ready/stun/..." mentén. */
export const splitInstr=(eff:string)=>String(eff||'').replace(KW_HEAD,'').split(/(?<=\.)\s+/).flatMap(x=>DELAY_RE.test(x)?[x]:x.split(/,\s*then\s+|\s+and\s+(?=(?:ready|stun|exhaust|buff|draw|recall|give|channel|kill|deal|banish|discard)\b)/i)).map(x=>x.trim()).filter(Boolean);
const DELAY_RE=/\bat (?:the )?end of (?:this |the )?turn\b|\bat the start of (?:your|its controller's|the) next\b|\buntil (?:your|the) next\b/i;
export const LINK_RE=/\b(it|its|them|their|they|that unit|the friendly unit|the enemy unit|that spell|that gear|that equipment|the killed unit|the chosen unit|those units|each other|it's)\b/i;
export const DIRECT_RE=/\bif you do\b|\bif (?:this|it) kills\b|\bif (?:it|that unit) dies\b|\bfor each unit this kills\b/i;

/** Utasítás műveletének felismerése. k: a művelet; unsure: miért bizonytalan (ha az). */
export function actOf(t:string){const e=String(t||'');let m;const r:any=(o:any)=>{if(/\bfor each\b/i.test(e)&&!o.unsure&&!['draw','channel'].includes(o.k)||/\bfor each\b/i.test(e)&&o.n==null&&['draw','channel'].includes(o.k))o.unsure='a mennyiség a "for each" számlálásától függ, ezt az elemzés nem számolja';if(/\binstead\b/i.test(e)&&!o.unsure)o.unsure='replacement ("instead"), az elemzés csak jelzi';if(/^if\b/i.test(e)&&!KNOWN_COND.test(e)&&!o.unsure)o.unsure='feltételes utasítás, a feltételt az elemzés nem vizsgálja (teljesültnek veszi)';return o;};
  if(/\bchoose one\b/i.test(e))return {k:'other',unsure:'választható mód (Choose one), a módot a játékos választja'};
  if(/\b(?:costs?|cost) \[[^\]]*\][^.]*\b(?:less|more)\b|\bignore (?:this spell's|its|this) cost\b|\bcosts? \d+ (?:less|more)\b/i.test(e))return {k:'costmod'};
  if(/^(?:use (?:this ability )?only\b|spend this (?:energy|power) only\b|play (?:this|me) only\b)|\bcan.t (?:play|move|be played|attack|defend)\b/i.test(e))return {k:'restrict'};
  if(/\bdeal damage equal to their Mights to each other\b|\bthey deal damage equal to their mights to each other\b/i.test(e))return {k:'fight'};
  if(/^each player (?:kills|chooses|discards|banishes)\b/i.test(e))return {k:/kills/i.test(e)?'kill':'choose',unsure:'minden játékos maga választ, az elemzés nem követi'};
  if(/\bdeals? damage equal to (?:its|their|my|that unit's|that card's) (?:Energy|Power) cost\b/i.test(e))return {k:'dmg',n:null,unsure:'a damage értéke egy költségtől függ, ezt az elemzés nem számolja'};
  if(/^\[Show Off\]/i.test(e))return {k:'showoff'};
  if(DELAY_RE.test(e)&&!/\bthis turn\b/i.test(e.replace(/at the end of this turn/i,'')))return r({k:'delayed',inner:actOf(e.replace(new RegExp(DELAY_RE.source,'gi'),'')).k});
  if((m=/\bcounter (?:a|an|that|it|the|any|target)?\b[^.]{0,50}?\b(spell|ability|abilities)/i.exec(e))||/^counter (?:it|that)\b/i.test(e))return {k:'counter',unless:/unless its controller pays/i.test(e)};
  if(/\byou control (?:it|that \w+|them) until\b/i.test(e))return {k:'ctrlUntil',until:/until I leave the board/i.test(e)?'src':'other'};
  if(/\b(?:gain|take)s? control of\b/i.test(e))return r({k:'control'});
  if(/\blose control of\b/i.test(e))return {k:'loseCtrl'};
  if(/\battach [^.]*\bor detach\b/i.test(e))return {k:'other',unsure:'attach vagy detach a játékos választása, állítsd be kézzel'};
  if(/\bdetach\b/i.test(e))return {k:'detach'};
  if(/\battach (?:this|it|that equipment|that gear|an equipment|a gear)\b[^.]* to\b/i.test(e)||/\battach this to\b/i.test(e))return {k:'attach',self:/\battach this\b/i.test(e)||/\battach it to (?:a|an)\b/i.test(e),toSelf:/\bto me\b/i.test(e)};
  if(/\[Add\]/.test(e))return {k:'add'};
  if(/\breturn[^.]{0,80}\bhands?\b/i.test(e))return {k:'hand'};
  if(/\bmove me to its location and it to my original location\b|\bmove each to the other's location\b/i.test(e))return {k:'swap'};
  if(/\bbanish\b/i.test(e)&&!/\bbanished\b/i.test(e.replace(/\bbanish\b/i,'')))return r({k:'banish'});
  if(/\b(?:its owner|you|they) plays? it\b/i.test(e))return {k:'replay',unsure:'az újra kijátszott lapot az elemzés nem követi tovább'};
  if(/\bkill\b/i.test(e)&&!/\bif (?:this|it) kills\b/i.test(e))return r({k:'kill'});
  if(/\brecall\b/i.test(e))return r({k:'recall'});
  if(/\bmove\b[^.]{0,60}\bto (?:its|their|your|his|her|my)? ?base\b|\bmove\b[^.]{0,60}\bback\b/i.test(e))return r({k:'base'});
  if((m=/\bdeals? (\d+)\b/i.exec(e))){if(/\bsplit\b/i.test(e))return {k:'dmg',n:+m[1],unsure:'a damage szétosztását (split) a játékos dönti el'};return r({k:'dmg',n:+m[1]});}
  if((m=/\bdeals? damage equal to (my|its|their|his|her|that unit's) Might/i.exec(e)))return r({k:'dmgM',who:/my|his|her/i.test(m[1])?'self':'linked',unsure:/\beach other\b|\bsplit\b/i.test(e)?'kölcsönös vagy szétosztott damage, az elemzés nem számolja':undefined});
  if(/\bmove\b/i.test(e))return r({k:'move'});
  if(/\[?\bstun\b\]?/i.test(e)&&!/\bstunned\b/i.test(e))return r({k:'stun'});
  if(/^buffs? give\b/i.test(e))return {k:'other',unsure:'buffok erősítése (folyamatos hatás), az elemzés nem számolja'};
  if(/\bbuff\b/i.test(e))return r({k:'buff'});
  if(/\bdouble\b[^.]*\bMight\b/i.test(e))return r({k:'double'});
  if((m=/\bgive[^.]*?\+\s*\[S\] equal to (?:its|their|that unit's) Might/i.exec(e)))return r({k:'mightEq'});
  if((m=/\b(?:give|gets?|has|have)\b[^.]*?([+-]\d+) \[S\]/i.exec(e))){const mn=/to a minimum of (\d+) \[S\]/i.exec(e);return r({k:'might',n:+m[1],min:mn?+mn[1]:null,self:/\bgive me\b|\bI (?:get|have)\b/i.test(e)});}
  if((m=/\bgive\b[^.]*\[(Assault|Shield|Tank|Backline|Ganking|Deflect|Temporary|Vision|Hidden)(?: (\d+))?\]/i.exec(e)))return r({k:'kw',kw:m[1],n:m[2]?+m[2]:null,self:/\bgive me\b/i.test(e)});
  if(/\bready (?:your |up to \d+ |\d+ )?(?:friendly )?runes?\b|\bready (?:your|their) runes\b/i.test(e))return r({k:'runes'});
  if(/^(?:you may )?ready\b|\bready (?:it|me|them|a|an|up to|that|your|all|each|another)\b/i.test(e))return r({k:'ready'});
  if(/^(?:you may )?exhaust\b|\bexhaust (?:it|me|them|a|an|up to|that|all|each|another)\b/i.test(e))return r({k:'exhaust'});
  if((m=/\bdraws? (\d+|a card|one)\b/i.exec(e)))return r({k:'draw',n:/^\d+$/.test(m[1])?+m[1]:1});
  if(/\bdraw (?:it|them|that card)\b/i.test(e))return r({k:'draw',n:1,pick:true});
  if((m=/\bchannels? (\d+) runes?\b/i.exec(e)))return r({k:'channel',n:+m[1]});
  if((m=/\bdiscards? (\d+|a card|one|that card)\b/i.exec(e)))return r({k:'discard',n:/^\d+$/.test(m[1])?+m[1]:1});
  if(/\b(?:play|create)s? (?:a|an|one|two|three|four|five|\d+)\b[^.]*\btokens?\b/i.test(e))return r({k:'token'});
  if(/\bheal\b/i.test(e))return r({k:'heal'});
  if(/\bdisempower\b/i.test(e))return {k:'disempower'};
  if(/\bempower (?:me|it|a|this)\b/i.test(e))return {k:'empower'};
  if((m=/\bscores? (\d+) points?\b/i.exec(e)))return r({k:'score',n:+m[1]});
  if((m=/\b(?:gains?|lose|loses|pay|spend)s? (\d+) XP\b/i.exec(e)))return r({k:'xp',n:+m[1]});
  if(/^\[(?:Predict|Burn)(?: \d+)?\]|\bpredict\b|\bburn \d+\b/i.test(e))return r({k:'deck'});
  if(/\b(?:look at|reveal)s? the top\b|\breveals? (?:their|your|his|her) hand\b|\brecycle\b|\bshuffle\b|\breveal (?:a|an|up to \w+|any number of)\b[^.]*\bfrom among\b/i.test(e))return r({k:'deck'});
  if(/^(?:you may )?pay \[|^(?:you may )?pay \d+|^(?:you may )?spend\b/i.test(e))return r({k:'pay'});
  if(/\byou may play\b|\bplay (?:it|that card|a unit|a spell|a card|a gear|them)\b/i.test(e))return {k:'playcard',unsure:'kijátszás egy másik zónából, az elemzés nem követi'};
  if(/^(?:you may )?choose (?:a|an|up to|another|any|two|three)\b/i.test(e))return {k:'choose'};
  if(/^(?:you may )?choose an? (?:opponent|player)\b/i.test(e))return {k:'choose'};
  return {k:'other'};
}

/** Feltételek, amelyeket az elemzés ténylegesen kiértékel. */
export const KNOWN_COND=/^if (?:you do|you played this from your hand|you paid the additional cost|it's an equipment|this kills|it dies)\b/i;
export const allScope=(eff:string)=>{const m=/\b(all|each) (other )?(friendly |enemy )?(units?|gear)\b([^.]{0,30})/i.exec(eff);if(!m||/\beach of\b/i.test(eff))return null;
  return {rel:(m[3]||'any').trim().toLowerCase()||'any',type:/gear/i.test(m[4])?'gear':'unit',here:/\bhere\b/i.test(m[5]),there:/\bthere\b/i.test(m[5]),atbf:/at (?:a |each )?battlefields?/i.test(m[5]),inbase:/\bin (?:a |their |your |its )?bases?\b/i.test(m[5]),other:!!m[2]};};
export function timingOf(c:any){
  const t=c.txt||'';const kw=(k:string)=>new RegExp('^\\['+k+'\\](?:\\s*\\(|\\s*$|\\s*\\[)','m').test(t);
  if(kw('Reaction')||kw('Quick-Draw'))return 'reaction';
  if(kw('Hidden'))return 'hidden';
  if(kw('Action'))return 'action';
  return c.t==='Spell'?'none':'perm';
}
export const isPermC=(c:any)=>c&&(c.t==='Unit'||c.t==='Gear');

/* "Így értelmezem a lapot": felülírható műveletek. */
export const OV_ACTS=[['kill','kill'],['dmg','damage N'],['base','move to base'],['move','move (cél a lépésnél)'],['hand','return to hand'],['banish','banish'],['recall','recall'],['stun','stun'],['buff','buff'],['might','Might módosítás N'],['ready','ready'],['exhaust','exhaust'],['control','gain control'],['attach','attach'],['detach','detach'],['draw','draw N'],['channel','channel N'],['discard','discard N'],['counter','counter'],['choose','választás (célpont kijelölése)'],['none','semmi'],['other','nem követett hatás']];
export const OV_LBL:any=Object.fromEntries(OV_ACTS);
export const OV_N=new Set(['dmg','draw','might','channel','discard']);
export function interp(s:any,inf:any){const eff=inf.eff||'';const list=inf.list||[];
  let INS=splitInstr(eff).map(t=>({t,n:phrasesTxt(t).length}));
  if(INS.reduce((x,y)=>x+y.n,0)!==list.length)INS=[{t:eff,n:list.length}];
  let k=0;return INS.map((x,xi)=>{const tis:number[]=[];for(let q=0;q<x.n;q++)tis.push(k++);
    const det=actOf(x.t);const dir=DIRECT_RE.test(x.t);const detLk=xi>0&&(dir||LINK_RE.test(x.t.replace(/\bits (?:own )?(?:base|location)\b/ig,'')));
    const ov=(s.ov&&s.ov[xi])||null;const act=ov&&ov.k?Object.assign({},det,{k:ov.k,n:ov.n!=null?ov.n:(det.n!=null?det.n:1)}):det;
    const lk=xi>0&&(ov&&ov.lk!=null?!!ov.lk:detLk);
    const unsure:string[]=[];if(!(ov&&ov.k)&&det.k==='other')unsure.push('a műveletet nem ismerem fel, az elemzés nem követi');
    if(!(ov&&ov.k)&&det.unsure)unsure.push(det.unsure);
    if(!(ov&&ov.lk!=null)&&detLk&&!dir)unsure.push('a linked kapcsolatot csak névmásból ("it", "its") következtetem');
    return {t:x.t,n:x.n,tis,det,act,lk,detLk,dir,manual:!!(ov&&(ov.k||ov.lk!=null)),unsure,st:'',ref:'',why:''};});}

/* ---------- Lépések ---------- */
export function srcCard(CS:any,src:string){if(!src)return null;if(src[0]==='L')return vsCard(CS.lg[src.slice(1)]);
  if(src[0]==='b'){const b=CS.bd[+src.slice(1)];return b?vsCard(b.n):null;}
  if(src[0]==='s'){const s=CS.steps[+src.slice(1)];return s&&s.k==='card'?vsCard(s.n):null;}return null;}
/** A forrásra csatolt gearek Effect Textje (136.2.c): a trigger listába ez is bekerül. */
function attachedEff(CS:any,src:string){if(!src||src[0]!=='b')return '';const i=+src.slice(1);return CS.bd.filter((g:any)=>g.on===i).map((g:any)=>{const c=vsCard(g.n);return c&&c.eff?c.eff:'';}).filter(Boolean).join('\n');}
export function stepInfo(CS:any,s:any){
  if(s.k==='tr'){const c=vsCard(s.n)||{n:s.n||'?',t:'',txt:''};const eff=stripRem(s.eff||'');return {c,eff,list:phrasesTxt(eff),trig:false,isTr:true,may:/^you may\b/i.test(eff)};}
  if(s.k==='tg'){const c=srcCard(CS,s.src);if(!c)return null;const tr=triggersOf(c,attachedEff(CS,s.src))[s.ti||0];if(!tr)return {c,tr:null,eff:'',list:[],isTg:true};
    let eff=tr.eff;let killSelf=false;const km=/^you may kill me to\s+/i.exec(eff);if(km){killSelf=true;eff=eff.slice(km[0].length);}
    return {c,tr,eff,list:phrasesTxt(eff),isTg:true,killSelf,may:/^you may\b/i.test(tr.eff)};}
  const c=vsCard(s.n);if(!c)return null;
  if(s.k==='ab'){const sc=srcCard(CS,s.src);const ab=abilitiesOf(sc)[s.ai||0];if(!ab)return {c,ab:null,eff:'',list:[],trig:false,isAb:true};
    return {c:sc,ab,eff:ab.eff,list:ab.add?[]:ab.equip?[{type:'unit',rel:'friendly',max:null,bf:false,opt:false}]:phrasesTxt(ab.eff),trig:false,isAb:true,may:/^you may\b/i.test(ab.eff)};}
  const cost=costOf(c);
  let pt=/(?:^|\n)\s*when you play (?:me|this)(?: or [^,.]*)?[,.]\s*([^\n]*)/i.exec(c.txt||'');
  let ptE=pt?stripRem(pt[1]):'';
  if(!pt&&/^\[Quick-Draw\]/m.test(c.txt||'')){ptE='Attach this to a unit you control.';pt=[ptE,ptE];}
  let cond=null;const cm=/^if you paid the additional cost,\s*/i.exec(ptE);if(cm){cond='paid';ptE=ptE.slice(cm[0].length);ptE=ptE[0].toUpperCase()+ptE.slice(1);}
  const e=c.t==='Spell'?effOf(c):ptE;
  return {c,eff:e,list:phrasesTxt(e),trig:!!pt,may:/^you may\b/i.test(e),cost,cond};
}

/* ---------- Elemzés ---------- */
const INS_ST:any={executed:'végrehajtódik',partial:'részben hajtódik végre',ignored:'Ignored',negated:'Negated',skipped:'nem hajtódik végre'};
const RES:any={ok:'lefutott',partial:'részben futott le',fizzle:'hatás nélkül',countered:'counterelve',removed:'lekerült a chainről'};
const art=(x:string)=>(/^[aáeéiíoóöőuúüű]/i.test(x)?'az ':'a ')+x;const Art=(x:string)=>{const s=art(x);return s[0].toUpperCase()+s.slice(1);};
const other=(p:string)=>p==='A'?'B':'A';const WHO:any={A:'te',B:'az ellenfél'};const WHOC:any={A:'Te',B:'Az ellenfél'};
const LOCK=(l:string)=>l==='base'?'base':l;

export type ChainResult={frames:any[];html:string;story:string[];done:any[];rows:[string,string][];ev:any[];objs:any;items:any[];delayed:any[];empty:boolean};

export function analyze(CS:any):ChainResult{
  const LOCS=()=>[['base','Base'],['bf0',(CS.bf[0].n||'1. battlefield')],['bf1',(CS.bf[1].n||'2. battlefield')]];
  const locLabel=(l:string)=>(LOCS().find(x=>x[0]===l)||['',l])[1];
  let MT:any=null;const MTIDS=new Set<string>();
  const S=CS.steps.map((s:any,j:number)=>{const inf=stepInfo(CS,s);return inf&&inf.c?Object.assign({},s,inf,{j,tg:(s.tg||[]).slice(),ext:s.ext||{}}):null;}).filter(Boolean);
  const POST=S.filter((s:any)=>s.k==='tr');const MAIN=S.filter((s:any)=>s.k!=='tr');
  const out:ChainResult={frames:[],html:'',story:[],done:[],rows:[],ev:[],objs:{},items:[],delayed:[],empty:false};
  if(!S.length){out.empty=true;out.html='<h2>Chain elemzés</h2><p class="note">Nem találok felismert kártyát vagy abilityt. Válassz a listából.</p>';return out;}
  let REC:any=null;let MAN=false;const ALL:[string,string][]=out.rows;const EV=out.ev;
  const line=(ref:string,txt:string,fl?:number)=>{const r=[...new Set(String(ref).split(',').map(r=>r.trim()).filter(Boolean))].join(', ');const p=plainOf(txt);if(REC)REC.push([r,p].concat(MAN?[1]:[]));ALL.push([r,p]);return lineH(r,txt,fl);};
  const lineH=(ref:string,txt:string,fl?:number)=>'<tr><td class="r">'+String(ref).split(',').filter(r=>r.trim()).map(r=>'<a href="#szabalyok" data-ref="'+r.trim()+'">'+r.trim()+'</a>').join('')+'</td><td>'+txt+'</td><td class="f">'+(fl!=null?'<span class="fl f'+fl+'" title="'+FLT[fl]+'">'+FL[fl]+'</span>':'')+'</td></tr>';
  const story=out.story;let rows='';let rr='';const notes:string[]=[];
  // ---- objektumok ----
  const O:any={};out.objs=O;
  const bfC=(n:string)=>{const c=vsCard(n);return c&&c.t==='Battlefield'?c:null;};const BF:any={bf0:{c:bfC(CS.bf[0].n),ctrl:CS.bf[0].c},bf1:{c:bfC(CS.bf[1].n),ctrl:CS.bf[1].c}};
  const onB=(id:string)=>!!O[id]&&O[id].zone==='board';
  /** Aktuális Might (layer-egyszerűsítés): nyomtatott vagy megadott + buff + csatolt gear Might bonus + "this turn" módosítók + ismert statikus hatások. Nem boardon: null (359.3.e.12). */
  const mightOf=(id:string):number|null=>{const ob=O[id];if(!ob||ob.m==null||ob.zone!=='board')return null;let m=ob.m+(ob.bu?1:0);
    Object.values(O).forEach((g:any)=>{if(g.on===id&&g.zone==='board'&&g.card&&g.card.m)m+=+g.card.m;});
    const t=(ob.card&&ob.card.txt)||'';let x;
    if((x=/while there's a stunned enemy unit here, I have \+(\d+) \[S\]/i.exec(t))&&Object.values(O).some((u:any)=>u.zone==='board'&&u.type==='unit'&&u.st&&u.ctrl!==ob.ctrl&&u.loc===ob.loc))m+=+x[1];
    if((x=/^\[Empowered\]\[>\]\s*I have \+(\d+) \[S\]/m.exec(t))&&ob.emp)m+=+x[1];
    (ob.mods||[]).forEach((md:any)=>{m=m+md.n;if(md.min!=null&&md.n<0)m=Math.max(m,md.min);if(md.dbl)m=m+Math.max(0,m);});
    return m;};
  const lethal=(id:string)=>{const ob=O[id];if(!onB(id)||ob.type!=='unit')return false;const m=mightOf(id);return m!=null&&ob.dmg>0&&ob.dmg>=m;};
  CS.bd.forEach((b:any,i:number)=>{const c=vsCard(b.n);if(!c)return;O['b'+i]={id:'b'+i,name:c.n,card:c,ctrl:b.pl,own:b.pl,loc:b.loc,baseOf:b.pl,m:c.t==='Unit'?(b.m!=null?b.m:(c.m!=null?+c.m:null)):null,dmg:b.d||0,ex:!!b.ex,st:!!b.st,bu:!!b.bu,mods:[],kws:[],zone:'board',type:c.t.toLowerCase()==='unit'?'unit':c.t==='Gear'?'gear':c.t.toLowerCase(),board:true};});
  CS.bd.forEach((b:any,i:number)=>{if(O['b'+i]&&b.on!=null&&O['b'+b.on]&&O['b'+i].type==='gear'){O['b'+i].on='b'+b.on;O['b'+i].loc=O['b'+b.on].loc;}});
  ['A','B'].forEach(p=>{const c=vsCard(CS.lg[p]);if(c)O['L'+p]={id:'L'+p,name:c.n,card:c,ctrl:p,own:p,zone:'legend',type:'legend',emp:false,ex:false};});
  const cnt:any={};S.forEach((s:any)=>cnt[s.c.n]=(cnt[s.c.n]||0)+1);
  MAIN.forEach((s:any)=>{const j=s.j;const c=s.c;if(s.k==='ab'||s.k==='tg')return;
    const nmx=c.n+(cnt[c.n]>1?' ('+(j+1)+'.)':'');
    if(isPermC(c))O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,loc:s.loc||(s.from==='facedown'?'bf0':'base'),baseOf:s.pl,m:c.t==='Unit'&&c.m!=null?+c.m:null,dmg:0,mods:[],kws:[],zone:'pending',type:c.t==='Unit'?'unit':'gear'};
    else O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,zone:'pending',type:'spell'};});
  S.forEach((s:any)=>{const c=s.c;const j=s.j;
    s.tg=s.tg.map((v:string,ti:number)=>{if(v!=='x')return v;const p=s.list[ti];if(!p)return '';const e=s.ext[ti]||{};const id='t'+j+'_'+ti;
      const ctrl=e.pl||(p.rel==='enemy'?other(s.pl):p.rel==='friendly'?s.pl:null);
      O[id]={id,name:c.n+' célpontja ('+(ctrl==='A'?'a te '+p.type+'od':ctrl==='B'?'az ellenfél '+p.type+'ja':p.type)+')',ctrl,own:ctrl,baseOf:ctrl,loc:e.loc||'bf0',m:e.m!=null?e.m:null,dmg:0,mods:[],kws:[],zone:'board',type:p.type};return id;});
    if(s.cost&&s.costTg==='x'){}});
  const nm=(id:string)=>id==='F0'?locLabel('bf0'):id==='F1'?locLabel('bf1'):O[id]?O[id].name:id;
  // ---- frame-ek ----
  const FR=out.frames;REC=[];
  const pside=(p:string)=>p==='A'?'me':p==='B'?'opp':null;
  const itemName=(it:any)=>it.label;
  const DET=new Set<string>();const NEWCTRL=new Set<string>();
  const snap=(label:string,items:any[])=>{
    const vis=(items||[]).filter((it:any)=>!(it.objId&&O[it.objId]&&O[it.objId].zone==='countered')).slice().reverse();
    const mk=()=>({base:[],trash:[],banish:[],hand:[]});const side:any={A:mk(),B:mk()};const bfs=[0,1].map(i=>({name:CS.bf[i].n||(i+1)+'. battlefield',ctrl:pside(BF['bf'+i].ctrl),me:[],opp:[],i}));
    const shown=new Set<string>();
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='unit'&&ob.type!=='gear')return;const p=ob.ctrl==='B'?'B':'A';
      if(ob.zone!=='board'){const nmC=ob.card?ob.card.n:ob.name;const op=ob.own==='B'?'B':'A';if(ob.zone==='trash')side[op].trash.push(nmC);else if(ob.zone==='banish')side[op].banish.push(nmC);else if(ob.zone==='hand')side[op].hand.push(nmC);return;}
      if(ob.type==='gear'&&ob.on&&onB(ob.on))return;
      const mt=ob.type==='unit'?mightOf(id):null;const st:string[]=[];
      if(ob.st)st.push('stunned');if(ob.bu)st.push('buffed');if(ob.emp)st.push('empowered');if(ob.type==='unit'&&lethal(id))st.push('dying');if(MTIDS.has(id))st.push('mistarget');
      if(DET.has(id))st.push('detached');if(ob.ctrl&&ob.own&&ob.ctrl!==ob.own)st.push(NEWCTRL.has(id)?'ctrlnew':'ctrl');
      (ob.kws||[]).forEach((k:string)=>st.push('kw:'+k));
      const gear=Object.values(O).filter((g:any)=>g.on===id&&g.zone==='board').map((g:any)=>g.card?g.card.n:g.name);
      const u:any={id,n:ob.card?ob.card.n:ob.name,m:mt!=null?mt:0,dmg:ob.dmg||0,ex:!!ob.ex,gear,status:st};
      if(ob.type==='gear'){u.kind='gear';u.base=0;u.m=0;}
      if(ob.type==='unit'&&mt==null){u.base=0;u.mods=['Might ismeretlen'];}
      if(ob.card&&/token/i.test((ob.card.st||[]).join(' ')+' '+(ob.card.tg||[]).join(' ')))u.token=true;
      shown.add(id);
      if(ob.loc==='base'){const bp=ob.baseOf==='B'?'B':ob.baseOf==='A'?'A':p;side[bp].base.push(Object.assign(u,bp!==p?{tag:'idegen base'}:{}));}else{const f=bfs[ob.loc==='bf1'?1:0];(p==='A'?f.me:f.opp).push(u);}});
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='spell')return;const p=ob.own==='B'?'B':'A';if(ob.zone==='trash'||ob.zone==='countered')side[p].trash.push(ob.card.n);});
    const used=bfs.filter(f=>CS.bf[f.i].n||f.me.length||f.opp.length);const bfPos=(i:number)=>used.findIndex(f=>f.i===i);
    const arrows:any[]=[];
    vis.forEach((it:any,ci:number)=>{(it.list||[]).forEach((p:any,ti:number)=>{const v=(it.tg||[])[ti];if(!v)return;
      if(v==='F0'||v==='F1'){const k=bfPos(+v[1]);if(k>=0)arrows.push({from:ci,to:'bf:'+k});return;}
      const ob=O[v];if(!ob)return;
      if(ob.type==='spell'){const k=vis.findIndex((x:any)=>x.objId===v);if(k>=0)arrows.push({from:ci,to:'c:'+k});return;}
      if(shown.has(v))arrows.push({from:ci,to:'u:'+v});else if(ob.type==='gear'&&ob.on&&shown.has(ob.on))arrows.push({from:ci,to:'u:'+ob.on});});});
    const lg=(p:string)=>O['L'+p]?O['L'+p].card.n:undefined;
    const ps=(p:string)=>({legend:lg(p),legendEx:!!(O['L'+p]&&O['L'+p].ex),base:side[p].base,hand:side[p].hand,trash:side[p].trash,banish:side[p].banish});
    FR.push({label,board:{me:ps('A'),opp:ps('B'),bfs:used.map(({i,...f})=>f),chain:vis.map(itemName)},changes:REC||[],arrows,bfi:used.map(f=>f.i),mt:MT});REC=[];MT=null;MTIDS.clear();DET.clear();NEWCTRL.clear();};
  // battlefield állandó hatások
  ['bf0','bf1'].forEach(l=>{const b=BF[l];if(b.c){const known=/can.t move from here to base|can.t be played here/i.test(b.c.txt||'');notes.push(line('169',esc(b.c.n)+' ('+(b.ctrl==='A'?'te irányítod':b.ctrl==='B'?'az ellenfél irányítja':'senki nem irányítja')+'): '+esc(stripRem(b.c.txt))+(known?' <b>Ezt az állandó hatást az elemzés figyelembe veszi.</b>':' Ezt a hatást az elemzés nem értékeli ki, ha számít, vedd figyelembe.'),known?0:1));}});
  ALL.length=0;
  const bfBlocksBase=(l:string)=>BF[l]&&BF[l].c&&/can.t move from here to base/i.test(BF[l].c.txt||'');
  const bfBlocksPlay=(l:string)=>BF[l]&&BF[l].c&&/can.t be played here/i.test(BF[l].c.txt||'');
  const chain:any[]=[];let stack:any[]=[];
  /* Egyszerre triggerelő abilityk (383.3.d, 383.3.d.1): előbb gyűjtjük, majd a turn player teszi fel a sajátjait, utána a többiek; azonos controllernél a sorrendet a controller választja. */
  const TP=CS.turn==='A'||CS.turn==='B'?CS.turn:(MAIN[0]?(MAIN[0].k==='tg'?((CS.bd[+String(MAIN[0].src||'').slice(1)]||{}).pl||MAIN[0].pl||'A'):MAIN[0].pl):'A');
  const PEND:any[]=[];const DIED:string[]=[];
  const pushTrig=(t:any)=>{PEND.push(t);};
  /** "When another (non-X) unit you control dies" és társai (383.2.c.2: a forrásnak a boardon kell maradnia). Amit nem ismer fel, azt kiírja. */
  const deathWatch=()=>{if(!DIED.length)return;const died=DIED.splice(0);const unk=new Set<string>();
    Object.keys(O).forEach(wid=>{const W=O[wid];if(!W.card||!(W.zone==='board'||W.zone==='legend'))return;
      (W.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{const l2=l.replace(/^once each turn,\s*/i,'');
        if(!/^(?:when|whenever)\b[^,]*\bdies?\b/i.test(l2)||/^when I die\b/i.test(l2))return;
        const m=/^(?:when|whenever) (another|a|an) (?:non-([A-Za-z]+) )?(friendly |enemy )?units? (you control |an opponent controls )?dies,\s*(.*)$/i.exec(l2);
        if(!m){unk.add(W.name+': "'+l2+'"');return;}
        died.forEach(did=>{const D=O[did];if(!D||D.type!=='unit')return;if(/another/i.test(m[1])&&did===wid)return;
          if(m[2]&&((D.card&&(D.card.n+' '+(D.card.tg||[]).join(' ')).toLowerCase().includes(m[2].toLowerCase()))))return;
          const dc=(D.lk&&D.lk.ctrl)||D.own;const fr=/friendly/i.test(m[3]||'')||/you control/i.test(m[4]||'');const en=/enemy/i.test(m[3]||'')||/opponent/i.test(m[4]||'');
          if(fr&&dc!==W.ctrl)return;if(en&&dc===W.ctrl)return;
          pushTrig({kind:'auto',label:W.name+' triggere ('+D.name+' meghalt)',name:W.name+' triggere',src:wid,pl:W.ctrl,eff:m[5],why:'"'+l2.split(',')[0]+'"',list:[],tg:[]});
          rr+=line('383, 383.2.c.2','<b>'+esc(W.name)+'</b> triggerel, mert '+esc(D.name)+' meghalt, és '+esc(W.name)+' a boardon maradt.',0);story.push(Art(W.name)+' triggerel, mert '+D.name+' meghalt.');});});});
    unk.forEach(u=>{rr+=line('383','<span class="cbuns">nem követett</span> Halálra figyelő trigger, amelyet az elemzés nem ismer fel: '+esc(u)+'. Ha teljesül, vedd fel kézzel ("Trigger a chainre").',1);});};
  const flushPend=(target:any[])=>{deathWatch();if(!PEND.length)return;const list=PEND.splice(0);
    const byP=(p:string)=>list.filter((t:any)=>(t.pl||'A')===p);const ordered=byP(TP).concat(byP(other(TP)));
    const ctrls=[...new Set(list.map((t:any)=>t.pl||'A'))];
    if(ctrls.length>1){const L=line('383.3.d.1','Egyszerre triggerelt: '+ordered.map((t:any)=>esc(t.label)).join(', ')+'. Először a turn player ('+WHO[TP]+') teszi fel a sajátjait, utána '+WHO[other(TP)]+'; ami később kerül fel, az resolve-ol előbb.',0);rows+=L;rr+=L;}
    ctrls.forEach((p:any)=>{const own=byP(p);if(own.length>1){const L=line('383.3.d','Egyszerre triggerelt, azonos controller ('+WHO[p]+'): '+own.map((t:any)=>esc(t.label)).join(', ')+'. A sorrendet '+WHO[p]+' választja; az elemzés a felsorolt sorrendben teszi fel (az utolsó resolve-ol először).',1);rows+=L;rr+=L;}});
    ordered.forEach((t:any)=>target.push(t));};
  /* ---- zónaváltás, triggerek, kontroll ---- */
  /** Kontrollváltás (191): a lap az új irányítóhoz kerül a Playmaton; "until" esetén a forrás távozásakor visszaáll (391.5.b). */
  const setCtrl=(id:string,to:string,ref:string,why:string,until?:string)=>{const ob=O[id];if(!ob||!to||ob.ctrl===to)return false;const from=ob.ctrl;ob.ctrl=to;if(ob.loc==='base')ob.baseOf=ob.baseOf||from;
    if(until)ob.until={src:until,prev:from};NEWCTRL.add(id);EV.push({k:'ctrl',id,name:ob.name,from,to});
    Object.values(O).forEach((g:any)=>{if(g.on===id&&g.zone==='board'){}});
    REC.push([ref,ob.name+': az irányítója '+(from==='A'?'te':'az ellenfél')+' helyett '+(to==='A'?'te':'az ellenfél')+' lesz'+(why?' ('+why+')':'')+'. A Playmaton átkerül a másik oldalra.']);ALL.push(REC[REC.length-1]);return true;};
  const leaveTrigs=(id:string,dk:boolean)=>{const ob=O[id];if(!ob||!ob.card)return;const t=ob.card.txt||'';const lst:any[]=[];
    triggersOf(ob.card).forEach((tr:any)=>{
      if(dk&&(tr.dk||/^when I die\b(?! in combat)/i.test(tr.why)))lst.push([tr,'808.1.d.2, 429.1.a.1.b']);
      else if(/^when (?:I|this) leaves? the board\b|^when I leave the board\b/i.test(tr.why))lst.push([tr,'383.2.c.3']);});
    lst.forEach(([tr,ref])=>{pushTrig({kind:'auto',label:ob.name+' triggere ('+(tr.dk?'Deathknell':tr.why)+')',name:ob.name+' triggere',sent:true,src:id,pl:ob.ctrl,eff:tr.eff,why:tr.dk?'Deathknell':tr.why,list:[],tg:[],lk:{loc:ob.loc}});
      rr+=line(ref,'<b>'+esc(ob.name)+'</b> triggere ('+esc(tr.dk?'Deathknell':tr.why)+') a chainre kerül, mielőtt a lap elhagyja a boardot. A helyét és adatait a játék feljegyzi (383.2.c.3.b).',0);story.push(Art(ob.name)+' triggere ('+(tr.dk?'Deathknell':tr.why)+') a chainre kerül.');});
    void t;};
  /** Lap távozása a boardról: csatolt gear leválik (719.5), a "until I leave the board" kontroll megszűnik (391.5.b), a kontroll visszaáll a tulajdonosra. */
  const leaveBoard=(id:string,zone:string)=>{const ob=O[id];const was=ob.zone==='board';ob.lk={m:mightOf(id),ctrl:ob.ctrl,loc:ob.loc};ob.zone=zone;
    if(zone!=='board'){ob.dmg=0;ob.mods=[];ob.kws=[];ob.st=false;ob.bu=false;if(ob.on){ob.on=null;}ob.ctrl=ob.own;ob.until=null;}
    EV.push({k:'zone',id,name:ob.name,to:zone});
    if(!was)return;
    Object.keys(O).forEach(k=>{const g=O[k];if(g.on===id&&g.zone==='board'){g.on=null;g.loc=ob.lk.loc;DET.add(k);EV.push({k:'detach',id:k,name:g.name,from:id});
      REC.push(['719.5, 436.4',g.name+' leválik '+ob.name+' lapról, és a helyén marad ('+locLabel(g.loc)+').'+(g.loc!=='base'?' Battlefielden álló, csatolatlan gear: a következő cleanupban recall-olódik (436.4.a, 323.6).':'')]);ALL.push(REC[REC.length-1]);
      story.push(Art(g.name)+' leválik '+art(ob.name)+' lapról'+(g.loc!=='base'?', és a következő cleanupban a base-be kerül':'')+'.');}});
    Object.keys(O).forEach(k=>{const g=O[k];if(g.until&&g.until.src===id&&g.zone==='board'){const prev=g.until.prev;g.until=null;setCtrl(k,prev,'391.5.b, 391.5.a',ob.name+' elhagyta a boardot, a "until I leave the board" kontroll véget ért');story.push(Art(g.name)+' irányítása visszakerül, mert '+ob.name+' elhagyta a boardot.');}});};
  /** Replacement a halál helyett (367, 369.1): saját "If I would die", csatolt gear Effect Textje (Guardian Angel), vagy friendly gear "If a friendly unit would die, kill this instead" (Zhonya's Hourglass). */
  const deathRepl=(id:string)=>{const ob=O[id];if(!ob||ob.type!=='unit')return null;
    if(ob.card&&/\bif I would die\b/i.test(ob.card.txt||''))return {by:id,txt:stripRem((/[^\n]*if I would die[^\n]*/i.exec(ob.card.txt)||[''])[0]),self:true};
    const ga=Object.values(O).find((g:any)=>g.on===id&&g.zone==='board'&&g.card&&/\bif I would die\b/i.test(g.card.eff||''));if(ga)return {by:ga.id,txt:ga.card.eff};
    const zh=Object.values(O).find((g:any)=>g.zone==='board'&&g.id!==id&&!g.on&&g.ctrl===ob.ctrl&&g.card&&/\bif a friendly unit would die, kill this instead\b/i.test(g.card.txt||''));if(zh)return {by:zh.id,txt:stripRem((/[^\n]*would die[^\n]*/i.exec(zh.card.txt)||[''])[0])};
    return null;};
  /** Kill (429): replacement esetén Negated (359.3.e.14.b), Deathknell nem fut (808.1.d.1). */
  const killObj=(id:string,why:string,parts:string[],refs:string[],srcName?:string):'ok'|'neg'=>{const ob=O[id];const rp=deathRepl(id);
    if(rp){EV.push({k:'replace',id,name:ob.name,by:rp.by});refs.push('367','369.1');
      if(rp.self){parts.push(esc(ob.name)+' meghalna, de a saját replacement effectje mást hajt végre helyette (367): "'+esc(rp.txt)+'". Ezt az elemzés nem követi tovább.');story.push(Art(ob.name)+' meghalna, de a saját replacement effectje helyettesíti a halált.');return 'neg';}
      const hasDK=triggersOf(ob.card).some((t:any)=>t.dk||/^when I die\b/i.test(t.why));
      const by=O[rp.by];parts.push(esc(ob.name)+' meghalna, de '+esc(by.name)+' replacement effectje helyettesíti: "'+esc(rp.txt)+'". '+esc(by.name)+' a trashbe kerül, '+esc(ob.name)+' meggyógyul, exhausted lesz és a base-be recall-olódik (457).'+(hasDK?' A halálra triggerelő abilityje a chainre kerülne (808.1.d.2), de mivel a lap nem került a trashbe, lekerül (808.1.d.1).':''));refs.push('457');if(hasDK)refs.push('808.1.d.1','808.1.d.2');
      story.push(Art(ob.name)+' meghalna, de '+art(by.name)+' megmenti: '+by.name+' a trashbe kerül, '+ob.name+' gyógyulva, exhausted állapotban a base-be kerül.');
      leaveTrigs(rp.by,false);leaveBoard(rp.by,'trash');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;EV.push({k:'recall',id,name:ob.name});return 'neg';}
    if(srcName)story.push(Art(srcName)+' lefut: '+ob.name+' meghal.');
    leaveTrigs(id,true);leaveBoard(id,'trash');if(ob.type==='unit')DIED.push(id);parts.push(esc(ob.name)+' meghal, a tulajdonosa trashébe kerül'+(why?' ('+why+')':'')+'.');refs.push('429');return 'ok';};
  const moveObj=(id:string,to:string,parts:string[],refs:string[],srcName:string,toBase?:string)=>{const ob=O[id];const from=ob.loc;const nb=toBase||ob.ctrl;
    if(from===to&&(to!=='base'||ob.baseOf===nb)){parts.push(esc(ob.name)+' már ott van ('+esc(locLabel(to))+'), nincs mozgás.');return 'neg';}
    if(to==='base'&&from!=='base'&&bfBlocksBase(from)){parts.push(esc(ob.name)+' nem mozoghat a base-be, mert '+esc(locLabel(from))+' tiltja: a mozgás Negated (358.3.a, 359.3.e.6).');refs.push('358.3.a','359.3.e.6');story.push(Art(ob.name)+' a base-be mozogna, de '+locLabel(from)+' ezt tiltja, így a helyén marad.');return 'neg';}
    ob.loc=to;if(to==='base')ob.baseOf=nb;EV.push({k:'move',id,name:ob.name,from,to,baseOf:to==='base'?nb:undefined});refs.push('421');
    Object.values(O).forEach((g:any)=>{if(g.on===id)g.loc=to;});
    const bTxt=to==='base'&&nb!==ob.ctrl?(nb==='A'?'a te base-edbe':'az ellenfél base-ébe'):to==='base'?'a base-be':locLabel(to);
    parts.push(esc(ob.name)+' mozog: '+esc(locLabel(from))+' → '+esc(bTxt)+'.');story.push(Art(srcName)+' lefut: '+ob.name+' '+(to==='base'?bTxt.replace(/^a /,'a ')+' mozog':'ide mozog: '+locLabel(to))+'.');
    const tr=triggersOf(ob.card).find((t:any)=>/^when I move\b/i.test(t.why));if(tr){pushTrig({kind:'auto',label:ob.name+' triggere ("When I move")',name:ob.name+' triggere',src:id,pl:ob.ctrl,eff:tr.eff,why:'"When I move"',list:[],tg:[]});rr+=line('383','<b>'+esc(ob.name)+'</b> triggerel ("'+esc(tr.why)+'"), a chainre kerül.',1);}
    return 'ok';};
  const bonusDmg=(pl:string)=>Object.values(O).reduce((a:number,o:any)=>{if(o.zone!=='board'||o.ctrl!==pl||!o.card)return a;const m=/your spells and abilities deal (\d+) bonus damage/i.exec(o.card.txt||'');return a+(m?+m[1]:0);},0);
  /** Egy művelet végrehajtása egy célponton. Visszatérés: 'neg' ha a game action nem történik meg (Negated). */
  const applyTo=(v:string,act:any,it:any,parts:string[],refs:string[]):string|void=>{const ob=O[v];const srcName=it.name;
    switch(act.k){
    case 'counter':ob.zone='countered';EV.push({k:'counter',id:v,name:ob.name});parts.push(esc(ob.name)+' counterelve.');refs.push('426.1');story.push(Art(srcName)+' countereli '+art(ob.name)+' lapot.');return;
    case 'kill':{const r=killObj(v,'',parts,refs,srcName);return r==='neg'?'neg':undefined;}
    case 'hand':case 'banish':story.push(Art(srcName)+' lefut: '+ob.name+' '+(act.k==='hand'?'a tulajdonosa kezébe kerül':'banishelődik')+'.');leaveTrigs(v,false);leaveBoard(v,act.k);parts.push(esc(ob.name)+' '+(act.k==='hand'?'a tulajdonosa kezébe kerül (056.2)':'banishelődik')+'.');refs.push(act.k==='hand'?'056.2':'428');return;
    case 'recall':{if(ob.loc==='base'&&ob.baseOf===ob.ctrl){parts.push(esc(ob.name)+' már a base-ben van.');return 'neg';}ob.loc='base';ob.baseOf=ob.ctrl;Object.values(O).forEach((g:any)=>{if(g.on===v)g.loc='base';});EV.push({k:'recall',id:v,name:ob.name});parts.push(esc(ob.name)+' visszakerül a base-be (recall, nem Move, 457).');refs.push('457');story.push(Art(srcName)+' lefut: '+ob.name+' recall-olódik a base-be.');return;}
    case 'base':return moveObj(v,'base',parts,refs,srcName,/\bto your base\b/i.test(act.t||'')?it.pl:undefined);
    case 'move':return moveObj(v,it.dest||'base',parts,refs,srcName);
    case 'dmg':case 'dmgM':{let n=act.k==='dmg'?act.n:null;
      if(act.k==='dmgM'){const sid=act.who==='self'?it.src:null;n=sid?mightOf(sid):null;if(n==null){parts.push(esc(ob.name)+': a damage a forrás Mightjától függ, de a forrás már nincs a boardon, így az érték null, az utasítás Ignored (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}}
      const b=bonusDmg(it.pl);if(b)refs.push('715.1');const tot=n+b;ob.dmg+=tot;const mt=mightOf(v);EV.push({k:'dmg',id:v,name:ob.name,n:tot});
      parts.push(esc(ob.name)+' '+tot+' damage-et kap'+(b?' ('+n+' + '+b+' Bonus Damage)':'')+(mt!=null?' (Might '+mt+', összesen '+ob.dmg+' damage)':'')+'.');refs.push('418');
      if(mt!=null&&ob.dmg>=mt){parts.push('Lethal damage: a következő cleanupban meghal (142.4.b, 323.4).');refs.push('142.4.b');story.push(Art(srcName)+' '+tot+' damage-et oszt '+art(ob.name)+' lapra. Ez eléri a Mightját ('+mt+'), ezért a cleanupban meghal.');}
      else story.push(Art(srcName)+' '+tot+' damage-et oszt '+art(ob.name)+' lapra'+(mt==null?'. A Mightja nincs megadva, ezért nem tudni, túléli-e.':', ami túléli ('+ob.dmg+' damage, '+mt+' Might).'));return;}
    case 'stun':if(ob.st){parts.push(esc(ob.name)+' már Stunned, nem stunolható újra: az utasítás Negated (424.1.a.1).');refs.push('424.1.a.1');return 'neg';}ob.st=true;EV.push({k:'stun',id:v,name:ob.name});parts.push(esc(ob.name)+' Stunned lesz (424).');refs.push('424');story.push(Art(srcName)+' lefut: '+ob.name+' Stunned lesz.');return;
    case 'buff':if(ob.bu){parts.push(esc(ob.name)+' már buffolt, nem kap újabbat: a buff nem kerül fel, az utasítás Negated (427.1.b.1, 427.1.c).');story.push(Art(ob.name)+' már buffolt, így nem történik semmi.');refs.push('427.1.b.1','427.1.c');return 'neg';}ob.bu=true;EV.push({k:'buff',id:v,name:ob.name});parts.push(esc(ob.name)+' +1 Might buffot kap (427, 703).');refs.push('427','703');story.push(Art(srcName)+' lefut: '+ob.name+' +1 Might buffot kap.');return;
    case 'might':case 'mightEq':case 'double':{let n=act.n;if(act.k==='mightEq'){n=it.lkMight!=null?it.lkMight:null;if(n==null){parts.push(esc(ob.name)+': a Might értéke a korábbi célponttól függ, ami nem elérhető, ezért Ignored (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}}
      const before=mightOf(v);if(act.k==='double'){ob.mods.push({n:Math.max(0,before||0)});refs.push('433');}else ob.mods.push({n,min:act.min});const after=mightOf(v);EV.push({k:'might',id:v,name:ob.name,from:before,to:after});
      parts.push(esc(ob.name)+' Mightja '+before+' → '+after+' (ebben a körben'+(act.min!=null?', minimum '+act.min:'')+').');story.push(Art(srcName)+' lefut: '+ob.name+' Mightja '+before+' helyett '+after+'.');
      if(lethal(v)){parts.push('A már rajta lévő damage így lethal: a következő cleanupban meghal (142.4.b).');refs.push('142.4.b');}return;}
    case 'kw':ob.kws.push(act.kw+(act.n?' '+act.n:''));EV.push({k:'kw',id:v,name:ob.name,kw:act.kw});parts.push(esc(ob.name)+' megkapja: ['+esc(act.kw+(act.n?' '+act.n:''))+'] (ebben a körben).');story.push(Art(srcName)+' lefut: '+ob.name+' ['+act.kw+(act.n?' '+act.n:'')+'] keywordöt kap.');return;
    case 'ready':if(!ob.ex){parts.push(esc(ob.name)+' már ready, nem readyzhető újra (416.1.b, 416.1.c): a game action nem hajtható végre, az utasítás Negated (359.3.e.6).');refs.push('416.1.b','416.1.c');return 'neg';}ob.ex=false;EV.push({k:'ready',id:v,name:ob.name});parts.push(esc(ob.name)+' ready lesz (416).');refs.push('416');story.push(Art(srcName)+' lefut: '+ob.name+' ready lesz.');return;
    case 'exhaust':if(ob.ex){parts.push(esc(ob.name)+' már exhausted, nem exhaustolható újra (415.1.b, 415.1.c): a game action nem hajtható végre, az utasítás Negated (359.3.e.6).');refs.push('415.1.b','415.1.c');return 'neg';}ob.ex=true;EV.push({k:'exhaust',id:v,name:ob.name});parts.push(esc(ob.name)+' exhausted lesz (415).');refs.push('415');story.push(Art(srcName)+' lefut: '+ob.name+' exhausted lesz.');return;
    case 'heal':ob.dmg=0;EV.push({k:'heal',id:v,name:ob.name});parts.push(esc(ob.name)+' meggyógyul (419).');refs.push('419');return;
    case 'control':{const ok=setCtrl(v,it.pl,'191','a kontroll a resolve-kor változik');if(!ok){parts.push(esc(ob.name)+' irányítója már '+WHO[it.pl]+'.');return 'neg';}
      parts.push(esc(ob.name)+' irányítását '+WHO[it.pl]+' szerzi meg (a resolve-kor).');story.push(Art(srcName)+' lefut: '+ob.name+' irányítását '+WHO[it.pl]+' veszi át.');return;}
    case 'ctrlUntil':{if(act.until==='src'&&!(it.src&&onB(it.src))){parts.push('"'+esc(act.t||'')+'": a forrás már nincs a boardon, így a delayed kontroll nem jön létre, a lap irányítója nem változik, egy pillanatra sem (359.3.e.16).');refs.push('359.3.e.16');return 'ign';}
      const ok=setCtrl(v,it.pl,'391.5.b, 391.5.a','addig, amíg '+(it.src&&O[it.src]?O[it.src].name:'a forrás')+' a boardon van',act.until==='src'?it.src:undefined);if(ok){parts.push(esc(ob.name)+' irányítója '+WHO[it.pl]+' lesz, amíg '+esc(it.src&&O[it.src]?O[it.src].name:'a forrás')+' a boardon van (391.5.b).');story.push(WHOC[it.pl]+' irányítja '+art(ob.name)+' lapot, amíg '+(it.src&&O[it.src]?O[it.src].name:'a forrás')+' a boardon van.');}return;}
    case 'attach':{let gear=v,unit=it.src;if(act.self){gear=it.src;unit=v;}
      if(act.toSelf&&!(it.src&&onB(it.src))){parts.push('A csatolás célja ("me") már nincs a boardon: az információ nem elérhető, az utasítás Ignored (359.3.e.6).');refs.push('359.3.e.6');return 'ign';}
      const G=O[gear],U=O[unit];if(!G||!U||G.type!=='gear'||U.type!=='unit'||!onB(gear)||!onB(unit)){parts.push('A csatolás nem hajtható végre.');return 'neg';}
      if(!(G.card&&(G.card.tg||[]).includes('Equipment'))){parts.push(esc(G.name)+' nem Equipment, ezért nem csatolódik.');return 'neg';}
      if(G.on===unit){parts.push(esc(G.name)+' már ezen a uniton van, a csatolásnak nincs hatása (435.1.g, 435.1.i); az elemzés ezt Negated-nek veszi (levezetés, a 416.1.b és 415.1.b mintájára).');refs.push('435.1.g','435.1.i');it.flL=true;return 'neg';}
      G.on=unit;G.loc=U.loc;EV.push({k:'attach',id:gear,name:G.name,to:unit});parts.push('Felcsatolva: '+esc(G.name)+' → '+esc(U.name)+', a unit megkapja a Might bónuszát'+(G.card.eff?' és Effect Textjét':'')+' (435.1.c, 435.1.d).');refs.push('435','435.4');story.push(Art(G.name)+' felcsatolódik '+art(U.name)+' lapra.');return;}
    case 'detach':{const gs=ob.type==='gear'?[ob]:Object.values(O).filter((g:any)=>g.on===v&&g.zone==='board');if(!gs.length){parts.push(esc(ob.name)+': nincs leválasztható gear (436.1.a.1).');refs.push('436.1.a.1');return 'neg';}
      const g=gs[0];const top=O[g.on];if(!top){parts.push(esc(g.name)+' nincs csatolva (436.1.a.1).');refs.push('436.1.a.1');return 'neg';}g.on=null;g.loc=top.loc;DET.add(g.id);EV.push({k:'detach',id:g.id,name:g.name,from:top.id});
      parts.push(esc(g.name)+' leválik '+esc(top.name)+' lapról, a helye '+esc(locLabel(g.loc))+' (436.4)'+(g.loc!=='base'?'; battlefielden csatolatlan gear a következő cleanupban recall-olódik (436.4.a)':'')+'.');refs.push('436.4');story.push(Art(g.name)+' leválik '+art(top.name)+' lapról.');return;}
    case 'empower':ob.emp=true;EV.push({k:'empower',id:v,name:ob.name});parts.push(esc(ob.name)+' Empowered lesz (442).');refs.push('442');story.push(Art(ob.name)+' Empowered lesz.');return;
    case 'swap':{const me=O[it.src];if(!me||!onB(it.src)){parts.push('A forrás már nincs a boardon, a helycsere nem hajtható végre (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}
      const a=me.loc,b=ob.loc;const p1:string[]=[];const r1=moveObj(it.src,b,p1,refs,srcName);const r2=moveObj(v,a,p1,refs,srcName);parts.push(...p1);return r1==='neg'&&r2==='neg'?'neg':undefined;}
    case 'choose':parts.push(esc(ob.name)+' kiválasztva.');return;
    case 'none':parts.push(esc(ob.name)+': a kézi értelmezés szerint ez az utasítás nem csinál semmit.');return;
    default:parts.push(esc(ob.name)+': a hatás lefut, ezt az elemzés nem követi részletesen.');story.push(Art(srcName)+' lefut '+art(ob.name)+' lapra (részletesen nem követett hatás).');return;}};
  /** Önmagára hivatkozó utasítás ("ready me", "give me +2", "empower me", "kill this"): a forrásra hat, ha még a boardon van (359.3.f.2). */
  const selfRef=(t:string)=>/\b(?:me|myself)\b(?! to\b)|\b(?:kill|banish|recall|exhaust|ready) this\b|\bI (?:get|gain|have)\b/i.test(t)&&!/\bto me\b/i.test(t);
  /* ---- célpont legalitás ---- */
  const srcLoc=(it:any,phase?:string)=>phase==='play'&&it.perm?it.loc:it.src&&O[it.src]&&O[it.src].zone==='board'?O[it.src].loc:null;
  /** A célpont legalitása. phase: 'play' (kijátszáskor, 355.8) vagy 'res' (resolve-kor, 359.3.e.2). Visszaadja az okok listáját. */
  const tgWhy=(it:any,p:any,v:string,ti:number,phase:string)=>{const why:string[]=[];if(v==='F0'||v==='F1'){if(p.type!=='battlefield')why.push('ez battlefield');return why;}
    const ob=O[v];if(!ob)return ['ismeretlen célpont'];const N=esc(ob.name);
    if(p.type==='spell'){if(ob.type!=='spell')why.push(N+' nem spell, hanem '+ob.type+' (355.9.a.2).');else if(ob.zone!=='chain')why.push(phase==='res'?'már nincs a chainen':N+' nincs a chainen.');return why;}
    if(ob.type!==p.type&&!(p.type==='unit'&&ob.type==='unit'))why.push(N+' '+ob.type+', nem '+p.type+'.');
    if(ob.zone!=='board'){why.push(phase==='res'?'már '+(ob.zone==='hand'?'kézben van':ob.zone==='trash'?'a trashben van':ob.zone==='banish'?'banishelve van':'nincs a boardon')+', zónát váltott (359.3.e.2)':N+' nincs a boardon.');return why;}
    if(p.equipOnly&&!(ob.card&&(ob.card.tg||[]).includes('Equipment')))why.push(N+' nem Equipment.');
    if(p.bf&&ob.loc==='base')why.push(phase==='res'?'már a base-ben áll, a lap pedig battlefielden álló célpontot kér':N+' base-ben áll, a lap battlefielden álló célpontot kér.');
    if(p.base&&ob.loc!=='base')why.push(N+' nem base-ben áll.');
    if(p.eq&&!p.equipOnly&&!Object.values(O).some((g:any)=>g.on===v&&g.zone==='board'))why.push(phase==='res'?'már nincs rajta Equipment, nem "equipped" (359.3.e.12)':N+' nem equipped.');
    if(p.stunned&&!ob.st)why.push(N+' nem stunned.');
    if(p.here){const hl=srcLoc(it,phase);if(hl==null)why.push(phase==='res'?'a forrás már nincs a boardon, ezért a "here" nem értelmezhető (359.3.f.2)':'a forrás nincs a boardon ("here")');else if(ob.loc!==hl)why.push(phase==='res'?'már nem ott áll, ahol a forrás ("here" a végrehajtáskor, 359.3.f.2)':N+' nem ott áll, ahol a forrás ("here").');}
    if(p.free&&srcLoc(it,phase)!=null&&srcLoc(it,phase)===ob.loc)why.push(N+' ugyanott áll, a lap másik locationt kér.');
    if(p.max!=null){const mt=mightOf(v);if(mt==null)why.push('Add meg '+N+' Mightját.');else if(mt>p.max)why.push(N+' Mightja '+mt+', a lap legfeljebb '+p.max+' Mightút választhat.');}
    if(p.mighty){const mt=mightOf(v);if(mt!=null&&mt<5)why.push(N+' nem Mighty (Might '+mt+', 5 kell, 708).');}
    if(p.another&&it.tg&&it.tg.some((x:string,k:number)=>k!==ti&&x===v))why.push(N+' már egy másik célpont, a lap "another" egységet kér.');
    if(p.another&&it.src===v&&p.rel!=='enemy')why.push(N+' maga a forrás, a lap másik unitot kér.');
    if(it.from==='facedown'&&!p.free&&it.loc){const at=it.perm&&phase==='res'?(onB(it.objId)?it.loc:null):it.loc;
      if(at==null)why.push('a facedown-ból kijátszott forrás már nincs a boardon, így nem tudni, melyik battlefieldről jött (811.1.d.3.a)');
      else if(ob.loc!==at)why.push(phase==='res'?'már nem azon a battlefielden áll, ahonnan a lapot facedown-ból kijátszották (811.1.d.2, 359.3.e.2.a)':'Facedown-ból kijátszva csak azon a battlefielden választhat ('+esc(locLabel(at))+'), '+(it.perm?'ahová a lap került (811.1.d.3)':'ahol el volt rejtve (811.1.d.2)')+'.');}
    if(p.rel!=='any'&&ob.ctrl){const need=p.rel==='enemy'?other(it.pl):it.pl;if(ob.ctrl!==need)why.push(phase==='res'?'megváltozott az irányítója, már nem '+(p.rel==='enemy'?'enemy':'friendly')+' (359.3.e.2)':N+' '+(ob.ctrl===it.pl?'saját':'ellenséges')+' lap, a választás '+(p.rel==='enemy'?'ellenséges':'saját')+' lapot kér');}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/can.t be chosen by enemy|cannot be chosen by enemy/i.test(ob.card.txt||'')&&!/unless/i.test(ob.card.txt||''))why.push(phase==='res'?'enemy spell vagy ability nem választhatja, így illegális célpont (758.1)':N+' szövege szerint ellenséges spell vagy ability nem választhatja (757, 758).');
    return why;};
  /** Legális választások egy célponthoz (403.4.b). */
  const legalOpts=(it:any,p:any,ti:number)=>{if(p.type==='battlefield')return ['F0','F1'].filter(f=>BF['bf'+f[1]].c);
    return Object.keys(O).filter(id=>(p.type==='spell'?O[id].zone==='chain':O[id].zone==='board')&&O[id].type===p.type&&!(it.tg||[]).some((x:string,k:number)=>k!==ti&&x===id)&&!tgWhy(it,p,id,ti,'play').length);};
  /* ---- 1. felépítés ---- */
  const playTrigs=(s:any)=>{const res:any[]=[];const ty=s.c.t.toLowerCase();
    Object.keys(O).forEach(id=>{const ob=O[id];if(!ob.card||id==='s'+s.j)return;if(!(ob.zone==='board'||ob.zone==='legend'))return;
      (ob.card.txt||'').split('\n').forEach((l:string)=>{const m=/^when (you|an opponent|a player) plays? (?:a |an )?(card|spell|unit|gear)s?([^,]*),\s*(.*)$/i.exec(stripRem(l));if(!m)return;
        const who=m[1].toLowerCase();if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        if(m[2].toLowerCase()!=='card'&&m[2].toLowerCase()!==ty)return;
        if(/other than your hand/i.test(m[3])&&(s.from||'hand')==='hand')return;
        if(/from your hand/i.test(m[3])&&s.from&&s.from!=='hand')return;
        res.push({kind:'auto',label:ob.name+' triggere',src:id,pl:ob.ctrl,eff:m[4],why:'"'+stripRem(l)+'"',list:[],tg:[]});});});
    return res;};
  snap('Kiinduló helyzet',[]);
  const itemOf=(s:any)=>{const c=s.c;const perm=s.k==='card'&&isPermC(c);
    const label=s.k==='ab'?c.n+' abilityje':s.k==='tg'?c.n+' triggere':((O['s'+s.j]&&O['s'+s.j].name)||c.n)+(perm?' (play trigger)':'');
    const src=s.k==='ab'||s.k==='tg'?s.src:perm?'s'+s.j:null;
    return {kind:'step',s,label,name:s.k==='ab'?c.n+' abilityje':s.k==='tg'?c.n+' triggere':c.n,pl:s.k==='tg'?((O[s.src]&&O[s.src].ctrl)||s.pl):s.pl,eff:s.eff,list:s.list,tg:s.tg,src,perm,from:s.k==='card'?s.from:null,loc:s.k==='card'?(s.loc||(s.from==='facedown'?'bf0':'base')):null,objId:s.k==='card'?'s'+s.j:null,dest:s.dest,ov:s.ov,pays:s.pays,may:s.may,isTg:s.k==='tg'};};
  MAIN.forEach((s:any,ix:number)=>{let it:any=null;try{const c=s.c;const tm=s.k==='ab'?(s.ab?s.ab.tm:'none'):s.k==='tg'?'trig':timingOf(c);const perm=s.k==='card'&&isPermC(c);const empty=!chain.length;
    const verb=s.k==='tg'?Art(c.n)+' triggerel':s.pl==='A'?(ix&&!empty?'Válaszként ':'')+(s.k==='ab'?'aktiválod':'kijátszod'):'Az ellenfél '+(ix&&!empty?'válaszként ':'')+(s.k==='ab'?'aktiválja':'kijátssza');
    const what=s.k==='tg'?'('+esc(s.tr?s.tr.why:'?')+')':s.k==='ab'?art(c.n)+' abilityjét ('+esc(s.ab?s.ab.label:'?')+')':art(c.n)+' lapot';
    const Verb=verb[0].toUpperCase()+verb.slice(1);
    it=itemOf(s);s.it=it;
    let illegal:any=null;
    if(s.k==='ab'&&!s.ab)illegal='nincs kiválasztva ability';
    else if(s.k==='tg'&&!s.tr)illegal='nincs kiválasztva trigger';
    else if(s.k==='ab'&&s.ab.add){rows+=line('430.2, 337.2',esc(Verb)+' '+what+'. Erőforrást ad: azonnal resolve-ol, nem kerül a chainre, és nem lehet rá válaszolni.',0);story.push(Verb+' '+what+': azonnal erőforrást ad, nem kerül a chainre.');return;}
    else if(s.k!=='tg'&&!empty&&!(tm==='reaction'||tm==='hidden'&&s.from==='facedown')&&(s.illTiming=true))illegal=(s.k==='ab'?'az ability':'a lap')+' nem [Reaction]'+(tm==='hidden'?' (kézből; csak facedown-ból kapna [Reaction]-t)':'')+', ezért amíg van valami a chainen, nem jöhet';
    if(!illegal&&s.k==='tg'&&s.src&&O[s.src]&&!['board','legend'].includes(O[s.src].zone)&&!s.tr.dk)illegal='a trigger forrása nincs a boardon';
    if(!illegal&&perm&&bfBlocksPlay(O['s'+s.j].loc))illegal=esc(locLabel(O['s'+s.j].loc))+' szövege szerint ide nem játszható ki';
    if(!illegal&&s.k==='ab'&&s.src&&O[s.src]){const sc=O[s.src];
      if(sc.ex&&/\[T\]|\[E\]/.test(s.ab.cost||s.ab.label))illegal='a forrás már exhausted, az [Exhaust] költség nem fizethető ki';
      else if(/disempower me/i.test(s.ab.cost||'')&&!sc.emp)illegal='a "Disempower me" költséghez a forrásnak Empowered állapotban kell lennie';
      else if(!['board','legend'].includes(sc.zone))illegal='a forrás nincs a boardon';}
    // additional cost: kill
    const ck=s.k==='card'&&s.cost&&s.cost.kill;let costV:any=null;
    if(!illegal&&ck&&(!ck.opt||s.addc)){costV=s.costTg||'';if(!costV)illegal='az additional cost kill célpontja nincs megadva';else{const ob=O[costV];
      if(!ob||ob.zone!=='board'||ob.type!=='unit')illegal='a költségként megölendő unit nincs a boardon';else if(ob.ctrl!==s.pl)illegal='költségként csak friendly unit ölhető meg';else if(ck.mighty&&(mightOf(costV)==null||mightOf(costV)<5))illegal=esc(ob.name)+' nem Mighty (5 vagy több Might kell, 708)';}}
    // célpontok (355.8). A kijátszott permanent már a boardon van, mire a play effectje célpontot választ (337.2), így önmagát is választhatja (355.9.c).
    if(perm&&!illegal&&O['s'+s.j].zone==='pending')O['s'+s.j].zone='board';
    const pick:any[]=[];
    // trigger (play effect, chainre tett trigger): ha van legális választás, kötelező azt választani (403.4.b); ha nincs, lekerül (403.4)
    if(!illegal&&(perm&&s.trig||s.k==='tg'))s.list.forEach((p:any,ti:number)=>{const v=s.tg[ti];if(!v&&p.opt)return;if(v&&!tgWhy(it,p,v,ti,'play').length)return;
      const opts=legalOpts(it,p,ti);if(!opts.length)return;const was=v?nm(v):'';const wy=v?tgWhy(it,p,v,ti,'play').join(' '):'';s.tg[ti]=opts[0];
      pick.push(['403.4.b, 403.2','A trigger '+(ti+1)+'. célpontja '+(was?'('+esc(was)+') nem legális: '+wy.replace(/\.\s*$/,'')+';':'nincs megadva;')+' de van legális választás, ezért kötelező azt választani (403.4.b). Az elemzés ezzel számol: '+esc(nm(opts[0]))+(opts.length>1?'; '+WHO[it.pl]+' választhatja helyette ezek egyikét is: '+opts.slice(1).map((o:string)=>esc(nm(o))).join(', '):'')+'.',0]);});
    let tErr:any=null;
    if(!illegal)s.list.forEach((p:any,ti:number)=>{if(tErr)return;const v=s.tg[ti];if(!v){if(!p.opt)tErr='nincs megadva a kötelező '+(ti+1)+'. célpont';return;}
      const why=tgWhy(it,p,v,ti,'play');if(why.length)tErr=(ti+1)+'. célpont nem választható: '+why.join(' ').replace(/\.\s*$/,'');});
    if(!illegal&&!tErr&&s.list.some((p:any)=>p.same)){const ls=s.tg.filter(Boolean).map((v:string)=>O[v]&&O[v].loc);if(ls.length>1&&ls.some((l:string)=>l!==ls[0]))tErr='a célpontoknak ugyanazon a locationön kell állniuk';}
    let trigBad:any=null;if(tErr){if(perm&&s.trig)trigBad=tErr;else{illegal=tErr;s.illTarget=true;}}
    s.illegal=illegal;
    if(illegal){if(s.k==='tg'){rows+=line('403.4, 403.4.a',esc(Verb)+' '+what+', de nincs legális választás: '+illegal+'. A trigger lekerül a chainről (ez nem counter).',0);story.push(Art(c.n)+' triggere lekerül a chainről, mert '+illegal.replace(/<[^>]+>/g,'')+'.');return;}
      rows+=line(s.illTiming?(s.k==='ab'?'358.4, 338.1.a.1, 813.1.c.2':'358.4, 338.1.a.1, 813.1.c.1'):s.illTarget?'355.8':'358','<span class="stbad">Nem szabályos:</span> '+esc(Verb)+' '+what+'? '+illegal+'. Kimarad.',0);story.push((s.pl==='A'?'Nem '+(s.k==='ab'?'aktiválhatod':'játszhatod ki'):'Az ellenfél nem '+(s.k==='ab'?'aktiválhatja':'játszhatja ki'))+' '+what.replace(/<[^>]+>/g,'')+' így: '+illegal.replace(/<[^>]+>/g,'').replace(/ \([0-9.]+\)/g,'')+'.');if(O['s'+s.j])O['s'+s.j].zone='none';return;}
    // legális
    const timingTxt=s.k==='tg'?'a játék teszi a chainre, priority nem kell hozzá':!empty?(tm==='reaction'?'[Reaction], ezért válaszként jöhet':'facedown-ból [Reaction]-ként jön'):(tm==='none'&&c.t==='Spell'?'üres chain mellett, a saját körödben':'üres chain mellett');
    rows+=line(s.k==='tg'?'383.3, 401':!empty?(tm==='reaction'?(s.k==='ab'?'813.1.c.2':'813.1.c.1'):'811.6'):(s.k==='ab'?'381':c.t==='Spell'?'155':'337.2'),esc(Verb)+' '+what+' ('+timingTxt+').'+(s.from&&s.from!=='hand'&&s.k==='card'?' Honnan: '+({facedown:'facedown',trash:'trash',champ:'Champion Zone',other:'nem kézből'} as any)[s.from]+'.':''),0);
    pick.forEach((a:any)=>{rows+=line(a[0],a[1],a[2]);});
    if(s.k==='ab'&&s.src&&O[s.src]&&/\[T\]|\[E\]/.test(s.ab.cost||'')){O[s.src].ex=true;rows+=line('415','Költség: '+esc(O[s.src].name)+' exhausted lesz.',0);}
    if(s.k==='ab'&&s.src&&O[s.src]&&/disempower me/i.test(s.ab.cost||'')){O[s.src].emp=false;rows+=line('443','Költség: '+esc(O[s.src].name)+' disempowered lesz.',0);}
    if(costV){const parts:string[]=[];const refs:string[]=[];const r=killObj(costV,'additional cost',parts,refs);EV.push({k:'cost',id:costV});rows+=line('356.2.a, 357.2'+(r==='neg'?', 357.2.a':''),'Költség: '+parts.join(' ')+(r==='neg'?' A halált replacement helyettesítette, a költség ettől még ki van fizetve (357.2.a).':''),0);story.push('Költségként '+(r==='neg'?'meg kellene halnia '+art(O[costV].name)+' lapnak, de a halált replacement helyettesíti; a költség így is ki van fizetve.':'meghal '+art(O[costV].name)+'.'));}
    if(s.k==='tg'&&s.killSelf){if(s.src&&onB(s.src)){const parts:string[]=[];const refs:string[]=[];const r=killObj(s.src,'a trigger költsége',parts,refs);rows+=line('204.1.c, 383.3.b'+(r==='neg'?', 357.2.a':''),'A trigger költsége ("kill me") a finalizáláskor: '+parts.join(' '),0);story.push(Art(c.n)+' a trigger költségeként meghal, mielőtt a hatás a chainre kerül.');}
      else{rows+=line('204.1.c','A "kill me" költség nem fizethető ki (a forrás nincs a boardon), ezért a trigger nem kerül a chainre.',0);s.illegal='költség';return;}}
    if(perm){O['s'+s.j].zone='board';EV.push({k:'enter',id:'s'+s.j,name:c.n,loc:O['s'+s.j].loc});rows+=line('337.2','A '+c.t.toLowerCase()+' azonnal resolve-ol és ide kerül: '+esc(locLabel(O['s'+s.j].loc))+'.'+(s.trig?' A "When you play" hatása triggerként a chainre kerül (355.5.b).':''),0);}
    else if(O['s'+s.j])O['s'+s.j].zone='chain';
    s.tg.forEach((v:string,ti:number)=>{if(v)rows+=line('355.7','<span class="stok">'+(ti+1)+'. célpont:</span> '+esc(nm(v))+(O[v]&&O[v].loc?' ('+esc(locLabel(O[v].loc))+(mightOf(v)!=null?', '+mightOf(v)+' Might':'')+')':'')+'.',0);});
    const defl=s.tg.filter((v:string)=>v&&O[v]&&O[v].card&&O[v].ctrl!==it.pl&&/\[Deflect/.test(O[v].card.txt||'')).map((v:string)=>{const m=/\[Deflect(?: (\d+))?\]/.exec(O[v].card.txt);return O[v].name+' ('+(m&&m[1]?m[1]:1)+')';});
    if(defl.length){s.defl=defl;rows+=line('809.1.c, 356.2.a','Deflect: '+esc(defl.join(', '))+' kiválasztásáért ennyi plusz Powert kell fizetni additional costként.',0);}
    let trigOK=!perm||!s.trig||s.cond!=='paid'||s.addc;
    if(perm&&s.trig&&!trigOK){rows+=line('383.2.a.1','A play effect feltétele ("if you paid the additional cost") nem teljesül, ezért nem triggerel.',0);}
    else if(trigBad){trigOK=false;rows+=line('403.4, 403.4.a','A play effectnek nincs legális választása ('+trigBad+'). A '+c.t.toLowerCase()+' ettől még a boardra kerül, a trigger lekerül a chainről (403.4; ez nem counter).',0);story.push('A play effectnek nincs legális célpontja, ezért a trigger lekerül a chainről.');s.trigBad=trigBad;}
    if(s.may&&(s.k==='tg'||perm&&trigOK))rows+=line('383.3.a, 383.3.a.2','"You may" a triggered ability elején: '+WHO[it.pl]+' a chainre tételkor (finalizálás) dönt'+(it.pl==='A'?'öd':'i')+' el, végrehajtja-e; ha nem, lekerül. Az elemzés igennel számol.',0);
    else if(s.may)rows+=line('355.18, 355.12','"You may": a döntés a resolve-kor születik (355.18); a célpontokat a kijátszáskor kell kiválasztani, a game action végrehajtásáról szóló döntéstől függetlenül (355.12). Az elemzés igennel számol.',0);
    story.push(Verb+' '+what.replace(/<[^>]+>/g,'')+(perm?', ami azonnal ide kerül: '+locLabel(O['s'+s.j].loc)+(s.trig&&trigOK?', a "When you play" hatása pedig a chainre':''):', ez a chain tetejére kerül')+'.');
    if(it.isTg&&s.tr&&s.tr.dk){it.dk=true;it.sent=!!(O[s.src]&&O[s.src].zone==='trash');}
    if(s.k==='ab'||s.k==='tg'||c.t==='Spell')chain.push(it);
    else if(s.trig&&trigOK)pushTrig(it);
    // unit és gear kijátszása azonnal resolve-ol (337.2), ezért a "When you play" triggerek most triggerelnek; spellnél csak a resolve-kor (420.4.a)
    if(perm){playTrigs(s).forEach((t:any)=>{pushTrig(t);rows+=line('420.4.a, 337.2','Trigger: '+esc(O[t.src].name)+' '+t.why+' A '+c.t.toLowerCase()+' kijátszása a resolve-jával befejeződött, ezért most triggerel.',1);story.push(Art(O[t.src].name)+' képessége triggerel erre a kijátszásra, és a chainre kerül.');});}
    else if(s.k==='card'&&playTrigs(s).length)rows+=line('420.4.a, 420.4.a.1','A "When you play a spell" típusú triggerek ('+playTrigs(s).map((t:any)=>esc(t.label)).join(', ')+') csak akkor triggerelnek, amikor '+esc(c.n)+' resolve-ol; ha counterelik, nem triggerelnek.',0);
    // a költségből vagy kijátszásból keletkezett triggerek (Deathknell, leave, play) a kijátszott elem fölé kerülnek
    if(PEND.length){const n=PEND.length;const lab=PEND.map((t:any)=>esc(t.label)).join(', ');flushPend(chain);rows+=line('337.1.b, 359.3.b, 340.1','A kijátszás közben keletkezett trigger'+(n>1?'ek':'')+' ('+lab+') a chain tetejére kerül'+(n>1?'nek':'')+', ezért előbb resolve-ol'+(n>1?'nak':'')+'.',1);}
  }finally{const lab=(s.k==='tg'?(s.it?s.it.pl:s.pl):s.pl)==='A'?'Te':'Ellenfél';snap(s.k==='tg'?'Trigger: '+s.c.n+(s.illegal?' (lekerül)':''):lab+': '+(s.k==='ab'?'aktiválás':'kijátszás')+', '+(s.k==='ab'?s.c.n+' abilityje':s.c.n)+(s.illegal?' (nem szabályos, kimarad)':''),chain);}});
  /* ---- 2. lefutás ---- */
  stack=chain.slice();const done=out.done;
  /** Cleanup (319.5, 323): lethal damage-es unitok meghalnak, csatolatlan gear battlefielden és idegen base-ben álló permanentek recall-olódnak (323.6). */
  const cleanup=()=>{const dead=Object.keys(O).filter(id=>lethal(id));const parts:string[]=[];const refs:string[]=[];const names:string[]=[];
    dead.forEach(id=>{const r=killObj(id,'lethal damage, cleanup',parts,refs);names.push(O[id].name+(r==='neg'?' (helyettesítve)':''));});
    if(dead.length){REC.push(['323.4, 142.4.b, 429.1.a.2','Cleanup: '+plainOf(parts.join(' '))]);ALL.push(REC[REC.length-1]);}
    const rc=Object.keys(O).filter(id=>{const g=O[id];return g.zone==='board'&&!g.on&&((g.type==='gear'&&g.loc!=='base')||(g.loc==='base'&&g.baseOf&&g.ctrl&&g.baseOf!==g.ctrl));});
    rc.forEach(id=>{const g=O[id];const why=g.loc!=='base'?'csatolatlan gear battlefielden':'nem a saját irányítója base-ében áll';g.loc='base';g.baseOf=g.ctrl;EV.push({k:'recall',id,name:g.name,cleanup:true});
      REC.push(['323.6'+(why[0]==='c'?', 436.4.a':''),g.name+': '+why+', ezért a cleanupban recall-olódik a base-be.']);ALL.push(REC[REC.length-1]);names.push(g.name+' recall');story.push(Art(g.name)+' a cleanupban a base-be kerül ('+why+').');});
    flushPend(stack);if(names.length)snap('Cleanup: '+names.join(', '),stack);};
  let guard=0;const resolveAll=()=>{while(stack.length&&guard++<80){const it=stack.pop();const d0=done.length;try{resolveItem(it);flushPend(stack);}finally{const dn=done.length>d0?done[done.length-1]:null;snap('Resolve: '+it.label+(dn?', '+(RES[dn.res]||dn.res):''),stack);cleanup();}}};
  const resolveItem=(it:any)=>{const rec0=REC.length;const all0=ALL.length;try{resolveItem0(it);}finally{
      /* az elem saját sora kerüljön előre a "Mi változott?" listában, utána a közben történt mellékhatások (leválás, kontroll) */
      if(REC.length>rec0+1&&ALL.length>all0+1){const a=REC.pop();REC.splice(rec0,0,a);const b=ALL.pop();ALL.splice(all0,0,b);}}};
  const resolveItem0=(it:any)=>{const s=it.s||null;const perm=!!it.perm;const self=it.objId?O[it.objId]:null;const srcName=it.name||it.label;
    const head='<b>'+esc(srcName)+'</b>'+(perm?' play triggere':it.kind==='auto'?' ('+esc(it.why)+')':'')+' resolve-ol. ';
    if(self&&self.zone==='countered'){const pt=it.kind==='step'&&s&&s.k==='card'?playTrigs(s):[];rr+=line('426.1'+(pt.length?', 420.4.a.1, 426.1.b':''),head+'Counterelték: nem csinál semmit, a trashbe kerül, a költség nem jár vissza, és nem számít kijátszottnak.'+(pt.length?' Ezért nem triggerel: '+pt.map((tr:any)=>esc(tr.label)).join(', ')+'.':''),0);story.push(Art(srcName)+' sorra kerülne, de counterelték: nem történik semmi.');done.push({name:srcName,pl:it.pl,res:'countered'});out.items.push({name:srcName,res:'countered',instr:[],targets:[]});return;}
    if((it.kind==='auto'&&it.why==='Deathknell'&&it.sent===false)||(it.isTg&&it.dk&&!it.sent)){rr+=line('808.1.d.1, 808.1.d',head+'A forrás nem került a trashbe (nem halt meg), ezért a trigger lekerül a chainről.',0);done.push({name:it.label,pl:it.pl,res:'removed'});out.items.push({name:it.label,res:'removed',instr:[],targets:[]});return;}
    if(it.kind==='auto'&&it.why==='Deathknell'&&it.sent&&O[it.src]&&O[it.src].zone!=='trash')rr+=line('808.1.d.1, 808.1.d','<b>'+esc(srcName)+'</b>: a forrás a trashbe került, de onnan a resolve előtt elmozdult. A trigger ettől még lefut, mert a 808.1.d.1 csak azt az esetet nevezi meg, amikor a lap nem kerül a trashbe.',1);
    let t=head;let fl=it.kind==='auto'?1:0;const refs=['340.1'];
    if(perm&&self&&self.zone!=='board'){story.push(Art(srcName)+' már nincs a boardon, de a play triggere a chainen maradt, ezért lefut.');t+='A forrás már nincs a boardon, de a trigger független objektum, ezért lefut (355.9.c). A forrásra vonatkozó információ ("me", "here", "my") a végrehajtáskor nem elérhető, az erre épülő utasítás Ignored (359.3.f.2, 359.3.e.6). ';fl=1;}
    if(it.kind==='step'&&s.k==='ab'&&it.src&&O[it.src]&&!['board','legend'].includes(O[it.src].zone)){t+='Az ability forrása már nincs a boardon, de az ability ettől még lefut (355.9.c). ';fl=1;}
    const INS=it.kind==='step'?interp(s,s):interp({},{eff:it.eff,list:[]});MAN=INS.some((x:any)=>x.manual);
    const parts:string[]=[];let legal=0,tot=0;const tgOut:any[]=[];const mtT:any[]=[];let lastT:any=null;
    const runTarget=(x:any,ti:number)=>{const p=it.list[ti];const v=it.tg[ti];if(!v)return;tot++;if(v==='F0'||v==='F1'){legal++;tgOut[ti]='ok';return;}const ob=O[v];
      const wS=tgWhy(it,p,v,ti,'res');
      if(wS.length){tgOut[ti]='ign';mtT.push({n:ob.name,ok:false,why:wS.join(', ')});if(ob.zone==='board')MTIDS.add(v);EV.push({k:'mistarget',id:v,name:ob.name,item:srcName});
        parts.push('<span class="stbad">'+(ti+1)+'. célpont illegális</span> ('+esc(ob.name)+' '+wS.join(', ')+'): mistarget, rá a hatás elmarad (359.3.e.2, 359.3.e.5).');refs.push('359.3.e.9');story.push(Art(srcName)+(perm?' triggere':'')+' sorra kerül, de '+(it.list.length>1?((ti===0||ti===4)?'az ':'a ')+(ti+1)+'.':'a')+' célpontja ('+ob.name+') '+wS.join(', ').replace(/ \([0-9.,a-z ]+\)/g,'')+': mistarget, rá a hatás elmarad.');return;}
      legal++;mtT.push({n:ob.name,ok:true});const xa=x.act;
      if(xa.k==='counter'&&ob.type==='spell'&&xa.unless&&it.pays){tgOut[ti]='neg';parts.push(esc(ob.name)+' irányítója kifizeti a kért költséget, ezért a counter nem történik meg.');story.push(Art(srcName)+' lefut, de '+art(ob.name)+' gazdája kifizeti a kért költséget, így a spell marad.');return;}
      if(['draw','channel','discard','choose','deck','xp','score','pay','showoff','fight'].includes(xa.k)){tgOut[ti]='ok';if(xa.k==='choose')parts.push(esc(ob.name)+' kiválasztva.');return;}
      if(xa.k==='other'||xa.k==='delayed'||xa.k==='playcard'||xa.k==='replay'||xa.k==='token'){tgOut[ti]='ok';parts.push(esc(ob.name)+': "'+esc(x.t)+'" lefut, ezt az elemzés nem követi részletesen.');fl=Math.max(fl,1);return;}
      const r=applyTo(v,Object.assign({t:x.t},xa),it,parts,refs);tgOut[ti]=r==='neg'?'neg':r==='ign'?'ign':'ok';if(r==='ign')legal--;};
    // Bellows Breath típus: "at the same location" csoport a resolve-kor (355.11.b, 355.11.b.1)
    if(it.list.some((p:any)=>p.same)){const live=it.tg.map((v:string,ti:number)=>v&&O[v]&&O[v].zone==='board'?{v,ti,loc:O[v].loc}:null).filter(Boolean);const groups:any={};live.forEach((x:any)=>{(groups[x.loc]=groups[x.loc]||[]).push(x);});const keys=Object.keys(groups);
      if(keys.length>1){keys.sort((a,b)=>groups[b].length-groups[a].length);const keep=keys[0];
        parts.push('A célpontok már nem állnak egy locationön, ezért '+WHO[it.pl]+' választ egy legális részhalmazt (355.11.b). A részhalmaznak az adott locationön álló összes eredeti célpontot tartalmaznia kell (355.11.b.1), de bármelyik location választható: '+keys.map(k=>esc(locLabel(k))+': '+groups[k].map((x:any)=>esc(O[x.v].name)).join(', ')).join('; vagy ')+'. Az elemzés ezt számolja: '+esc(locLabel(keep))+'; a másik választással a hatás a másik csoportra jutna.');refs.push('355.11.b','355.11.b.1');
        live.forEach((x:any)=>{if(x.loc!==keep){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});}}
    const runT0=runTarget;const runTargetX=(x:any,ti:number)=>{if(it.dropT&&it.dropT.has(ti)){tot++;tgOut[ti]='ign';mtT.push({n:O[it.tg[ti]].name,ok:false,why:'kimarad a választott részhalmazból (355.11.b)'});return;}runT0(x,ti);};
    INS.forEach((x:any,xi:number)=>{
      const dir=x.dir;const lk=x.lk;const prev=lk?lastT:null;
      const cf=/^if you played this from your hand\b/i.test(x.t)?(it.from||'hand')==='hand':/^if you paid the additional cost\b/i.test(x.t)?!!(s&&s.addc):null;
      if(cf===false){x.st='skipped';x.ref='135.2.b.7';x.why='a feltétel ("'+x.t.split(',')[0]+'") nem teljesül, a resolve-kor ellenőrizve';return;}
      if(prev&&(prev.st==='ignored')){x.st='ignored';x.ref='359.3.e.14.a';x.why='linked instruction, a korábbi utasítás Ignored lett, ezért ez is Ignored';
        x.tis.forEach((ti:number)=>{const v=it.tg[ti];if(v){tot++;tgOut[ti]='ign';mtT.push({n:nm(v),ok:false,skip:true,why:'a linked instruction Ignored, ezért rá sem hat'});}});}
      else if(prev&&prev.st==='negated'&&dir){x.st='skipped';x.ref='359.3.e.14.b';x.why='közvetlenül a korábbi game actionre hivatkozik ("if you do"), az pedig Negated lett, ezért nem hajtódik végre';}
      else if(x.tis.length){if(prev&&x.act.k==='mightEq'){const lv=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]);it.lkMight=lv?(O[lv].lk&&O[lv].lk.m!=null&&O[lv].zone!=='board'?O[lv].lk.m:mightOf(lv)):null;}
        x.tis.forEach((ti:number)=>runTargetX(x,ti));const ch=x.tis.filter((ti:number)=>tgOut[ti]);const ig=ch.filter((ti:number)=>tgOut[ti]==='ign').length,ng=ch.filter((ti:number)=>tgOut[ti]==='neg').length;
        if(!ch.length){x.st='executed';x.why='nincs választott célpont';}
        else if(ig===ch.length){x.st='ignored';x.ref=ch.length>1?'359.3.e.6, 359.3.e.7':'359.3.e.6';x.why='minden célpontja illegális (mistarget) vagy a szükséges információ nem elérhető';}
        else if(ng===ch.length-ig&&ng){x.st='negated';x.ref='359.3.e.6';x.why='a célpont legális, de a game action nem hajtható végre vagy helyettesítődik';}
        else if(ig){x.st='partial';x.ref='359.3.e.8';x.why='csak a legális célpontokra hat';}
        else{x.st='executed';x.why='';}}
      else{x.st='executed';
        if(prev&&prev.st==='negated'){x.ref='359.3.e.14.b';x.why='linked instruction, a korábbi Negated lett, de erre nem hat (nem hivatkozik közvetlenül a game actionre)';}
        else if(prev&&prev.st==='partial'){x.ref='359.3.e.14.a';x.why='linked instruction: csak a legális célpontokra vonatkozik';}
        else if(!lk&&INS.some((y:any,yi:number)=>yi<xi&&y.st==='ignored')){x.ref='359.3.e.5';x.why='nem linked, ezért a korábbi mistarget ellenére végrehajtódik';}
        let live=prev?prev.tis.filter((ti:number)=>it.tg[ti]&&tgOut[ti]&&tgOut[ti]!=='ign'&&O[it.tg[ti]]):[];
        if(/\bthe friendly unit\b/i.test(x.t))live=live.filter((ti:number)=>O[it.tg[ti]].ctrl===it.pl);else if(/\bthe enemy unit\b/i.test(x.t))live=live.filter((ti:number)=>O[it.tg[ti]].ctrl&&O[it.tg[ti]].ctrl!==it.pl);
        const a=x.act;const sc=allScope(x.t);
        if(a.k==='draw'||a.k==='channel'||a.k==='discard'){const n=a.n!=null?a.n:1;const verbs:any={draw:['húz',' lapot','414.1'],channel:['channelöl',' rune-t','431.1'],discard:['eldob',' lapot','423.1']};const vb=verbs[a.k];
          let who:any=it.pl;let whoTxt=it.pl==='A'?'Te':'Az ellenfél';
          if(/\b(its|their) (controller|owner)s?\b/i.test(x.t)){if(prev&&live.length){const ob=O[it.tg[live[0]]];const own=/owner/i.test(x.t);who=own?ob.own:(ob.zone==='board'?ob.ctrl:(ob.lk&&ob.lk.ctrl)||ob.own);whoTxt='A célpont '+(own?'tulajdonosa':'irányítója')+' ('+WHO[who]+')';}
            else if(prev&&!live.length){x.st='ignored';x.ref='359.3.e.14.a';x.why='a hivatkozott célpont nem érvényes';who=null;}
            else{who=null;parts.push('A szöveg a célpont '+(/owner/i.test(x.t)?'tulajdonosára':'irányítójára')+' hivatkozik, de nem linked utasításként szerepel, így az elemzés nem tudja, ki '+vb[0]+' '+n+vb[1]+'.');}}
          else if(/^they\b/i.test(x.t)&&prev&&live.length){const ob=O[it.tg[live[0]]];who=ob.ctrl;whoTxt=WHOC[who];}
          if(who){EV.push({k:a.k,pl:who,n});parts.push(whoTxt+' '+vb[0]+' '+n+vb[1]+(/for each/i.test(x.t)?' (a "for each" szorzót az elemzés nem számolja)':'')+'.');refs.push(vb[2]);story.push(whoTxt+' '+vb[0]+' '+n+vb[1]+'.');}}
        else if(a.k==='none'){if(x.manual)parts.push('"'+esc(x.t)+'": a kézi értelmezés szerint nem csinál semmit.');}
        else if(a.k==='delayed'){out.delayed.push({t:x.t,who:it.pl,src:srcName,on:live.map((ti:number)=>O[it.tg[ti]].name)});EV.push({k:'delayed',t:x.t});parts.push('Delayed ability jön létre: "'+esc(x.t)+'". A megadott időpontban triggerel, és akkor kerül a chainre (391.2, 392); ez a mostani chainen kívül esik, ezért az elemzés itt nem futtatja le.');refs.push('391.2','392');story.push('Delayed hatás jön létre: "'+x.t+'" (később fut le).');}
        else if(a.k==='loseCtrl'){parts.push('"'+esc(x.t)+'"');}
        else if(a.k==='fight'){const pt=prev?prev.tis.map((ti:number)=>it.tg[ti]).filter(Boolean):[];const lv=pt.filter((v:string)=>onB(v)&&live.some((ti:number)=>it.tg[ti]===v));
          if(lv.length===2&&pt.length===2){const [p1,p2]=lv;const m1=mightOf(p1),m2=mightOf(p2);
            [[p1,m2,p2],[p2,m1,p1]].forEach(([v,n,by]:any)=>{if(n==null)return;O[v].dmg+=Math.max(0,n);EV.push({k:'dmg',id:v,name:O[v].name,n:Math.max(0,n),by});parts.push(esc(O[by].name)+' '+Math.max(0,n)+' damage-et oszt '+esc(O[v].name)+' lapra (a forrás a unit, 418.6.b.3).');});refs.push('418.6.b.3');story.push(Art(O[p1].name)+' és '+art(O[p2].name)+' sebzi egymást ('+m1+' és '+m2+' Might).');}
          else{x.st='ignored';x.ref='359.3.e.14.a, 359.3.e.12';x.why='a két kiválasztott unit közül legalább egy nem érvényes célpont, a Mightja nem elérhető';}}
        else if(lk&&live.length&&!['other','playcard','replay','token','deck','xp','score','choose','empower','disempower','runes','add'].includes(a.k)){const gl=live.filter((ti:number)=>O[it.tg[ti]].type==='gear');const tl=(a.k==='detach'||a.k==='attach')&&gl.length?gl:live;
          if(a.k==='attach'&&gl.length&&live.length>gl.length&&!a.toSelf){const u=live.find((ti:number)=>O[it.tg[ti]].type==='unit');const G=O[it.tg[gl[0]]],U=O[it.tg[u]];if(G.on===U.id){parts.push(esc(G.name)+' már ezen a uniton van, a csatolásnak nincs hatása (435.1.g, 435.1.i); az elemzés ezt Negated-nek veszi (levezetés).');x.st='negated';x.ref='359.3.e.6';it.flL=true;}else{G.on=U.id;G.loc=U.loc;EV.push({k:'attach',id:G.id,name:G.name,to:U.id});parts.push('Felcsatolva: '+esc(G.name)+' → '+esc(U.name)+' (435).');refs.push('435');}}
          else tl.forEach((ti:number)=>{const r=applyTo(it.tg[ti],Object.assign({t:x.t},a),it,parts,refs);if(r==='neg'){x.st='negated';x.ref='359.3.e.6';}else if(r==='ign'){x.st='ignored';x.ref=a.k==='ctrlUntil'?'359.3.e.16':'359.3.e.6';x.why=a.k==='ctrlUntil'?'a delayed kontroll időtartama már véget ért, mielőtt létrejött volna':'a végrehajtáshoz szükséges információ nem elérhető';}});}
        else if(lk&&prev&&!live.length&&a.k!=='other'){x.st='ignored';x.ref='359.3.e.14.a';x.why='a hivatkozott célpont nem érvényes, ezért nincs mire hatnia';}
        else if(!lk&&sc&&['dmg','kill','stun','hand','banish','recall','ready','exhaust','might','buff'].includes(a.k)&&!x.tis.length){const hereLoc=sc.there?(it.tg.find((v:string)=>v==='F0'||v==='F1')==='F1'?'bf1':'bf0'):srcLoc(it);let hit=0;
          Object.keys(O).forEach(v=>{const ob=O[v];if(ob.zone!=='board'||ob.type!==sc.type)return;if(sc.rel==='enemy'&&ob.ctrl===it.pl)return;if(sc.rel==='friendly'&&ob.ctrl!==it.pl)return;if((sc.here||sc.there)&&ob.loc!==hereLoc)return;if(sc.atbf&&ob.loc==='base')return;if(sc.inbase&&ob.loc!=='base')return;if(sc.other&&v===it.src)return;hit++;applyTo(v,Object.assign({t:x.t},a),it,parts,refs);});
          if(!hit)parts.push('"'+esc(x.t)+'": nincs olyan lap a boardon, amire hatna.');}
        else if(selfRef(x.t)&&['ready','exhaust','might','kw','empower','disempower','kill','banish','recall','buff','stun','heal','dmg'].includes(a.k)&&!(a.k==='might'&&!a.self&&!/\bme\b/i.test(x.t))){
          if(it.src&&(onB(it.src)||(O[it.src]&&O[it.src].zone==='legend'))){if(a.k==='disempower'){O[it.src].emp=false;parts.push(esc(O[it.src].name)+' disempowered lesz.');}else if(a.k==='empower'){O[it.src].emp=true;EV.push({k:'empower',id:it.src,name:O[it.src].name});parts.push(esc(O[it.src].name)+' Empowered lesz (442).');refs.push('442');story.push(Art(O[it.src].name)+' Empowered lesz.');}else{const r=applyTo(it.src,Object.assign({t:x.t},a),it,parts,refs);if(r==='neg'){x.st='negated';x.ref='359.3.e.6';}}}
          else{x.st='ignored';x.ref='359.3.e.6, 359.3.f.2';x.why='a forrásra ("me", "this") hivatkozik, de a forrás már nincs a boardon, az információ nem elérhető';}}
        else if(a.k==='attach'&&a.toSelf&&prev){x.st='ignored';x.ref='359.3.e.14.a';x.why='a csatolandó lap nem érvényes';}
        else if(a.k==='ctrlUntil'&&a.until==='src'&&!(it.src&&onB(it.src))){x.st='ignored';x.ref='359.3.e.16';x.why='a delayed kontroll időtartama ("until I leave the board") már véget ért, mielőtt létrejött volna, ezért nem jön létre';parts.push('"'+esc(x.t)+'": '+esc(srcName.replace(/ triggere$/,''))+' már nincs a boardon, ezért a kontroll nem változik, egy pillanatra sem (359.3.e.16).');refs.push('359.3.e.16');}
        else if(['dmg','kill','stun','hand','banish','recall','base','move','might','buff','ready','exhaust','counter'].includes(a.k)&&!lk&&!x.tis.length&&it.kind!=='auto'){parts.push('"'+esc(x.t)+'": nincs kiválasztott célpont vagy hatókör, ezért nincs mire hatnia.');}
        else if(a.k==='other'||a.k==='playcard'||a.k==='replay'||a.unsure){parts.push('"'+esc(x.t)+'": lefut, ezt az elemzés nem követi részletesen.');fl=Math.max(fl,1);}
        else if(['token','deck','xp','score','runes','choose','add','pay','costmod','restrict','showoff'].includes(a.k)){const L:any={token:'token jön létre (440)',deck:'pakli művelet (felfedés, recycle, Predict)',xp:'XP változás',score:'pontszerzés',runes:'rune-ok readyre állítása',choose:'választás',add:'erőforrás hozzáadása',pay:'költség fizetése az utasításon belül (204.3.a)',costmod:'költségmódosítás, a chain lefutását nem érinti',restrict:'korlátozás, a chain lefutását nem érinti',showoff:'Show Off (832)'};parts.push('"'+esc(x.t)+'": '+L[a.k]+'.');EV.push({k:a.k,pl:it.pl,t:x.t});}
        else if(x.manual&&a.k!=='other')parts.push('"'+esc(x.t)+'": kézzel '+(OV_LBL[a.k]||a.k)+' műveletre állítva, de nincs mire hatnia (nincs célpontja, és nem linked).');}
      if(x.tis.length||['control','choose'].includes(x.act.k)&&x.tis.length)lastT=x;});
    const insShown=INS.length>1||INS.some((x:any)=>x.st!=='executed');
    if(MAN)parts.push('<b>Kézzel beállított értelmezés:</b> '+INS.filter((x:any)=>x.manual).map((x:any)=>'"'+esc(x.t)+'" = '+esc((OV_LBL[x.act.k]||x.act.k).replace(/ N$/,''))+(OV_N.has(x.act.k)?' '+x.act.n:'')+(x.lk?', linked':'')).join('; ')+'.');
    if(insShown){parts.push('Utasítások: '+INS.map((x:any)=>'"'+esc(x.t)+'": '+INS_ST[x.st]+(x.ref?' ('+x.ref+')':'')+(x.manual?' [kézi]':'')).join('; ')+'.');
      INS.forEach((x:any)=>{if(x.ref)x.ref.split(/,\s*/).forEach((r:string)=>refs.push(r));});
      INS.forEach((x:any,xi:number)=>{if(xi&&(x.st==='ignored'||x.st==='skipped'))story.push('"'+x.t+'": '+INS_ST[x.st]+', mert '+x.why+'.');});}
    if(tot&&(mtT.some((q:any)=>!q.ok)||INS.some((x:any)=>x.st==='negated'||x.st==='skipped')))
      MT={item:srcName+(perm?' (play trigger)':''),kind:!legal?'full':mtT.some((q:any)=>!q.ok)?'partial':'none',targets:mtT,instr:INS.map((x:any)=>({t:x.t,st:x.st,ref:x.ref,why:x.why,man:x.manual}))};
    else if(!tot&&INS.some((x:any)=>x.st==='negated'||x.st==='skipped'||x.st==='ignored'))MT={item:srcName,kind:'none',targets:[],instr:INS.map((x:any)=>({t:x.t,st:x.st,ref:x.ref,why:x.why,man:x.manual}))};
    if(!parts.length){parts.push(it.kind==='step'&&s.k==='card'&&s.c.sh?'Hatás: '+esc(s.c.sh):'Hatás: '+esc(it.eff||''));fl=Math.max(fl,1);story.push(Art(srcName)+' lefut'+(it.kind==='step'&&s.k==='card'&&s.c.sh?': '+s.c.sh:': '+it.eff));}
    if(tot&&!legal){const rest=INS.some((x:any)=>x.st==='executed'&&!x.tis.length);if(rest){parts.push('Teljes mistarget: minden célpontja illegális lett, a célponthoz nem kötött utasítás viszont végrehajtódik.');refs.push('359.3.e.7');}else{parts.push('Teljes mistarget: minden célpontja illegális lett, ezért hatás nélkül resolve-ol'+(perm||it.kind!=='step'||s.k!=='card'?'':', de kijátszottnak számít (359.3.e.10)')+'.');refs.push('359.3.e.7');story.push(Art(srcName)+' így hatás nélkül fejeződik be.');}}
    else if(tot&&legal<tot&&tot>1)refs.push('359.3.e.8');
    if(self&&self.type==='spell')self.zone='trash';
    if(it.kind==='step'&&s&&s.k==='card'&&s.c.t==='Spell'){const pt=playTrigs(s);pt.forEach((tr:any)=>pushTrig(tr));if(pt.length){parts.push('A kijátszás most fejeződött be a resolve-val, ezért triggerel: '+pt.map((tr:any)=>esc(tr.label)).join(', ')+' (420.4.a; akkor is, ha egyik utasítás sem hajtódott végre, 359.3.e.10).');refs.push('420.4.a');}}
    const res=(tot&&!legal)?'fizzle':(tot&&legal<tot)?'partial':'ok';
    done.push({name:it.label,pl:it.pl,res});out.items.push({name:it.label,res,instr:INS.map((x:any)=>({t:x.t,k:x.act.k,st:x.st,ref:x.ref,lk:x.lk})),targets:mtT});
    if(it.flL)fl=Math.max(fl,1);rr+=line(refs.join(','),t+parts.join(' '),fl);MAN=false;};
  resolveAll();
  /* Combat utáni triggerek: a Combat panel kiosztása szerinti eredmény, majd új chain a felvett triggerekkel (célpontokkal). */
  if(POST.length){const cb=POST[0].cb||{bf:'bf0',dead:[],recall:[],ctrl:'',label:''};const bl=cb.bf==='bf1'?'bf1':'bf0';
    story.push('A chain kiürült. Ezután jön a combat '+locLabel(bl)+' battlefielden, a Combat panel kiosztása szerint.');
    (cb.dead||[]).forEach((id:string)=>{const ob=O[id];if(ob&&ob.zone==='board'){leaveBoard(id,'trash');REC.push(['467.2.d, 323.4',ob.name+': a combat damage-től meghal, a trashbe kerül.']);story.push(Art(ob.name)+' meghal a combatban.');}});
    (cb.recall||[]).forEach((id:string)=>{const ob=O[id];if(ob&&ob.zone==='board'){ob.loc='base';ob.baseOf=ob.ctrl;REC.push(['468.1.a.2',ob.name+': attackerként recall-olódik a base-be.']);}});
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.zone==='board'&&ob.type==='unit'&&(ob.loc===bl||(cb.recall||[]).includes(id))&&ob.dmg){ob.dmg=0;}});REC.push(['468.1.a.1','A túlélők damage-e a Combat Cleanupban gyógyul.']);
    if(cb.ctrl&&BF[bl].ctrl!==cb.ctrl){BF[bl].ctrl=cb.ctrl;REC.push(['468.5',(cb.ctrl==='A'?'Te':'Az ellenfél')+' Establishes Control: '+locLabel(bl)+'.']);}
    snap('Combat: '+(cb.label||locLabel(bl)),[]);
    POST.forEach((s:any)=>{let id=s.src;if(!id||!O[id]){id='X'+s.j;O[id]={id,name:s.c.n,card:s.c.t?s.c:null,ctrl:s.pl,own:s.pl,loc:s.loc||bl,zone:'legend',type:'trigsrc'};}
      const it={kind:'step',s,label:O[id].name+' triggere ('+(s.why||'trigger')+')',name:O[id].name+' triggere',pl:s.pl,eff:s.eff,list:s.list,tg:s.tg,src:id,perm:false,from:null,loc:null,objId:null,dest:s.dest,ov:s.ov,isTr:true};
      const bad:string[]=[];s.list.forEach((p:any,ti:number)=>{const v=s.tg[ti];if(!v){if(!p.opt)bad.push('nincs megadva a kötelező '+(ti+1)+'. célpont');return;}const w=tgWhy(it,p,v,ti,'play');if(w.length)bad.push((ti+1)+'. célpont nem választható: '+w.join(' '));});
      if(bad.length){REC.push(['403.4',O[id].name+' triggere ('+(s.why||'trigger')+') nem kerülhet a chainre legális választás nélkül: '+plainOf(bad.join('; '))+'. Lekerül (403.4).']);story.push(Art(O[id].name)+' triggere lekerül, mert nincs legális célpontja.');return;}
      pushTrig(it);REC.push([s.why==='Deathknell'?'808.1.c, 808.1.d.2':/Conquer/i.test(s.why||'')?'383.4.c.2':'383.3',O[id].name+' triggere ('+(s.why||'trigger')+') a chainre kerül: '+s.eff]);story.push(Art(O[id].name)+' triggere ('+(s.why||'trigger')+') a chainre kerül.');});
    flushPend(stack);snap('Combat utáni triggerek a chainen',stack);resolveAll();}
  story.push('A chain kiürült.');
  REC.push(['','A chain kiürült.']);if(out.delayed.length)REC.push(['391.2',out.delayed.length+' delayed hatás vár későbbi időpontra: '+out.delayed.map((d:any)=>'"'+d.t+'"'+(d.on.length?' ('+d.on.join(', ')+')':'')).join('; ')]);snap('Végállapot: a chain üres',[]);REC=null;
  // ---- 3. kimenet ----
  const stat:any={ok:['stok','lefutott'],partial:['stok','részben futott le'],fizzle:['stbad','hatás nélkül'],countered:['stbad','counterelve'],removed:['stbad','lekerült']};
  let h='<h2>Chain elemzés</h2><p class="note">Lépésenkénti levezetés a lapok szövegéből és a Core Rules szabályaiból. A "levezetés" címkéjű sorok az oldal következtetései, a judge felülbírálhatja őket.</p>';
  h+='<h3 class="cbsec">A chain lefutása</h3><p class="note" style="margin:0 0 6px">Ebben a sorrendben futottak le a tételek: mindig a legutóbb felrakott először, a közben keletkező triggerek pedig rögtön a tetejére kerülnek.</p><ol class="stack">'+done.map((d:any,i:number)=>{const r=stat[d.res]||['','?'];return '<li><span class="sn">'+(i+1)+'.</span><span class="sc">'+esc(d.name)+'</span><span class="note">'+(d.pl==='A'?'te':'ellenfél')+'</span><span class="'+r[0]+'">'+r[1]+'</span></li>';}).join('')+'</ol>';
  const off=S.filter((s:any)=>s.illegal||(s.k==='card'&&isPermC(s.c)&&!s.trig)||(s.k==='ab'&&s.ab&&s.ab.add));
  if(off.length)h+='<p class="note" style="margin:4px 0 0">Nem került a chainre: '+off.map((s:any)=>esc(s.c.n)+(s.illegal?(s.k==='tg'?' (trigger, lekerült)':' (nem szabályos)'):s.k==='ab'?' (erőforrást ad, azonnal lefut)':' (azonnal a boardra került, nincs play triggere)')).join(', ')+'.</p>';
  h+='<h3 class="cbsec">Sorban ez történik</h3><ol class="flow">'+story.map(x=>'<li><span>'+glossify(esc(x))+'</span></li>').join('')+'</ol>';
  const res:string[]=[];Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type==='legend'||ob.type==='trigsrc')return;
    if(ob.type==='spell'){if(ob.zone==='none'||ob.zone==='pending')return;res.push(esc(ob.name)+': '+(ob.zone==='countered'?'counterelve, a trashben':'lefutott, a trashben'));return;}
    if(ob.zone==='none'||ob.zone==='pending')return;
    const mt=mightOf(id);const z=({board:esc(locLabel(ob.loc))+(ob.loc==='base'&&ob.baseOf&&ob.baseOf!==ob.ctrl?' ('+(ob.baseOf==='A'?'a te':'az ellenfél')+' base-ében)':'')+(ob.type==='unit'&&mt!=null?', '+mt+' Might':'')+(ob.dmg?', '+ob.dmg+' damage':'')+(ob.st?', stunned':'')+(ob.ex?', exhausted':'')+(ob.on&&O[ob.on]?', rajta: '+esc(O[ob.on].name):''),hand:'a tulajdonosa kezében',trash:'a tulajdonosa trashében',banish:'banishelve'} as any)[ob.zone]||ob.zone;
    res.push((ob.ctrl==='A'?'Te: ':ob.ctrl==='B'?'Ellenfél: ':'')+esc(ob.name)+(ob.zone==='board'&&ob.own&&ob.ctrl!==ob.own?' (átvett kontroll, tulajdonos: '+WHO[ob.own]+')':'')+': '+z);});
  h+='<h3 class="cbsec">Végállapot</h3><ul class="res">'+res.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  if(out.delayed.length)h+='<h3 class="cbsec">Függő delayed hatások</h3><table class="nt">'+out.delayed.map((d:any)=>lineH('391.2, 392, 359.3.e.16',esc(d.src)+': "'+esc(d.t)+'"'+(d.on.length?' ('+esc(d.on.join(', '))+')':'')+'. A megadott időpontban triggerel és akkor kerül a chainre; a mostani chain lefutásán kívül esik. Ha az időtartam már véget ért, amikor létrejönne (például az Ending Phase-ben kijátszva), nem jön létre (359.3.e.16).',0)).join('')+'</table>';
  if(notes.length)h+='<h3 class="cbsec">Battlefieldek állandó hatása</h3><table class="nt">'+notes.join('')+'</table>';
  const cards:any[]=[];S.forEach((s:any)=>{if(!cards.includes(s.c))cards.push(s.c);});CS.bd.forEach((b:any)=>{const c=vsCard(b.n);if(c&&!cards.includes(c))cards.push(c);});
  let pr='';for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){const A=cards[a],B=cards[b];
    const p=vsPairs(A,B).concat(vsPairs(B,A));
    const rA=new Map(),rB=new Map();(A.nt||[]).forEach((n:any)=>n[0].split(',').forEach((r:string)=>rA.set(r.trim(),n[2])));(B.nt||[]).forEach((n:any)=>n[0].split(',').forEach((r:string)=>rB.set(r.trim(),n[2])));
    const common=[...rA.keys()].filter(r=>rB.has(r)&&!/^(155|813|806|355\.7|355\.10|337)/.test(r));
    if(!p.length&&!common.length)continue;
    pr+='<details class="tp"><summary><span class="tt">'+esc(A.n)+' és '+esc(B.n)+'</span><span class="why">'+p.length+' kölcsönhatás, '+common.length+' közös szabály</span></summary><div class="rules"><table class="nt">'+p.map((x:any)=>lineH(x[0],glossify(esc(x[1])),1)).join('')+common.map(r=>lineH(r,'<b>'+esc(A.n)+':</b> '+glossify(esc(rA.get(r)))+'<br><b>'+esc(B.n)+':</b> '+glossify(esc(rB.get(r))),null)).join('')+'</table></div></details>';}
  if(pr)h+='<h3 class="cbsec">Kölcsönhatások a lapok között</h3><p class="note" style="margin:0 0 6px">Általános összevetés, a konkrét helyzettől függetlenül: milyen kölcsönhatás lehetséges két lap között, és mely szabályokra hivatkozik mindkettő magyarázata.</p>'+pr;
  h+='<h3 class="cbsec">Részletesen: a chain felépítése</h3><table class="nt">'+rows+'</table>';
  h+='<h3 class="cbsec">Részletesen: lefutás (340.1)</h3>'+(rr?'<table class="nt">'+rr+'</table>':'<p class="note">Nem került semmi a chainre.</p>');
  h+='<p class="note" style="margin-top:14px">Követett hatások: counter, kézbe küldés, kill (replacementtel: Zhonya\'s Hourglass, Guardian Angel), banish, move és base-be mozgatás, helycsere, recall, damage (Bonus Damage), stun, buff, Might módosítás, keyword adása, ready, exhaust, kontrollváltás ("until I leave the board" és delayed visszaadás), Equipment csatolás és leválás, draw, channel, discard, "all/each" hatások, additional cost kill, Deathknell, "When I move" és "leaves the board" triggerek, "When you play" triggerek, Vilemaw\'s Lair típusú mozgástiltás, cleanup (lethal damage, gear recall). Ami ezen kívül esik, azt az elemzés megnevezi, de nem számolja ki.</p>';
  const names=[...new Set(Object.values(O).map((ob:any)=>ob.card&&ob.card.n).filter(Boolean).concat(['bf0','bf1'].map(l=>BF[l].c&&BF[l].c.n).filter(Boolean)))].sort((a:any,b:any)=>b.length-a.length);
  if(names.length){const re=new RegExp('('+names.map((n:any)=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','g');
    h=h.replace(/(<[^>]+>)|([^<]+)/g,(_m:string,tag:string,txt:string)=>tag?tag:txt.replace(re,(w:string)=>'<button type="button" class="cl" data-card="'+esc(w)+'">'+w+'</button>'));}
  out.html=h;
  void LOCK;
  return out;
}
