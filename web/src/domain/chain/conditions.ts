/* Szorzók és feltételek felismerése (for each, If ..., játékállapot, nyitott kérdés, rejtett adat, enter ready). (a chainCore.ts 1-405. sorából, S19) */
import { stripRem } from './text';
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
