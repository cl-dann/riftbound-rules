/* Utasítás műveletének felismerése, besorolás, időzítés, a felülírható műveletek és az értelmezés (interp). (a chainCore.ts 1-405. sorából, S19) */
import { cardOv } from './overrides';
import { condOf, eachOf } from './conditions';
import { DELAY_RE, DIRECT_RE, LINK_RE, phrasesTxt, splitInstr } from './parser';
import { COST_LINE } from './text';
import type { Act, CardLike, CardOv, Instr, StepInfo } from './types';
/** Az utasítás értelmezésének kézi felülírása a lépésen (Haladó szerkesztés): művelet, darabszám, linked. */
export type InstrOv = { k?: string; n?: number | null; lk?: boolean | null };
export function actOf(t:string):Act{const e=String(t||'').replace(/^[-\u2014\u2013]\s*/,'');let m;const r=(o:Act):Act=>{
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
  if(/^the next unit you play this turn has \[Accelerate\]/i.test(e))return {k:'nextAccel'};
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
  if(/^(?:if it's an? (?:unit|gear|spell),\s*)?(?:you may )?put (?:a card|the top \d+ cards?|the rest|those you don't|it) [^.]*\b(?:main deck|trash|hand)\b|^put those you don't\b|^(?:you may )?return your chosen champion\b|\breveal from among\b|\breveal cards from the top\b/i.test(e))return r({k:'deck'});
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

/** Művelet a lap kézi leírásával (cardRules.ts), ha van, különben az általános felismerés. */
export function actOfCard(t:string,cardName?:string|null):Act{const ov=cardOv(cardName,t);if(ov)return Object.assign({},ov,{k:ov.k,ov,re:undefined});return actOf(t);}
/** Utasítás besorolása a lefedettséghez: 'other' (nem felismert), 'unsure' (bizonytalan), 'user' (felismert, de a builderben kell megadni egy adatot), 'known'. */
export function classOf(t:string,cardName?:string|null){const ov=cardOv(cardName,t);if(ov)return ov.hidden?'hidden':ov.open?'open':'known';
  const a=actOf(t);if(a.k==='other')return 'other';if(a.unsure)return 'unsure';
  if(a.cond&&a.cond.how==='hidden')return 'hidden';
  if(a.cond&&a.cond.how==='open')return 'open';
  if(a.k==='playcard'&&(a.from==='hand'||/\b(?:play|plays) it\b/i.test(t)&&!/\bbanish/i.test(t)))return 'hidden';
  return 'known';}
/** Miért kér adatot egy rejtett információra épülő utasítás (a lefedettségi riporthoz és a mezők címkéjéhez). */
export function hiddenWhy(t:string,cardName?:string|null){const ov:CardOv|null=cardOv(cardName,t);if(ov)return ov.why||'rejtett információ (kéz vagy deck)';const a=actOf(t);
  if(a.cond&&a.cond.how==='hidden')return a.cond.why;if(a.k==='playcard')return 'a kijátszott lap a kézből vagy rejtett zónából jön, a builderben választható';return '';}
export const allScope=(eff:string)=>{const m=/\b(all|each) (other )?(friendly |enemy )?(units?|gear)\b([^.]{0,30})/i.exec(eff)||/\b(?:to|kill|stun|ready|exhaust|give)\s()(other )?(friendly |enemy )(units|gear)\b((?: here| there| at battlefields?| in (?:your |their )?bases?)[^.]{0,20})/i.exec(eff);if(!m||/\beach of\b/i.test(eff))return null;
  return {rel:(m[3]||'').trim()?m[3].trim().toLowerCase():/^\s*(?:you control|of yours)\b/i.test(m[5]||'')?'friendly':/^\s*(?:an opponent controls|your opponents control)\b/i.test(m[5]||'')?'enemy':'any',type:/gear/i.test(m[4])?'gear':'unit',here:/\bhere\b/i.test(m[5]),there:/\bthere\b/i.test(m[5]),atbf:/at (?:a |each )?battlefields?/i.test(m[5]),inbase:/\bin (?:a |their |your |its )?bases?\b/i.test(m[5]),other:!!m[2]};};
export function timingOf(c:CardLike){
  const t=c.txt||'';const kw=(k:string)=>new RegExp('^\\['+k+'\\](?:\\s*\\(|\\s*$|\\s*\\[)','m').test(t);
  if(kw('Reaction')||kw('Quick-Draw'))return 'reaction';
  if(kw('Hidden'))return 'hidden';
  if(kw('Action'))return 'action';
  return c.t==='Spell'?'none':'perm';
}
export const isPermC=(c:CardLike|null|undefined)=>c&&(c.t==='Unit'||c.t==='Gear');

/* "Így értelmezem a lapot": felülírható műveletek. */
export const OV_ACTS=[['kill','kill'],['dmg','damage N'],['base','move to base'],['move','move (cél a lépésnél)'],['hand','return to hand'],['banish','banish'],['recall','recall'],['stun','stun'],['buff','buff'],['might','Might módosítás N'],['ready','ready'],['exhaust','exhaust'],['control','gain control'],['attach','attach'],['detach','detach'],['draw','draw N'],['channel','channel N'],['discard','discard N'],['counter','counter'],['choose','választás (célpont kijelölése)'],['none','semmi'],['other','nem követett hatás']];
export const OV_LBL:Record<string,string>=Object.fromEntries(OV_ACTS);
export const OV_N=new Set(['dmg','draw','might','channel','discard']);
export function interp(s:{ov?:Record<number,InstrOv|null>},inf:Partial<StepInfo>):Instr[]{const eff=inf.eff||'';const list=inf.list||[];
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

