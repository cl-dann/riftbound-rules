/* Két lap általános kölcsönhatásai (a chain riport "Kölcsönhatások" része). (a korábbi legacy/core.ts része, S15) */
import { kwRef } from '../data/store';
import type { Card } from '../data/schema';
export function vsPairs(A: Card,B: Card){
  const out: [string, string][]=[];const ta=(A.txt||'')+' '+(A.eff||''),tb=(B.txt||'')+' '+(B.eff||'');const refsA=(A.nt||[]).flatMap(n=>n[0].split(',').map(x=>x.trim()));
  const targets=refsA.some(r=>/^355\.(7|9|10|11)/.test(r));
  const add=(ref: string,txt: string)=>out.push([ref,txt]);
  if(targets&&/can.t be chosen|cannot be chosen/i.test(tb))add('757',A.n+' választást kér, '+B.n+' szövege viszont bizonyos helyzetben kizárja, hogy kiválasszák. Ha a feltétel teljesül (például enemy spell választaná), '+B.n+' nem választható.');
  if(targets&&/\[Deflect/.test(tb))add(kwRef('Deflect')||'356.2.a',B.n+' Deflectje miatt, ha '+A.n+' őt választja, plusz költséget kell fizetni.');
  if(/counter (?:a|an|target|that|it)\b[^.]{0,30}spell|counter (?:a|an) spell/i.test(ta)&&B.t==='Spell')add('426',A.n+' counterelheti '+B.n+'-t, amíg az a chainen vár. A counterelt spell nem hat, és a kifizetett cost nem jár vissza.');
  if(/\bkill\b|\bdeal \d/i.test(ta)&&/\[Deathknell\]/.test(tb))add(kwRef('Deathknell')||'429',A.n+' megölheti '+B.n+'-t, ekkor '+B.n+' Deathknell képessége elindul.');
  if(/\bbanish/i.test(ta)&&/\[Deathknell\]/.test(tb))add('428',A.n+' banish hatása nem kill, ezért ha így kerül el '+B.n+', a Deathknell képessége nem indul.');
  if(/\bkill\b|\bdeal \d/i.test(ta)&&/(if (?:i|this|it) would die|would be killed)/i.test(tb))add('367',B.t==='Gear'&&B.eff?B.n+' Effect Textje replacement effectet ad a felszerelt unitnak: ha '+A.n+' megölné azt a unitot, helyette a '+B.n+' hatása fut le.':B.n+' replacement effectje helyettesítheti a halálát, ha '+A.n+' megölné.');
  if(/return[^.]{0,60}hand/i.test(ta)&&(B.st||[]).includes('Token'))add('186.1',A.n+' kézbe küldené '+B.n+'-t, de token kézbe kerülve megszűnik.');
  if(/return[^.]{0,60}hand/i.test(ta)&&B.t==='Unit')add('719.5',A.n+' kézbe küldheti '+B.n+'-t: ha rajta Equipment van, az leválik és a boardon marad.');
  if(A.t==='Gear'&&(A.tg||[]).includes('Equipment')&&B.t==='Unit')add('716',A.n+' Equipment, felcsatolható '+B.n+'-re: ekkor '+B.n+' megkapja a Might bonust és az Effect Textet.');
  if(/\bmove/i.test(ta)&&/can.t move|cannot move/i.test(tb))add('358.3.a',A.n+' mozgatást kér, de '+B.n+' tiltja: a lap kijátszható, a mozgás viszont negálódik.');
  if(/\[Stun\]|\bstun/i.test(ta)&&B.t==='Unit')add(kwRef('Stun')||'424',A.n+' stunolhatja '+B.n+'-t.');
  return out;
}
