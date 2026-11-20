// @ts-nocheck
/* Chain elemző magja, DOM nélkül. A builder állapotából (CS: legendek, battlefieldek, board, lépések) kiszámolja a
   lejátszás frame-jeit, a szabálysorokat, az eseménynaplót és a HTML kimenetet. A chain.ts (DOM) és a unit tesztek is ezt hívják.
   A lapszöveg értelmezése szöveges heurisztika; amit nem ismer fel biztosan, azt "bizonytalan" címkével jelöli. */
import {esc,FL,FLT,glossify,vsCard,vsPairs} from './core';
import {cardOv} from './cardRules';

/* ---------- Szövegelemzés ---------- */
export const stripRem=(s:string)=>(s||'').replace(/\([^()]*\)/g,' ').replace(/\s+/g,' ').trim();
export const plainOf=(h:string)=>String(h).replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
/** Csak keywordöt (és költségjelet) tartalmazó sor, például "[Hidden]", "[Repeat] [2]", "[Equip] [C]". */
const KW_ONLY=/^(?:\[[A-Za-z' -]+(?: \d+)?\]\s*(?:\[[^\]]*\]\s*)*)+$/;
export const KW_HEAD=/^(?:\[(?:Reaction|Action|Hidden|Quick-Draw|Accelerate|Ganking|Deflect(?: \d+)?|Tank|Backline|Shield(?: \d+)?|Assault(?: \d+)?|Vision|Temporary|Repeat)\](?:\s*\[[^\]]*\])*\s*)+/i;
/** Költségsor (nem utasítás): kötelező vagy választható additional cost. */
const COST_LINE=/^(?:as an additional cost to play (?:this|me)\b|you may (?:pay [^.]*?|kill a friendly unit) as an additional cost|as you play (?:this|me), you may pay [^.]*? as an additional cost)/i;
const TRIG_LINE=/^(?:\[[^\]]+\]\s*)*(?:(?:when|whenever)\b[^,]*,|at (?:the )?(?:start|end|beginning)\b[^,]*,|the (?:first|next|second) time\b[^,]*,)\s*/i;
const DK_LINE=/^(?:\[[^\]]+\]\s*)*\[(Deathknell|Hunt(?: \d+)?)\]\s*(?:\[>\])?\s*(?:[\u2014-]\s*)?/i;

