/* Az aktuális deck és a legalitás ellenőrzése (Core Rules 103). (a korábbi legacy/core.ts része, S15) */
import { BF, banDate } from '../data/store';
import type { Card } from '../data/schema';
import type { CardRow, DeckCheck, DeckSection } from './types';
export let DECK: DeckSection[]=[];
export const setDeck=(d: DeckSection[])=>{DECK=d;};
export const secOf=(re: RegExp)=>DECK.filter(s=>re.test(s.name)).flatMap(s=>s.rows.filter((r): r is CardRow=>!!r.card));
export function checkDeck(){
  const L=secOf(/legend/i),CH=secOf(/champion/i),M=secOf(/main/i),B=secOf(/battle/i),RN=secOf(/rune/i),SB=secOf(/side/i);
  const sum=(a: CardRow[])=>a.reduce((x,r)=>x+r.qty,0);const out: DeckCheck[]=[];
  const add=(ok: unknown,rule: string,txt: string)=>out.push([ok,rule,txt]);
  const leg=L.length?L[0].card:null;
  add(sum(L)===1&&leg&&leg.t==='Legend','103.2','Pontosan 1 Champion Legend kell. A listában: '+sum(L)+'.');
  if(!leg||leg.t!=='Legend')return out;
  const id=leg.d||[];
  const ch=CH.length?CH[0].card:null;
  add(sum(CH)===1&&ch&&ch.t==='Unit'&&(ch.st||[]).includes('Champion'),'103.3.a','Pontosan 1 Chosen Champion kell, és Champion unitnak kell lennie.');
  if(ch&&leg.ch)add((ch.tg||[]).includes(leg.ch),'103.3.a.2','A Chosen Champion tagje egyezzen a legend Champion tagjével ('+leg.ch+').');
  const main=M.concat(CH);const n=sum(main);
  add(n>=40,'103.3','A Main Deck legalább 40 lap, a Chosen Championnel együtt. Most: '+n+'.');
  const wrong=main.filter(r=>!['Unit','Gear','Spell'].includes(r.card.t)||(r.card.st||[]).includes('Token'));
  add(!wrong.length,'103.3','A Main Deckben csak Unit, Gear és Spell lehet.'+(wrong.length?' Nem odavaló: '+wrong.map(r=>r.card.n).join(', ')+'.':''));
  const cnt: Record<string, number>={};main.forEach(r=>cnt[r.card.n]=(cnt[r.card.n]||0)+r.qty);
  const over=Object.keys(cnt).filter(k=>cnt[k]>3);
  add(!over.length,'103.3.b','Azonos nevű lapból legfeljebb 3 lehet, a Chosen Championt is beleszámolva.'+(over.length?' Túllépi: '+over.map(k=>k+' ('+cnt[k]+')').join(', ')+'.':''));
  const uq=[...new Set(main.map(r=>r.card))].filter(c=>/\[Unique\]/.test(c.txt||'')&&cnt[c.n]>1);
  if(main.some(r=>/\[Unique\]/.test(r.card.txt||'')))add(!uq.length,'825.3.a','[Unique] lapból csak 1 példány lehet.'+(uq.length?' Túllépi: '+uq.map(c=>c.n).join(', ')+'.':''));
  const offDom=(a: CardRow[])=>[...new Set<Card>(a.map(r=>r.card))].filter(c=>(c.d||[]).some(d=>!id.includes(d)));
  const od=offDom(main);
  add(!od.length,'103.2.b','Minden lap domainje a legend Domain Identity-jén ('+id.join(' + ')+') belül legyen.'+(od.length?' Kilóg: '+od.map(c=>c.n+' ('+c.d.join('+')+')').join(', ')+'.':''));
  const sig=main.filter(r=>(r.card.st||[]).includes('Signature'));const sn=sum(sig);
  add(sn<=3,'103.3.d.1','Összesen legfeljebb 3 Signature lap lehet. Most: '+sn+'.');
  if(sig.length&&leg.ch){const lch=leg.ch;const bad=sig.filter(r=>!(r.card.tg||[]).includes(lch));add(!bad.length,'103.3.d.2','Minden Signature lap a legend Champion tagjét ('+leg.ch+') viselje.'+(bad.length?' Nem egyezik: '+bad.map(r=>r.card.n).join(', ')+'.':''));}
  const rn=sum(RN);
  add(rn===12&&RN.every(r=>r.card.t==='Rune'),'103.4.a','A Rune Deck pontosan 12 rune. Most: '+rn+'.');
  const ro=offDom(RN);
  add(!ro.length,'103.4.a.1','A rune-ok a legend Domain Identity-jén belül legyenek.'+(ro.length?' Kilóg: '+ro.map(c=>c.n).join(', ')+'.':''));
  const bn=sum(B);
  add(bn===3&&B.every(r=>r.card.t==='Battlefield'),'487.5','1v1 módban 3 Battlefield kell, ebből egy kerül véletlenszerűen játékba. Most: '+bn+'. Más módban a szám eltér (103.5.a).');
  add(B.every(r=>r.qty===1),'103.5.c','Azonos nevű Battlefieldből csak egy lehet.');
  const ban=main.concat(B,SB,L).filter(r=>r.card.ban===1);
  add(!ban.length,'103.3.e','Tiltott lap nem lehet a deckben (érvényes ban lista: '+banDate()+').'+(ban.length?' Tiltott: '+[...new Set(ban.map(r=>r.card.n))].join(', ')+'.':''));
  const fut=main.concat(B,SB,L).filter(r=>r.card.banf&&!r.card.ban);
  if(fut.length)out.push([null,'103.3.e','Figyelem: '+BF.from+'-tól tiltott lesz: '+[...new Set(fut.map(r=>r.card.n))].join(', ')+'. A deck addig legális, utána ezeket cserélni kell.']);
  if(SB.length){const all: Record<string, number>={};main.concat(SB).forEach(r=>all[r.card.n]=(all[r.card.n]||0)+r.qty);const o2=Object.keys(all).filter(k=>all[k]>3);
    out.push([null,'','Sideboard: '+sum(SB)+' lap. A sideboard méretét és a példányszám-limit számítását a Tournament Rules szabályozza, azt ez az oldal nem ellenőrzi.'+(o2.length?' Main Deck és Sideboard együtt 3-nál több: '+o2.map(k=>k+' ('+all[k]+')').join(', ')+'.':'')]);}
  return out;
}