/** Egy lap utasításforrásai: spell sorok, play effect, triggered és activated abilityk hatása (a lefedettségi statisztikához és a builderhez). */
export function instrSources(c:any){const out:any[]=[];if(!c)return out;
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

export const effOf=(c:any)=>stripRem(((c.txt||'').split('\n').map(stripRem).filter((l:string)=>l&&!KW_ONLY.test(l)&&!COST_LINE.test(l)).map((l:string)=>l.replace(KW_HEAD,'').trim()).join(' '))+' '+(c.eff&&c.t==='Spell'?c.eff:''));

/** "Choose one" módok: a fejléc sora és a "- " kezdetű opciók (Rocket Barrage, 820.2.a). mode: a választott opció indexe. */
export function modalSplit(lines:string[],mode:number){const hi=lines.findIndex(l=>/\bchoose one\b(?! of\b)|^do one of the following\b/i.test(l)&&!/based on/i.test(l));const opts:string[]=[];
  if(hi>=0){let k=hi+1;while(k<lines.length&&/^[-\u2014\u2013]\s+/.test(lines[k])){opts.push(lines[k].replace(/^[-\u2014\u2013]\s*/,''));k++;}}
  if(!opts.length)return {lines,opts};const md=Math.max(0,Math.min(mode||0,opts.length-1));
  const head=lines[hi].replace(/(?:then,?\s*)?(?:you may )?choose one\b.*$/i,'').trim();
  return {lines:lines.slice(0,hi).concat(head?[head]:[],[opts[md]],lines.slice(hi+opts.length+1)),opts,mode:md,head:lines[hi]};}
/** Additional cost: kötelező vagy választható kill (Sacrifice, Cruel Patron, Atakhan), illetve fizethető extra költség (Akshan). */
export function costOf(c:any){const out:any={kill:null,opt:false,txt:''};if(!c)return out;
  (c.txt||'').split('\n').map(stripRem).forEach((l:string)=>{let m;
    if((m=/^as an additional cost to play (?:this|me), kill (?:a|another) friendly (\[Mighty\] )?unit/i.exec(l))){out.kill={opt:false,mighty:!!m[1]};out.txt=l;}
    else if(/^you may kill a friendly unit as an additional cost/i.test(l)){out.kill={opt:true,mighty:false};out.txt=l;}
    else if(/you may pay [^.]*as an additional cost|as you play (?:this|me), you may pay|^as an additional cost to play (?:this|me), you may\b/i.test(l)){out.opt=true;out.txt=l;}});
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
  const lines=(c.txt||'').split('\n').concat(extraEff?[extraEff]:[]).map(stripRem);
  lines.forEach((l:string,li:number)=>{let m;if(/^[-\u2014\u2013]\s+/.test(l)&&out.length){const last=out[out.length-1];if(last.modal)last.opts.push(l.replace(/^[-\u2014\u2013]\s*/,''));return;}
    if((m=DK_LINE.exec(l))){const e=l.slice(m[0].length);if(e)out.push({label:'['+m[1]+'] '+e.slice(0,50),eff:e,why:m[1],dk:/Deathknell/i.test(m[1])});return;}
    if((m=TRIG_LINE.exec(l))){const why=l.slice(0,m[0].length).replace(/,\s*$/,'');const ef=l.slice(m[0].length);out.push({label:why+': '+ef.slice(0,50),eff:ef,why,modal:/\bchoose one\b(?! of\b)/i.test(ef)&&!/based on/i.test(ef),opts:[]});}void li;});
  return out;}

const NUMW:any={one:1,two:2,three:3,four:4,five:5,six:6};
const numOf=(x:string)=>x==null?1:/^\d+$/.test(x)?+x:NUMW[String(x).toLowerCase()]||1;
/** Célpont-kifejezések: "a unit", "up to two enemy units", "a friendly [Mighty] unit", "an Equipment", "a unit you control at another location". */
export function phrasesTxt(e:string){
  const out:any[]=[];
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
    if(/\bamong them\s*$/i.test(before))continue; // a megnézett lapok közül választás, nem célpont (128.4, 355.10.a) // Show Off választás (832), nem célpont
    if(/^\s*token\b/i.test(tail)||/\b(?:it's|it is|is|was|that's|as|becomes?)\s*$/i.test(before))continue; // feltétel, nem célpont
    if(/^\s*(?:from (?:your|their|its owner's|an opponent's|a player's) (?:hand|trash|deck|main deck)|from among|from (?:it|that unit|them|me)\b|in (?:your|their) (?:hand|trash)|you play|they control|in your trash)\b/i.test(tail))continue;
    if(/\b(?:for each|each|reveal|discard|draw)\s*$/i.test(before)&&!/each of\s*$/i.test(before))continue;
    if(ty==='ability'&&!/\bspell or\s*$/i.test(before)&&!/counter|gain control/i.test(e.slice(Math.max(0,m.index-30),m.index)))continue;
    const q=m[1].toLowerCase();const totM=/^[^.]*?\bwith total Might (\d+) or less\b/i.exec(tail);const n=m[2]?numOf(m[2]):q==='any number of'?(totM?6:3):(q==='two'?2:q==='three'?3:1);
    const rel=/friendly/.test(adj)||/^\s*(?:you control|of yours)\b/i.test(tail)?'friendly':/enemy/.test(adj)||/^\s*(?:an opponent controls|your opponent controls)\b/i.test(tail)?'enemy':'any';
    const sent=tail.split('.')[0].split(/\b(?:and|or)\s+(?:a|an|another|up to)\b/i)[0];
    const p:any={type:ty==='ability'?'spell':ty,rel,max:mm&&ty==='unit'?+mm[1]:null,
      bf:ty!=='spell'&&/^\s*(?:you control\s+)?at (?:a|the same|that) battlefield/i.test(sent)||/^\s*from a battlefield\b/i.test(sent),
      same:/\bat the same (?:battlefield|location)\b/i.test(sent)||!!totM,totalMax:totM?+totM[1]:null,opt:!!m[2]||q==='any number of',
      here:/^\s*(?:you control\s+|an opponent controls\s+)?(?:here|there)\b/i.test(sent),free:/\bat (?:another|a different) location\b/i.test(sent),
      base:/^\s*(?:you control\s+)?in (?:a|your|their|its owner's) base\b/i.test(sent),eq:/equipped/.test(adj)||raw==='equipment',equipOnly:raw==='equipment',
      ...(costCondOf(sent)?{cost:costCondOf(sent)}:{}),mighty:/mighty/.test(adj),another:q==='another'||/\bother\b/.test(adj),attacking:/attacking/.test(adj),stunned:/stunned/.test(adj),any:q==='any number of',orAb:ty==='spell'&&/^\s*or abilit/i.test(tail),chooseOnly:/^[^.]*\bthat chooses it and no other friendly unit\b/i.test(tail)};
    for(let i=0;i<Math.min(n,totM?6:3);i++)out.push(Object.assign({},p,{opt:p.opt||(i>0&&!!m[2])}));}
  if(splitP){const dn=/\bdeal (\d+) damage split\b/i.exec(e);const slots=dn?Math.min(10,+dn[1]+3):10;for(let i=0;i<slots;i++)out.push(Object.assign({},splitP));}
  return out;
}

/** Instruction felbontás (359.3.e.14): mondatonként, ", then" és " and ready/stun/..." mentén. */
export const splitInstr=(eff:string)=>String(eff||'').replace(KW_HEAD,'').split(/(?<=\.)\s+/).flatMap(x=>DELAY_RE.test(x)||/\binstead\b|\bwould\b/i.test(x)?[x]:x.split(/,\s*then\s+|\s+and\s+(?=(?:ready|stun|exhaust|buff|draw|recall|give|channel|kill|deal|banish|discard)\b)/i)).map(x=>x.trim()).filter(Boolean);
const DELAY_RE=/\bat (?:the )?end of (?:this |the )?turn\b|\bat the start of (?:your|its controller's|the) next\b|\buntil (?:your|the) next\b/i;
export const LINK_RE=/\b(it|its|them|their|they|that unit|the friendly unit|the enemy unit|that spell|that gear|that equipment|the killed unit|the chosen unit|those units|each other|it's)\b/i;
export const DIRECT_RE=/\bif you do\b|\bif (?:this|it) kills\b|\bif (?:it|that unit) dies\b|\bfor each unit this kills\b/i;

/** Utasítás műveletének felismerése. k: a művelet; unsure: miért bizonytalan (ha az). */
/** Szorzó ("for each", "equal to the number of"): ha a boardról megszámolható, cnt a leírása; ha nem, miss a hiányzó adat. */
export function eachOf(e:string){let m;
  if(/\bfor each unit this kills\b/i.test(e))return {cnt:{kills:true},txt:'az ezzel megölt unitok'};
  if(/\bfor each of your \[Mighty\] units\b/i.test(e))return {cnt:{rel:'friendly',type:'unit',mighty:true,where:'',st:''},txt:'a Mighty saját unitok'};
  if((m=/\bfor each (other )?battlefield you (?:or allies )?control\b/i.exec(e)))return {cnt:{bfs:true,other:!!m[1]},txt:'az általad irányított '+(m[1]?'többi ':'')+'battlefieldek'};
  if((m=/\bfor each Equipment attached to (me|it)\b/i.exec(e)))return {cnt:{eqOn:m[1].toLowerCase()},txt:'a csatolt Equipmentek'};
  if((m=/\b(?:for each|equal to the number of) (other |another )?(exhausted |ready |stunned |buffed )?(friendly |enemy )?(units?|gear)( you control| an opponent controls)?( here| there| at (?:a |that |this )?battlefields?| in (?:your )?base)?(?![^.]*\b(?:revealed|spent|in your hand|in your trash|with this name)\b)/i.exec(e))&&!/\bfor each (?:card|buff|opponent|time|player|of the following)\b/i.test(e)){
    return {cnt:{other:!!m[1],st:(m[2]||'').trim().toLowerCase(),rel:/friendly|you control/i.test((m[3]||'')+(m[5]||''))?'friendly':/enemy|opponent/i.test((m[3]||'')+(m[5]||''))?'enemy':'any',type:/gear/i.test(m[4])?'gear':'unit',where:/^\s*here/i.test(m[6]||'')?'here':/^\s*there/i.test(m[6]||'')?'there':/battlefield/i.test(m[6]||'')?'bf':/base/i.test(m[6]||'')?'base':''},txt:m[0].replace(/^(?:for each|equal to the number of) /i,'')};}
  const miss=/\bhand\b/i.test(e)?'a kézben lévő lapok':/\btrash\b|with this name/i.test(e)?'a trash tartalma':/\bbuffs? spent|\bspent\b/i.test(e)?'az elköltött buffok':/\brevealed\b/i.test(e)?'a felfedett lapok':/\bopponent who\b|\bplayer\b/i.test(e)?'a többi játékos döntése':/\bXP\b|\brunes?\b/i.test(e)?'XP vagy rune-ok':/\btags?\b/i.test(e)?'a unitok tagjei':/\btime\b/i.test(e)?'a kör korábbi eseményei':'a számlált adat';
  return {miss};}
/** Feltétel ("If ..., "): how = 'known' (az elemzés tudja), 'board' (a boardból kiértékelhető), 'user' (a builderben állítandó, mert nem követett adattól függ). */
export function condOf(e:string){const m=/^(?:then,?\s*)?if (you've played a non-token unit, a non-token gear, and a spell this turn),/i.exec(e)||/^(?:then,?\s*)?if ([^,]+),/i.exec(e)||/^\[(Level \d+|Legion)\]/i.exec(e);if(!m)return null;const c=m[1];
  if(/^(?:you do|this kills|it dies|you played this from your hand|you paid (?:the|my) additional cost|it's an equipment)\b/i.test(c))return {t:c,how:'known'};
  if(/^(?:I'm|it's|this is|it is) \[?empowered\]?$|^it's already buffed$|^it is stunned$|^it's \[?mighty\]?$|^I'm at a battlefield$|^it has \d+ \[S\] or less$|^it's your turn$|^it's not your turn$|^there is exactly one other unit you control here$|^you control (?:a|an|two or more|\d+ or more|exactly \d+|\d+ or more other) (?:other )?(?:friendly )?(?:units?|gear)(?: here| there)?$|^you have (?:exactly \d+|\d+\+|\d+ or more) units (?:here|there|at that battlefield)$|^an enemy unit is alone here$|^it was (?:a|an) (?:friendly|enemy) unit$|^you control this battlefield$|^you have exactly two units there$/i.test(c))return {t:c,how:'board'};
  const op=OPEN_COND.find(x=>x[0].test(c));if(op)return {t:c,how:'open',why:op[1],refs:op[2]};
  const st=STATE_COND.find(x=>x[0].test(c));if(st)return {t:c,how:'state',key:st[1]};
  const hd=HIDDEN_COND.find(x=>x[0].test(c));if(hd)return {t:c,how:'hidden',why:hd[1]};
  return {t:c,how:'hidden',why:'a feltétel builderen kívüli előzménytől függ'};}
/** A játékállapotból (builder mezők és a lépésekből számolt értékek) kiértékelhető feltételek; a második elem a szükséges állapotmező. */
export const STATE_COND:[RegExp,string][]=[
  [/^Level \d+$/i,'xp'],[/^Legion$/i,'played'],[/score is (?:not )?within 3 points of the Victory Score/i,'score'],
  [/^you control (?:\d+ or (?:fewer|more)|exactly \d+) runes$/i,'runes'],[/^your Rune Deck is empty$/i,'runeDeck'],[/^you can't$/i,'runeDeck'],[/^you couldn't channel \d+ runes? this way$/i,'runeDeck'],
  [/^it's your Beginning Phase$/i,'phase'],[/^you've played a non-token unit, a non-token gear, and a spell this turn$/i,'played'],[/^you've played a spell this turn$/i,'played'],
  [/^you spent \[\d+\] or more$/i,'spent'],
  [/^you showed off(?: a (?:unit|card))?$/i,'showoff'],[/^it's attacking$/i,'atk'],
  [/^you control a facedown card(?: here| at a battlefield)?$/i,'facedown'],
  [/^I (?:didn't )?died? alone$|^I didn't die alone$/i,'lk'],[/^I was \[?Mighty\]?$/i,'lk'],[/^I haven't been dealt damage this turn$/i,'dealt'],
  [/^I am at a battlefield$/i,'board'],[/^you control a (\w+)$/i,'board'],[/^there is a friendly gear with \[Deploy\] here$/i,'board'],
  [/^there's an enemy unit alone at that battlefield$/i,'board'],[/^it's already stunned$/i,'board'],[/^there are \d+ or more units there$/i,'board'],
  [/^it's your turn and you played this from face down$/i,'board'],[/^if your score is not within/i,'score']];
/** A Core Rules által nem definiált fogalomra épülő feltételek: nyitott kérdés (flag 2), a lapnál állítható, alapból nem teljesül. */
export const OPEN_COND:[RegExp,string,string][]=[[/^you assigned \d+ or more excess damage(?: to enemy units)?$/i,'az "excess damage" fogalmat a Core Rules nem definiálja','467.2.c']];
/** Rejtett adattól függő feltételek (kéz, deck, felfedett lap, builderen kívüli előzmény): a lapnál kis mezővel, alapértékkel. */
export const HIDDEN_COND:[RegExp,string][]=[
  [/^it's an? (?:gear|spell|unit)$|^it is a unit$/i,'a felfedett vagy húzott lap típusa (deck, rejtett)'],[/^you revealed /i,'a felfedett lapok (deck, rejtett)'],
  [/^it has that type$/i,'a megtippelt lap típusa (kéz, rejtett)'],[/cards in hand/i,'a kéz mérete (rejtett)'],[/^there are four spells banished with me$/i,'a Jhinnel banishelt spellek száma (builderen kívüli előzmény)']];
export function actOf(t:string){const e=String(t||'').replace(/^[-\u2014\u2013]\s*/,'');let m;const r:any=(o:any)=>{
    if(/\bfor each\b|\bequal to the number of\b/i.test(e)&&!o.unsure){const ea=eachOf(e);if(ea.cnt)o.each=ea;else o.unsure='a szorzóhoz ("for each") hiányzó adat: '+ea.miss+'; ezt az elemzés nem követi';}
    const cd=condOf(e);if(cd)o.cond=cd;
    if(/\binstead\b/i.test(e)&&!o.unsure&&!['saveNext','dieRepl'].includes(o.k)){if(cd)o.alt=true;else o.unsure='replacement ("instead") feltétel nélkül, az elemzés csak jelzi';}
    return o;};
  if(COST_LINE.test(e))return {k:'cost'};
  if((m=/^otherwise,?\s+(.+)$/i.exec(e))){const inner=actOf(m[1]);return Object.assign({},inner,{otherwise:true});}
  if(/^when you play it, \[?buff\]? it\b/i.test(e))return {k:'delayed',inner:'buff'};
  if(/^the next unit you play this turn\b[^.]*\bcan be played to any battlefield\b/i.test(e))return {k:'perm'};
  if(/^(?:units you play this turn|friendly units) enter ready(?: this turn)?\b/i.test(e))return {k:'enterReady'};
  if(/(?:^|\u2014\s*)the next unit you play this turn enters ready\b/i.test(e))return r({k:'nextReady'});
  if(/^for each friendly unit, you may spend its buff to ready it\b/i.test(e))return {k:'spendBuffReady'};
  if(/^ignore \[deflect\] while paying\b/i.test(e))return {k:'costmod'};
  if(/\bthat many\b/i.test(e))return {k:/\bbanish\b/i.test(e)?'banish':'other',unsure:'a mennyiség a kifizetett költségtől ("that many") függ, ezt az elemzés nem követi'};
  if(/^(?:then,?\s*)?(?:you may )?choose one\b(?! of\b)|^do one of the following\b/i.test(e))return /based on/i.test(e)?{k:'modal',unsure:'a mód a lap egy tulajdonságától függ, ezt az elemzés nem követi'}:{k:'modal'};
  if((m=/^(?:then,?\s*)?(?:(if [^,]+|for each [^,]+),\s*)?(?:you may )?do this(?: (\w+) times)?:\s*(.*)$/i.exec(e))){const inner=actOf(m[3]);return {k:'reflex',body:m[3],inner:inner.k,unsure:inner.k==='other'?'a reflexív trigger hatását nem ismerem fel':inner.unsure,cond:m[1]&&/^if/i.test(m[1])?condOf(m[1]+','):null};}
  if(/\bthe next time (?:it|that unit) takes damage this turn\b/i.test(e))return {k:'delayed'};
  if(/\bthe next time (?:it|that unit) would die this turn\b[^.]*\binstead\b/i.test(e))return {k:'saveNext',pay:/\bpay\b/i.test(e)};
  if(/^if it would die this turn, banish it instead\b/i.test(e))return {k:'dieRepl',to:'banish'};
  if((m=/^prevent (?:the next (\d+)|all) damage that would be dealt to (?:it|that unit|a unit)\b/i.exec(e))||/\bthe next time (?:it|that unit) would be dealt damage this turn, prevent it\b/i.test(e))return {k:'prevent',n:m&&m[1]?+m[1]:99,next:!m};
  if(/^double all damage that would be dealt to (?:it|that unit)\b/i.test(e))return {k:'dbldmg'};
  if(/\byou win the game\b/i.test(e))return r({k:'win'});
  if(/^take a turn after this one\b/i.test(e))return {k:'extraturn'};
  if(/\bcan.t be countered\b|\byou can hide\b|\byou can look at\b|\buse this ability once\b/i.test(e))return {k:'perm'};
  if(/^(?:it|that unit) can.t be chosen by enemy spells and abilities this turn\b/i.test(e))return {k:'untgt'};
  if((m=/\b(?:its|another unit's|my|that unit's) base Might becomes? (\d+)\b/i.exec(e)))return r({k:'setbase',n:+m[1],self:/\bmy base\b/i.test(e)});
  if((m=/\bdeal damage equal to (my|its) \[(Shield|Assault)\]/i.exec(e)))return r({k:'dmgKw',kw:m[2],who:m[1].toLowerCase()==='my'?'self':'linked'});
  if(/\bdeal damage to (?:a|an) [^.]*\bequal to the damage marked on it\b/i.test(e))return r({k:'dmgMarked'});
  if(/^swap the Mights of two units\b/i.test(e))return r({k:'swapMight'});
  if(/\bplaces? it on the top or bottom of (?:their|its owner's|your) Main Deck\b/i.test(e))return r({k:'todeck'});
  if(/^(?:then,?\s*)?(?:you may )?(?:name a (?:card|spell|unit)|they guess a card type)\b/i.test(e))return {k:'choose'};
  if(/^(?:you may )?put (?:a card|the top \d+ cards?|the rest|those you don't|it) [^.]*\b(?:main deck|trash|hand)\b|^put those you don't\b|^(?:you may )?return your chosen champion\b|\breveal from among\b|\breveal cards from the top\b/i.test(e))return r({k:'deck'});
  if(/\breduce (?:its|this spell's) (?:energy )?cost\b|\bcost is reduced\b/i.test(e))return {k:'costmod'};
  if((m=/\bgive [^.]*?([+\-\u2013])\[S\][^.]*\bequal to the number of\b/i.exec(e)))return r({k:'might',n:m[1]==='+'?1:-1,self:false});
  if((m=/^each player (discards|draws) (\d+)\b/i.exec(e)))return {k:m[1].toLowerCase()==='discards'?'discard':'draw',n:+m[2],eachPlayer:true};
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
  if(/\breturn[^.]{0,80}\bhands?\b/i.test(e))return r({k:'hand'});
  if(/\bmove me to its location and it to my original location\b|\bmove each to the other's location\b/i.test(e))return {k:'swap'};
  if(/\bbanish\b/i.test(e)&&!/\bbanished\b/i.test(e.replace(/\bbanish\b/i,'')))return r({k:'banish'});
  if(/\b(?:its owner|you|they) plays? (?:it|that unit)\b(?! from)/i.test(e)&&!/\byou may play it\b/i.test(e))return {k:'replay',to:/to the same location/i.test(e)?'same':/to their base|to your base/i.test(e)?'base':/to any battlefield/i.test(e)?'anybf':'choose',free:/ignoring (?:its|any and all) costs?/i.test(e)};
  if(/\bkill\b/i.test(e)&&!/\bif (?:this|it) kills\b/i.test(e))return r({k:'kill'});
  if(/\brecall\b/i.test(e))return r({k:'recall'});
  if(/\bmove\b[^.]{0,60}\bto (?:its|their|your|his|her|my)? ?base\b|\bmove\b[^.]{0,60}\bback\b/i.test(e))return r({k:'base'});
  if((m=/\bdeals? (\d+)\b/i.exec(e))){if(/\bsplit\b/i.test(e))return {k:'dmg',n:+m[1],split:true};return r({k:'dmg',n:+m[1]});}
  if((m=/\bdeals? damage equal to (my|its|their|his|her|that unit's) Might/i.exec(e)))return r({k:'dmgM',who:/my|his|her/i.test(m[1])?'self':'linked',split:/\bsplit\b/i.test(e),unsure:/\beach other\b/i.test(e)?'kölcsönös damage, az elemzés nem számolja':undefined});
  if(/\bmove\b/i.test(e))return r({k:'move'});
  if(/\[?\bstun\b\]?/i.test(e)&&!/\bstunned\b/i.test(e))return r({k:'stun'});
  if(/^buffs? give\b/i.test(e))return {k:'other',unsure:'buffok erősítése (folyamatos hatás), az elemzés nem számolja'};
  if(/\bbuff\b/i.test(e))return r({k:'buff'});
  if(/\bdouble\b[^.]*\bMight\b/i.test(e))return r({k:'double'});
  if((m=/\bgive[^.]*?\+\s*\[S\] equal to (?:its|their|that unit's) Might/i.exec(e)))return r({k:'mightEq'});
  if((m=/\b(?:give|gets?|has|have)\b[^.]*?([+-]\d+) \[S\]/i.exec(e))){const mn=/to a minimum of (\d+) \[S\]/i.exec(e);return r({k:'might',n:+m[1],min:mn?+mn[1]:null,self:/\bgive me\b|\bI (?:get|have)\b/i.test(e)});}
  if((m=/\b(?:give|gains?)\b[^.]*\[(Assault|Shield|Tank|Backline|Ganking|Deflect|Temporary|Vision|Hidden)(?: (\d+))?\]/i.exec(e))){const all=[...e.matchAll(/\[(Assault|Shield|Tank|Backline|Ganking|Deflect|Temporary|Vision|Hidden)(?: (\d+))?\]/gi)].map(x=>x[1]+(x[2]?' '+x[2]:''));return r({k:'kw',kw:m[1],n:m[2]?+m[2]:null,all,self:/\bgive me\b/i.test(e)});}
  if(/\bready (?:your |up to \d+ |\d+ )?(?:friendly )?runes?\b|\bready (?:your|their) runes\b/i.test(e))return r({k:'runes'});
  if(/^(?:you may )?ready\b|\bready (?:it|me|them|a|an|up to|that|your|all|each|another)\b/i.test(e))return r({k:'ready'});
  if(/^(?:you may )?exhaust\b|\bexhaust (?:it|me|them|a|an|up to|that|all|each|another)\b/i.test(e))return r({k:'exhaust'});
  if((m=/\bdraws? (\d+|a card|one)\b/i.exec(e)))return r({k:'draw',n:/^\d+$/.test(m[1])?+m[1]:1});
  if(/\bdraw (?:it|them|that card)\b/i.test(e))return r({k:'draw',n:1,pick:true});
  if((m=/\bchannels? (\d+) runes?\b/i.exec(e)))return r({k:'channel',n:+m[1]});
  if((m=/\bdiscards? (\d+|a card|one|that card)\b/i.exec(e)))return r({k:'discard',n:/^\d+$/.test(m[1])?+m[1]:1});
  if(/\b(?:play|create)s? (?:a|an|one|two|three|four|five|\d+)\b[^.]*\btokens?\b/i.test(e))return r({k:'token'});
  if(/\bheal\b/i.test(e))return r({k:'heal'});
  if(/\bdisempower\b/i.test(e))return r({k:'disempower'});
  if(/\bempower (?:me|it|a|this|another|something)\b/i.test(e))return r({k:'empower'});
  if((m=/\b(?:scores?|gains?) (\d+) points?\b/i.exec(e)))return r({k:'score',n:+m[1]});
  if((m=/\b(?:gains?|lose|loses|pay|spend)s? (\d+) XP\b/i.exec(e)))return r({k:'xp',n:+m[1]});
  if(/^\[(?:Predict|Burn)(?: \d+)?\]|\bpredict\b|\bburn \d+\b/i.test(e))return r({k:'deck'});
  if(/\b(?:look at|reveal)s? the top\b|\breveals? (?:their|your|his|her) hand\b|\brecycle\b|\bshuffle\b|\breveal (?:a|an|up to \w+|any number of)\b[^.]*\bfrom among\b/i.test(e))return r({k:'deck'});
  if(/^(?:you may )?pay \[|^(?:you may )?pay \d+|^(?:you may )?spend\b/i.test(e))return r({k:'pay'});
  if((/\byou may play\b|\bplay (?:it|that card|a unit|a spell|a card|a gear|an equipment|them|me|this|all units|up to \d+ units)\b/i.test(e))&&!/\bto play (?:this|me)\b/i.test(e))return r({k:'playcard',self:/\bplay (?:me|this)\b/i.test(e),free:/ignoring (?:its|my|their|any and all) (?:energy )?costs?/i.test(e),from:/\bfrom (?:your |their )?trash\b/i.test(e)?'trash':/\bfrom (?:your )?hand\b/i.test(e)?'hand':/\bbanished\b|\bbanish\b/i.test(e)?'banish':'other'});
  if(/^(?:then,?\s*)?(?:if [^,]+,\s*)?(?:you may )?choose (?:a|an|up to|another|any|two|three)\b/i.test(e))return r({k:'choose'});
  if(/^(?:then,?\s*)?(?:you may )?choose an? (?:opponent|player)\b/i.test(e))return {k:'choose'};
  return {k:'other'};
}

/** Feltételek, amelyeket az elemzés ténylegesen kiértékel. */
export const KNOWN_COND=/^if (?:you do|you played this from your hand|you paid the additional cost|it's an equipment|this kills|it dies)\b/i;
/** A lap saját "enter ready" sora: how = 'always', 'board' (a boardról eldönthető), 'user' (nem követett adattól függ, a builderben állítható). */
export function enterReadyCond(c:any){if(!c||c.t!=='Unit')return null;const L=(c.txt||'').split('\n').map(stripRem).flatMap((l:string)=>/^If you do, I enter ready/i.test(l.split(/(?<=\.)\s+/).pop()||'')?l.split(/(?<=\.)\s+/).slice(-1):[l]);
  for(const l of L){if(!/\benter ready\b/i.test(l)||/^(?:other|your|friendly|units)\b/i.test(l))continue;
    if(/^I enter ready\.?$/i.test(l))return {how:'always',t:l};
    if(/^If you do, I enter ready\.?$/i.test(l))return {how:'addc',t:l};
    if(/^I enter ready if you control another (\w+)\.?$/i.test(l)||/^I enter ready if you control no other units\.?$/i.test(l)||/^I enter ready if you have two or more other units in your base\.?$/i.test(l)||/^If you play me to a battlefield, I enter ready\.?$/i.test(l)||/^If an opponent controls a battlefield, I enter ready\.?$/i.test(l)||/^If an opponent controls a stunned unit\b/i.test(l))return {how:'board',t:l};
    if(/^\[Level \d+\]|score is (?:not )?within 3 points|died this turn|in your trash/i.test(l))return {how:'state',t:l};
    if(/^You may have me enter ready|showed off/i.test(l))return {how:'choice',t:l};
    return {how:'hidden',t:l};}
  return null;}
/** Művelet a lap kézi leírásával (cardRules.ts), ha van, különben az általános felismerés. */
export function actOfCard(t:string,cardName?:string){const ov=cardOv(cardName,t);if(ov)return Object.assign({},ov,{k:ov.k,ov,re:undefined});return actOf(t);}
/** Utasítás besorolása a lefedettséghez: 'other' (nem felismert), 'unsure' (bizonytalan), 'user' (felismert, de a builderben kell megadni egy adatot), 'known'. */
export function classOf(t:string,cardName?:string){const ov=cardOv(cardName,t);if(ov)return ov.hidden?'hidden':ov.open?'open':'known';
  const a=actOf(t);if(a.k==='other')return 'other';if(a.unsure)return 'unsure';
  if(a.cond&&a.cond.how==='hidden')return 'hidden';
  if(a.cond&&a.cond.how==='open')return 'open';
  if(a.k==='playcard'&&(a.from==='hand'||/\b(?:play|plays) it\b/i.test(t)&&!/\bbanish/i.test(t)))return 'hidden';
  return 'known';}
/** Miért kér adatot egy rejtett információra épülő utasítás (a lefedettségi riporthoz és a mezők címkéjéhez). */
export function hiddenWhy(t:string,cardName?:string){const ov:any=cardOv(cardName,t);if(ov)return ov.why||'rejtett információ (kéz vagy deck)';const a:any=actOf(t);
  if(a.cond&&a.cond.how==='hidden')return a.cond.why;if(a.k==='playcard')return 'a kijátszott lap a kézből vagy rejtett zónából jön, a builderben választható';return '';}
export const allScope=(eff:string)=>{const m=/\b(all|each) (other )?(friendly |enemy )?(units?|gear)\b([^.]{0,30})/i.exec(eff)||/\b(?:to|kill|stun|ready|exhaust|give)\s()(other )?(friendly |enemy )(units|gear)\b((?: here| there| at battlefields?| in (?:your |their )?bases?)[^.]{0,20})/i.exec(eff);if(!m||/\beach of\b/i.test(eff))return null;
  return {rel:(m[3]||'').trim()?m[3].trim().toLowerCase():/^\s*(?:you control|of yours)\b/i.test(m[5]||'')?'friendly':/^\s*(?:an opponent controls|your opponents control)\b/i.test(m[5]||'')?'enemy':'any',type:/gear/i.test(m[4])?'gear':'unit',here:/\bhere\b/i.test(m[5]),there:/\bthere\b/i.test(m[5]),atbf:/at (?:a |each )?battlefields?/i.test(m[5]),inbase:/\bin (?:a |their |your |its )?bases?\b/i.test(m[5]),other:!!m[2]};};
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
    const det=actOfCard(x.t,inf.c&&inf.c.n);const dir=DIRECT_RE.test(x.t);const detLk=xi>0&&(dir||LINK_RE.test(x.t.replace(/\bits (?:own )?(?:base(?! Might)|location)\b/ig,'')));
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
    let eff=tr.eff;let killSelf=false;let modes:string[]=[];if(tr.modal&&tr.opts.length){modes=tr.opts;const md=Math.max(0,Math.min(s.mode||0,modes.length-1));eff=eff.replace(/(?:then,?\s*)?(?:you may )?choose one\b.*$/i,'').trim()+' '+modes[md];}const km=/^you may kill me to\s+/i.exec(eff);if(km){killSelf=true;eff=eff.slice(km[0].length);}
    return {c,tr,eff,list:phrasesTxt(eff),isTg:true,killSelf,may:/^you may\b/i.test(tr.eff),modes};}
  const c=vsCard(s.n);if(!c)return null;
  if(s.k==='ab'){const sc=srcCard(CS,s.src);const ab=abilitiesOf(sc)[s.ai||0];if(!ab)return {c,ab:null,eff:'',list:[],trig:false,isAb:true};
    return {c:sc,ab,eff:ab.eff,list:ab.add?[]:ab.equip?[{type:'unit',rel:'friendly',max:null,bf:false,opt:false}]:phrasesTxt(ab.eff),trig:false,isAb:true,may:/^you may\b/i.test(ab.eff)};}
  const cost=costOf(c);
  let pt=/(?:^|\n)\s*when you play (?:me|this)( from face down)?(?: or [^,.]*)?[,.]\s*([^\n]*)/i.exec(c.txt||'');const fdOnly=!!(pt&&pt[1]);if(pt)pt=[pt[0],pt[2]] as any;
  let ptE=pt?stripRem(pt[1]):'';
  if(!pt&&/^\[Quick-Draw\]/m.test(c.txt||'')){ptE='Attach this to a unit you control.';pt=[ptE,ptE];}
  let cond:any=fdOnly?'facedown':null;const cm=/^if you paid the additional cost,\s*/i.exec(ptE);if(cm){cond='paid';ptE=ptE.slice(cm[0].length);ptE=ptE[0].toUpperCase()+ptE.slice(1);}
  /* "When you play me, if X, ...": az "if" a trigger feltételének része (383.2.a.1); ha a játékállapotból vagy a boardról kiértékelhető, a kijátszáskor dől el, triggerel-e */
  let tcond:any=null;if(!cm){const ic=/^if ([^,]+),\s*/i.exec(ptE);const cd:any=ic?condOf(ptE):null;if(ic&&cd&&(cd.how==='state'||cd.how==='board')){tcond=cd;ptE=ptE.slice(ic[0].length);ptE=ptE[0].toUpperCase()+ptE.slice(1);}}
  let modes:string[]=[];let e=ptE;
  if(c.t==='Spell'){const L=(c.txt||'').split('\n').map(stripRem).filter((l:string)=>l&&!KW_ONLY.test(l)&&!COST_LINE.test(l)&&!/^\[Repeat\]/.test(l)).map((l:string)=>l.replace(KW_HEAD,'').trim());const md=modalSplit(L,s.mode);modes=md.opts;e=stripRem(md.lines.join(' ')+(c.eff?' '+c.eff:''));
    /* [Repeat] (820): minden kifizetett ismétlési költség egy további végrehajtás, új választásokkal (820.1.d.1, 820.2, 820.2.a) */
    const rl=/^\[Repeat\]\s*(?:\u2014\s*)?([^(\n]*)/m.exec(c.txt||'');
    if(s.rep&&rl){const nCost=Math.max(1,rl[1].split('/').filter((x:string)=>x.trim()).length);const times=Math.min(nCost,s.rep===true?1:Math.max(0,+s.rep||0));
      const ms=[s.mode||0,s.mode2,s.mode3,s.mode4].map((m:any)=>m==null?(s.mode||0):+m).slice(0,times+1);
      const effs=[e].concat(ms.slice(1).map((m:number)=>modes.length?stripRem(modalSplit(L,m).lines.join(' ')):e));
      let repBad='';if(modes.length&&/choose one you haven't already chosen/i.test(c.txt||'')&&new Set(ms).size<ms.length)repBad='a lap minden végrehajtáshoz olyan módot kér, amelyet még nem választottak ("Choose one you haven\'t already chosen")';
      if(times)return {c,eff:effs.join(' '),list:effs.flatMap((x:string)=>phrasesTxt(x)),trig:!!pt,may:/^you may\b/i.test(e),cost,cond,modes,rep:times,repN:nCost,repModes:ms,repBad};}}
  return {c,eff:e,list:phrasesTxt(e),trig:!!pt,may:/^you may\b/i.test(e),cost,cond,modes,tcond,repN:(()=>{const rl=/^\[Repeat\]\s*(?:\u2014\s*)?([^(\n]*)/m.exec(c.txt||'');return rl?Math.max(1,rl[1].split('/').filter((x:string)=>x.trim()).length):0;})()};
}

/* ---------- Elemzés ---------- */
const INS_ST:any={executed:'végrehajtódik',partial:'részben hajtódik végre',ignored:'Ignored',negated:'Negated',skipped:'nem hajtódik végre'};
const RES:any={ok:'lefutott',partial:'részben futott le',fizzle:'hatás nélkül',countered:'counterelve',removed:'lekerült a chainről'};
const art=(x:string)=>(/^[aáeéiíoóöőuúüű]/i.test(x)?'az ':'a ')+x;const Art=(x:string)=>{const s=art(x);return s[0].toUpperCase()+s.slice(1);};
const other=(p:string)=>p==='A'?'B':'A';const WHO:any={A:'te',B:'az ellenfél'};const WHOC:any={A:'Te',B:'Az ellenfél'};
const LOCK=(l:string)=>l==='base'?'base':l;

/** Költségfeltétel egy választásban ("cost no more than [3] and no more than [A]", "Energy cost [4] or less", "Power cost [A][A] or more",
    "Energy cost no more than my Might", "Energy cost less than your points", "no more Energy and no more Power than the killed unit").
    A szám a nyomtatott Energy (131.2.a), a Power szimbólumok száma a nyomtatott Power (131.3.a). e és p: [művelet, érték]; az érték szám vagy változó. */
export type CostCond={e?:[string,number|string];p?:[string,number|string];t:string};
export function costCondOf(t0:string):CostCond|null{const t=String(t0||'');let m:any;const c:any={t:''};
  const pw=(x:string)=>(x.match(/\[[A-Z]\]/g)||[]).length;
  if((m=/no more Energy and no more Power than the killed unit/i.exec(t))){c.e=['<=','relE'];c.p=['<=','relP'];c.t=m[0];return c;}
  if((m=/Energy cost no more than my Might/i.exec(t))){c.e=['<=','might'];c.t=m[0];return c;}
  if((m=/Energy cost less than your points/i.exec(t))){c.e=['<','points'];c.t=m[0];return c;}
  if((m=/\b(?:Energy cost|costs?|costing|with cost)\s+no more than \[(\d+)\](?:\s*(?:and|,)\s*(?:with\s+)?(?:Power cost\s+)?no more than ((?:\[[A-Z]\])+))?/i.exec(t))){c.e=['<=',+m[1]];if(m[2])c.p=['<=',pw(m[2])];c.t=m[0];}
  if((m=/\bPower cost no more than ((?:\[[A-Z]\])+)/i.exec(t))){c.p=['<=',pw(m[1])];c.t=(c.t?c.t+'; ':'')+m[0];}
  if(!c.e&&(m=/\b(?:Energy cost|costs?|with cost)\s+\[(\d+)\] or (more|less)\b/i.exec(t))){c.e=[m[2].toLowerCase()==='more'?'>=':'<=',+m[1]];c.t=(c.t?c.t+'; ':'')+m[0];}
  if(!c.p&&(m=/\bPower cost ((?:\[[A-Z]\])+) or (more|less)\b/i.exec(t))){c.p=[m[2].toLowerCase()==='more'?'>=':'<=',pw(m[1])];c.t=(c.t?c.t+'; ':'')+m[0];}
  return c.e||c.p?c:null;}
/** A lap nyomtatott költsége (206, 356.1.c): token 0 (185.3.a.1); hiányzó Power rész 0 (131.3.b, levezetés). */
export const printedCost=(card:any)=>{const tok=/token/i.test(((card&&card.st)||[]).join(' '));return {e:tok?0:+(card&&card.e!=null&&card.e!==''?card.e:0),p:tok?0:+(card&&card.p!=null&&card.p!==''?card.p:0)};};
export const COSTVAR:any={might:'a forrás Mightja',points:'a játékos pontszáma',relE:'a költségként megölt unit Energy költsége',relP:'a költségként megölt unit Power költsége'};
/** Költségfeltétel ellenőrzése a nyomtatott költségen; ctx: a változók (might, points, relE, relP). '' ha megfelel vagy nem ellenőrizhető. */
export function costCheck(cc:CostCond|null|undefined,card:any,ctx?:any){if(!cc||!card)return '';const pc=printedCost(card);const out:string[]=[];
  const ok=(op:string,a:number,b:number)=>op==='<='?a<=b:op==='>='?a>=b:op==='<'?a<b:true;const OPH:any={'<=':'legfeljebb','>=':'legalább','<':'kevesebb, mint'};
  ([['e','Energy költsége'],['p','Power költsége']] as const).forEach(([k,lbl])=>{const r=(cc as any)[k];if(!r)return;let v=r[1];if(typeof v==='string'){const nm=COSTVAR[v]||v;v=ctx?ctx[v]:null;if(v==null){out.push('a feltétel nem ellenőrizhető: '+nm+' nem elérhető, az erre épülő ellenőrzés null (359.3.e.12)');return;}}
    if(!ok(r[0],pc[k],+v))out.push(lbl+' '+pc[k]+', a feltétel '+OPH[r[0]]+' '+v);});
  return out.length?out.join('; ')+' (206)':'';}

/** Kézből, deckből vagy trashből választó utasítás (355.7, 355.9.a, 355.10.a). z: zóna; who: kinek a zónája ("your" = a lap irányítója);
    target: a trash nyilvános zóna, ezért az onnan választott lap célpont, a lerakáskor kell kiválasztani (355.8, 355.10.a, 108.2.d);
    a kéz (108.7.c) és a deck (108.4.e) nem nyilvános: ott a választás nem célpont, a resolve-kor történik (355.10.a, 355.18).
    n: legfeljebb ennyi lap; type: a lap típusa (unit, spell, gear vagy bármi); tags: kötelező tag; act: a művelet; opt: "you may" vagy "up to". */
export type ZoneRef={z:'trash'|'hand'|'deck'|'among';who:'you'|'they'|'any'|'each';n:number;type:string[];tags:string[];target:boolean;act:string;opt:boolean;top:boolean;t:string;cost?:CostCond|null};
const ZNUM:any={a:1,an:1,one:1,two:2,three:3,four:4,five:5};
export function zoneRefOf(t0:string,cardName?:string):ZoneRef|null{const r=zoneRef0(t0,cardName);if(r){const cc=costCondOf(r.t);if(cc)r.cost=cc;}return r;}
function zoneRef0(t0:string,cardName?:string):ZoneRef|null{const t=stripRem(String(t0||'')).replace(/^[-\u2014\u2013]\s*/,'');let m:any;
  const typesOf=(s:string)=>{const out:string[]=[];if(/\bunits?\b/i.test(s))out.push('unit');if(/\bspells?\b/i.test(s))out.push('spell');if(/\b(gear|equipment)\b/i.test(s))out.push('gear');return out;};
  const nOf=(s:string)=>{const u=/\bup to (\d+|one|two|three|four|five)\b/i.exec(s);if(u)return /^\d+$/.test(u[1])?+u[1]:ZNUM[u[1].toLowerCase()];const d=/\b(\d+|one|two|three)\s+(?:cards?|units?|spells?|gear)\b/i.exec(s);if(d)return /^\d+$/.test(d[1])?+d[1]:ZNUM[d[1].toLowerCase()];return 1;};
  const act=(actOfCard(t,cardName) as any).k;const opt=/\byou may\b|\bup to\b/i.test(t);
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
  if(/\bfrom among them\b/i.test(t)||/^(?:then,?\s*)?(?:you may )?(?:put 1 into your hand|banish one\b|choose one and banish it)/i.test(t)){const head=t.split(/\bfrom among them\b/i)[0];
    const tags=/\b(Bird|Cat|Dog|Poro)\b/.test(head)?['Bird','Cat','Dog','Poro']:[];
    const tyS=typesOf(head).length?head:t.replace(/\bfrom among them\b/i,'').replace(/\b(?:Energy|Power) cost\b/gi,'');
    return {z:'among' as any,who:'any',n:1,type:/\bcards?\b/i.test(head)?[]:typesOf(tyS),tags,target:false,act:/\bplay it\b/i.test(t)?'playcard':/\bdraw it\b|\binto your hand\b/i.test(t)?'hand':/\bbanish\b/i.test(t)?'banish':'hand',opt:/\byou may\b/i.test(t),top:false,t};}
  // deck: titkos sorrend (108.4.e, 128.3); a felső lap(ok) vagy keresés ("from your Main Deck")
  if((m=/\btop (card|\d+ cards|two cards|three cards) of (your|their) (?:main )?deck\b/i.exec(t))){const k=m[1].toLowerCase();const n=k==='card'?1:k.startsWith('two')?2:k.startsWith('three')?3:parseInt(k,10);return {z:'deck',who:m[2].toLowerCase()==='their'?'they':'you',n,type:[],tags:[],target:false,act,opt,top:true,t};}
  if((m=/\bfrom your (?:main )?deck\b/i.exec(t))&&/\b(search|play|put|reveal|look)\b/i.test(t))return {z:'deck',who:'you',n:nOf(t.slice(0,m.index)),type:typesOf(t.slice(0,m.index)),tags:[],target:false,act,opt,top:false,t};
  return null;}
/** Rejtett adatot kérő utasítás, amely a pályás építőben konkrét lap kiválasztásával kiváltható (kéz, deck felső lapja, trash, eldobott lap). */
export function zoneResolvable(t:string,c:any){if(zoneRefOf(t,c&&c.n))return true;const a:any=actOfCard(t,c&&c.n);
  if(a.field&&/eldobott lap/i.test(a.field.label||''))return true;
  if(a.cond&&a.cond.how==='hidden'&&/^it's an? (?:gear|spell|unit)$|^it is a unit$/i.test(a.cond.t)&&/\btop card of (?:your|their) main deck\b/i.test((c&&c.txt)||''))return true;
  return false;}
/** A zónából választott lap megfelel-e a lap szövegének (kinek a zónája, típus, tag); '' ha igen. A zóna-tagságot a hívó ellenőrzi. */
export function zoneCheck(zr:ZoneRef,ob:any,pl:string,ctx?:any){const own=zr.who==='you'?[pl]:zr.who==='they'?[pl==='A'?'B':'A']:['A','B'];if(!ob||!ob.card)return 'ismeretlen lap';
  if(!own.includes(ob.own||ob.ctrl))return 'nem '+(zr.who==='you'?'a saját':'az ellenfél')+' '+(zr.z==='trash'?'trashében':zr.z==='hand'?'kezében':'deckjében')+' van';
  if(zr.type.length&&!zr.type.includes(String(ob.card.t).toLowerCase()))return 'nem '+zr.type.join(' vagy ')+' ('+ob.card.t+')';
  if(zr.tags.length&&!zr.tags.some(t=>t==='[Hidden]'?/\[Hidden\]/.test(ob.card.txt||''):(ob.card.tg||[]).includes(t)))return 'nem '+zr.tags.join(', ');
  return costCheck(zr.cost,ob.card,ctx);}
export const ZONE_HU:any={trash:'trash',hand:'kéz',deck:'deck',banish:'banishment',board:'board',gone:'nem a zónában',played:'kijátszva',chain:'chain'};

export type ChainResult={frames:any[];html:string;story:string[];done:any[];rows:[string,string][];ev:any[];objs:any;items:any[];delayed:any[];empty:boolean;zsnap?:any};

export function analyze(CS:any):ChainResult{
  const LOCS=()=>[['base','Base'],['bf0',(CS.bf[0].n||'1. battlefield')],['bf1',(CS.bf[1].n||'2. battlefield')]];
  const locLabel=(l:string)=>(LOCS().find(x=>x[0]===l)||['',l])[1];
  let MT:any=null;const MTIDS=new Set<string>();
  const S=CS.steps.map((s:any,j:number)=>{if(s&&(s.k==='res'||s.k==='end'))return {k:s.k,j,pl:s.pl||'A',c:{n:'',t:'',txt:''},tg:[],ext:{},list:[]};const inf=stepInfo(CS,s);return inf&&inf.c?Object.assign({},s,inf,{j,tg:(s.tg||[]).slice(),ext:s.ext||{}}):null;}).filter(Boolean);
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
  const mightOf=(id:string):number|null=>{const ob=O[id];if(!ob||ob.m==null||ob.zone!=='board')return null;let m=(ob.baseSet!=null?ob.baseSet:ob.m)+(ob.bu?(BUF2(ob.ctrl)?2:1):0);
    Object.values(O).forEach((g:any)=>{if(g.on===id&&g.zone==='board'&&g.card&&g.card.m)m+=+g.card.m;});
    const t=(ob.card&&ob.card.txt)||'';let x;
    if((x=/while there's a stunned enemy unit here, I have \+(\d+) \[S\]/i.exec(t))&&Object.values(O).some((u:any)=>u.zone==='board'&&u.type==='unit'&&u.st&&u.ctrl!==ob.ctrl&&u.loc===ob.loc))m+=+x[1];
    if((x=/^\[Empowered\]\[>\]\s*I have \+(\d+) \[S\]/m.exec(t))&&ob.emp)m+=+x[1];
    (ob.mods||[]).forEach((md:any)=>{m=m+md.n;if(md.min!=null&&md.n<0)m=Math.max(m,md.min);if(md.dbl)m=m+Math.max(0,m);});
    return m;};
  const BUF2=(p:string)=>typeof BUFF2!=='undefined'&&BUFF2[p];
  const lethal=(id:string)=>{const ob=O[id];if(!onB(id)||ob.type!=='unit')return false;const m=mightOf(id);return m!=null&&ob.dmg>0&&ob.dmg>=m;};
  CS.bd.forEach((b:any,i:number)=>{const c=vsCard(b.n);if(!c)return;O['b'+i]={id:'b'+i,name:c.n,card:c,ctrl:b.pl,own:b.pl,loc:b.loc,baseOf:b.pl,m:c.t==='Unit'?(b.m!=null?b.m:(c.m!=null?+c.m:null)):null,dmg:b.d||0,dealt:(b.d||0)>0,atk:b.atk||'',ex:!!b.ex,st:!!b.st,bu:!!b.bu,emp:!!b.emp,mods:[],kws:[],zone:'board',type:c.t.toLowerCase()==='unit'?'unit':c.t==='Gear'?'gear':c.t.toLowerCase(),board:true};});
  CS.bd.forEach((b:any,i:number)=>{if(O['b'+i]&&b.on!=null&&O['b'+b.on]&&O['b'+i].type==='gear'){O['b'+i].on='b'+b.on;O['b'+i].loc=O['b'+b.on].loc;}});
  ['A','B'].forEach(p=>{const c=vsCard(CS.lg[p]);if(c)O['L'+p]={id:'L'+p,name:c.n,card:c,ctrl:p,own:p,zone:'legend',type:'legend',emp:false,ex:false};});
  /* Kéz, trash és deck tartalma (a pályás építő mezői, nem kötelező): "zc" objektumok, a többi lapszámítás nem látja őket. Ha nincs megadva, az elemzés változatlan. */
  const ZC=!!(CS.hand||CS.trash||CS.deck||(CS.steps||[]).some((x:any)=>x&&x.zp));const zcK:any={hand:'h',trash:'t',deck:'d'};
  if(ZC)(['hand','trash','deck'] as const).forEach(z=>['A','B'].forEach(p=>((CS[z]||{})[p]||[]).forEach((e:any,i:number)=>{const n=typeof e==='string'?e:e&&e.n;const c=vsCard(n);if(!c)return;const id=typeof e==='string'||!e.id?'z'+zcK[z]+p+i:e.id;O[id]={id,name:c.n,card:c,own:p,ctrl:p,zone:z,type:'zc',ord:i,gen:0};})));
  const zcMove=(id:string,to:string)=>{const ob=O[id];if(!ob)return;ob.zone=to;ob.gen=(ob.gen||0)+1;EV.push({k:'zcard',id,name:ob.name,to});};
  /** Választható lapok egy zónában: zc objektumok és a játék közben oda került lapok (meghalt unit, lefutott spell a trashben). */
  const zoneIds=(z:string,p:string)=>Object.keys(O).filter(id=>{const ob=O[id];return ob.card&&ob.zone===z&&(ob.own||ob.ctrl)===p&&(ob.type==='zc'||ob.type==='unit'||ob.type==='gear'||ob.type==='spell');}).sort((a,b)=>(O[a].ord??99)-(O[b].ord??99));
  out.zsnap={};
  /** Egy zónából választott lap legális-e (a lap szövegének megkötései: kinek a zónája, típus, tag, darabszám). Üres string: legális. */
  const zcWhy=(zr:ZoneRef,ids:string[],pl:string,res:boolean,ctx?:any)=>{const out:string[]=[];
    if(ids.length>zr.n)out.push('legfeljebb '+zr.n+' lap választható');
    ids.forEach(id=>{const ob=O[id];if(!ob||!ob.card){out.push('nincs megadva: a kiválasztott lap már nincs a helyzetben (törölték), újra kell választani');return;}
      if(ob.zone!==zr.z){out.push(ob.name+' nincs '+(zr.z==='trash'?'a trashben':zr.z==='hand'?'a kézben':'a deckben')+(res?' a resolve-kor':'')+' (most: '+(ZONE_HU[ob.zone]||ob.zone)+')');return;}
      const w=zoneCheck(zr,ob,pl,ctx);if(w)out.push(ob.name+' '+w);});
    return out.join('; ');};
  /** A költségfeltétel változói a választás pillanatában: a forrás Mightja, a játékos pontszáma, a költségként megölt unit nyomtatott költsége. */
  const zctx=(it:any,s:any)=>{const k=s&&s.costTg&&O[s.costTg]&&O[s.costTg].card?printedCost(O[s.costTg].card):null;return {might:it.src&&onB(it.src)?mightOf(it.src):null,points:scoreOf(it.pl),relE:k?k.e:null,relP:k?k.p:null};};
  const cnt:any={};S.forEach((s:any)=>{if(s.k!=='res'&&s.k!=='end')cnt[s.c.n]=(cnt[s.c.n]||0)+1;});
  MAIN.forEach((s:any)=>{const j=s.j;const c=s.c;if(s.k==='res'||s.k==='end')return;
    if(s.k==='ab'||s.k==='tg'){const sc=s.src&&O[s.src];O['s'+j]={id:'s'+j,name:c.n+(s.k==='ab'?' abilityje':' triggere'),card:c,ctrl:s.k==='tg'&&sc?sc.ctrl:s.pl,own:s.k==='tg'&&sc?sc.ctrl:s.pl,zone:'pending',type:'ability',src:s.src,stepJ:j};return;}
    const nmx=c.n+(cnt[c.n]>1?' ('+(j+1)+'.)':'');
    if(isPermC(c))O['s'+j]={id:'s'+j,name:nmx,card:c,ctrl:s.pl,own:s.pl,loc:s.loc||(s.from==='facedown'?'bf0':'base'),baseOf:s.pl,m:c.t==='Unit'&&c.m!=null?+c.m:null,dmg:0,mods:[],kws:[],zone:'pending',type:c.t==='Unit'?'unit':'gear',ex:false,accel:!!s.accel};
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
  const snap=(label:string,items:any[],sj?:number)=>{
    const vis=(items||[]).filter((it:any)=>!(it.objId&&O[it.objId]&&O[it.objId].zone==='countered')).slice().reverse();
    const mk=()=>({base:[],trash:[],banish:[],hand:[]});const side:any={A:mk(),B:mk()};const bfs=[0,1].map(i=>({name:CS.bf[i].n||(i+1)+'. battlefield',ctrl:pside(BF['bf'+i].ctrl),me:[],opp:[],i}));
    const shown=new Set<string>();
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='unit'&&ob.type!=='gear')return;const p=ob.ctrl==='B'?'B':'A';
      if(ob.zone==='gone')return;
      if(ob.zone!=='board'){const nmC=ob.card?ob.card.n:ob.name;const op=ob.own==='B'?'B':'A';if(ob.zone==='trash')side[op].trash.push(nmC);else if(ob.zone==='banish')side[op].banish.push(nmC);else if(ob.zone==='hand')side[op].hand.push(nmC);return;}
      if(ob.type==='gear'&&ob.on&&onB(ob.on))return;
      const mt=ob.type==='unit'?mightOf(id):null;const st:string[]=[];
      if(ob.st)st.push('stunned');if(ob.bu)st.push('buffed');if(ob.emp)st.push('empowered');if(ob.type==='unit'&&lethal(id))st.push('dying');if(MTIDS.has(id))st.push('mistarget');
      if(DET.has(id))st.push('detached');if((ob.shields||[]).length)st.push('shield');if(ob.save||ob.dieTo)st.push('save');if(ob.dbl)st.push('dbl');if(REPL.has(id))st.push('repl');if(ob.ctrl&&ob.own&&ob.ctrl!==ob.own)st.push(NEWCTRL.has(id)?'ctrlnew':'ctrl');
      (ob.kws||[]).forEach((k:string)=>st.push('kw:'+k));
      const gear=Object.values(O).filter((g:any)=>g.on===id&&g.zone==='board').map((g:any)=>g.card?g.card.n:g.name);
      const u:any={id,n:ob.card?ob.card.n:ob.name,m:mt!=null?mt:0,dmg:ob.dmg||0,ex:!!ob.ex,gear,status:st};
      if(ob.type==='gear'){u.kind='gear';u.base=0;u.m=0;}
      if(ob.type==='unit'&&mt==null){u.base=0;u.mods=['Might ismeretlen'];}
      if(ob.card&&/token/i.test((ob.card.st||[]).join(' ')+' '+(ob.card.tg||[]).join(' ')))u.token=true;
      shown.add(id);
      if(ob.loc==='base'){const bp=ob.baseOf==='B'?'B':ob.baseOf==='A'?'A':p;side[bp].base.push(Object.assign(u,bp!==p?{tag:'idegen base'}:{}));}else{const f=bfs[ob.loc==='bf1'?1:0];(p==='A'?f.me:f.opp).push(u);}});
    Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='spell')return;const p=ob.own==='B'?'B':'A';if(ob.zone==='trash'||ob.zone==='countered')side[p].trash.push(ob.card.n);});
    const zids:any={A:{hand:[],trash:[]},B:{hand:[],trash:[]}};
    if(ZC){/* a kéz és a trash lapjainak azonosítói, a kirajzolt listával azonos sorrendben (a pályás építő ezzel választ) */
      Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='unit'&&ob.type!=='gear')return;if(ob.zone==='trash'||ob.zone==='hand')zids[ob.own==='B'?'B':'A'][ob.zone].push(id);});
      Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type==='spell'&&(ob.zone==='trash'||ob.zone==='countered'))zids[ob.own==='B'?'B':'A'].trash.push(id);});
      Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type!=='zc')return;const p=ob.own==='B'?'B':'A';if(ob.zone==='trash'||ob.zone==='hand'||ob.zone==='banish'){side[p][ob.zone].push(ob.card.n);if(ob.zone!=='banish')zids[p][ob.zone].push(id);}});}
    const used=bfs.filter(f=>CS.bf[f.i].n||f.me.length||f.opp.length);const bfPos=(i:number)=>used.findIndex(f=>f.i===i);
    const arrows:any[]=[];
    vis.forEach((it:any,ci:number)=>{(it.list||[]).forEach((p:any,ti:number)=>{const v=(it.tg||[])[ti];if(!v)return;
      if(v==='F0'||v==='F1'){const k=bfPos(+v[1]);if(k>=0)arrows.push({from:ci,to:'bf:'+k});return;}
      const ob=O[v];if(!ob)return;
      if(ob.type==='spell'||ob.type==='ability'){const k=vis.findIndex((x:any)=>x.objId===v);if(k>=0)arrows.push({from:ci,to:'c:'+k});return;}
      if(shown.has(v))arrows.push({from:ci,to:'u:'+v});else if(ob.type==='gear'&&ob.on&&shown.has(ob.on))arrows.push({from:ci,to:'u:'+ob.on});});});
    const lg=(p:string)=>O['L'+p]?O['L'+p].card.n:undefined;
    const ps=(p:string)=>Object.assign({legend:lg(p),legendEx:!!(O['L'+p]&&O['L'+p].ex),base:side[p].base,hand:side[p].hand,trash:side[p].trash,banish:side[p].banish},ZC?{zids:zids[p],deck:((CS.deck||{})[p]||[]).length?Object.values(O).filter((o:any)=>o.type==='zc'&&o.zone==='deck'&&o.own===p).length:undefined}:{});
    FR.push({label,board:{me:ps('A'),opp:ps('B'),bfs:used.map(({i,...f})=>f),chain:vis.map(itemName)},changes:REC||[],arrows,bfi:used.map(f=>f.i),mt:MT,sj});REC=[];MT=null;MTIDS.clear();DET.clear();NEWCTRL.clear();REPL.clear();};
  // battlefield állandó hatások
  ['bf0','bf1'].forEach(l=>{const b=BF[l];if(b.c){const known=/can.t move from here to base|can.t be played here/i.test(b.c.txt||'');notes.push(line('169',esc(b.c.n)+' ('+(b.ctrl==='A'?'te irányítod':b.ctrl==='B'?'az ellenfél irányítja':'senki nem irányítja')+'): '+esc(stripRem(b.c.txt))+(known?' <b>Ezt az állandó hatást az elemzés figyelembe veszi.</b>':' Ezt a hatást az elemzés nem értékeli ki, ha számít, vedd figyelembe.'),known?0:1));}});
  ALL.length=0;
  const bfBlocksBase=(l:string)=>BF[l]&&BF[l].c&&/can.t move from here to base/i.test(BF[l].c.txt||'');
  const bfBlocksPlay=(l:string)=>BF[l]&&BF[l].c&&/can.t be played here/i.test(BF[l].c.txt||'');
  const chain:any[]=[];let stack:any[]=[];const REPL=new Set<string>();const READY:any={A:false,B:false};const BUFF2:any={A:false,B:false};const PREVSA:any={on:false};
  /** 143.4: a unit exhausted lép be. Kivétel (143.4.a): kifizetett Accelerate (805.6), a lap saját "I enter ready" sora (369.3; feltételes sornál a feltétel kiértékelve, vagy a builderben megadva),
      más lap folyamatos hatása (Confront, Bushwhack, Magma Wurm, Firebrand Raider, Renata, Riven legend, Sun Disc). Visszaadja: {ready, why, note}. */
  const READYNEXT:any={A:false,B:false};
  const ST:any={};
  /* ---- játékállapot: builder mezők (kezdőértékek) és a lépésekből számolt változások ---- */
  const PSD:any={xp:0,score:0,runes:0,runeDeck:12,played:0,playedT:'',spent:0,hand:0,diedT:0};
  const PSv=(p:string,k:string)=>{const v=((CS.ps||{})[p]||{})[k];return v==null||v===''?PSD[k]:v;};
  const VS=()=>+(CS.vs||8);
  const evSum=(k:string,p:string)=>EV.filter((e:any)=>e.k===k&&e.pl===p).reduce((a:number,e:any)=>a+(e.n||0),0);
  const xpOf=(p:string)=>+PSv(p,'xp')+evSum('xp',p);const scoreOf=(p:string)=>+PSv(p,'score')+evSum('score',p);
  const runesOf=(p:string)=>+PSv(p,'runes')+evSum('channel',p);const runeDeckOf=(p:string)=>Math.max(0,+PSv(p,'runeDeck')-evSum('channel',p));
  /** A lépés előtt az adott játékos által (ebben a körben) kijátszott lapok típusai: a builder lépései és a korábbi kijátszások mezője. */
  const playedBefore=(p:string,j:number)=>{const out=new Set<string>();MAIN.forEach((t:any)=>{if(t.k==='card'&&t.j<j&&t.pl===p&&!t.illegal&&t.c){const tok=/token/i.test((t.c.st||[]).join(' '));out.add((tok?'token':'')+t.c.t.toLowerCase());}});
    String(PSv(p,'playedT')||'').split(',').filter(Boolean).forEach((x:string)=>out.add(x));return out;};
  ST.xpOf=xpOf;ST.scoreOf=scoreOf;ST.VS=VS;
  ST.diedT=(p:string,gearToo:boolean)=>+PSv(p,'diedT')>0||EV.some((e:any)=>e.k==='zone'&&e.to==='trash'&&O[e.id]&&O[e.id].own===p&&(O[e.id].type==='unit'||gearToo&&O[e.id].type==='gear'));
  const enterReady=(c:any,pl:string,accel:boolean,loc?:string,erd?:string,selfId?:string,addc?:boolean)=>{const out:any={ready:false,why:'',note:''};if(!c||c.t!=='Unit')return out;
    const yes=(w:string)=>{out.ready=true;out.why=out.why||w;};
    if(accel&&/^\[Accelerate\]/m.test(c.txt||''))yes('Accelerate kifizetve, 143.4.a, 805.6');
    const ec=enterReadyCond(c);
    if(ec){if(ec.how==='always')yes('"I enter ready", 369.3');
      else if(ec.how==='addc'){if(addc)yes('"'+ec.t+'": az additional cost kifizetve, 143.4.a');else out.note='"'+esc(ec.t)+'": az additional cost nincs kifizetve, ezért exhausted lép be.';}
      else{let v:boolean|null=null;const l=ec.t;let m;const cnt=(f:(o:any)=>boolean)=>Object.values(O).filter((o:any)=>o.zone==='board'&&o.id!==selfId&&f(o)).length;
        if((m=/if you control another (\w+)/i.exec(l)))v=cnt((o:any)=>o.ctrl===pl&&o.card&&((o.card.tg||[]).some((t:string)=>t.toLowerCase()===m[1].toLowerCase())||new RegExp('\\b'+m[1]+'\\b','i').test(o.card.n)))>0;
        else if(/if you control no other units/i.test(l))v=cnt((o:any)=>o.ctrl===pl&&o.type==='unit')===0;
        else if(/two or more other units in your base/i.test(l))v=cnt((o:any)=>o.ctrl===pl&&o.type==='unit'&&o.loc==='base'&&(o.baseOf||o.ctrl)===pl)>=2;
        else if(/if you play me to a battlefield/i.test(l))v=!!loc&&loc!=='base';
        else if(/if an opponent controls a battlefield/i.test(l))v=['bf0','bf1'].some(k=>BF[k].c&&BF[k].ctrl===other(pl));
        else if(/if an opponent controls a stunned unit/i.test(l))v=cnt((o:any)=>o.ctrl===other(pl)&&o.type==='unit'&&o.st)>0;
        else if(ec.how==='state'&&ST.xpOf){if((m=/^\[Level (\d+)\]/i.exec(l)))v=ST.xpOf(pl)>=+m[1];
          else if(/^If your score is not within 3 points/i.test(l))v=ST.VS()-ST.scoreOf(pl)>3;
          else if(/^If an opponent's score is within 3 points/i.test(l))v=ST.VS()-ST.scoreOf(other(pl))<=3;
          else if(/died this turn/i.test(l)){const fr=/friendly unit or gear/i.test(l);v=/^If a unit died/i.test(l)?ST.diedT('A',false)||ST.diedT('B',false):ST.diedT(pl,fr);}
          else if(/a card with my name in your trash/i.test(l))v=Object.values(O).some((o:any)=>o.zone==='trash'&&o.own===pl&&o.card&&o.card.n===c.n)||erd==='1';
          if(v===false&&erd==='1'&&!/in your trash/i.test(l))v=true;}
        else if(erd==='1')v=true;else if(erd==='0')v=false;
        if(v===true)yes('"'+l+'" teljesül'+(ec.how==='state'?' (a játékállapotból számolva)':ec.how!=='board'?' (a lapnál megadva)':' (a boardon ellenőrizve)')+', 143.4.a');
        else if(v==null)out.note='"'+esc(l)+'": a feltétel rejtett vagy builderen kívüli adattól függ; a lapnál állítható, feltételezés: nem teljesül, ezért exhausted lép be (143.4).';
        else out.note='"'+esc(l)+'": a feltétel nem teljesül'+(ec.how==='state'?' (a játékállapotból számolva)':ec.how!=='board'?' (a builderben így állítva)':' (a boardon ellenőrizve)')+'.';}}
    if(READY[pl])yes('"Units you play this turn / Friendly units enter ready" hatás, 143.4.a');
    if(READYNEXT[pl]){READYNEXT[pl]=false;yes('Sun Disc: "The next unit you play this turn enters ready", 143.4.a');}
    const isTok=/token/i.test((c.st||[]).join(' ')+' '+(c.tg||[]).join(' '));const nt:string[]=[];
    Object.values(O).forEach((o:any)=>{if(!o.card||!(o.zone==='board'||o.zone==='legend')||o.id===selfId)return;(o.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{
      if(/^Other friendly units enter ready\b/i.test(l)&&o.ctrl===pl)yes(o.name+': "'+l+'", 143.4.a');
      else if(/^Other units enter ready\b/i.test(l))yes(o.name+': "'+l+'", 143.4.a');
      else if(/^Your tokens enter ready\b/i.test(l)&&o.ctrl===pl&&isTok)yes(o.name+': "'+l+'", 143.4.a');
      else if(/^Units you play to battlefields you control enter ready\b/i.test(l)&&o.ctrl===pl&&loc&&loc!=='base'&&BF[loc]&&BF[loc].ctrl===pl)yes(o.name+': "'+l+'", 143.4.a');
      else if(/enter ready\b/i.test(l)&&o.ctrl===pl&&!/^I enter ready|^If |^I enter ready if/i.test(l)&&!/^(?:Other friendly units|Other units|Your tokens|Units you play to battlefields you control) enter ready/i.test(l))nt.push(o.name+' ("'+l+'")');});});
    if(nt.length&&!out.ready)out.note=(out.note?out.note+' ':'')+'<span class="cbuns">nem követett ready belépés</span>: '+esc(nt.join(', '))+'; ha él, a unit ready lép be.';
    return out;};
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
  const leaveBoard=(id:string,zone:string)=>{const ob=O[id];const was=ob.zone==='board';ob.lk={m:mightOf(id),ctrl:ob.ctrl,loc:ob.loc,kws:(ob.kws||[]).slice(),alone:ob.zone==='board'?!Object.values(O).some((o:any)=>o.id!==id&&o.zone==='board'&&o.type==='unit'&&o.ctrl===ob.ctrl&&o.loc===ob.loc):null};ob.zone=zone;
    if(zone!=='board'){ob.dmg=0;ob.mods=[];ob.kws=[];ob.st=false;ob.bu=false;ob.shields=[];ob.save=null;ob.dbl=false;ob.dieTo=null;ob.baseSet=null;ob.untgt=false;if(ob.on){ob.on=null;}ob.ctrl=ob.own;ob.until=null;}
    EV.push({k:'zone',id,name:ob.name,to:zone});
    if(!was)return;
    Object.keys(O).forEach(k=>{const g=O[k];if(g.on===id&&g.zone==='board'){g.on=null;g.loc=ob.lk.loc;DET.add(k);EV.push({k:'detach',id:k,name:g.name,from:id});
      REC.push(['719.5, 436.4',g.name+' leválik '+ob.name+' lapról, és a helyén marad ('+locLabel(g.loc)+').'+(g.loc!=='base'?' Battlefielden álló, csatolatlan gear: a következő cleanupban recall-olódik (436.4.a, 323.6).':'')]);ALL.push(REC[REC.length-1]);
      story.push(Art(g.name)+' leválik '+art(ob.name)+' lapról'+(g.loc!=='base'?', és a következő cleanupban a base-be kerül':'')+'.');}});
    Object.keys(O).forEach(k=>{const g=O[k];if(g.until&&g.until.src===id&&g.zone==='board'){const prev=g.until.prev;g.until=null;setCtrl(k,prev,'391.5.b, 391.5.a',ob.name+' elhagyta a boardot, a "until I leave the board" kontroll véget ért');story.push(Art(g.name)+' irányítása visszakerül, mert '+ob.name+' elhagyta a boardot.');}});};
  /** Replacement a halál helyett (367, 369.1): saját "If I would die", csatolt gear Effect Textje (Guardian Angel), vagy friendly gear "If a friendly unit would die, kill this instead" (Zhonya's Hourglass). */
  const deathRepl=(id:string)=>{const ob=O[id];if(!ob||ob.type!=='unit')return null;
    if(ob.dieTo)return {by:null,dieTo:ob.dieTo,txt:'If it would die this turn, banish it instead.'};
    if(ob.save)return {by:null,save:true,txt:ob.save.src+': heal, exhaust, recall instead'};
    if(ob.card&&/\bif I would die\b/i.test(ob.card.txt||''))return {by:id,txt:stripRem((/[^\n]*if I would die[^\n]*/i.exec(ob.card.txt)||[''])[0]),self:true};
    const ga=Object.values(O).find((g:any)=>g.on===id&&g.zone==='board'&&g.card&&/\bif I would die\b/i.test(g.card.eff||''));if(ga)return {by:ga.id,txt:ga.card.eff};
    const zh=Object.values(O).find((g:any)=>g.zone==='board'&&g.id!==id&&!g.on&&g.ctrl===ob.ctrl&&g.card&&/\bif a friendly unit would die, kill this instead\b/i.test(g.card.txt||''));if(zh)return {by:zh.id,txt:stripRem((/[^\n]*would die[^\n]*/i.exec(zh.card.txt)||[''])[0])};
    return null;};
  /** Kill (429): replacement esetén Negated (359.3.e.14.b), Deathknell nem fut (808.1.d.1). */
  const killObj=(id:string,why:string,parts:string[],refs:string[],srcName?:string):'ok'|'neg'=>{const ob=O[id];const rp=deathRepl(id);
    if(rp){EV.push({k:'replace',id,name:ob.name,by:rp.by});refs.push('367','369.1');
      if(rp.dieTo){parts.push(esc(ob.name)+' meghalna, de helyette banishelődik (replacement: "'+esc(rp.txt)+'"). A lap a replacement miatt nem a trashbe kerül: a halálra triggerelő abilityk nem triggerelnek (383.2.c.3.a), a "leaves the board" triggerek igen, mert a lap így is elhagyja a boardot.');story.push(Art(ob.name)+' meghalna, de helyette banishelődik.');leaveTrigs(id,false);leaveBoard(id,'banish');REPL.add(id);return 'neg';}
      if(rp.save){ob.save=null;parts.push(esc(ob.name)+' meghalna, de a replacement ('+esc(rp.txt)+') helyettesíti: meggyógyul, exhausted lesz és a base-be recall-olódik (457).');story.push(Art(ob.name)+' meghalna, de helyette gyógyulva a base-be kerül.');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;Object.values(O).forEach((g:any)=>{if(g.on===id)g.loc='base';});EV.push({k:'recall',id,name:ob.name});REPL.add(id);return 'neg';}
      if(rp.self){parts.push(esc(ob.name)+' meghalna, de a saját replacement effectje mást hajt végre helyette (367): "'+esc(rp.txt)+'". Ezt az elemzés nem követi tovább.');story.push(Art(ob.name)+' meghalna, de a saját replacement effectje helyettesíti a halált.');return 'neg';}
      const hasDK=triggersOf(ob.card).some((t:any)=>t.dk||/^when I die\b/i.test(t.why));
      const by=O[rp.by];parts.push(esc(ob.name)+' meghalna, de '+esc(by.name)+' replacement effectje helyettesíti: "'+esc(rp.txt)+'". '+esc(by.name)+' a trashbe kerül, '+esc(ob.name)+' meggyógyul, exhausted lesz és a base-be recall-olódik (457).'+(hasDK?' A halálra triggerelő abilityje a chainre kerülne (808.1.d.2), de mivel a lap nem került a trashbe, lekerül (808.1.d.1).':''));refs.push('457');if(hasDK)refs.push('808.1.d.1','808.1.d.2');
      story.push(Art(ob.name)+' meghalna, de '+art(by.name)+' megmenti: '+by.name+' a trashbe kerül, '+ob.name+' gyógyulva, exhausted állapotban a base-be kerül.');
      REPL.add(id);leaveTrigs(rp.by,false);leaveBoard(rp.by,'trash');ob.dmg=0;ob.ex=true;ob.loc='base';ob.baseOf=ob.ctrl;EV.push({k:'recall',id,name:ob.name});return 'neg';}
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
  /** Damage egy unitra. Duplázás (433.1.b) és Prevent (438.2, 438.3) replacementek: ha mindkettő él, a sorrendet a unit controllere választja (372, 467.2.c.5 példa).
      Az elemzés mindkét sorrend eredményét kiírja, és a kevesebb damage-et adó sorrenddel számol (a controller ezt választaná, ha a túlélés a cél). */
  const dealDmg=(v:string,n:number,parts:string[],refs:string[],note?:string)=>{const ob=O[v];const base=Math.max(0,n);const rp:string[]=[];
    if(PREVSA.on&&base>0){EV.push({k:'prevented',id:v,name:ob.name,n:base});parts.push(esc(ob.name)+': '+base+' spell vagy ability damage megelőzve (Unyielding Spirit, 438.1.b.1.b, 438.4; levezetés).');refs.push('438.4');return 0;}
    const sh=(ob.shields||[]).map((x:any)=>Object.assign({},x));const pv=sh.reduce((q:number,x:any)=>q+x.n,0);
    const run=(order:'pd'|'dp')=>{let d=base;let left=pv;const step=()=>{const k=Math.min(d,left);d-=k;left-=k;return k;};let prevd=0;
      if(order==='pd'){prevd=step();if(ob.dbl)d=d*2;}else{if(ob.dbl)d=d*2;prevd=step();}return {d,prevd,left:pv>=99?'All':left};};
    let r=run('pd');
    if(ob.dbl&&pv>0&&base>0){const A=run('pd'),B=run('dp');refs.push('372','467.2.c.5','433.1.b');
      rp.push('két replacement él (Prevent és duplázás), a sorrendet '+WHO[ob.ctrl]+' választja (372): Prevent előbb '+A.d+' damage (megmaradó Prevent: '+A.left+'), duplázás előbb '+B.d+' damage (megmaradó Prevent: '+B.left+'); az elemzés '+(A.d<=B.d?'a Prevent előbb':'a duplázás előbb')+' sorrenddel számol');r=A.d<=B.d?A:B;}
    else if(ob.dbl&&base>0){rp.push('duplázva (433.1.b)');refs.push('433.1.b');}
    if(r.prevd>0){rp.push(r.prevd+' megelőzve (438.2)');refs.push('438.2','438.3');}
    let used=r.prevd;(ob.shields||[]).forEach((x:any)=>{if(used<=0&&!x.next)return;const k=Math.min(x.n,used);if(x.n<99)x.n-=k;used-=k;if(x.next&&base>0||x.n<=0)x.used=true;});
    ob.shields=(ob.shields||[]).filter((x:any)=>!x.used);
    const d=r.d;
    if(d<=0&&base>0){EV.push({k:'prevented',id:v,name:ob.name,n:base});parts.push(esc(ob.name)+': '+base+' damage teljesen megelőzve, nem számít megtörtént damage-nek (438.4)'+(rp.length?' ['+rp.join(', ')+']':'')+'.');refs.push('438.4');return 0;}
    ob.dmg+=d;ob.dealt=true;const mt=mightOf(v);EV.push({k:'dmg',id:v,name:ob.name,n:d});
    parts.push(esc(ob.name)+' '+d+' damage-et kap'+(note?' ('+note+')':'')+(rp.length?' ['+rp.join(', ')+']':'')+(mt!=null?' (Might '+mt+', összesen '+ob.dmg+' damage)':'')+'.');refs.push('418');
    if(mt!=null&&ob.dmg>=mt&&ob.dmg>0){parts.push('Lethal damage: a következő cleanupban meghal (142.4.b, 323.4).');refs.push('142.4.b');}
    return d;};
  /** Keyword érték (Shield, Assault): a nyomtatott sor eleji keyword és a kapott keywordök összege (807.2, 814.2). */
  const kwVal=(id:string,kw:string)=>{const ob=O[id];if(!ob)return 0;let n=0;const t=(ob.card&&ob.card.txt)||'';const re=new RegExp('^\\['+kw+'(?: (\\d+))?\\]','m');const m=re.exec(t);if(m)n+=m[1]?+m[1]:1;
    (ob.kws||[]).forEach((k:string)=>{const q=new RegExp('^'+kw+'(?: (\\d+))?$').exec(k);if(q)n+=q[1]?+q[1]:1;});return n;};
  /** Szorzó számolása a frame boardján (418.8: egy damage példány). */
  const countEach=(cnt:any,it:any,tv?:string)=>{if(cnt.kills)return null;
    if(cnt.bfs){const here=srcLoc(it);return ['bf0','bf1'].filter(l=>BF[l].c&&BF[l].ctrl===it.pl&&!(cnt.other&&l===here)).length;}if(cnt.eqOn){const host=cnt.eqOn==='me'?it.src:tv;return Object.values(O).filter((g:any)=>g.on===host&&g.zone==='board'&&g.card&&(g.card.tg||[]).includes('Equipment')).length;}
    const here=srcLoc(it);const there=tv&&O[tv]?O[tv].loc:null;
    return Object.keys(O).filter(id=>{const ob=O[id];if(ob.zone!=='board'||ob.type!==cnt.type)return false;if(cnt.other&&(id===it.src||id===tv))return false;
      if(cnt.rel==='friendly'&&ob.ctrl!==it.pl)return false;if(cnt.rel==='enemy'&&ob.ctrl===it.pl)return false;
      if(cnt.mighty&&!((mightOf(id)??0)>=5))return false;
      if(cnt.st==='exhausted'&&!ob.ex||cnt.st==='ready'&&ob.ex||cnt.st==='stunned'&&!ob.st||cnt.st==='buffed'&&!ob.bu)return false;
      if(cnt.where==='here'&&ob.loc!==here)return false;if(cnt.where==='there'&&ob.loc!==there)return false;if(cnt.where==='bf'&&ob.loc==='base')return false;if(cnt.where==='base'&&ob.loc!=='base')return false;return true;}).length;};
  /** Token létrehozása (440, 143.4): "play (N) (ready) (M [S]) <Név> unit|gear token(s) (exhausted) (with [Kw]) (here|there|to your base)". */
  let TOKN=0;
  const createTokens=(t:string,it:any,parts:string[],refs:string[],times:number)=>{const m=/\b(?:[Pp]lay|[Cc]reate)s? (a|an|one|two|three|four|five|six|\d+|that many)\s+(ready\s+)?(?:(\d+) \[S\]\s+)?([A-Z][\w'\-]*(?: [A-Z][\w'\-]*)*)(?:\s+(unit|gear))?\s+tokens?(\s+exhausted)?(?:\s+with\s+((?:\[[^\]]+\](?:,?\s*(?:and\s+)?)?)+))?([^.]*)/.exec(t);
    if(!m){parts.push('"'+esc(t)+'": token jön létre (440), az elemzés nem tudja pontosan, milyen.');return;}
    let n=m[1].toLowerCase()==='that many'?0:numOf(m[1]);n=n*(times==null?1:times);const name=m[4];const card=vsCard(name);const kind=m[5]?m[5].toLowerCase():card&&card.t==='Gear'?'gear':'unit';const kws=(m[7]||'').match(/\[([^\]]+)\]/g)||[];const tail=m[8]||'';
    const here=srcLoc(it);const loc=/\bto a (?:single )?battlefield\b/i.test(tail)?(it.dest||(it.s&&it.s.dest)||'bf0'):/\bthere\b/i.test(tail)?(it.notedLoc||(it.lk&&it.lk.loc)||here||'base'):/\bhere\b/i.test(tail)?(here||'base'):'base';
    const ids:string[]=[];for(let q=0;q<n;q++){const id='k'+(++TOKN);const extra=kws.filter((k:string)=>!(card&&(card.txt||'').includes(k))).join('\n');const c=card?(extra?Object.assign({},card,{txt:(card.txt||'')+'\n'+extra}):card):{n:name,t:kind==='unit'?'Unit':'Gear',m:m[3]?+m[3]:null,st:['Token'],tg:[],txt:extra};
      const er=kind==='unit'?enterReady(Object.assign({},c,{t:'Unit',st:['Token']}),it.pl,false,loc,undefined,id):{ready:false,why:''};if(q===0&&er.why&&!m[2]&&!m[6])parts.push('Ready lép be: '+esc(er.why)+'.');
      O[id]={id,name:name+' token',card:c,ctrl:it.pl,own:it.pl,loc,baseOf:it.pl,m:kind==='unit'?(m[3]?+m[3]:(c.m!=null?+c.m:null)):null,dmg:0,mods:[],kws:[],zone:'board',type:kind,ex:m[6]?true:m[2]?false:kind==='unit'?!er.ready:false,token:true};
      ids.push(id);EV.push({k:'token',pl:it.pl,id,name,loc});}
    if(it.notedLoc&&/\bthere\b/i.test(tail)){parts.push('A "there" a trigger feltételéből a triggereléskor feljegyzett location ('+esc(locLabel(it.notedLoc))+'), a forrás későbbi mozgása nem számít (359.3.f.3).');refs.push('359.3.f.3');}
    parts.push(n+' db '+esc(name)+' '+kind+' token jön létre ('+esc(locLabel(loc))+(m[2]?', ready':m[6]?', exhausted':kind==='unit'?(O[ids[0]]&&!O[ids[0]].ex?', ready (143.4.a)':', exhausted (143.4)'):'')+(kws.length?', '+kws.join(' '):'')+') (350.2, 440.2).');refs.push('350.2','440.2');
    if(n)story.push(n+' '+name+' token kerül ide: '+locLabel(loc)+'.');
    ids.forEach(id=>{if(O[id].type==='unit')playTrigs({c:O[id].card,j:-1,pl:it.pl,from:'other',objId:id}).forEach((tr:any)=>pushTrig(tr));});};
  /** Egy művelet végrehajtása egy célponton. Visszatérés: 'neg' ha a game action nem történik meg (Negated). */
  const applyTo=(v:string,act:any,it:any,parts:string[],refs:string[]):string|void=>{const ob=O[v];const srcName=it.name;
    switch(act.k){
    case 'counter':if(ob.type!=='spell'&&ob.type!=='ability')return 'skip';ob.zone='countered';if(act.toHand)ob.toHand=true;EV.push({k:'counter',id:v,name:ob.name});parts.push(esc(ob.name)+' counterelve.');refs.push('426.1');story.push(Art(srcName)+' countereli '+art(ob.name)+' lapot.');return;
    case 'kill':{const r=killObj(v,'',parts,refs,srcName);return r==='neg'?'neg':undefined;}
    case 'hand':case 'banish':story.push(Art(srcName)+' lefut: '+ob.name+' '+(act.k==='hand'?'a tulajdonosa kezébe kerül':'banishelődik')+'.');leaveTrigs(v,false);leaveBoard(v,act.k);parts.push(esc(ob.name)+' '+(act.k==='hand'?'a tulajdonosa kezébe kerül (056.2)':'banishelődik')+'.');refs.push(act.k==='hand'?'056.2':'428');return;
    case 'recall':{if(ob.loc==='base'&&ob.baseOf===ob.ctrl){parts.push(esc(ob.name)+' már a base-ben van.');return 'neg';}ob.loc='base';ob.baseOf=ob.ctrl;Object.values(O).forEach((g:any)=>{if(g.on===v)g.loc='base';});EV.push({k:'recall',id:v,name:ob.name});parts.push(esc(ob.name)+' visszakerül a base-be (recall, nem Move, 457).');refs.push('457');story.push(Art(srcName)+' lefut: '+ob.name+' recall-olódik a base-be.');return;}
    case 'base':return moveObj(v,'base',parts,refs,srcName,/\bto your base\b/i.test(act.t||'')?it.pl:undefined);
    case 'move':return moveObj(v,it.dest||'base',parts,refs,srcName);
    case 'dmg':case 'dmgM':{let n=act.k==='dmg'?act.n:null;
      if(act.k==='dmgM'&&act.who==='linked'&&it.soM!=null&&/\bshowed off\b|\bthat unit's Might\b/i.test(act.t||'')){n=+it.soM;parts.push('A Show Off-olt unit ('+esc(it.soName)+') Mightja a finalizáláskor: '+n+'; a későbbi változás nem számít (832.1.d, 832.1.d.1).');refs.push('832.1.d','832.1.d.1');}
      else if(act.k==='dmgM'){const sid=act.who==='self'?it.src:null;n=sid?mightOf(sid):null;if(n==null){parts.push(esc(ob.name)+': a damage a forrás Mightjától függ, de a forrás már nincs a boardon, így az érték null, az utasítás Ignored (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}}
      let note='';if(act.each&&act.each.cnt){const k=countEach(act.each.cnt,it,v);if(k!=null){note='szorzó: '+k+' ('+act.each.txt+'), '+n+' x '+k;n=n*k;refs.push('418.8');}}
      const b=bonusDmg(it.pl)+(act.bonus||0);if(b){refs.push('715.1');note=(note?note+', ':'')+'+'+b+' Bonus Damage';}const tot=n+b;
      const d=dealDmg(v,tot,parts,refs,note);const mt=mightOf(v);
      if(d>0)story.push(Art(srcName)+' '+d+' damage-et oszt '+art(ob.name)+' lapra'+(mt!=null&&ob.dmg>=mt?'. Ez eléri a Mightját ('+mt+'), ezért a cleanupban meghal.':mt==null?'. A Mightja nincs megadva, ezért nem tudni, túléli-e.':', ami túléli ('+ob.dmg+' damage, '+mt+' Might).'));
      else{story.push(Art(srcName)+' damage-ét megelőzik ('+ob.name+').');if(tot>0){parts.push('A Deal utasítás Negated: az eseményt a Prevent helyettesítette (438.2, 359.3.e.14.b).');refs.push('359.3.e.14.b');return 'neg';}}return;}
    case 'stealEquip':{const g=Object.values(O).find((o:any)=>o.on===v&&o.zone==='board'&&o.card&&(o.card.tg||[]).includes('Equipment'));if(!g||!onB(it.src)){parts.push(esc(ob.name)+': nincs Equipment rajta, vagy a forrás nincs a boardon.');return 'neg';}
      g.on=it.src;g.loc=O[it.src].loc;EV.push({k:'attach',id:g.id,name:g.name,to:it.src});parts.push(esc(g.name)+' átkerül '+esc(ob.name)+' lapról '+esc(O[it.src].name)+' lapra (435.1.f).');refs.push('435.1.f');return;}
    case 'fightSelf':{if(!onB(it.src)){parts.push('A forrás már nincs a boardon (359.3.e.12).');return 'ign';}const a1=mightOf(it.src),a2=mightOf(v);dealDmg(v,a1||0,parts,refs,'forrás: '+O[it.src].name+', 418.6.b.3');dealDmg(it.src,a2||0,parts,refs,'forrás: '+ob.name+', 418.6.b.3');refs.push('418.6.b.3');return;}
    case 'raiseSelf':case 'raiseTo':{const base=act.k==='raiseSelf'?it.src:it.raiseBase;if(!base||!onB(base)){parts.push('A növelendő unit nem érvényes (359.3.e.12).');return 'ign';}const cur=mightOf(base),to=mightOf(v);if(cur==null||to==null||to<=cur){parts.push(esc(O[base].name)+' Mightja nem nő ('+cur+' és '+to+'), nincs mire növelni.');return;}
      O[base].mods.push({n:to-cur});EV.push({k:'might',id:base,name:O[base].name,from:cur,to});parts.push(esc(O[base].name)+' Mightja '+cur+' → '+to+' ebben a körben.');return;}
    case 'mightNum':case 'dmgNum':{const n=+(act.fv||0);if(act.k==='dmgNum'){if(n<=0){parts.push(esc(ob.name)+': 0 damage, nincs deal (715.4).');return 'neg';}dealDmg(v,n,parts,refs,'a lapnál megadott érték: '+n);return;}
      if(n===0){parts.push(esc(ob.name)+': a megadott érték 0, nincs Might változás.');return 'neg';}const b0=mightOf(v);ob.mods.push({n});EV.push({k:'might',id:v,name:ob.name,from:b0,to:mightOf(v)});parts.push(esc(ob.name)+' +'+n+' Might ebben a körben (a lapnál megadott érték).');return;}
    case 'dblShield':{const n=kwVal(v,'Shield');if(!n){parts.push(esc(ob.name)+': nincs Shield, a duplázás 0-t ad (433.1).');return 'neg';}ob.kws.push('Shield '+n);EV.push({k:'kw',id:v,name:ob.name,kw:'Shield'});parts.push(esc(ob.name)+' Shield értéke '+n+' → '+(2*n)+' ebben a körben (433.1, 814.2).');return;}
    case 'katoGive':{if(!onB(it.src)&&!(O[it.src]&&O[it.src].lk)){parts.push('A forrás adatai nem elérhetők (359.3.e.12).');return 'ign';}const so=O[it.src];const n=onB(it.src)?mightOf(it.src):so.lk.m;const kw=((so.card&&so.card.txt)||'').split('\n').map(stripRem).filter((l:string)=>/^\[[A-Za-z]+(?: \d+)?\]$/.test(l)).map((l:string)=>l.slice(1,-1)).concat(onB(it.src)?(so.kws||[]):((so.lk&&so.lk.kws)||[]));
      const b0=mightOf(v);ob.mods.push({n:n||0});kw.forEach((k:string)=>ob.kws.push(k));EV.push({k:'might',id:v,name:ob.name,from:b0,to:mightOf(v)});const sums=['Shield','Assault','Deflect'].filter((k:string)=>kw.some((x:string)=>x.split(' ')[0]===k)).map((k:string)=>k+' '+kwVal(v,k));parts.push(esc(ob.name)+' +'+n+' Might'+(kw.length?' és Kato összes jelenlegi keywordjét kapja (a nyomtatottakat és a kapottakat is): '+esc(kw.join(', ')):'')+' ebben a körben; az azonos értékes keywordök összeadódnak (801.3.a, 814.2)'+(sums.length?', '+esc(ob.name)+' összesített értéke: '+esc(sums.join(', ')):'')+'.');refs.push('801.3.a','814.2');return;}
    case 'mightTags':{const tags=act.tags||[];const have=tags.filter((t:string)=>Object.values(O).some((o:any)=>o.zone==='board'&&o.type==='unit'&&o.ctrl===it.pl&&o.card&&(o.card.tg||[]).includes(t)));const n=have.length;const b0=mightOf(v);if(n)ob.mods.push({n});EV.push({k:'might',id:v,name:ob.name,from:b0,to:mightOf(v)});parts.push(esc(ob.name)+' +'+n+' Might (a saját unitok között előforduló tagek: '+(have.join(', ')||'nincs')+').');return;}
    case 'mightOnlyThere':{const alone=!Object.values(O).some((o:any)=>o.id!==v&&o.zone==='board'&&o.type==='unit'&&o.ctrl===it.pl&&o.loc===ob.loc);if(!alone){parts.push(esc(ob.name)+' nem az egyetlen saját unit ott, ezért nem kap további +1-et (a boardon ellenőrizve).');return 'neg';}const b0=mightOf(v);ob.mods.push({n:1});EV.push({k:'might',id:v,name:ob.name,from:b0,to:mightOf(v)});parts.push(esc(ob.name)+' az egyetlen saját unit ott: további +1 Might.');return;}
    case 'setbase':ob.baseSet=act.n;{const mt=mightOf(v);EV.push({k:'setbase',id:v,name:ob.name,n:act.n});parts.push(esc(ob.name)+' alap Mightja '+act.n+' lesz ebben a körben (jelenlegi Might: '+mt+').');story.push(Art(ob.name)+' alap Mightja '+act.n+' lesz.');}return;
    case 'dmgKw':case 'dmgMarked':{const sid=act.k==='dmgMarked'?v:act.who==='self'?it.src:it.kwSrc;const so=sid&&O[sid];if(!so||so.zone!=='board'){parts.push(esc(ob.name)+': a damage értéke nem elérhető (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}
      const n=act.k==='dmgMarked'?so.dmg:kwVal(sid,act.kw);const d=dealDmg(v,n,parts,refs,act.k==='dmgMarked'?'a rajta lévő damage alapján':esc(so.name)+' ['+act.kw+'] értéke: '+n);if(d>0)story.push(Art(srcName)+' '+d+' damage-et oszt '+art(ob.name)+' lapra.');return;}
    case 'todeck':leaveTrigs(v,false);leaveBoard(v,'deck');parts.push(esc(ob.name)+' a tulajdonosa Main Deckjébe kerül (056.2).');refs.push('056.2');story.push(Art(ob.name)+' a tulajdonosa paklijába kerül.');return;
    case 'untgt':ob.untgt=true;EV.push({k:'untgt',id:v,name:ob.name});parts.push(esc(ob.name)+' ebben a körben nem választható enemy spellel vagy abilityvel (757.1, 758.1).');refs.push('757.1','758.1');return;
    case 'prevent':ob.shields=(ob.shields||[]).concat([{n:act.n,next:act.next}]);EV.push({k:'prevent',id:v,name:ob.name,n:act.n});parts.push(esc(ob.name)+': '+(act.n>=99?(act.next?'a következő damage-et':'minden damage-et'):'a következő '+act.n+' damage-et')+' megelőzi ebben a körben (Prevent, delayed replacement, 438.1.b.2, 438.7).');refs.push('438.1.b.2','438.7');story.push(Art(ob.name)+' védelmet kap: a damage megelőzése (Prevent).');return;
    case 'dbldmg':ob.dbl=true;EV.push({k:'dbldmg',id:v,name:ob.name});parts.push(esc(ob.name)+': minden ráosztott damage duplázódik ebben a körben (replacement, 433.1.b).');refs.push('433.1.b');story.push(Art(ob.name)+' minden damage-et duplán kap ebben a körben.');return;
    case 'saveNext':ob.save={pay:!!act.pay,src:srcName};EV.push({k:'save',id:v,name:ob.name});parts.push(esc(ob.name)+': ha ebben a körben meghalna, helyette gyógyul, exhausted lesz és recall-olódik (replacement, 369.1)'+(act.pay?'; a "you may pay" miatt a controller dönt, az elemzés úgy veszi, hogy fizet (371.2)':'')+'.');refs.push('369.1');story.push(Art(ob.name)+' halálát ebben a körben egy replacement megakadályozza.');return;
    case 'dieRepl':ob.dieTo=act.to;EV.push({k:'dierepl',id:v,name:ob.name});parts.push(esc(ob.name)+': ha ebben a körben meghalna, helyette banishelődik (replacement, 369.1).');refs.push('369.1');return;
    case 'stun':if(ob.st){parts.push(esc(ob.name)+' már Stunned, nem stunolható újra: az utasítás Negated (424.1.a.1).');refs.push('424.1.a.1');return 'neg';}ob.st=true;EV.push({k:'stun',id:v,name:ob.name});parts.push(esc(ob.name)+' Stunned lesz (424).');refs.push('424');story.push(Art(srcName)+' lefut: '+ob.name+' Stunned lesz.');return;
    case 'buff':if(ob.bu){parts.push(esc(ob.name)+' már buffolt, nem kap újabbat: a buff nem kerül fel, az utasítás Negated (427.1.b.1, 427.1.c).');story.push(Art(ob.name)+' már buffolt, így nem történik semmi.');refs.push('427.1.b.1','427.1.c');return 'neg';}ob.bu=true;EV.push({k:'buff',id:v,name:ob.name});parts.push(esc(ob.name)+' +1 Might buffot kap (427, 703).');refs.push('427','703');story.push(Art(srcName)+' lefut: '+ob.name+' +1 Might buffot kap.');return;
    case 'replay':{if(ob.zone==='board'){parts.push(esc(ob.name)+' nem hagyta el a boardot, így nincs mit újra kijátszani.');return 'neg';}
      if(!['banish','trash','hand'].includes(ob.zone)){parts.push(esc(ob.name)+' nem elérhető az újra kijátszáshoz (359.3.e.12).');return 'ign';}
      const to=act.to==='same'?(ob.lk&&ob.lk.loc)||'base':act.to==='base'?'base':(it.dest||'base');const nid=v+'r';let erR:any=null;
      O[nid]=Object.assign({},ob,{id:nid,zone:'board',loc:to,baseOf:ob.own,ctrl:ob.own,dmg:0,mods:[],kws:[],st:false,bu:false,ex:ob.type==='unit'&&!(erR=enterReady(ob.card,ob.own,false,to,undefined,nid)).ready,on:null,shields:[],save:null,dbl:false,dieTo:null,lk:null,until:null});
      ob.zone='gone';EV.push({k:'enter',id:nid,name:ob.name,loc:to,replay:true});
      const unitEnt=ob.type!=='unit'?'':erR&&erR.ready?', a unit ready lép be ('+erR.why+')':', a unit exhausted lép be (143.4)';
      parts.push(esc(ob.name)+': a tulajdonosa újra kijátssza ('+esc(locLabel(to))+(act.free?', a költség figyelmen kívül':'')+'). Ez új objektum (359.3.e.4)'+unitEnt+'; a kijátszás nem a kézből történik (420.3).'+(erR&&erR.note?' '+erR.note:''));refs.push('420.3','359.3.e.4',erR&&erR.ready?'143.4.a':'143.4');
      story.push(Art(ob.name)+' újra a boardra kerül: '+locLabel(to)+'.');
      playTrigs({c:ob.card,j:-1,pl:ob.own,from:'other',objId:nid}).forEach((t:any)=>{pushTrig(t);parts.push('Triggerel: '+esc(t.label)+' (420.4.a).');});
      const own=triggersOf(ob.card).find((t:any)=>/^when you play (?:me|this)\b/i.test(t.why));if(own){pushTrig({kind:'auto',label:ob.name+' play triggere',name:ob.name+' play triggere',src:nid,pl:ob.own,eff:own.eff,why:own.why,list:[],tg:[]});parts.push('A play effectje is triggerel; célpontját a játékos választja, az elemzés nem követi.');}
      return;}
    case 'might':case 'mightEq':case 'double':{let n=act.n;if(act.each&&act.each.cnt&&act.k==='might'){const k=countEach(act.each.cnt,it,v);if(k!=null){parts.push('Szorzó: '+k+' ('+esc(act.each.txt)+').');n=n*k;}}if(act.k==='mightEq'){n=it.lkMight!=null?it.lkMight:null;if(n==null){parts.push(esc(ob.name)+': a Might értéke a korábbi célponttól függ, ami nem elérhető, ezért Ignored (359.3.e.12).');refs.push('359.3.e.12');return 'ign';}}
      const before=mightOf(v);if(act.k==='double'){ob.mods.push({n:Math.max(0,before||0)});refs.push('433');}else ob.mods.push({n,min:act.min});const after=mightOf(v);EV.push({k:'might',id:v,name:ob.name,from:before,to:after});
      parts.push(esc(ob.name)+' Mightja '+before+' → '+after+' (ebben a körben'+(act.min!=null?', minimum '+act.min:'')+').');story.push(Art(srcName)+' lefut: '+ob.name+' Mightja '+before+' helyett '+after+'.');
      if(lethal(v)){parts.push('A már rajta lévő damage így lethal: a következő cleanupban meghal (142.4.b).');refs.push('142.4.b');}return;}
    case 'kw':{const L=act.all&&act.all.length>1?act.all:[act.kw+(act.n?' '+act.n:'')];L.forEach((k:string)=>ob.kws.push(k));EV.push({k:'kw',id:v,name:ob.name,kw:act.kw,all:L});parts.push(esc(ob.name)+' megkapja: '+L.map((k:string)=>'['+esc(k)+']').join(', ')+' (ebben a körben).');}story.push(Art(srcName)+' lefut: '+ob.name+' ['+act.kw+(act.n?' '+act.n:'')+'] keywordöt kap.');return;
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
    case 'disempower':ob.emp=false;EV.push({k:'disempower',id:v,name:ob.name});parts.push(esc(ob.name)+' disempowered lesz (443).');refs.push('443');story.push(Art(ob.name)+' disempowered lesz.');return;
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
  /** "Counter an enemy spell or ability that chooses it and no other friendly unit" (Repulse): a választott chain elem célpontjai közül
      a friendly unitok száma 359.3.e.9.a szerint: a mistargetelt választások is számítanak a boardon (a célzó utasítás zónája), a boardot elhagyók nem. */
  const chooseOnlyWhy=(it:any,ob:any,phase:string)=>{const mine=(it.tg||[])[0];const st=MAIN.find((x:any)=>'s'+x.j===ob.id);const tg=st?(st.tg||[]):[];
    const cnt=tg.filter((v:string)=>v&&O[v]&&O[v].type==='unit'&&O[v].zone==='board'&&O[v].ctrl===it.pl);const gone=tg.filter((v:string)=>v&&O[v]&&O[v].type==='unit'&&O[v].zone!=='board');
    const N=esc(ob.name);const out:string[]=[];
    if(!mine||!tg.includes(mine))out.push(N+' nem választja ki '+(mine&&O[mine]?esc(O[mine].name)+' lapot':'a kiválasztott friendly unitot'));
    else if(cnt.length!==1)out.push(N+' '+cnt.length+' friendly unitot választott, amelyek a boardon vannak ('+cnt.map((v:string)=>esc(O[v].name)).join(', ')+'); a mistargetelt, de a boardon maradt választások is számítanak (359.3.e.9.a)');
    if(!out.length&&gone.length)it.coNote=N+' célpontjai közül '+gone.map((v:string)=>esc(O[v].name)).join(', ')+' nem a boardon van, ezért nem számít (359.3.e.9.a); így csak '+esc(O[mine].name)+' a választott friendly unit.';
    return out;};
  const itemEnergy=(it:any)=>{const c=it.s&&it.s.c;return it.s&&it.s.k==='card'&&c&&c.e!=null?+c.e:0;};
  /** Költségfeltétel a célpontra (Defy, Rebuttal, Pickpocket): a nyomtatott költség számít (206). */
  const tgWhy=(it:any,p:any,v:string,ti:number,phase:string)=>{const w=tgWhy0(it,p,v,ti,phase);
    if(!w.length&&p&&p.cost&&v!=='F0'&&v!=='F1'&&O[v]&&O[v].card){const cw=costCheck(p.cost,O[v].card,{might:it.src&&onB(it.src)?mightOf(it.src):null,points:scoreOf(it.pl)});if(cw)w.push(esc(O[v].name)+': '+cw+'.');}
    return w;};
  const tgWhy0=(it:any,p:any,v:string,ti:number,phase:string)=>{const why:string[]=[];if(v==='F0'||v==='F1'){if(p.type!=='battlefield')why.push('ez battlefield');return why;}
    const ob=O[v];if(!ob)return ['ismeretlen célpont'];const N=esc(ob.name);
    if(p.type==='spell'){if(!(ob.type==='spell'||p.orAb&&ob.type==='ability'))why.push(N+' nem spell'+(p.orAb?' vagy ability':'')+', hanem '+ob.type+' (355.9.a.2).');else if(ob.zone!=='chain')why.push(phase==='res'?'már nincs a chainen':N+' nincs a chainen.');
      if(!why.length&&p.rel==='enemy'&&ob.ctrl===it.pl)why.push(N+' nem enemy (a saját '+(ob.type==='ability'?'abilityd':'spelled')+').');
      if(!why.length&&p.chooseOnly)why.push(...chooseOnlyWhy(it,ob,phase));
      return why;}
    if(ob.type!==p.type&&!(p.type==='perm'&&(ob.type==='unit'||ob.type==='gear')))why.push(N+' '+ob.type+', nem '+p.type+'.');
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
    if(ob.untgt&&ob.ctrl&&ob.ctrl!==it.pl)why.push(phase==='res'?'ebben a körben nem választható enemy spellel vagy abilityvel, így illegális célpont (758.1)':N+' ebben a körben nem választható enemy spellel vagy abilityvel (757.1).');
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/^I can.t be chosen by enemy spells or abilities with Energy cost less than my Might\b/im.test(ob.card.txt||'')){const ec=itemEnergy(it);const mt=mightOf(v);
      if(mt!=null&&ec<mt)why.push(phase==='res'?'a Mightja ('+mt+') nagyobb, mint a forrás Energy költsége ('+ec+'), ezért nem választható, illegális célpont (757, 758.1)':N+' Mightja ('+mt+') nagyobb, mint a lap Energy költsége ('+ec+'), ezért nem választható (757).');
      else if(phase==='res'&&EV.slice(it.evPlay||0).some((e:any)=>e.k==='might'&&e.id===v&&e.to!=null&&e.to>ec))it.prot758=(it.prot758||[]).concat([N+': a Mightja ('+mt+') már nem nagyobb, mint az Energy költség ('+ec+'), ezért újra legális célpont (758.2)']);}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&ob.type==='unit'&&ob.zone==='board'){const W=Object.values(O).find((w:any)=>w.id!==v&&w.zone==='board'&&w.ctrl===ob.ctrl&&w.loc===ob.loc&&w.card&&/^Your units here with less Might than me can.t be chosen by enemy spells and abilities\b/im.test(w.card.txt||'')&&(mightOf(w.id)||0)>(mightOf(v)||0));
      if(!W&&phase==='res'){const W2:any=Object.values(O).find((w:any)=>w.id!==v&&w.board&&w.own===ob.ctrl&&w.card&&/^Your units here with less Might than me can.t be chosen by enemy spells and abilities\b/im.test(w.card.txt||''));
        if(W2&&EV.slice(it.evPlay||0).some((e:any)=>e.k==='might'&&e.id===W2.id&&e.to!=null&&e.to>(mightOf(v)||0)))it.prot758=(it.prot758||[]).concat([N+': '+esc(W2.name)+' passzív képessége már nem vonatkozik rá ('+(W2.zone!=='board'?'nincs a boardon':W2.loc!==ob.loc?'nem ugyanott áll':'a Mightja nem nagyobb')+'), ezért a resolve-kor legális célpont (758.2.a)']);}
      if(W)why.push(phase==='res'?esc((W as any).name)+' passzív képessége miatt ('+mightOf(v)+' Might, kevesebb, mint '+mightOf((W as any).id)+') nem választható, illegális célpont (757, 758.1)':N+' nem választható: '+esc((W as any).name)+' ugyanott áll, és a Mightja nagyobb (757).');}
    if(ob.card&&ob.ctrl&&ob.ctrl!==it.pl&&/can.t be chosen by enemy|cannot be chosen by enemy/i.test((ob.card.txt||'').split('\n').filter((l:string)=>!/with Energy cost less than my Might|^Your units here with less Might/i.test(l)).join('\n'))&&!/unless/i.test(ob.card.txt||''))why.push(phase==='res'?'enemy spell vagy ability nem választhatja, így illegális célpont (758.1)':N+' szövege szerint ellenséges spell vagy ability nem választhatja (757, 758).');
    return why;};
  /** Legális választások egy célponthoz (403.4.b). */
  const legalOpts=(it:any,p:any,ti:number)=>{if(p.type==='battlefield')return ['F0','F1'].filter(f=>BF['bf'+f[1]].c);
    return Object.keys(O).filter(id=>(p.type==='spell'?O[id].zone==='chain':O[id].zone==='board')&&(O[id].type===p.type||p.orAb&&O[id].type==='ability'||p.type==='perm'&&(O[id].type==='unit'||O[id].type==='gear'))&&!(it.tg||[]).some((x:string,k:number)=>k!==ti&&x===id)&&!tgWhy(it,p,id,ti,'play').length);};
  /* ---- 1. felépítés ---- */
  /** "When you play a [type] (that costs / with Energy cost / with Power cost ...)": a kijátszott lap nyomtatott (vagy copied) költsége dönt (206).
      A trashben lévő lap "play this/me from your trash" triggere is figyel (Forbidden Technique, Meticulous Restorationist). A döntés indoka egyszer kerül a sorok közé. */
  const PTN=new Set<string>();
  const playTrigs=(s:any)=>{const res:any[]=[];const ty=s.c.t.toLowerCase();
    Object.keys(O).forEach(id=>{const ob=O[id];if(!ob.card||id==='s'+s.j||id===s.objId)return;
      const fromTrash=ob.zone==='trash'&&ZC;if(!(ob.zone==='board'||ob.zone==='legend'||fromTrash))return;
      (ob.card.txt||'').split('\n').forEach((l:string)=>{const L=stripRem(l);let m:any;let types:string[];let cond='';let eff='';let who='';
        const mm=/^when (you|an opponent|a player) plays? a unit, gear, or activated ability([^,]*),\s*(.*)$/i.exec(L);
        if(mm){who=mm[1].toLowerCase();types=['unit','gear'];cond=mm[2];eff=mm[3];}
        else{m=/^when (you|an opponent|a player) plays? (?:a |an )?(card|spell|unit|gear)s?([^,]*),\s*(.*)$/i.exec(L);if(!m)return;who=m[1].toLowerCase();types=[m[2].toLowerCase()];cond=m[3];eff=m[4];}
        if(fromTrash&&!/\bfrom your trash\b/i.test(eff))return;
        if(!fromTrash&&ob.zone==='trash')return;
        if(who==='you'&&ob.ctrl!==s.pl)return;if(who==='an opponent'&&ob.ctrl===s.pl)return;
        if(!types.includes('card')&&!types.includes(ty))return;
        if(/other than your hand/i.test(cond)&&(s.from||'hand')==='hand')return;
        if(/from your hand/i.test(cond)&&s.from&&s.from!=='hand')return;
        const cc=costCondOf(cond);let cw='';
        if(cc){const pc=printedCost(s.c);const w=costCheck(cc,s.c,{});const key=(s.j??'x')+'|'+id;
          cw=esc(s.c.n)+' nyomtatott költsége '+pc.e+' Energy és '+pc.p+' Power; a feltétel: "'+esc(cc.t||cond.trim())+'" (206).';
          if(w){if(!PTN.has(key)){PTN.add(key);const h=line('206, 383.2',esc(ob.name)+': "'+esc(L)+'" nem triggerel, mert '+cw.replace(/ \(206\)\.$/,'')+', és ez nem teljesül ('+w.replace(/ \(206\)$/,'')+').',0);if(INRES)rr+=h;else rows+=h;}return;}}
        res.push({kind:'auto',label:ob.name+' triggere',src:id,pl:ob.ctrl,eff,why:'"'+L+'"'+(cw?' Triggerel, mert '+cw.replace(/^[^ ]+/,(x)=>x)+'':''),list:[],tg:[],trigBy:s.c});});});
    return res;};
  snap('Kiinduló helyzet',[]);
  const itemOf=(s:any)=>{const c=s.c;const perm=s.k==='card'&&isPermC(c);
    const label=s.k==='ab'?c.n+' abilityje':s.k==='tg'?c.n+' triggere':((O['s'+s.j]&&O['s'+s.j].name)||c.n)+(perm?' (play trigger)':'');
    const src=s.k==='ab'||s.k==='tg'?s.src:perm?'s'+s.j:null;
    return {kind:'step',s,label,name:s.k==='ab'?c.n+' abilityje':s.k==='tg'?c.n+' triggere':c.n,pl:s.k==='tg'?((O[s.src]&&O[s.src].ctrl)||s.pl):s.pl,eff:s.eff,list:s.list,tg:s.tg,src,perm,from:s.k==='card'?s.from:null,loc:s.k==='card'?(s.loc||(s.from==='facedown'?'bf0':'base')):null,objId:s.k==='card'||s.k==='ab'||s.k==='tg'?'s'+s.j:null,dest:s.dest,ov:s.ov,pays:s.pays,may:s.may,isTg:s.k==='tg',evPlay:EV.length,soM:s.so?(String(s.so).startsWith('h:')?((vsCard(String(s.so).slice(2))||{}).m??null):(O[s.so]?mightOf(s.so):null)):null,soName:s.so?(String(s.so).startsWith('h:')?String(s.so).slice(2)+' (kézből felfedve)':(O[s.so]?O[s.so].name:'')):'',notedLoc:s.k==='tg'&&s.tr&&/\bmove from a location\b/i.test(s.tr.why||'')?(s.mfrom||'base'):null};};
  const playMain=()=>MAIN.forEach((s:any,ix:number)=>{
    if(s.k==='end'){/* Kör vége: a chain lefut, majd Ending Step (317.1); a további lépések a kör végi triggerekre válaszolnak. */
      stack=chain;if(chain.length){rows+=line('340.1','Mindkét játékos passzol: a chain teljes egészében lefut, utána jön az Ending Phase.',0);resolveAll();}
      if(!ENDED){rows+=line('317, 317.1','Kör vége: Ending Phase, Ending Step.',0);endStep();}return;}
    if(s.k==='res'){/* "Mindenki passzol": a chain legfelső eleme most resolve-ol (340.1), utána a cleanup; a következő lépések erre az állapotra épülnek. */
      if(!chain.length){rows+=line('340.1','Resolve lépés: a chain üres, nincs mit lefuttatni.',0);return;}
      stack=chain;const top=chain.pop();rows+=line('340.1','Mindkét játékos passzol: a chain legfelső eleme ('+esc(top.label)+') most resolve-ol, a következő lépések ez után jönnek.',0);
      const d0=done.length;try{resolveItem(top);flushPend(chain);}finally{const dn=done.length>d0?done[done.length-1]:null;snap('Resolve: '+top.label+(dn?', '+(RES[dn.res]||dn.res):''),chain);cleanup();}
      return;}
    let it:any=null;try{const c=s.c;const tm=s.k==='ab'?(s.ab?s.ab.tm:'none'):s.k==='tg'?'trig':timingOf(c);const perm=s.k==='card'&&isPermC(c);const empty=!chain.length;
    const verb=s.k==='tg'?Art(c.n)+' triggerel':s.pl==='A'?(ix&&!empty?'Válaszként ':'')+(s.k==='ab'?'aktiválod':'kijátszod'):'Az ellenfél '+(ix&&!empty?'válaszként ':'')+(s.k==='ab'?'aktiválja':'kijátssza');
    const what=s.k==='tg'?'('+esc(s.tr?s.tr.why:'?')+')':s.k==='ab'?art(c.n)+' abilityjét ('+esc(s.ab?s.ab.label:'?')+')':art(c.n)+' lapot';
    const Verb=verb[0].toUpperCase()+verb.slice(1);
    it=itemOf(s);s.it=it;if(ZC)out.zsnap[s.j]={ctx:zctx(it,s),hand:{A:zoneIds('hand','A'),B:zoneIds('hand','B')},trash:{A:zoneIds('trash','A'),B:zoneIds('trash','B')},deck:{A:zoneIds('deck','A'),B:zoneIds('deck','B')}};
    let illegal:any=null;
    if(s.k==='ab'&&!s.ab)illegal='nincs kiválasztva ability';
    else if(s.k==='tg'&&!s.tr)illegal='nincs kiválasztva trigger';
    else if(s.k==='ab'&&s.ab.add){rows+=line('430.2, 337.2',esc(Verb)+' '+what+'. Erőforrást ad: azonnal resolve-ol, nem kerül a chainre, és nem lehet rá válaszolni.',0);story.push(Verb+' '+what+': azonnal erőforrást ad, nem kerül a chainre.');return;}
    else if(s.k!=='tg'&&!empty&&!(tm==='reaction'||tm==='hidden'&&s.from==='facedown')&&(s.illTiming=true))illegal=(s.k==='ab'?'az ability':'a lap')+' nem [Reaction]'+(tm==='hidden'?' (kézből; csak facedown-ból kapna [Reaction]-t)':'')+', ezért amíg van valami a chainen, nem jöhet';
    if(!illegal&&s.k==='tg'&&s.src&&O[s.src]&&!['board','legend'].includes(O[s.src].zone)&&!s.tr.dk)illegal='a trigger forrása nincs a boardon';
    if(!illegal&&s.repBad){illegal=s.repBad;}
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
    if(!illegal&&!tErr&&s.list.some((p:any)=>p.split)){const n=s.list.map((p:any,ti:number)=>p.split&&s.tg[ti]?1:0).reduce((a:number,b:number)=>a+b,0);const sx=(interp(s,s).find((x:any)=>x.act.split)||{}).act||{};
      let T0=sx.k==='dmg'?sx.n:null;if(sx.k==='dmgM'){const f=s.tg.find((v:string,ti:number)=>v&&!s.list[ti].split);T0=f?mightOf(f):null;}
      if(T0!=null){const b=bonusDmg(s.pl);if(b)T0+=b;if(n>T0)tErr='osztott damage: legfeljebb '+T0+' célpont választható (355.14.c'+(b?', a Bonus Damage-dzsel együtt, 715.3':'')+'), most '+n;}}
    /* trashből választott célpont (355.9.a, 355.10.a): a lerakáskor legálisnak kell lennie (355.8) */
    if(!illegal&&!tErr&&s.zp)interp(s,s).forEach((x:any,xi:number)=>{const ids=s.zp[xi];if(tErr||!ids||!ids.length)return;const zr=zoneRefOf(x.t,c.n);if(!zr)return;
      const gone=ids.filter((id:string)=>!O[id]||!O[id].card);if(gone.length){tErr='nincs megadva a '+(xi+1)+'. utasítás lapja: a kiválasztott lap már nincs a helyzetben (törölték), újra kell választani';return;}
      if(!zr.target)return;
      const w=zcWhy(zr,ids,it.pl,false,zctx(it,s));if(w)tErr=(xi+1)+'. utasítás célpontja a trashben nem választható: '+w+' (355.9.a, 355.9.b)';else{it.zpGen=it.zpGen||{};ids.forEach((id:string)=>{it.zpGen[id]=O[id].gen||0;});}});
    /* Show Off költségfeltétellel (Rousing Display): a felfedett vagy kiválasztott lap nyomtatott költsége (832.1.c, 206) */
    if(!illegal&&!tErr&&s.so&&/\[Show Off\]/.test(c.txt||'')){const sl=(c.txt||'').split('\n').find((l:string)=>/\[Show Off\]/.test(l))||'';const cc=costCondOf(sl);
      if(cc){const sc=String(s.so).startsWith('h:')?vsCard(String(s.so).slice(2)):O[s.so]&&O[s.so].card;const w=sc?costCheck(cc,sc,{}):'';if(w)tErr='Show Off: '+sc.n+' nem választható, '+w.replace(/ \(206\)$/,'')+' (832.1.c, 206)';}}
    let trigBad:any=null;if(tErr){if(perm&&s.trig)trigBad=tErr;else{illegal=tErr;s.illTarget=true;}}
    s.illegal=illegal;
    if(illegal){if(s.k==='tg'){rows+=line('403.4, 403.4.a',esc(Verb)+' '+what+', de nincs legális választás: '+illegal+'. A trigger lekerül a chainről (ez nem counter).',0);story.push(Art(c.n)+' triggere lekerül a chainről, mert '+illegal.replace(/<[^>]+>/g,'')+'.');return;}
      rows+=line(s.illTiming?(s.k==='ab'?'358.4, 338.1.a.1, 813.1.c.2':'358.4, 338.1.a.1, 813.1.c.1'):s.illTarget?'355.8':'358','<span class="stbad">Nem szabályos:</span> '+esc(Verb)+' '+what+'? '+illegal+'. Kimarad.',0);story.push((s.pl==='A'?'Nem '+(s.k==='ab'?'aktiválhatod':'játszhatod ki'):'Az ellenfél nem '+(s.k==='ab'?'aktiválhatja':'játszhatja ki'))+' '+what.replace(/<[^>]+>/g,'')+' így: '+illegal.replace(/<[^>]+>/g,'').replace(/ \([0-9.]+\)/g,'')+'.');if(O['s'+s.j])O['s'+s.j].zone='none';return;}
    // legális
    if(ZC&&s.k==='card'&&['hand','trash',undefined,null,''].includes(s.from)){const fz=s.from==='trash'?'trash':'hand';const zid=Object.keys(O).find(id=>O[id].type==='zc'&&O[id].zone===fz&&O[id].own===s.pl&&O[id].card.n===c.n);if(zid)zcMove(zid,'played');}
    const timingTxt=s.k==='tg'?'a játék teszi a chainre, priority nem kell hozzá':!empty?(tm==='reaction'?'[Reaction], ezért válaszként jöhet':'facedown-ból [Reaction]-ként jön'):(tm==='none'&&c.t==='Spell'?'üres chain mellett, a saját körödben':'üres chain mellett');
    rows+=line(s.k==='tg'?'383.3, 401':!empty?(tm==='reaction'?(s.k==='ab'?'813.1.c.2':'813.1.c.1'):'811.6'):(s.k==='ab'?'381':c.t==='Spell'?'155':'337.2'),esc(Verb)+' '+what+' ('+timingTxt+').'+(s.from&&s.from!=='hand'&&s.k==='card'?' Honnan: '+({facedown:'facedown',trash:'trash',champ:'Champion Zone',other:'nem kézből'} as any)[s.from]+'.':''),0);
    pick.forEach((a:any)=>{rows+=line(a[0],a[1],a[2]);});
    if(s.modes&&s.modes.length)rows+=line('355.3','Választott mód ("Choose one"): '+esc(s.modes[Math.max(0,Math.min(s.mode||0,s.modes.length-1))].replace(/\.$/,''))+'. A mód a kijátszáskor dől el, a builderben állítható.',0);
    if(s.rep&&s.repModes)rows+=line('820.1.d.1, 820.2'+(s.modes&&s.modes.length?', 820.2.a':''),'[Repeat] költség kifizetve '+(s.rep>1?s.rep+' alkalommal ('+s.repN+' külön költségből)':'')+': a hatás a resolve-kor '+(s.rep>1?s.rep+' további alkalommal':'még egyszer')+' végrehajtódik'+(s.modes&&s.modes.length?', a további végrehajtások módja: '+s.repModes.slice(1).map((m:number)=>esc(s.modes[Math.max(0,Math.min(m,s.modes.length-1))].replace(/\.$/,''))).join('; ')+' (más mód és más célpont is választható)':'')+'. A célpontok sorrendje a végrehajtás sorrendje.',0);
    if(s.k==='ab'&&s.src&&O[s.src]&&/\[T\]|\[E\]/.test(s.ab.cost||'')){O[s.src].ex=true;rows+=line('415','Költség: '+esc(O[s.src].name)+' exhausted lesz.',0);}
    if(s.k==='ab'&&s.src&&O[s.src]&&/disempower me/i.test(s.ab.cost||'')){O[s.src].emp=false;rows+=line('443','Költség: '+esc(O[s.src].name)+' disempowered lesz.',0);}
    if(costV){const parts:string[]=[];const refs:string[]=[];const r=killObj(costV,'additional cost',parts,refs);EV.push({k:'cost',id:costV});rows+=line('356.2.a, 357.2'+(r==='neg'?', 357.2.a':''),'Költség: '+parts.join(' ')+(r==='neg'?' A halált replacement helyettesítette, a költség ettől még ki van fizetve (357.2.a).':''),0);story.push('Költségként '+(r==='neg'?'meg kellene halnia '+art(O[costV].name)+' lapnak, de a halált replacement helyettesíti; a költség így is ki van fizetve.':'meghal '+art(O[costV].name)+'.'));}
    if(s.k==='tg'&&s.killSelf){if(s.src&&onB(s.src)){const parts:string[]=[];const refs:string[]=[];const r=killObj(s.src,'a trigger költsége',parts,refs);rows+=line('204.1.c, 383.3.b'+(r==='neg'?', 357.2.a':''),'A trigger költsége ("kill me") a finalizáláskor: '+parts.join(' '),0);story.push(Art(c.n)+' a trigger költségeként meghal, mielőtt a hatás a chainre kerül.');}
      else{rows+=line('204.1.c','A "kill me" költség nem fizethető ki (a forrás nincs a boardon), ezért a trigger nem kerül a chainre.',0);s.illegal='költség';return;}}
    if(perm){O['s'+s.j].zone='board';const er=enterReady(c,s.pl,!!s.accel,O['s'+s.j].loc,s.erd,'s'+s.j,!!s.addc);if(c.t==='Unit')O['s'+s.j].ex=!er.ready;EV.push({k:'enter',id:'s'+s.j,name:c.n,loc:O['s'+s.j].loc});rows+=line('337.2'+(c.t==='Unit'?(er.ready?', 143.4.a':', 143.4'):''),'A '+c.t.toLowerCase()+' azonnal resolve-ol és ide kerül: '+esc(locLabel(O['s'+s.j].loc))+'.'+(c.t==='Unit'?(er.ready?' Ready lép be ('+er.why+').':' Exhausted lép be (143.4).')+(er.note?' '+er.note:''):'')+(s.trig?' A "When you play" hatása triggerként a chainre kerül (355.5.b).':''),er.note&&/bizonytalan|nem követett/.test(er.note)?1:0);}
    else if(O['s'+s.j])O['s'+s.j].zone='chain';
    s.tg.forEach((v:string,ti:number)=>{if(v)rows+=line('355.7','<span class="stok">'+(ti+1)+'. célpont:</span> '+esc(nm(v))+(O[v]&&O[v].loc?' ('+esc(locLabel(O[v].loc))+(mightOf(v)!=null?', '+mightOf(v)+' Might':'')+')':'')+'.',0);});
    const defl=s.tg.filter((v:string)=>v&&O[v]&&O[v].card&&O[v].type!=='ability'&&O[v].type!=='spell'&&O[v].ctrl!==it.pl&&/\[Deflect/.test(O[v].card.txt||'')).map((v:string)=>{const m=/\[Deflect(?: (\d+))?\]/.exec(O[v].card.txt);return O[v].name+' ('+(m&&m[1]?m[1]:1)+')';});
    if(defl.length){s.defl=defl;rows+=line('809.1.c, 356.2.a','Deflect: '+esc(defl.join(', '))+' kiválasztásáért ennyi plusz Powert kell fizetni additional costként.',0);}
    let trigOK=!perm||!s.trig||s.cond!=='paid'||s.addc;
    if(perm&&s.trig&&s.cond==='facedown'&&s.from!=='facedown'){trigOK=false;rows+=line('383.2.a','A play trigger feltétele ("When you play me from face down") nem teljesül: nem facedown-ból játszották ki, ezért nem triggerel.',0);}
    else if(perm&&s.trig&&s.cond==='facedown')rows+=line('383.2.a, 811.1.d.3','Facedown-ból kijátszva: a "When you play me from face down" trigger a chainre kerül.',0);
    if(perm&&s.trig&&trigOK&&s.tcond){const cv=evalCond(s.tcond,it,s,-1,null);if(cv===false){trigOK=false;rows+=line('383.2.a.1','A play trigger feltétele ("if '+esc(s.tcond.t)+'") a kijátszáskor nem teljesül '+esc(condSrc(s.tcond))+', ezért nem triggerel.',0);story.push('A "When you play" trigger nem triggerel, mert a feltétele ("if '+s.tcond.t+'") nem teljesül.');}
      else rows+=line('383.2.a.1','A play trigger feltétele ("if '+esc(s.tcond.t)+'") a kijátszáskor teljesül '+esc(condSrc(s.tcond))+', ezért a chainre kerül; a resolve-kor már nem ellenőrzi újra.',0);}
    if(perm&&s.trig&&!trigOK){if(s.cond==='paid')rows+=line('383.2.a.1','A play effect feltétele ("if you paid the additional cost") nem teljesül, ezért nem triggerel.',0);}
    else if(trigBad){trigOK=false;rows+=line('403.4, 403.4.a','A play effectnek nincs legális választása ('+trigBad+'). A '+c.t.toLowerCase()+' ettől még a boardra kerül, a trigger lekerül a chainről (403.4; ez nem counter).',0);story.push('A play effectnek nincs legális célpontja, ezért a trigger lekerül a chainről.');s.trigBad=trigBad;}
    if(perm&&s.trig&&!trigOK){}
    else if(s.may&&(s.k==='tg'||perm&&trigOK))rows+=line('383.3.a, 383.3.a.2','"You may" a triggered ability elején: '+WHO[it.pl]+' a chainre tételkor (finalizálás) dönt'+(it.pl==='A'?'öd':'i')+' el, végrehajtja-e; ha nem, lekerül. Az elemzés igennel számol.',0);
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
  }finally{const lab=(s.k==='tg'?(s.it?s.it.pl:s.pl):s.pl)==='A'?'Te':'Ellenfél';snap(s.k==='tg'?'Trigger: '+s.c.n+(s.illegal?' (lekerül)':''):lab+': '+(s.k==='ab'?'aktiválás':'kijátszás')+', '+(s.k==='ab'?s.c.n+' abilityje':s.c.n)+(s.illegal?' (nem szabályos, kimarad)':''),chain,s.j);}});
  /* ---- 2. lefutás ---- */
  const done=out.done;
  /** Cleanup (319.5, 323): lethal damage-es unitok meghalnak, csatolatlan gear battlefielden és idegen base-ben álló permanentek recall-olódnak (323.6). */
  const cleanup=()=>{const dead=Object.keys(O).filter(id=>lethal(id));const parts:string[]=[];const refs:string[]=[];const names:string[]=[];
    dead.forEach(id=>{const r=killObj(id,'lethal damage, cleanup',parts,refs);names.push(O[id].name+(r==='neg'?' (helyettesítve)':''));});
    if(dead.length){REC.push(['323.4, 142.4.b, 429.1.a.2','Cleanup: '+plainOf(parts.join(' '))]);ALL.push(REC[REC.length-1]);}
    const rc=Object.keys(O).filter(id=>{const g=O[id];return g.zone==='board'&&!g.on&&((g.type==='gear'&&g.loc!=='base')||(g.loc==='base'&&g.baseOf&&g.ctrl&&g.baseOf!==g.ctrl));});
    rc.forEach(id=>{const g=O[id];const why=g.loc!=='base'?'csatolatlan gear battlefielden':'nem a saját irányítója base-ében áll';g.loc='base';g.baseOf=g.ctrl;EV.push({k:'recall',id,name:g.name,cleanup:true});
      REC.push(['323.6'+(why[0]==='c'?', 436.4.a':''),g.name+': '+why+', ezért a cleanupban recall-olódik a base-be.']);ALL.push(REC[REC.length-1]);names.push(g.name+' recall');story.push(Art(g.name)+' a cleanupban a base-be kerül ('+why+').');});
    flushPend(stack);if(names.length)snap('Cleanup: '+names.join(', '),stack);};
  let guard=0;const resolveAll=()=>{while(stack.length&&guard++<80){const it=stack.pop();const d0=done.length;try{resolveItem(it);flushPend(stack);}finally{const dn=done.length>d0?done[done.length-1]:null;snap('Resolve: '+it.label+(dn?', '+(RES[dn.res]||dn.res):''),stack);cleanup();}}};
  const evalState=(cd:any,it:any,s:any,tv:string|null):boolean|null=>{const c=cd.t;const pl=it.pl;let m;const T=tv&&O[tv]?O[tv]:null;const S=it.src&&O[it.src]?O[it.src]:null;const here=S&&S.zone==='board'?S.loc:null;
    const cntU=(f:(o:any)=>boolean)=>Object.values(O).filter((o:any)=>o.zone==='board'&&f(o)).length;cd.from='state';
    if((m=/^Level (\d+)$/i.exec(c))){cd.val='XP: '+xpOf(pl);return xpOf(pl)>=+m[1];}
    if(/^Legion$/i.test(c)){const pb=playedBefore(pl,s?s.j:999);cd.val='korábban kijátszott lap: '+(pb.size||+PSv(pl,'played')?'van':'nincs');return pb.size>0||+PSv(pl,'played')>0;}
    if(/^you've played a spell this turn$/i.test(c)){const pb=playedBefore(pl,s?s.j:999);return pb.has('spell');}
    if(/^you've played a non-token unit, a non-token gear, and a spell this turn$/i.test(c)){const pb=playedBefore(pl,s?s.j:999);cd.val=[...pb].join(', ')||'semmi';return pb.has('unit')&&pb.has('gear')&&pb.has('spell');}
    if(/an opponent's score is within 3 points of the Victory Score/i.test(c)){cd.val='ellenfél pontja: '+scoreOf(other(pl))+', Victory Score: '+VS();return VS()-scoreOf(other(pl))<=3;}
    if(/your score is not within 3 points of the Victory Score/i.test(c)){cd.val='pontod: '+scoreOf(pl);return VS()-scoreOf(pl)>3;}
    if((m=/^you control (\d+) or (fewer|more) runes$/i.exec(c))){const r=runesOf(pl);cd.val='rune-ok: '+r;return m[2]==='fewer'?r<=+m[1]:r>=+m[1];}
    if((m=/^you control exactly (\d+) runes$/i.exec(c)))return runesOf(pl)===+m[1];
    if(/^your Rune Deck is empty$/i.test(c)){cd.val='rune deck: '+runeDeckOf(pl);return runeDeckOf(pl)===0;}
    if(/^you can't$/i.test(c)){cd.val='rune deck a resolve előtt: '+it.rdBefore;return (it.rdBefore??runeDeckOf(pl))<1;}
    if((m=/^you couldn't channel (\d+) runes? this way$/i.exec(c))){cd.val='rune deck a resolve előtt: '+it.rdBefore;return (it.rdBefore??runeDeckOf(pl))<+m[1];}
    if(/^it's your Beginning Phase$/i.test(c)){cd.val='fázis: '+(CS.phase||'main');return CS.phase==='beginning'&&TP===pl;}
    if((m=/^you spent \[(\d+)\] or more$/i.exec(c))){cd.val='elköltve: '+PSv(pl,'spent');return +PSv(pl,'spent')>=+m[1];}
    if(/^you showed off/i.test(c)){cd.val=s&&s.so?'Show Off: '+(O[s.so]?O[s.so].name:String(s.so).replace(/^h:/,'')):'nincs Show Off';return !!(s&&s.so);}
    if(/^it's attacking$/i.test(c))return !!(T&&T.atk==='a');
    if((m=/^you control a facedown card( here| at a battlefield)?$/i.exec(c))){const bfs=['bf0','bf1'].filter((l,i)=>(CS.bf[i]||{}).fd===pl&&(!m[1]||!/here/i.test(m[1])||l===here));return bfs.length>0;}
    if(/^I didn't die alone$/i.test(c))return !!(S&&S.lk&&S.lk.alone===false);if(/^I died alone$/i.test(c))return !!(S&&S.lk&&S.lk.alone===true);
    if(/^I was \[?Mighty\]?$/i.test(c))return !!(S&&S.lk&&S.lk.m>=5);
    if(/^I haven't been dealt damage this turn$/i.test(c))return !(S&&S.dealt);
    if(/^I am at a battlefield$/i.test(c))return !!(here&&here!=='base');
    if((m=/^you control a (\w+)$/i.exec(c))){const tg=m[1].toLowerCase();return cntU((o:any)=>o.ctrl===pl&&o.card&&((o.card.tg||[]).some((x:string)=>x.toLowerCase()===tg)||new RegExp('\\b'+m[1]+'\\b','i').test(o.card.n)))>0;}
    if(/^there is a friendly gear with \[Deploy\] here$/i.test(c))return cntU((o:any)=>o.ctrl===pl&&o.type==='gear'&&o.loc===here&&/\[Deploy\]/.test((o.card&&o.card.txt)||''))>0;
    if(/^there's an enemy unit alone at that battlefield$/i.test(c)){const l=T?(T.zone==='board'&&T.loc!=='base'?T.loc:(T.lk&&T.lk.loc)):null;return !!l&&cntU((o:any)=>o.type==='unit'&&o.ctrl!==pl&&o.loc===l)===1;}
    if(/^it's already stunned$/i.test(c))return !!(T&&T.st);
    if((m=/^there are (\d+) or more units there$/i.exec(c))){const f=(it.tg||[]).find((v:string)=>v==='F0'||v==='F1');const l=f==='F1'?'bf1':'bf0';return cntU((o:any)=>o.type==='unit'&&o.loc===l)>=+m[1];}
    if(/^it's your turn and you played this from face down$/i.test(c))return TP===pl&&it.from==='facedown';
    return null;};
  /** A feltétel forrásának szövege a felületen. */
  const condSrc=(cd:any)=>cd.how==='open'?(cd.from==='field'?'(nyitott kérdés, judge dönt: '+cd.why+'; a lapnál így megadva)':'(nyitott kérdés, judge dönt: '+cd.why+'; feltételezés: nem teljesül, a lapnál állítható)'):cd.how==='hidden'?(cd.from==='field'?'(a lapnál megadva)':cd.from==='zone'?'(a deck felső lapja a pályás építőben megadva: '+cd.zn+', 108.4.e, 128.3)':'(feltételezés: nem teljesül; '+(cd.why||'rejtett adat')+', a lapnál állítható)'):cd.how==='state'?'(játékállapotból'+(cd.val?': '+cd.val:'')+'; a kezdőérték a builderben állítható)':'(a boardon ellenőrizve)';
  /** Feltétel kiértékelése: true, false, vagy null (nem követett adat, a builderben nincs megadva). */
  const evalCond=(cd:any,it:any,s:any,xi:number,tv:string|null):boolean|null=>{if(!cd)return true;const c=cd.t.toLowerCase();
    if(/^you paid (?:the|my) additional cost/.test(c))return !!(s&&s.addc);if(/^you played this from your hand/.test(c))return (it.from||'hand')==='hand';
    if(cd.how==='hidden'||cd.how==='open'){const v=s&&s.cnd?s.cnd[xi]:null;if(v==='1'||v==='0'){cd.from='field';return v==='1';}
      const zm=/^it's an? (gear|spell|unit)$|^it is a (unit)$/i.exec(cd.t);if(zm&&it.zTop&&O[it.zTop]){cd.from='zone';cd.zn=O[it.zTop].name;return String(O[it.zTop].card.t).toLowerCase()===(zm[1]||zm[2]).toLowerCase();}
      cd.from='default';return false;}
    if(cd.how==='state'){const r=evalState(cd,it,s,tv);return r;}
    if(cd.how!=='board')return null;
    const T=tv&&O[tv]?O[tv]:null;const S=it.src&&O[it.src]?O[it.src]:null;const here=S&&S.zone==='board'?S.loc:null;
    const cntU=(f:(o:any)=>boolean)=>Object.values(O).filter((o:any)=>o.zone==='board'&&f(o)).length;
    let m;
    if(/empowered/.test(c))return /^(?:i'm|this is)/.test(c)?!!(S&&S.emp):!!(T&&T.emp);
    if(/already buffed/.test(c))return !!(T&&T.bu);if(/is stunned/.test(c))return !!(T&&T.st);
    if(/mighty/.test(c)){const mt=T?mightOf(T.id):null;return mt==null?null:mt>=5;}
    if(/^i'm at a battlefield/.test(c))return !!(here&&here!=='base');
    if((m=/^it has (\d+) \[s\] or less/.exec(c))){const mt=T?mightOf(T.id):null;return mt==null?null:mt<=+m[1];}
    if(/^it's your turn/.test(c))return TP===it.pl;if(/^it's not your turn/.test(c))return TP!==it.pl;
    if(/exactly one other unit you control here/.test(c))return cntU((o:any)=>o.type==='unit'&&o.ctrl===it.pl&&o.loc===here&&o.id!==it.src)===1;
    if(/^an enemy unit is alone here/.test(c))return cntU((o:any)=>o.type==='unit'&&o.ctrl!==it.pl&&o.loc===here)===1;
    if((m=/^it was (?:a|an) (friendly|enemy) unit/.exec(c))){if(!T)return null;const tc=(T.lk&&T.lk.ctrl)||T.ctrl;return m[1]==='friendly'?tc===it.pl:tc!==it.pl;}
    if(/^you control this battlefield/.test(c)){const l=here;return l&&l!=='base'?BF[l].ctrl===it.pl:null;}
    if((m=/^you (?:control|have) (a|an|two or more|\d+ or more|exactly \d+|exactly two|\d+\+) (other )?(?:friendly )?(units?|gear)(?: (here|there|at that battlefield))?/.exec(c))){
      const w=m[4]==='here'?here:m[4]?(T?T.loc:here):null;const n=cntU((o:any)=>o.ctrl===it.pl&&o.type===(/gear/.test(m[3])?'gear':'unit')&&(!m[2]||o.id!==it.src)&&(!w||o.loc===w));
      const q=m[1];if(q==='a'||q==='an')return n>=1;if(q==='two or more')return n>=2;let k;if((k=/^(\d+)(?: or more|\+)$/.exec(q)))return n>=+k[1];if((k=/^exactly (\d+|two)$/.exec(q)))return n===numOf(k[1]);}
    return null;};
  /** Osztott damage (355.14): a kiosztás a resolve-kor dől el (355.14.e); ha kevesebb a damage, mint a célpont, legfeljebb annyi célpont eshet ki, hogy ne legyen kevesebb célpont, mint damage (355.14.h, 355.14.h.1). */
  const splitRun=(x:any,prev:any)=>{const refs0=['355.14'];const legalT:number[]=[];
    x.tis.forEach((ti:number)=>{const v=it0.tg[ti];if(!v)return;tot0.n++;const w=tgWhy(it0,it0.list[ti],v,ti,'res');if(w.length){tgOut0[ti]='ign';mtT0.push({n:O[v].name,ok:false,why:w.join(', ')});if(O[v].zone==='board')MTIDS.add(v);}else{legalT.push(ti);tgOut0[ti]='ok';mtT0.push({n:O[v].name,ok:true});legal0.n++;}});
    let T:number|null=x.act.n;if(x.act.k==='dmgM'){const pv=prev?prev.tis.map((ti:number)=>it0.tg[ti]).find((v:string)=>v&&O[v]&&O[v].zone==='board'):null;T=pv?mightOf(pv):null;}
    if(T==null){x.st='ignored';x.ref='359.3.e.12';x.why='a szétosztandó damage értéke nem elérhető';return;}
    const b=bonusDmg(it0.pl);if(b){T+=b;refs0.push('715.3');}
    if(!legalT.length){x.st='ignored';x.ref='359.3.e.6';x.why='minden célpontja illegális';return;}
    const need=Math.min(T,legalT.length);const sp=(it0.s&&it0.s.split)||{};
    const asg:any={};legalT.forEach((ti:number)=>{const a=+sp[ti]||0;if(a>0)asg[ti]=a;});const keys=Object.keys(asg).map(Number);const sum=keys.reduce((q,k)=>q+asg[k],0);
    let why='';if(!keys.length)why='nincs megadva kiosztás';else if(sum!==T)why='a megadott kiosztás összege '+sum+', de a szétosztandó damage '+T;else if(keys.length<need)why='csak '+keys.length+' célpont kapna damage-et, de nem lehet kevesebb célpont, mint damage ('+need+', 355.14.h.1)';
    if(why){const kept=legalT.slice(0,need);kept.forEach((ti:number)=>{asg[ti]=0;});Object.keys(asg).forEach(k=>{if(!kept.includes(+k))delete asg[k];});kept.forEach((ti:number,i:number)=>{asg[ti]=1+(i===0?T!-need:0);});
      parts0.push('Osztott damage: '+T+' damage, '+legalT.length+' legális célpont. '+esc(why)+'; a kiosztást a játékos dönti el (355.14.e), az elemzés javaslata: '+kept.map((ti:number)=>esc(O[it0.tg[ti]].name)+' '+asg[ti]).join(', ')+'.');}
    else parts0.push('Osztott damage: '+T+' damage a builderben megadott kiosztás szerint.');
    if(legalT.length>T)refs0.push('355.14.h','355.14.h.1');
    legalT.forEach((ti:number)=>{const v=it0.tg[ti];if(!asg[ti]){parts0.push(esc(O[v].name)+' nem kap damage-et, kiesik a célpontok közül (355.14.h).');return;}const d=dealDmg(v,asg[ti],parts0,refs0);if(d>0){it0.hit=(it0.hit||[]).concat([v]);story.push(Art(it0.name||it0.label)+' '+d+' damage-et oszt '+art(O[v].name)+' lapra (osztott damage).');}});
    refs0.forEach(r=>refs1.push(r));x.st=legalT.length<x.tis.filter((ti:number)=>it0.tg[ti]).length?'partial':'executed';x.ref='355.14';x.why=x.st==='partial'?'csak a legális célpontokra':'';};
  let it0:any=null,parts0:string[]=[],refs1:string[]=[],tgOut0:any[]=[],mtT0:any[]=[];const tot0={n:0},legal0={n:0};
  let INRES=false;
  const resolveItem=(it:any)=>{const rec0=REC.length;const all0=ALL.length;const ir0=INRES;INRES=true;try{resolveItem0(it);}finally{INRES=ir0;
      /* az elem saját sora kerüljön előre a "Mi változott?" listában, utána a közben történt mellékhatások (leválás, kontroll) */
      if(REC.length>rec0+1&&ALL.length>all0+1){const a=REC.pop();REC.splice(rec0,0,a);const b=ALL.pop();ALL.splice(all0,0,b);}}};
  const resolveItem0=(it:any)=>{it.rdBefore=runeDeckOf(it.pl);it.ev0=EV.length;const s=it.s||null;const perm=!!it.perm;const self=it.objId?O[it.objId]:null;const srcName=it.name||it.label;
    const head='<b>'+esc(srcName)+'</b>'+(perm?' play triggere':it.kind==='auto'?' ('+esc(it.why)+')':'')+' resolve-ol. ';
    if(self&&self.zone==='countered'){if(self.toHand){self.zone='hand';self.zone0='countered';}const pt=it.kind==='step'&&s&&s.k==='card'?playTrigs(s):[];rr+=line('426.1'+(pt.length?', 420.4.a.1, 426.1.b':''),head+(self.type==='ability'?'Counterelték: nem csinál semmit, lekerül a chainről és megszűnik.':'Counterelték: nem csinál semmit, '+(self.toHand?'a tulajdonosa kezébe kerül':'a trashbe kerül')+', a költség nem jár vissza, és nem számít kijátszottnak.')+(pt.length?' Ezért nem triggerel: '+pt.map((tr:any)=>esc(tr.label)).join(', ')+'.':''),0);story.push(Art(srcName)+' sorra kerülne, de counterelték: nem történik semmi.');done.push({name:srcName,pl:it.pl,res:'countered'});out.items.push({name:srcName,res:'countered',instr:[],targets:[]});return;}
    if((it.kind==='auto'&&it.why==='Deathknell'&&it.sent===false)||(it.isTg&&it.dk&&!it.sent)){rr+=line('808.1.d.1, 808.1.d',head+'A forrás nem került a trashbe (nem halt meg), ezért a trigger lekerül a chainről.',0);done.push({name:it.label,pl:it.pl,res:'removed'});out.items.push({name:it.label,res:'removed',instr:[],targets:[]});return;}
    if(it.kind==='auto'&&it.why==='Deathknell'&&it.sent&&O[it.src]&&O[it.src].zone!=='trash')rr+=line('808.1.d.1, 808.1.d','<b>'+esc(srcName)+'</b>: a forrás a trashbe került, de onnan a resolve előtt elmozdult. A trigger ettől még lefut, mert a 808.1.d.1 csak azt az esetet nevezi meg, amikor a lap nem kerül a trashbe.',1);
    let t=head;let fl=it.kind==='auto'?1:0;const refs=['340.1'];
    if(perm&&self&&self.zone!=='board'){story.push(Art(srcName)+' már nincs a boardon, de a play triggere a chainen maradt, ezért lefut.');t+='A forrás már nincs a boardon, de a trigger független objektum, ezért lefut (355.9.c). A forrásra vonatkozó információ ("me", "here", "my") a végrehajtáskor nem elérhető, az erre épülő utasítás Ignored (359.3.f.2, 359.3.e.6). ';fl=1;}
    if(it.endTrig&&it.src&&O[it.src]&&!['board','legend'].includes(O[it.src].zone)){t+='A forrás már nincs a boardon, de a trigger feltétele a triggereléskor teljesült, ezért a trigger lefut (383.2.a.1). ';refs.push('383.2.a.1');}
    if(it.kind==='step'&&s.k==='ab'&&it.src&&O[it.src]&&!['board','legend'].includes(O[it.src].zone)){t+='Az ability forrása már nincs a boardon, de az ability ettől még lefut (355.9.c). ';fl=1;}
    const INS=it.kind==='step'?interp(s,s):interp({},{eff:it.eff,list:it.list&&it.list.length?it.list:phrasesTxt(it.eff||''),c:it.src&&O[it.src]?O[it.src].card:null});MAN=INS.some((x:any)=>x.manual);if(it.pre&&it.pre.length&&INS[0])INS[0].lk=true;
    const parts:string[]=[];let legal=0,tot=0;const tgOut:any[]=[];const mtT:any[]=[];let lastT:any=null;if(it.pre&&it.pre.length){const base=(it.tg||[]).length;it.tg=(it.tg||[]).concat(it.pre);it.list=(it.list||[]).concat(it.pre.map((v:string)=>({type:O[v]?O[v].type:'unit',rel:'any',max:null,bf:false,opt:true,pre:true})));it.pre.forEach((_:any,i:number)=>{tgOut[base+i]='ok';});lastT={tis:it.pre.map((_:any,i:number)=>base+i),st:'executed',act:{k:'pre'},t:'(a delayed hatás létrehozásakor megjelölt célpont)'};}it0=it;parts0=parts;refs1=refs;tgOut0=tgOut;mtT0=mtT;
    const runTarget=(x:any,ti:number)=>{const p=it.list[ti];const v=it.tg[ti];if(!v)return;tot++;if(v==='F0'||v==='F1'){legal++;tgOut[ti]='ok';return;}const ob=O[v];
      const wS=tgWhy(it,p,v,ti,'res');
      if(wS.length){tgOut[ti]='ign';mtT.push({n:ob.name,ok:false,why:wS.join(', ')});if(ob.zone==='board')MTIDS.add(v);EV.push({k:'mistarget',id:v,name:ob.name,item:srcName});
        parts.push('<span class="stbad">'+(ti+1)+'. célpont illegális</span> ('+esc(ob.name)+' '+wS.join(', ')+'): mistarget, rá a hatás elmarad (359.3.e.2, 359.3.e.5).');refs.push('359.3.e.9');story.push(Art(srcName)+(perm?' triggere':'')+' sorra kerül, de '+(it.list.length>1?((ti===0||ti===4)?'az ':'a ')+(ti+1)+'.':'a')+' célpontja ('+ob.name+') '+wS.join(', ').replace(/ \([0-9.,a-z ]+\)/g,'')+': mistarget, rá a hatás elmarad.');return;}
      legal++;mtT.push({n:ob.name,ok:true});const xa=x.act;if(it.prot758&&it.prot758.length){parts.push([...new Set(it.prot758)].join(' ')+'.');refs.push(/758\.2\.a/.test(it.prot758.join(''))?'758.2.a':'758.2');it.prot758=[];}
      if(xa.k==='counter'&&ob.type==='spell'&&xa.unless&&it.pays){tgOut[ti]='neg';parts.push(esc(ob.name)+' irányítója kifizeti a kért költséget, ezért a counter nem történik meg.');story.push(Art(srcName)+' lefut, de '+art(ob.name)+' gazdája kifizeti a kért költséget, így a spell marad.');return;}
      if(['draw','channel','discard','choose','deck','xp','score','pay','showoff','fight','win','perm'].includes(xa.k)){tgOut[ti]='ok';if(xa.k==='choose')parts.push(esc(ob.name)+' kiválasztva.');return;}
      if(xa.k==='note'||xa.k==='copy'){tgOut[ti]='ok';if(!x.noted){x.noted=1;parts.push((xa.open?'<span class="cbuns">nyitott kérdés</span> ':'')+esc(ob.name)+': "'+esc(x.t)+'": '+esc(xa.d||'')+(xa.refs?' ('+xa.refs+')':'')+'.');if(xa.refs)xa.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));}fl=Math.max(fl,xa.open?2:1);return;}
      if(xa.k==='other'||xa.k==='delayed'||xa.k==='playcard'||xa.k==='replay'||xa.k==='token'){tgOut[ti]='ok';parts.push(esc(ob.name)+': "'+esc(x.t)+'" lefut, ezt az elemzés nem követi részletesen.');fl=Math.max(fl,1);return;}
      const r=applyTo(v,Object.assign({t:x.t},xa),it,parts,refs);tgOut[ti]=r==='neg'?'neg':r==='ign'?'ign':'ok';if(r==='ign')legal--;};
    // Bellows Breath típus: "at the same location" csoport a resolve-kor (355.11.b, 355.11.b.1)
    if(it.list.some((p:any)=>p.same)){const live=it.tg.map((v:string,ti:number)=>v&&O[v]&&O[v].zone==='board'?{v,ti,loc:O[v].loc}:null).filter(Boolean);const groups:any={};live.forEach((x:any)=>{(groups[x.loc]=groups[x.loc]||[]).push(x);});const keys=Object.keys(groups);
      if(keys.length>1){keys.sort((a,b)=>groups[b].length-groups[a].length);const keep=keys[0];
        parts.push('A célpontok már nem állnak egy locationön, ezért '+WHO[it.pl]+' választ egy legális részhalmazt (355.11.b). A részhalmaznak az adott locationön álló összes eredeti célpontot tartalmaznia kell (355.11.b.1), de bármelyik location választható: '+keys.map(k=>esc(locLabel(k))+': '+groups[k].map((x:any)=>esc(O[x.v].name)).join(', ')).join('; vagy ')+'. Az elemzés ezt számolja: '+esc(locLabel(keep))+'; a másik választással a hatás a másik csoportra jutna.');refs.push('355.11.b','355.11.b.1');
        live.forEach((x:any)=>{if(x.loc!==keep){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});}}
    // Összesített Might megkötés (Fox-Fire, 355.11.b): ha a megmaradt célpontok együtt már nem felelnek meg, legális részhalmaz kell
    const tmP=it.list.find((p:any)=>p.totalMax!=null);
    if(tmP){const live=it.tg.map((v:string,ti:number)=>v&&O[v]&&O[v].zone==='board'&&O[v].loc!=='base'&&!(it.dropT&&it.dropT.has(ti))?{v,ti,m:mightOf(v)||0}:null).filter(Boolean);const sum=live.reduce((a:number,x:any)=>a+x.m,0);
      if(sum>tmP.totalMax){let keep:any[];const sub=s&&Array.isArray(s.sub)?s.sub.map(Number):null;const subL=sub?live.filter((x:any)=>sub.includes(x.ti)):null;
        if(subL&&subL.length&&subL.reduce((a:number,x:any)=>a+x.m,0)<=tmP.totalMax){keep=subL;parts.push('A célpontok együttes Mightja ('+sum+') már nagyobb, mint '+tmP.totalMax+', ezért '+WHO[it.pl]+' a lapnál megadott legális részhalmazt választja: '+keep.map((x:any)=>esc(O[x.v].name)+' ('+x.m+')').join(', ')+' (355.11.b).');}
        else{keep=[];let acc=0;live.slice().sort((a:any,b:any)=>a.m-b.m||a.ti-b.ti).forEach((x:any)=>{if(acc+x.m<=tmP.totalMax){keep.push(x);acc+=x.m;}});keep.sort((a:any,b:any)=>a.ti-b.ti);
          parts.push('A célpontok együttes Mightja ('+sum+') már nagyobb, mint '+tmP.totalMax+', ezért '+WHO[it.pl]+' az eredeti célpontok egy legális részhalmazát választja (355.11.b). '+(sub?'A lapnál megadott részhalmaz nem legális, ezért ':'')+'Feltételezés: a lehető legtöbb célpont marad ('+keep.map((x:any)=>esc(O[x.v].name)+' '+x.m+' Might').join(', ')+'); a részhalmaz a lapnál választható. Új, eredetileg nem választott unit nem kerülhet bele.');}
        refs.push('355.11.b');live.forEach((x:any)=>{if(!keep.includes(x)){it.dropT=it.dropT||new Set();it.dropT.add(x.ti);}});
        story.push(Art(srcName)+' célpontjai együtt már '+sum+' Mightúak, ezért csak egy legális részhalmazukra hat ('+keep.map((x:any)=>O[x.v].name).join(', ')+').');}}
    const runT0=runTarget;const runTargetX=(x:any,ti:number)=>{if(it.dropT&&it.dropT.has(ti)){tot++;tgOut[ti]='ign';mtT.push({n:O[it.tg[ti]].name,ok:false,why:'kimarad a választott részhalmazból (355.11.b)'});return;}runT0(x,ti);};
    // "If ..., X instead": a feltétel teljesülése esetén az előző utasítás helyett ez hajtódik végre (369.1)
    INS.forEach((x:any,xi:number)=>{if(x.act.k==='counterToHand'){const b=INS.slice(0,xi).reverse().find((y:any)=>y.act.k==='counter');if(b){b.act=Object.assign({},b.act,{toHand:true});x.prep='a counterelt spell a kézbe kerül';}}
      if(x.act.k==='bonusTrashName'){const b=INS.slice(0,xi).reverse().find((y:any)=>y.act.k==='dmg');const fv=s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!==''?+s.hv[xi]:0;const nm2=(it.s&&it.s.c&&it.s.c.n)||'';const tc=Object.values(O).filter((o:any)=>o.zone==='trash'&&o.own===it.pl&&o.card&&o.card.n===nm2&&o.id!==it.objId).length;
        if(b){b.act=Object.assign({},b.act,{bonus:fv+tc});x.prep='Bonus Damage: '+(fv+tc)+' ('+fv+' a lapnál megadott korábbi, '+tc+' ebben az elemzésben a trashbe került példány)';}}});
    INS.forEach((x:any,xi:number)=>{if(!x.act.alt)return;let pi=xi-1;while(pi>=0&&INS[pi].act.alt)pi--;const base=INS[pi];if(!base)return;
      const tv=base.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]);const cv=evalCond(x.act.cond,it,s,xi,tv);x.cv=cv;
      if(cv===true){base.act=Object.assign({},x.act,{alt:false,cond:null});base.altBy=x.t;x.altUsed=true;}});
    INS.forEach((x:any,xi:number)=>{
      const dir=x.dir;const lk=x.lk;const prev=lk?lastT:null;
      if(x.det.unsure&&!x.manual){parts.push('<span class="cbuns">bizonytalan</span> "'+esc(x.t)+'": '+esc(x.det.unsure)+'.');fl=Math.max(fl,1);}
      if(x.act.alt){x.st=x.altUsed?'executed':'skipped';x.ref='369.1';x.why='a feltétel ("'+x.act.cond.t+'") '+(x.altUsed?'teljesül':'nem teljesül')+' '+condSrc(x.act.cond)+(x.altUsed?', ezért ez hajtódik végre az előző utasítás helyett':', ezért az eredeti utasítás marad');
        parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');if(x.act.cond.how==='hidden'&&x.act.cond.from==='default')fl=Math.max(fl,1);return;}
      const cf=/^if you played this from your hand\b/i.test(x.t)?(it.from||'hand')==='hand':/^if you paid the additional cost\b/i.test(x.t)?!!(s&&s.addc):null;
      if(cf===false){x.st='skipped';x.ref='135.2.b.7';x.why='a feltétel ("'+x.t.split(',')[0]+'") nem teljesül, a resolve-kor ellenőrizve';return;}
      if(x.act.otherwise){const pc=INS.slice(0,xi).reverse().find((y:any)=>y.act.cond&&!y.act.otherwise&&y.cv!=null);
        if(pc&&pc.cv===true){x.st='skipped';x.ref='135.2.b.5.a';x.why='az előző feltétel ("'+pc.act.cond.t+'") teljesült, ezért az "Otherwise" ág nem hajtódik végre';parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');return;}
        if(pc)parts.push('"'+esc(x.t)+'": az előző feltétel ("'+esc(pc.act.cond.t)+'") nem teljesült, ezért az "Otherwise" ág hajtódik végre.');}
      const cd=x.act.cond;if(cd&&cd.how!=='known'&&!(prev&&prev.st==='ignored')){const tv=lastT?lastT.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]):null;const cv=evalCond(cd,it,s,xi,tv);x.cv=cv===null?true:cv;
        if(cd.how==='open'){fl=2;parts.push('<span class="cbuns">nyitott kérdés</span> ('+esc(cd.refs||'')+')');}
        if(cv===false){x.st='skipped';x.why='a feltétel ("'+cd.t+'") nem teljesül '+condSrc(cd);parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');if(cd.how==='hidden'&&cd.from==='default')fl=Math.max(fl,1);return;}
        if(cv==null){parts.push('"'+esc(x.t)+'": a feltétel ("'+esc(cd.t)+'") az adott helyzetben nem értékelhető ki (nincs hozzá célpont vagy forrás); az elemzés teljesültnek veszi.');fl=Math.max(fl,1);}
        else parts.push('"'+esc(x.t)+'": a feltétel ("'+esc(cd.t)+'") teljesül '+esc(condSrc(cd))+'.');}
      if(x.act.k==='reflex'&&!(prev&&prev.st==='ignored')&&!(prev&&prev.st==='negated'&&dir)){x.st='executed';x.ref='388';
        let times=1;const tm=/do this (\w+) times/i.exec(x.t);if(tm)times=numOf(tm[1]);
        if(/for each unit this kills/i.test(x.t)){times=(it.hit||[]).filter((v:string)=>lethal(v)||O[v].zone==='trash').length;x.why='reflexív trigger, annyiszor kerül a chainre, ahány unitot ez megölt ('+times+'; a lethal damage-es unitok a következő cleanupban halnak meg, 429.5.c)';}
        else x.why='reflexív trigger ("do this"), külön chain elemként kerül a chainre (388.1)';
        if(x.act.cond&&x.act.cond.how!=='known'){const cv=evalCond(x.act.cond,it,s,xi,null);if(cv===false){times=0;x.why='a reflexív trigger feltétele nem teljesül';}}
        for(let q=0;q<times;q++)pushTrig({kind:'auto',label:srcName+' reflexív triggere',name:srcName+' reflexív triggere',src:it.src,pl:it.pl,eff:x.act.body,why:'do this',list:x.tis.map((ti:number)=>it.list[ti]),tg:x.tis.map((ti:number)=>it.tg[ti]),from:it.from,loc:it.loc,perm:false});
        parts.push('Reflexív trigger: "'+esc(x.act.body)+'"'+(times!==1?' ('+times+' alkalommal)':'')+' a chainre kerül, és ez után resolve-ol (388, 388.1).');refs.push('388');if(x.tis.length)lastT=x;return;}
      if(x.act.field)x.act.fv=s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!==''?s.hv[xi]:x.act.field.def;
      /* az eldobott lap a pályás építőben kiválasztva: a rejtett adat helyett a lap tényleges értéke */
      if(x.act.field&&x.act.hidden&&/eldobott lap/i.test(x.act.field.label||'')&&it.zDisc&&O[it.zDisc]&&!(s&&s.hv&&s.hv[xi]!=null&&s.hv[xi]!=='')){const dc=O[it.zDisc].card;x.act=Object.assign({},x.act,{fv:x.act.field.type==='num'?(dc.e!=null&&dc.e!==''?+dc.e:0):String(dc.t).toLowerCase()});parts.push('Az eldobott lap: '+esc(dc.n)+' ('+(x.act.field.type==='num'?'Energy költség '+x.act.fv:dc.t)+'), a kézből kiválasztva.');}
      if(x.act.fromPrev&&prev){const pv=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]);x.act=Object.assign({},x.act,{fv:pv&&O[pv].card&&O[pv].card.e!=null?+O[pv].card.e:0});if(pv)parts.push(esc(O[pv].name)+' Energy költsége: '+x.act.fv+'.');}
      if(x.act.k==='attachOrDetach')x.act=Object.assign({},x.act,{k:x.act.fv||'detach'});
      if(x.act.k==='might'&&x.act.onlyThere)x.act=Object.assign({},x.act,{k:'mightOnlyThere'});
      if(x.act.k==='raiseTo'&&prev)it.raiseBase=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]&&O[v].zone==='board')||null;
      if(x.act.k==='payChoice'){x.st=x.act.fv==='1'?'executed':'skipped';x.why=x.act.fv==='1'?'kifizetve':'nem fizette ki (a lapnál állítható, alap: nem)';it.paid=x.act.fv==='1';parts.push('"'+esc(x.t)+'": '+x.why+'.');lastT=lastT;return;}
      if(x.act.k==='counterOtherwise'){const tv=INS.slice(0,xi).flatMap((y:any)=>y.tis).map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]&&O[v].type==='spell');
        if(it.paid){x.st='skipped';x.why='a költséget kifizette, ezért nincs counter';parts.push('"'+esc(x.t)+'": '+x.why+'.');return;}
        if(tv&&O[tv].zone==='chain'){O[tv].zone='countered';EV.push({k:'counter',id:tv,name:O[tv].name});parts.push(esc(O[tv].name)+' counterelve (426.1).');refs.push('426.1');x.st='executed';}else{x.st='ignored';x.ref='359.3.e.6';x.why='a spell már nincs a chainen';}return;}
      if((x.act.k==='attach2'||x.act.k==='attachTo')&&!(prev&&prev.st==='ignored')){const own=x.tis.map((ti:number)=>it.tg[ti]).filter(Boolean);const pv=prev?prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]&&O[v].type==='unit'&&O[v].zone==='board'):null;
        const G=own.map((v:string)=>O[v]).find((o:any)=>o&&o.type==='gear'&&o.zone==='board');const U=x.act.k==='attach2'?own.map((v:string)=>O[v]).find((o:any)=>o&&o.type==='unit'&&o.zone==='board'):(pv?O[pv]:null);
        x.tis.forEach((ti:number)=>{if(it.tg[ti]){tot++;legal++;tgOut[ti]='ok';mtT.push({n:O[it.tg[ti]].name,ok:true});}});
        if(!G||!U){x.st=G||own.length?'ignored':'executed';x.why=G?'nincs érvényes unit':'nincs választott Equipment';parts.push('"'+esc(x.t)+'": '+x.why+'.');lastT=x;return;}
        if(G.on===U.id){x.st='negated';x.ref='359.3.e.6';x.why='már ezen a uniton van (435.1.g)';parts.push(esc(G.name)+' már '+esc(U.name)+' lapon van (435.1.g).');lastT=x;return;}
        const from=G.on;G.on=U.id;G.loc=U.loc;EV.push({k:'attach',id:G.id,name:G.name,to:U.id});parts.push(esc(G.name)+' csatolva: '+esc(U.name)+(from&&O[from]?' (leválik '+esc(O[from].name)+' lapról, 435.1.f)':'')+' (435).');refs.push('435');x.st='executed';lastT=x;return;}
      if(x.act.k==='mightFromSpell'&&prev){const pts=prev.tis.map((ti:number)=>it.tg[ti]).filter(Boolean);const U=pts.map((v:string)=>O[v]).find((o:any)=>o&&o.type==='unit'&&o.zone==='board');const SP=pts.map((v:string)=>O[v]).find((o:any)=>o&&o.type==='spell');
        if(!U||!SP){x.st='ignored';x.ref='359.3.e.14.a';x.why='a unit vagy a spell nem érvényes';return;}const n=+(SP.card&&SP.card.e||0);const b0=mightOf(U.id);U.mods.push({n});EV.push({k:'might',id:U.id,name:U.name,from:b0,to:mightOf(U.id)});parts.push(esc(U.name)+' +'+n+' Might ('+esc(SP.name)+' nyomtatott Energy költsége, 206).');x.st='executed';return;}
      if(x.act.k==='dmgKw'&&x.act.who==='linked'&&prev)it.kwSrc=prev.tis.map((ti:number)=>it.tg[ti]).find((v:string)=>v&&O[v]&&O[v].zone==='board')||null;
      if(x.act.k==='swapMight'&&x.tis.length===2&&!(prev&&prev.st==='ignored')){const vs=x.tis.map((ti:number)=>it.tg[ti]);
        const bad=x.tis.filter((ti:number)=>!it.tg[ti]||tgWhy(it,it.list[ti],it.tg[ti],ti,'res').length);x.tis.forEach((ti:number)=>{if(it.tg[ti]){tot++;if(!bad.includes(ti)){legal++;tgOut[ti]='ok';mtT.push({n:O[it.tg[ti]].name,ok:true});}else{tgOut[ti]='ign';mtT.push({n:O[it.tg[ti]].name,ok:false,why:'illegális célpont'});}}});
        if(bad.length){x.st='ignored';x.ref='359.3.e.6';x.why='a két unit közül legalább egy illegális célpont';lastT=x;return;}
        const m1=mightOf(vs[0]),m2=mightOf(vs[1]);if(m1==null||m2==null){x.st='ignored';x.ref='359.3.e.12';x.why='a Might nem ismert';lastT=x;return;}
        O[vs[0]].mods.push({n:m2-m1});O[vs[1]].mods.push({n:m1-m2});EV.push({k:'might',id:vs[0],name:O[vs[0]].name,from:m1,to:m2});EV.push({k:'might',id:vs[1],name:O[vs[1]].name,from:m2,to:m1});
        parts.push(esc(O[vs[0]].name)+' és '+esc(O[vs[1]].name)+' Mightja felcserélődik ebben a körben: '+m1+' ↔ '+m2+' (434.1).');refs.push('434.1');x.st='executed';lastT=x;return;}
      if(x.act.split&&x.tis.length&&!(prev&&prev.st==='ignored')){tot0.n=0;legal0.n=0;splitRun(x,prev);tot+=tot0.n;legal+=legal0.n;lastT=x;return;}
      if(prev&&(prev.st==='ignored')){x.st='ignored';x.ref='359.3.e.14.a';x.why='linked instruction, a korábbi utasítás Ignored lett, ezért ez is Ignored';
        if(x.act.split&&x.act.k==='dmgM'){x.ref='359.3.e.12, 359.3.e.14.a';x.why='a szétosztandó damage a kiválasztott unit Mightja, de az a unit már nem érvényes célpont, így a Mightja null (359.3.e.12); az erre épülő utasítás Ignored';}
        x.tis.forEach((ti:number)=>{const v=it.tg[ti];if(v){tot++;tgOut[ti]='ign';mtT.push({n:nm(v),ok:false,skip:true,why:'a linked instruction Ignored, ezért rá sem hat'});}});}
      else if(dir&&xi>0&&INS[xi-1].act.k==='payChoice'&&INS[xi-1].st==='skipped'){x.st='skipped';x.ref='359.3.e.14.b';x.why='az előző utasítás (a költség kifizetése) nem történt meg, ezért ez sem';parts.push('"'+esc(x.t)+'": '+x.why+'.');}
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
        const zr0=ZC&&s?zoneRefOf(x.t,s.c&&s.c.n):null;
        const zpick=zr0?(s.zp&&s.zp[xi]&&s.zp[xi].length?s.zp[xi]:zr0.z==='deck'&&zr0.top?zoneIds('deck',zr0.who==='they'?other(it.pl):it.pl).slice(0,zr0.n):null):null;
        const amongIt=ZC&&INS.some((y:any)=>{const z=zoneRefOf(y.t);return z&&z.z==='among';});
        const zTopUse=ZC&&it.zTop&&!amongIt&&/\b(?:draw it|put it (?:in|into) your hand)\b/i.test(x.t)&&O[it.zTop]&&O[it.zTop].zone==='deck';
        const restM=ZC&&it.zLook&&it.zLook.length&&/\b(?:the rest|the remaining cards)\b/i.test(x.t);
        if(amongIt&&it.zAmongDone&&/^(?:then,?\s*)?(?:you may )?draw it\b/i.test(x.t)){parts.push('"'+esc(x.t)+'": a megnézett lapok közül választott lap már a kézbe került (az előző utasítás része).');}
        else if(restM){const rest=it.zLook.filter((id:string)=>O[id]&&O[id].zone==='deck');const toTrash=/\btrash\b/i.test(x.t);
          rest.forEach((id:string)=>{if(toTrash)zcMove(id,'trash');else{O[id].ord=900+(O[id].ord||0);EV.push({k:'zcard',id,name:O[id].name,to:'deck'});}});
          parts.push('"'+esc(x.t)+'": '+(rest.length?rest.map((id:string)=>esc(O[id].name)).join(', ')+(toTrash?' a trashbe kerül (108.2).':': recycle, a Main Deck aljára (417).'):'nincs több megnézett lap.'));refs.push(toTrash?'108.2':'417');}
        else if(zTopUse){const ob=O[it.zTop];zcMove(ob.id,'hand');EV.push({k:'draw',pl:ob.own,n:1});parts.push('"'+esc(x.t)+'": '+esc(ob.name)+' a deckből a kézbe kerül (a deck felső lapja a pályás építőben megadva).');refs.push('414.1');}
        else if(zr0&&zpick&&zpick.length){/* kéz, deck vagy trash lapja (355.9.a, 355.10.a, 355.18): a választott lap végigkövetve */
          const zp=zr0;const okIds:string[]=[];const bad:string[]=[];const who=zp.who==='they'?other(it.pl):it.pl;
          zpick.forEach((id:string)=>{const ob=O[id];const w=zp.z==='among'?(!ob||!ob.card?'nincs megadva: a kiválasztott lap már nincs a helyzetben':!(it.zLook||[]).includes(id)?ob.name+' nincs a megnézett lapok között (a deck felső lapjai a pályás építőben megadva)':ob.zone!=='deck'?ob.name+' már nincs a deckben':(()=>{const z=zoneCheck(zp,ob,it.pl,zctx(it,s));return z?ob.name+' '+z:'';})()):zcWhy(zp,[id],it.pl,true,zctx(it,s));const g=it.zpGen&&it.zpGen[id];
            if(!w&&zp.target&&g!=null&&(ob.gen||0)!==g){bad.push(ob.name+' közben elhagyta a trasht és visszakerült, ezért új objektum, már nem az eredeti célpont (359.3.e.4)');return;}
            if(w)bad.push(w);else okIds.push(id);});
          const zhu=zp.z==='trash'?'trashből':zp.z==='hand'?'kézből':zp.z==='among'?'megnézett lapok közül':'deckből';
          if(!okIds.length){
            if(zp.target){x.st='ignored';x.ref='359.3.e.5, 359.3.e.6';x.why='a '+zhu+' választott célpont már nem legális: '+bad.join('; ');zpick.forEach((id:string)=>mtT.push({n:O[id]?O[id].name:id,ok:false,why:bad.join('; ')}));refs.push('359.3.e.5','359.3.e.6');}
            else{const typed=zp.z!=='trash'&&(zp.type.length>0||zp.tags.length>0);x.st='negated';x.ref='359.3.e.6, 355.18'+(typed?', 128.6.a':'');x.why='a '+zhu+' választás a resolve-kor történik (355.18), de a megadott lap nem választható: '+bad.join('; ')+'; az elemzés helyette nem választ másikat, ezért az utasítás nem hajtódik végre (levezetés: más okból elmaradó utasítás, Negated)'+(typed?'. Nyitott kérdés: a lap típust ír elő egy nem nyilvános zónában, ilyenkor a játékos az utasítást figyelmen kívül hagyhatja, és a 128.6.a ezt "Ignored"-nak nevezi; hogy ez a 359.3.e.6 szerinti Ignored-e, a Core Rules nem dönti el, judge dönt':'');fl=Math.max(fl,typed?2:1);refs.push('355.18','359.3.e.6');if(typed)refs.push('128.6.a');}
            parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');story.push(Art(srcName)+': a '+zhu+' választott lap már nem választható, a "'+x.t+'" utasítás elmarad.');}
          else{if(bad.length){x.st='partial';x.ref=zp.target?'359.3.e.8':'359.3.e.11';x.why='csak a még legális lapokra hat ('+bad.join('; ')+')';parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');}
            if(zp.target)parts.push('A '+zhu+' választott lap célpont, mert a trash nyilvános zóna; a lerakáskor kellett kiválasztani (355.10.a, 355.8, 108.2.d).');
            else if(zp.z==='hand')parts.push('A kéz nem nyilvános zóna, ezért a választás nem célpont, a resolve-kor történik; a lapot csak a tulajdonosa látja (355.10.a, 355.18, 128.4).');
            else if(zp.z==='among')parts.push('A megnézett lapokat csak a tulajdonosuk látja, felfedés után nyilvánosak; rejtett adat: a deck felső lapjai a pályás építőben megadott feltételezés (128.4, 128.5, 108.4.e). A választás a resolve-kor történik (355.18).');
            else parts.push('A deck sorrendje titkos információ: a felső lap a pályás építőben megadott feltételezés (108.4.e, 128.3).');
            refs.push(zp.target?'355.10.a':zp.z==='hand'?'355.18':'108.4.e');
            if(zp.cost){const cx=zctx(it,s);const vs=[zp.cost.e,zp.cost.p].filter((r:any)=>r&&typeof r[1]==='string').map((r:any)=>COSTVAR[r[1]]+': '+cx[r[1]]+(r[1]==='points'?' (a Játékállapot kezdő pontszáma plusz a lépésekben szerzett pontok; ha nincs megadva, 0)':r[1].startsWith('rel')?' (visszatekintés a költségként megölt unitra, 359.3.e.13)':''));
              parts.push('Költségfeltétel: "'+esc(zp.cost.t)+'", a nyomtatott költség számít (206)'+(vs.length?'; '+vs.join('; '):'')+'.');refs.push('206');}
            okIds.forEach((id:string,k:number)=>{const ob=O[id];const mv=(to:string)=>{if(ob.type==='zc')zcMove(id,to);else{ob.zone=to;ob.gen=(ob.gen||0)+1;EV.push({k:'zcard',id,name:ob.name,to});}};
              const recyc=zp.act==='recycle'||(INS[xi+1]&&/\brecycle (?:them|it)\b/i.test(INS[xi+1].t));
              if(recyc){mv('deck');ob.ord=999;if(INS[xi+1])INS[xi+1].zDone=true;parts.push(esc(ob.name)+': '+zhu+' recycle, a tulajdonosa Main Deckjének aljára kerül (417).');refs.push('417');story.push(Art(ob.name)+' a '+zhu+' a deck aljára kerül (recycle).');}
              else if(zp.act==='hand'){mv('hand');if(zp.z==='among'){it.zAmongDone=true;EV.push({k:'draw',pl:ob.own,n:1});refs.push('414.1');}parts.push(esc(ob.name)+': '+zhu+' a tulajdonosa kezébe kerül.');story.push(Art(ob.name)+' a '+zhu+' kézbe kerül.');}
              else if(zp.act==='banish'){mv('banish');parts.push(esc(ob.name)+' banishelve ('+zhu+').');refs.push('108.6');story.push(Art(ob.name)+' banishelve.');}
              else if(zp.act==='discard'){mv('trash');it.zDisc=id;EV.push({k:'discard',pl:ob.own,n:1});parts.push(WHOC[ob.own]+' eldobja: '+esc(ob.name)+' (423.1).');refs.push('423.1');story.push(WHOC[ob.own]+' eldobja '+art(ob.name)+' lapot.');}
              else if(zp.act==='playcard'){const pc=ob.card;mv('played');const isP=pc.t==='Unit'||pc.t==='Gear';const to=(s&&s.pll&&s.pll[xi])||(/\bhere\b/i.test(x.t)?srcLoc(it)||'base':'base');refs.push('420.3','420.3.b');
                if(isP){const pid='p'+(s?s.j:'x')+'_'+xi+'_'+k;O[pid]={id:pid,name:pc.n,card:pc,ctrl:it.pl,own:ob.own||it.pl,loc:to,baseOf:it.pl,m:pc.t==='Unit'&&pc.m!=null?+pc.m:null,dmg:0,mods:[],kws:[],zone:'board',type:pc.t==='Unit'?'unit':'gear',ex:false};const erP=enterReady(pc,it.pl,false,to,undefined,pid);if(pc.t==='Unit')O[pid].ex=!erP.ready;EV.push({k:'enter',id:pid,name:pc.n,loc:to,from:zp.z});
                  parts.push(esc(pc.n)+' kijátszva hatásból ('+zhu+', '+esc(locLabel(to))+'). A '+pc.t.toLowerCase()+' azonnal resolve-ol (337.2)'+(pc.t==='Unit'?(erP.ready?', ready lép be ('+erP.why+')':', exhausted lép be (143.4)'):'')+'.');story.push(Art(pc.n)+' a '+zhu+' a boardra kerül: '+locLabel(to)+'.');}
                else{pushTrig({kind:'auto',label:pc.n+' (hatásból kijátszott spell)',name:pc.n,src:null,pl:it.pl,eff:effOf(pc),why:'kijátszás hatásból',list:[],tg:[],from:zp.z});parts.push(esc(pc.n)+' spell a '+zhu+' a chainre kerül, és később resolve-ol (420.3.b); célpontjait az elemzés nem követi.');}}
              else{if(zp.z==='deck'&&zp.top&&k===0){it.zTop=id;it.zLook=okIds.slice();parts.push((/\breveals?\b/i.test(x.t)?'Felfedett lapok (nyilvánossá válnak, 128.5)':'Megnézett lapok (rejtett adat, csak a tulajdonos látja, 128.4)')+': '+okIds.map((z:string)=>esc(O[z].name)).join(', ')+'; a deck felső lapjai a pályás építőben megadva (108.4.e).');}parts.push('"'+esc(x.t)+'": '+esc(ob.name)+(zp.z==='deck'?' (a deck '+(ob.ord+1)+'. lapja)':'')+'.');}});
            x.st=x.st==='partial'?'partial':'executed';}}
        else if(a.k==='draw'||a.k==='channel'||a.k==='discard'){let n=a.n!=null?a.n:1;if(a.each&&a.each.cnt){const k=countEach(a.each.cnt,it,null);if(k!=null){parts.push('Szorzó: '+k+' ('+esc(a.each.txt)+').');n=n*k;}}const verbs:any={draw:['húz',' lapot','414.1'],channel:['channelöl',' rune-t','431.1'],discard:['eldob',' lapot','423.1']};const vb=verbs[a.k];
          let who:any=it.pl;let whoTxt=it.pl==='A'?'Te':'Az ellenfél';
          if(/\b(its|their) (controller|owner)s?\b/i.test(x.t)){if(prev&&live.length){const ob=O[it.tg[live[0]]];const own=/owner/i.test(x.t);who=own?ob.own:(ob.zone==='board'?ob.ctrl:(ob.lk&&ob.lk.ctrl)||ob.own);whoTxt='A célpont '+(own?'tulajdonosa':'irányítója')+' ('+WHO[who]+')';}
            else if(prev&&!live.length){x.st='ignored';x.ref='359.3.e.14.a';x.why='a hivatkozott célpont nem érvényes';who=null;}
            else{who=null;parts.push('A szöveg a célpont '+(/owner/i.test(x.t)?'tulajdonosára':'irányítójára')+' hivatkozik, de nem linked utasításként szerepel, így az elemzés nem tudja, ki '+vb[0]+' '+n+vb[1]+'.');}}
          else if(/^they\b/i.test(x.t)&&prev&&live.length){const ob=O[it.tg[live[0]]];who=ob.ctrl;whoTxt=WHOC[who];}
          else if(/^each player\b/i.test(x.t)){EV.push({k:a.k,pl:other(it.pl),n});parts.push(WHOC[other(it.pl)]+' '+vb[0]+' '+n+vb[1]+'.');whoTxt='Te'===WHOC[it.pl]?'Te':WHOC[it.pl];}
          if(who){EV.push({k:a.k,pl:who,n});parts.push(whoTxt+' '+vb[0]+' '+n+vb[1]+(/for each/i.test(x.t)?' (a "for each" szorzót az elemzés nem számolja)':'')+'.');refs.push(vb[2]);story.push(whoTxt+' '+vb[0]+' '+n+vb[1]+'.');}}
        else if(a.k==='counterToHand'||a.k==='bonusTrashName'){parts.push('"'+esc(x.t)+'": '+esc(x.prep||a.d)+' ('+a.refs+').');a.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));}
        else if(a.k==='note'||a.k==='copy'){parts.push((a.open?'<span class="cbuns">nyitott kérdés</span> ':'')+'"'+esc(x.t)+'": '+esc(a.d||'')+(a.field?' ('+esc(a.field.label)+': '+esc(String(a.fv))+')':'')+(a.refs?' ('+a.refs+')':'')+'.');if(a.refs)a.refs.split(/,\s*/).forEach((r:string)=>refs.push(r));fl=Math.max(fl,a.open?2:1);}
        else if(a.k==='dmgAllAt'){const l=it.dest&&it.dest!=='base'?it.dest:'bf0';const n=+(a.fv||0);const vs=Object.keys(O).filter(id=>O[id].zone==='board'&&O[id].type==='unit'&&O[id].ctrl!==it.pl&&O[id].loc===l);
          parts.push('"'+esc(x.t)+'": '+n+' damage minden enemy unitra itt: '+esc(locLabel(l))+' (a kifizetett mennyiség és a battlefield a lapnál állítható).');if(n>0)vs.forEach(v=>dealDmg(v,n,parts,refs));}
        else if(a.k==='channelNum'){const n=+(a.fv||0);if(n>0)EV.push({k:'channel',pl:it.pl,n});parts.push(WHOC[it.pl]+' channelöl '+n+' rune-t exhausted (a lapnál megadott érték, 431).');refs.push('431');}
        else if(a.k==='tokenPerChoice'){const n=a.fv==='1'?1:0;parts.push('"'+esc(x.t)+'": '+(n?'egy':'nincs')+' Gold token (az ellenfél választása a lapnál állítható).');if(n)createTokens('play a Gold gear token exhausted.',it,parts,refs,1);}
        else if(a.k==='buffBonus'){BUFF2[it.pl]=true;parts.push('"'+esc(x.t)+'": ebben a körben '+WHO[it.pl]+' unitjainak buffja +2 Mightot ad (703).');refs.push('703');}
        else if(a.k==='preventAllSA'){PREVSA.on=true;parts.push('"'+esc(x.t)+'": '+esc(a.d)+' ('+a.refs+'; levezetés).');refs.push('438.1.b');fl=Math.max(fl,1);}
        else if(a.k==='choosePerPlayer'){const mp0=(s&&s.mp&&s.mp[xi])||{};const ws=a.who==='all'?['A','B']:[other(it.pl)];const mp:any={};const used=new Set<string>();
          ws.forEach((p:string)=>{const v=mp0[p];if(!v)return;if(a.opts){if(a.opts.includes(v))mp[p]=v;return;}const o=O[v];
            const ok=o&&o.zone==='board'&&(a.scope==='notCaster'?o.type==='unit'&&o.ctrl!==it.pl:a.scope==='ownGearKill'?o.type==='gear'&&o.ctrl===p:o.type==='unit'&&o.ctrl===p);
            if(!ok){parts.push(WHOC[p]+' választása ('+esc(o?o.name:v)+') nem felel meg a lap megkötésének, ezért nem számít.');return;}
            if(a.distinct&&used.has(v)){parts.push(WHOC[p]+' választása ('+esc(o.name)+') már erre a spellre választott unit ("that hasn\'t been chosen for this spell"), ezért nem számít.');return;}
            used.add(v);mp[p]=v;});
          if(a.distinct)parts.push('Megkötés: csak olyan unit, amelyet erre a spellre még senki nem választott; két játékosnál egy választás van, ezért ez nem szűkít.');
          it.mp=mp;
          parts.push('"'+esc(x.t)+'": '+ws.map((p:string)=>WHOC[p]+' választása: '+(mp[p]?(O[mp[p]]?O[mp[p]].name:mp[p]):'nincs megadva')).join('; ')+' (a lapnál állítható, 412.1).');refs.push('412.1');
          if(a.scope==='ownKill'||a.scope==='ownGearKill')ws.forEach((p:string)=>{const v=mp[p];if(v&&O[v]&&O[v].zone==='board'&&O[v].ctrl===p)killObj(v,'saját választás',parts,refs,srcName);});}
        else if(a.k==='killRest'||a.k==='killChosen'){const mp=it.mp||{};const chosen=new Set(Object.values(mp));const vs=Object.keys(O).filter(id=>O[id].zone==='board'&&O[id].type==='unit'&&(a.k==='killRest'?!chosen.has(id):chosen.has(id)));vs.forEach(v=>killObj(v,'',parts,refs,srcName));if(!vs.length)parts.push('"'+esc(x.t)+'": nincs érintett unit.');}
        else if(a.k==='pfEach'){const mp=it.mp||{};const who=Object.entries(mp).filter(([,v])=>v===a.pick).map(([p])=>p);const ps=who.length?[it.pl,...who]:[];ps.forEach((p:string)=>EV.push({k:a.act,pl:p,n:1}));parts.push('"'+esc(x.t)+'": '+(ps.length?ps.map((p:string)=>WHOC[p]).join(' és ')+' '+(a.act==='draw'?'húz 1-et':'channelöl 1 rune-t'):'senki nem választotta ('+a.pick+')')+'.');}
        else if(a.k==='nextReady'){READYNEXT[it.pl]=true;parts.push('"'+esc(x.t)+'": a következő unit, amit '+WHO[it.pl]+' ebben a körben kijátszik, ready lép be (143.4.a).');refs.push('143.4.a');}
        else if(a.k==='enterReady'){READY[it.pl]=true;parts.push('"'+esc(x.t)+'": a kör hátralevő részében '+WHO[it.pl]+' által kijátszott unitok ready lépnek be (143.4.a).');refs.push('143.4.a');}
        else if(a.k==='spendBuffReady'){const us=Object.keys(O).filter(id=>O[id].zone==='board'&&O[id].type==='unit'&&O[id].ctrl===it.pl&&O[id].bu);us.forEach(id=>{O[id].bu=false;O[id].ex=false;EV.push({k:'ready',id,name:O[id].name,spent:true});});
          parts.push('"'+esc(x.t)+'": '+(us.length?us.map(id=>esc(O[id].name)).join(', ')+': a buff elköltve, ready lesz (416); "you may": a játékos unitonként dönt, az elemzés minden buffolt unitnál igennel számol':'nincs buffolt friendly unit')+'.');refs.push('416');}
        else if(a.k==='playcard'){const pc=a.self?(it.src&&O[it.src]&&O[it.src].card)||(s&&s.c):vsCard(s&&s.plc?s.plc[xi]:'');
          const pcW=pc&&!a.self?costCheck(costCondOf(x.t),pc,zctx(it,s)):'';
          if(pcW){x.st='negated';x.ref='206, 359.3.e.6';x.why='a megadott lap ('+pc.n+') nem felel meg a költségfeltételnek: '+pcW;parts.push('"'+esc(x.t)+'": '+esc(x.why)+'.');refs.push('206');}
          else if(!pc){x.why='a kijátszott lapot a builderben kell megadni';parts.push('"'+esc(x.t)+'": kijátszás hatásból (420.3). Melyik lap? Add meg a builderben (Így értelmezem blokk), és az elemzés követi.');fl=Math.max(fl,1);}
          else{if(a.self&&it.src&&O[it.src]&&O[it.src].zone==='trash'){const so0=O[it.src];if(so0.type==='zc')zcMove(it.src,'played');else{so0.zone='gone';so0.gen=(so0.gen||0)+1;}parts.push(esc(pc.n)+' a trashből kerül kijátszásra.');}
            const pid='p'+(s?s.j:'x')+'_'+xi;const isP=pc.t==='Unit'||pc.t==='Gear';const to=(s&&s.pll&&s.pll[xi])||(/\bhere\b/i.test(x.t)?srcLoc(it)||'base':'base');
            refs.push('420.3','420.3.b');
            if(isP){O[pid]={id:pid,name:pc.n,card:pc,ctrl:it.pl,own:it.pl,loc:to,baseOf:it.pl,m:pc.t==='Unit'&&pc.m!=null?+pc.m:null,dmg:0,mods:[],kws:[],zone:'board',type:pc.t==='Unit'?'unit':'gear',ex:false};const erP=enterReady(pc,it.pl,false,to,undefined,pid);if(pc.t==='Unit')O[pid].ex=!erP.ready;EV.push({k:'enter',id:pid,name:pc.n,loc:to,from:a.from});
              parts.push(esc(pc.n)+' kijátszva hatásból ('+({trash:'trashből',hand:'kézből',banish:'banishmentből',other:'nem kézből'} as any)[a.from]+', '+esc(locLabel(to))+(a.free?', költség nélkül':'')+'). A '+pc.t.toLowerCase()+' azonnal resolve-ol (337.2)'+(pc.t==='Unit'?(erP.ready?', ready lép be ('+erP.why+')':', exhausted lép be (143.4)'):'')+'.'+(erP.note?' '+erP.note:''));story.push(Art(pc.n)+' hatásból a boardra kerül: '+locLabel(to)+'.');
              playTrigs({c:pc,j:-1,pl:it.pl,from:a.from==='hand'?'hand':'other',objId:pid}).forEach((t:any)=>{pushTrig(t);parts.push('Triggerel: '+esc(t.label)+' (420.4.a).');});
              const own=triggersOf(pc).find((t:any)=>/^when you play (?:me|this)\b/i.test(t.why));if(own){pushTrig({kind:'auto',label:pc.n+' play triggere',name:pc.n+' play triggere',src:pid,pl:it.pl,eff:own.eff,why:own.why,list:[],tg:[]});parts.push(esc(pc.n)+' play effectje is triggerel; a célpontját az elemzés nem követi.');}}
            else{pushTrig({kind:'auto',label:pc.n+' (hatásból kijátszott spell)',name:pc.n,src:null,pl:it.pl,eff:effOf(pc),why:'kijátszás hatásból',list:[],tg:[],from:a.from});parts.push(esc(pc.n)+' spell a chainre kerül, és később resolve-ol (420.3.b); célpontjait az elemzés nem követi.');}}}
        else if(a.k==='none'){if(x.manual)parts.push('"'+esc(x.t)+'": a kézi értelmezés szerint nem csinál semmit.');}
        else if(a.k==='delayed'){out.delayed.push({t:x.t,who:it.pl,src:srcName,srcId:it.src||it.objId||null,on:live.map((ti:number)=>O[it.tg[ti]].name),ids:live.map((ti:number)=>it.tg[ti]),n:EV.slice(it.ev0||0).filter((e:any)=>e.k==='zone'&&e.to==='trash'&&O[e.id]&&O[e.id].type!=='spell').length});EV.push({k:'delayed',t:x.t});parts.push('Delayed ability jön létre: "'+esc(x.t)+'". A megadott időpontban triggerel, és akkor kerül a chainre (391.2, 392); ez a mostani chainen kívül esik, ezért az elemzés itt nem futtatja le.');refs.push('391.2','392');story.push('Delayed hatás jön létre: "'+x.t+'" (később fut le).');}
        else if(a.k==='loseCtrl'){const ids=(prev?prev.tis.map((ti:number)=>it.tg[ti]):[]).filter((v:string)=>v&&O[v]&&O[v].zone==='board');
          if(!ids.length)parts.push('"'+esc(x.t)+'": nincs a boardon olyan unit, amelynek a kontrollja visszaállna.');
          ids.forEach((v:string)=>{const ob=O[v];const to=(ob.until&&ob.until.prev)||ob.own;if(ob.ctrl===it.pl&&to!==it.pl){setCtrl(v,to,'391.2','levezetés: a kontroll elvesztésével az előző irányítóhoz kerül vissza');parts.push(esc(ob.name)+' irányítása visszakerül: '+WHO[to]+' (levezetés).');}else parts.push(esc(ob.name)+': '+WHO[it.pl]+' már nem irányítja, nincs mit elveszíteni.');});x.tis=prev?prev.tis.slice():[];}
        else if(a.k==='fight'){const pt=prev?prev.tis.map((ti:number)=>it.tg[ti]).filter(Boolean):[];const lv=pt.filter((v:string)=>onB(v)&&live.some((ti:number)=>it.tg[ti]===v));
          if(lv.length===2&&pt.length===2){const [p1,p2]=lv;const m1=mightOf(p1),m2=mightOf(p2);
            [[p1,m2,p2],[p2,m1,p1]].forEach(([v,n,by]:any)=>{if(n==null)return;dealDmg(v,n,parts,refs,'forrás: '+O[by].name+', 418.6.b.3');});refs.push('418.6.b.3');story.push(Art(O[p1].name)+' és '+art(O[p2].name)+' sebzi egymást ('+m1+' és '+m2+' Might).');}
          else{x.st='ignored';x.ref='359.3.e.14.a, 359.3.e.12';x.why='a két kiválasztott unit közül legalább egy nem érvényes célpont, a Mightja nem elérhető';}}
        else if(lk&&live.length&&!['other','playcard','token','deck','xp','score','choose','runes','add'].includes(a.k)&&!((a.k==='empower'||a.k==='disempower')&&selfRef(x.t))){const gl=live.filter((ti:number)=>O[it.tg[ti]].type==='gear');const tl=(a.k==='detach'||a.k==='attach')&&gl.length?gl:live;
          if(a.k==='attach'&&gl.length&&live.length>gl.length&&!a.toSelf){const u=live.find((ti:number)=>O[it.tg[ti]].type==='unit');const G=O[it.tg[gl[0]]],U=O[it.tg[u]];if(G.on===U.id){parts.push(esc(G.name)+' már ezen a uniton van, a csatolásnak nincs hatása (435.1.g, 435.1.i); az elemzés ezt Negated-nek veszi (levezetés).');x.st='negated';x.ref='359.3.e.6';it.flL=true;}else{G.on=U.id;G.loc=U.loc;EV.push({k:'attach',id:G.id,name:G.name,to:U.id});parts.push('Felcsatolva: '+esc(G.name)+' → '+esc(U.name)+' (435).');refs.push('435');}}
          else tl.forEach((ti:number)=>{const r=applyTo(it.tg[ti],Object.assign({t:x.t},a),it,parts,refs);if(r==='neg'){x.st='negated';x.ref='359.3.e.6';}else if(r==='ign'){x.st='ignored';x.ref=a.k==='ctrlUntil'?'359.3.e.16':'359.3.e.6';x.why=a.k==='ctrlUntil'?'a delayed kontroll időtartama már véget ért, mielőtt létrejött volna':'a végrehajtáshoz szükséges információ nem elérhető';}});}
        else if(lk&&prev&&!live.length&&a.k!=='other'){x.st='ignored';x.ref='359.3.e.14.a';x.why='a hivatkozott célpont nem érvényes, ezért nincs mire hatnia';}
        else if(!lk&&sc&&['dmg','kill','stun','hand','banish','recall','ready','exhaust','might','buff'].includes(a.k)&&!x.tis.length){const hereLoc=sc.there?(it.tg.find((v:string)=>v==='F0'||v==='F1')==='F1'?'bf1':'bf0'):srcLoc(it);let hit=0;
          Object.keys(O).forEach(v=>{const ob=O[v];if(ob.zone!=='board'||ob.type!==sc.type)return;if(sc.rel==='enemy'&&ob.ctrl===it.pl)return;if(sc.rel==='friendly'&&ob.ctrl!==it.pl)return;if((sc.here||sc.there)&&ob.loc!==hereLoc)return;if(sc.atbf&&ob.loc==='base')return;if(sc.inbase&&ob.loc!=='base')return;if(sc.other&&v===it.src)return;hit++;applyTo(v,Object.assign({t:x.t},a),it,parts,refs);});
          if(!hit)parts.push('"'+esc(x.t)+'": nincs olyan lap a boardon, amire hatna.');}
        else if((selfRef(x.t)||a.fromPlayed)&&['ready','exhaust','might','kw','empower','disempower','kill','banish','recall','buff','stun','heal','dmg','setbase'].includes(a.k)&&!(a.k==='might'&&!a.self&&!/\bme\b/i.test(x.t))){
          if(it.src&&(onB(it.src)||(O[it.src]&&O[it.src].zone==='legend'))){if(a.k==='disempower'){O[it.src].emp=false;parts.push(esc(O[it.src].name)+' disempowered lesz.');}else if(a.k==='empower'){O[it.src].emp=true;EV.push({k:'empower',id:it.src,name:O[it.src].name});parts.push(esc(O[it.src].name)+' Empowered lesz (442).');refs.push('442');story.push(Art(O[it.src].name)+' Empowered lesz.');}else{if(a.fromPlayed)parts.push('A kijátszott lap ('+esc((it.trigBy&&it.trigBy.n)||'?')+') Energy költsége: '+((it.trigBy&&it.trigBy.e)||0)+'.');const r=applyTo(it.src,Object.assign({t:x.t},a,a.fromPlayed?{n:+((it.trigBy&&it.trigBy.e)||0)}:{}),it,parts,refs);if(r==='neg'){x.st='negated';x.ref='359.3.e.6';}}}
          else{x.st='ignored';x.ref='359.3.e.6, 359.3.f.2';x.why='a forrásra ("me", "this") hivatkozik, de a forrás már nincs a boardon, az információ nem elérhető';}}
        else if(a.k==='attach'&&a.toSelf&&prev){x.st='ignored';x.ref='359.3.e.14.a';x.why='a csatolandó lap nem érvényes';}
        else if(a.k==='ctrlUntil'&&a.until==='src'&&!(it.src&&onB(it.src))){x.st='ignored';x.ref='359.3.e.16';x.why='a delayed kontroll időtartama ("until I leave the board") már véget ért, mielőtt létrejött volna, ezért nem jön létre';parts.push('"'+esc(x.t)+'": '+esc(srcName.replace(/ triggere$/,''))+' már nincs a boardon, ezért a kontroll nem változik, egy pillanatra sem (359.3.e.16).');refs.push('359.3.e.16');}
        else if(['dmg','kill','stun','hand','banish','recall','base','move','might','buff','ready','exhaust','counter'].includes(a.k)&&!lk&&!x.tis.length&&it.kind!=='auto'){parts.push('"'+esc(x.t)+'": nincs kiválasztott célpont vagy hatókör, ezért nincs mire hatnia.');}
        else if(a.k==='other'||a.k==='playcard'||a.k==='replay'||a.unsure){parts.push('"'+esc(x.t)+'": lefut, ezt az elemzés nem követi részletesen.');fl=Math.max(fl,1);}
        else if(['token','deck','xp','score','runes','choose','add','pay','costmod','restrict','showoff','win','extraturn','perm'].includes(a.k)){
          if(a.k==='token'){createTokens(a.tokenText||x.t,it,parts,refs,1);}else{const L:any={win:'a játék megnyerése, ha a feltétel teljesül',extraturn:'extra kör (735), a chainet nem érinti',perm:'engedély vagy tiltás a kör hátralevő részére, a chain lefutását nem érinti',deck:'pakli művelet (felfedés, recycle, Predict)',xp:'XP változás',score:'pontszerzés',runes:'rune-ok readyre állítása',choose:'választás',add:'erőforrás hozzáadása',pay:'költség fizetése az utasításon belül (204.3.a)',costmod:'költségmódosítás, a chain lefutását nem érinti',restrict:'korlátozás, a chain lefutását nem érinti',showoff:'Show Off (832)'};parts.push('"'+esc(x.t)+'": '+L[a.k]+'.');EV.push({k:a.k,pl:it.pl,t:x.t});}}
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
    if(tot&&!legal&&mtT.some((q:any)=>q.skip)){parts.push('A célponttól függő utasítások Ignored-ok (359.3.e.14.a'+(INS.some((x:any)=>/359\.3\.e\.12/.test(x.ref||''))?', 359.3.e.12':'')+'), a hatás ezekre elmarad.');refs.push('359.3.e.14.a');}
    else if(tot&&!legal){const rest=INS.some((x:any)=>x.st==='executed'&&!x.tis.length);if(rest){parts.push('Teljes mistarget: minden célpontja illegális lett, a célponthoz nem kötött utasítás viszont végrehajtódik.');refs.push('359.3.e.7');}else{parts.push('Teljes mistarget: minden célpontja illegális lett, ezért hatás nélkül resolve-ol'+(perm||it.kind!=='step'||s.k!=='card'?'':', de kijátszottnak számít (359.3.e.10)')+'.');refs.push('359.3.e.7');story.push(Art(srcName)+' így hatás nélkül fejeződik be.');}}
    else if(tot&&legal<tot&&tot>1)refs.push('359.3.e.8');
    if(self&&self.type==='spell')self.zone='trash';if(self&&self.type==='ability'&&self.zone==='chain')self.zone='none';
    if(it.kind==='step'&&s&&s.k==='card'&&s.c.t==='Spell'){const pt=playTrigs(s);pt.forEach((tr:any)=>pushTrig(tr));if(pt.length){parts.push('A kijátszás most fejeződött be a resolve-val, ezért triggerel: '+pt.map((tr:any)=>esc(tr.label)).join(', ')+' (420.4.a; akkor is, ha egyik utasítás sem hajtódott végre, 359.3.e.10).');refs.push('420.4.a');}}
    const res=(tot&&!legal)?'fizzle':(tot&&legal<tot)?'partial':'ok';
    done.push({name:it.label,pl:it.pl,res});out.items.push({name:it.label,res,instr:INS.map((x:any)=>({t:x.t,k:x.act.k,st:x.st,ref:x.ref,lk:x.lk})),targets:mtT});
    if(it.flL)fl=Math.max(fl,1);rr+=line(refs.join(','),t+parts.join(' '),fl);MAN=false;};
  let ENDED=false;
  const endStep=()=>{ENDED=true;
    story.push('A chain kiürült, jön az Ending Phase.');rr+=line('317, 317.1',esc('A chain kiürült. A kör az Ending Phase-be lép, Ending Step: a kör végi hatások triggerelnek (317.1.a).'),0);
    const ET:any[]=[];
    out.delayed.forEach((d:any)=>{if(!/\bat (?:the )?end of (?:this )?turn\b/i.test(d.t))return;d.done=true;
      let eff=d.t.replace(/,?\s*\bat (?:the )?end of (?:this )?turn\b,?\s*/i,' ').replace(/\s+\./g,'.').trim();if(/\bthat many\b/i.test(eff))eff=eff.replace(/\bthat many\b/i,String(d.n||0));
      eff=eff.charAt(0).toUpperCase()+eff.slice(1);if(!/\.$/.test(eff))eff+='.';
      ET.push({kind:'auto',label:d.src+' delayed hatása (kör vége)',name:d.src+' delayed hatása',src:d.srcId&&O[d.srcId]?d.srcId:null,pl:d.who,eff,why:'"'+d.t+'"',list:[],tg:[],pre:(d.ids||[]).filter((v:string)=>O[v]),dl:true});
      rr+=line('317.1.a, 391.2',esc(d.src+' delayed hatása triggerel: "'+d.t+'"'+(d.ids&&d.ids.length?' ('+d.ids.map((v:string)=>O[v]?O[v].name:v).join(', ')+')':'')+'.'),0);story.push(d.src+' delayed hatása triggerel: '+eff);});
    const endCond=(c:string,ob:any)=>{if(/^I'm at a battlefield$/i.test(c))return ob.zone==='board'&&ob.loc!=='base';
      if(/^you control this battlefield$/i.test(c))return ob.zone==='board'&&!!BF[ob.loc]&&BF[ob.loc].ctrl===ob.ctrl;
      const cd:any=condOf('if '+c+', x.');return cd?evalCond(cd,{pl:ob.ctrl,src:ob.id},null,0,null)===true:false;};
    Object.keys(O).forEach(id=>{const ob=O[id];if(!ob.card||!(ob.zone==='board'||ob.zone==='legend'))return;(ob.card.txt||'').split('\n').map(stripRem).forEach((l:string)=>{
      const m=/^At the end of (your|each) turn,\s*(.*)$/i.exec(l);if(!m)return;if(m[1].toLowerCase()==='your'&&ob.ctrl!==TP)return;
      let eff=m[2];const ic=/^if ([^,]+),\s*(.*)$/i.exec(eff);
      if(ic){const ok=endCond(ic[1],ob);eff=ic[2];rr+=line('383.2.a.1',esc(ob.name+': a trigger feltétele ("if '+ic[1]+'") a kör végén '+(ok?'teljesül, ezért a trigger a chainre kerül; ha utána a forrás eltűnik, a trigger ettől még lefut':'nem teljesül, ezért nem triggerel')+'.'),0);
        story.push(Art(ob.name)+(ok?' kör végi triggere a chainre kerül.':' kör végi triggere nem triggerel, mert a feltétele ("if '+ic[1]+'") nem teljesül.'));if(!ok)return;}
      else story.push(Art(ob.name)+' kör végi triggere a chainre kerül.');
      ET.push({kind:'auto',label:ob.name+' triggere (kör vége)',name:ob.name+' triggere',src:id,pl:ob.ctrl,eff,why:'"'+l+'"',list:[],tg:[],endTrig:!!ic});});});
    ET.forEach((t:any)=>pushTrig(t));flushPend(stack);
    if(stack.length)snap('Ending Step: kör végi triggerek a chainen',stack);
    else rr+=line('317.1.a',esc('Nincs kör végi hatás.'),0);};
  const expiration=()=>{
    /* Expiration Step (317.2): Ending Special Cleanup a 323 lépéseivel: 3a lethal damage-es unitok meghalnak, 3c heal (317.2.b),
       3d a "this turn" hatások lejárnak (317.2.c) és a stun megszűnik (424.1.a.2), 3e a Rune Pool kiürül (317.2.d);
       ha közben chain elem keletkezett és lefutott (FEPR), vissza az Expiration Step elejére (317.2.f). */
    for(let round=0;round<4;round++){
      rr+=line('317.2, 317.2.a',esc('Expiration Step'+(round?' (újra, 317.2.f)':'')+': Ending Special Cleanup (318).'),0);
      const kp:string[]=[];const kr:string[]=[];const dead=Object.keys(O).filter(id=>lethal(id));dead.forEach(id=>{killObj(id,'lethal damage, Ending Special Cleanup',kp,kr);});
      if(dead.length)rr+=line('323.4, 142.4.b',esc('3a: '+plainOf(kp.join(' '))),0);
      const heal:string[]=[];const exp:string[]=[];const stun:string[]=[];
      Object.keys(O).forEach(id=>{const ob=O[id];if(ob.zone!=='board')return;
        if(ob.type==='unit'&&ob.dmg){heal.push(ob.name+' ('+ob.dmg+')');ob.dmg=0;}});
      Object.keys(O).forEach(id=>{const ob=O[id];if(ob.zone!=='board')return;
        const e:string[]=[];if(ob.mods&&ob.mods.length){e.push('Might módosítók');ob.mods=[];}if(ob.kws&&ob.kws.length){e.push('kapott keywordök ('+ob.kws.join(', ')+')');ob.kws=[];}
        if(ob.baseSet!=null){e.push('alap Might beállítás');ob.baseSet=null;}if(ob.untgt){e.push('célozhatatlanság');ob.untgt=null;}if(ob.save){e.push('mentés');ob.save=null;}
        if(ob.dieTo){e.push('halál helyettesítés');ob.dieTo=null;}if(ob.dbl){e.push('damage duplázás');ob.dbl=null;}if(ob.prev){e.push('Prevent');ob.prev=null;}if(ob.shields){e.push('Shield módosítás');ob.shields=null;}
        if(e.length)exp.push(ob.name+': '+e.join(', '));
        if(ob.type==='unit'&&ob.st){ob.st=false;stun.push(ob.name);}});
      ['A','B'].forEach(p=>{READY[p]=false;BUFF2[p]=false;if(READYNEXT[p])exp.push(WHOC[p]+': "the next unit you play this turn enters ready"');READYNEXT[p]=false;});PREVSA.on=false;
      rr+=line('317.2.b',esc('3c: minden unit gyógyul'+(heal.length?': '+heal.join(', '):' (egyiken sincs damage)')+'.'),0);
      rr+=line('317.2.c, 424.1.a.2',esc('3d: minden "this turn" hatás egyszerre lejár'+(exp.length?': '+exp.join('; '):' (nincs ilyen)')+'; a stun megszűnik'+(stun.length?': '+stun.join(', '):' (nincs stunned unit)')+'.'),0);
      rr+=line('317.2.d',esc('3e: a Rune Pool kiürül, az el nem költött Energy és Power elvész.'),0);
      if(!round)story.push('Expiration Step: '+(dead.length?'a lethal damage-es unitok meghalnak, ':'')+'minden unit gyógyul, a "this turn" hatások lejárnak, a stun megszűnik.');
      cleanup();snap('Ending Phase: Expiration Step'+(round?' (újra)':''),stack);
      if(!stack.length)break;
      rr+=line('317.2.f',esc('Az Expiration Step közben chain elem keletkezett ('+stack.map((t:any)=>t.label).join(', ')+'); lefut, utána az Expiration Step elölről kezdődik.'),0);
      resolveAll();}
    out.delayed=out.delayed.filter((d:any)=>!d.done);};
  playMain();stack=chain.slice();
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
  /* ---- Kör vége (317), ha a builderben kérik: Ending Step ("at end of turn" delayed és "At the end of your turn" triggerek, 317.1.a, 391.2,
     383.2.a.1), majd Expiration Step (317.2): Ending Special Cleanup, heal, a "this turn" hatások lejárnak, a Rune Pool kiürül. */
  if(CS.end&&!ENDED){endStep();resolveAll();}
  if(ENDED)expiration();
  story.push('A chain kiürült.');
  REC.push(['','A chain kiürült.']);if(out.delayed.length)REC.push(['391.2',out.delayed.length+' delayed hatás vár későbbi időpontra: '+out.delayed.map((d:any)=>'"'+d.t+'"'+(d.on.length?' ('+d.on.join(', ')+')':'')).join('; ')]);snap('Végállapot: a chain üres',[]);REC=null;
  // ---- 3. kimenet ----
  const stat:any={ok:['stok','lefutott'],partial:['stok','részben futott le'],fizzle:['stbad','hatás nélkül'],countered:['stbad','counterelve'],removed:['stbad','lekerült']};
  let h='<h2>Chain elemzés</h2><p class="note">Lépésenkénti levezetés a lapok szövegéből és a Core Rules szabályaiból. A "levezetés" címkéjű sorok az oldal következtetései, a judge felülbírálhatja őket.</p>';
  h+='<h3 class="cbsec">A chain lefutása</h3><p class="note" style="margin:0 0 6px">Ebben a sorrendben futottak le a tételek: mindig a legutóbb felrakott először, a közben keletkező triggerek pedig rögtön a tetejére kerülnek.</p><ol class="stack">'+done.map((d:any,i:number)=>{const r=stat[d.res]||['','?'];return '<li><span class="sn">'+(i+1)+'.</span><span class="sc">'+esc(d.name)+'</span><span class="note">'+(d.pl==='A'?'te':'ellenfél')+'</span><span class="'+r[0]+'">'+r[1]+'</span></li>';}).join('')+'</ol>';
  const off=S.filter((s:any)=>s.illegal||(s.k==='card'&&isPermC(s.c)&&!s.trig)||(s.k==='ab'&&s.ab&&s.ab.add));
  if(off.length)h+='<p class="note" style="margin:4px 0 0">Nem került a chainre: '+off.map((s:any)=>esc(s.c.n)+(s.illegal?(s.k==='tg'?' (trigger, lekerült)':' (nem szabályos)'):s.k==='ab'?' (erőforrást ad, azonnal lefut)':' (azonnal a boardra került, nincs play triggere)')).join(', ')+'.</p>';
  h+='<h3 class="cbsec">Sorban ez történik</h3><ol class="flow">'+story.map(x=>'<li><span>'+glossify(esc(x))+'</span></li>').join('')+'</ol>';
  const res:string[]=[];Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type==='legend'||ob.type==='trigsrc'||ob.type==='ability')return;
    if(ob.type==='spell'){if(ob.zone==='none'||ob.zone==='pending')return;res.push(esc(ob.name)+': '+(ob.zone==='countered'?'counterelve, a trashben':ob.zone==='hand'?'counterelve, a lap szövege szerint a tulajdonosa kezében (426.1)':'lefutott, a trashben'));return;}
    if(ob.zone==='none'||ob.zone==='pending')return;
    const mt=mightOf(id);const z=({board:esc(locLabel(ob.loc))+(ob.loc==='base'&&ob.baseOf&&ob.baseOf!==ob.ctrl?' ('+(ob.baseOf==='A'?'a te':'az ellenfél')+' base-ében)':'')+(ob.type==='unit'&&mt!=null?', '+mt+' Might':'')+(ob.dmg?', '+ob.dmg+' damage':'')+(ob.st?', stunned':'')+(ob.ex?', exhausted':'')+(ob.on&&O[ob.on]?', rajta: '+esc(O[ob.on].name):''),hand:'a tulajdonosa kezében',trash:'a tulajdonosa trashében',banish:'banishelve'} as any)[ob.zone]||ob.zone;
    res.push((ob.ctrl==='A'?'Te: ':ob.ctrl==='B'?'Ellenfél: ':'')+esc(ob.name)+(ob.zone==='board'&&ob.own&&ob.ctrl!==ob.own?' (átvett kontroll, tulajdonos: '+WHO[ob.own]+')':'')+': '+z);});
  h+='<h3 class="cbsec">Végállapot</h3><ul class="res">'+res.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  if(out.delayed.length)h+='<h3 class="cbsec">Függő delayed hatások</h3><table class="nt">'+out.delayed.map((d:any)=>lineH('391.2, 392, 359.3.e.16',esc(d.src)+': "'+esc(d.t)+'"'+(d.on.length?' ('+esc(d.on.join(', '))+')':'')+'. A megadott időpontban triggerel és akkor kerül a chainre; a mostani chain lefutásán kívül esik. Ha az időtartam már véget ért, amikor létrejönne (például az Ending Phase-ben kijátszva), nem jön létre (359.3.e.16).',0)).join('')+'</table>';
  if(notes.length)h+='<h3 class="cbsec">Battlefieldek állandó hatása</h3><table class="nt">'+notes.join('')+'</table>';
  const cards:any[]=[];S.forEach((s:any)=>{if(s.c&&s.c.n&&!cards.includes(s.c))cards.push(s.c);});CS.bd.forEach((b:any)=>{const c=vsCard(b.n);if(c&&!cards.includes(c))cards.push(c);});
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
