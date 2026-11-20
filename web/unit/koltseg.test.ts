/* Költségfeltétel hatásból kijátszásnál és választásnál (206, 356.1.c, 185.3.a.1, 131.3.b), valamint a kéz, deck és trash lapjainak
   állandó azonosítója (régi, sorszámos linkek átalakítása azonos eredménnyel). Valós lapok. */
import { describe, expect, it } from 'vitest';
import { analyze, costCondOf, costCheck, printedCost } from '../src/domain/chain/chainCore';
import { normZones } from '../src/features/chain/legacyForm';
import { vsCard } from '../src/legacy/core';
import { ruleText, exampleOf } from './util';

const base = (o: any) => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
const run = (cs: any) => {
  const r = analyze(JSON.parse(JSON.stringify(cs)));
  const text = r.rows.map((x) => x.join(' ')).join('\n') + '\n' + r.frames.flatMap((f: any) => f.changes.map((c: any) => c.join(' '))).join('\n');
  return { r, text, last: r.frames[r.frames.length - 1].board, item: (re: RegExp) => r.items.find((i: any) => re.test(i.name)) };
};

describe('Core Rules alap', () => {
  it('a nyomtatott költség számít, a módosítás, a kihagyás és a Repeat nem; token 0; Power rész hiányozhat', () => {
    expect(ruleText('206')).toMatch(/always use its printed.*even if that cost is increased, decreased, or ignored/);
    expect(exampleOf('206', 'Defy')).toMatch(/Repeat cost is paid/);
    expect(ruleText('356.1.c')).toMatch(/Printed or Copied Base Cost/);
    expect(ruleText('185.3.a.1')).toMatch(/treated as being 0/);
    expect(ruleText('131.3.b')).toMatch(/may not be present/);
    expect(ruleText('805.1')).toMatch(/Optional Additional Cost/);
  });
  it('felismerés: Energy, Power, mindkettő, változó', () => {
    expect(costCondOf('Play a unit with cost no more than [2] and no more than [A] from your trash')).toMatchObject({ e: ['<=', 2], p: ['<=', 1] });
    expect(costCondOf('Counter a spell with Power cost [A][A] or more.')).toMatchObject({ p: ['>=', 2] });
    expect(costCondOf('you may kill a gear with Energy cost [4] or less.')).toMatchObject({ e: ['<=', 4] });
    expect(costCondOf('kill a gear with Energy cost no more than my Might.')).toMatchObject({ e: ['<=', 'might'] });
    expect(costCondOf("play a spell from your trash with Energy cost less than your points")).toMatchObject({ e: ['<', 'points'] });
    expect(costCondOf('Play a unit from your trash that costs no more Energy and no more Power than the killed unit')).toMatchObject({ e: ['<=', 'relE'], p: ['<=', 'relP'] });
    expect(printedCost(vsCard('Gold'))).toEqual({ e: 0, p: 0 });
    expect(printedCost(vsCard('Shipyard Skulker'))).toEqual({ e: 3, p: 0 });
    expect(costCheck(costCondOf('cost no more than [2]'), vsCard('Shipyard Skulker'))).toBe('Energy költsége 3, a feltétel legfeljebb 2 (206)');
  });
});

describe('Kiválasztás a trashből a lerakáskor', () => {
  it('megfelelő költség: Undying Loyalty a 2 költségű unitot kijátssza', () => {
    const x = run(base({ trash: { A: [{ id: 'ztA_1', n: 'Blastcone Fae' }], B: [] }, steps: [{ k: 'card', n: 'Undying Loyalty', pl: 'A', tg: [], ext: {}, zp: { 1: ['ztA_1'] } }] }));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.last.me.base.map((u: any) => u.n)).toEqual(['Blastcone Fae']);
  });
  it('túl drága lap: a lépés nem szabályos, okkal és szabályszámmal', () => {
    const x = run(base({ trash: { A: [{ id: 'ztA_1', n: 'Shipyard Skulker' }], B: [] }, steps: [{ k: 'card', n: 'Undying Loyalty', pl: 'A', tg: [], ext: {}, zp: { 1: ['ztA_1'] } }] }));
    expect(x.text).toMatch(/Nem szabályos.*Shipyard Skulker Energy költsége 3, a feltétel legfeljebb 2 \(206\)/);
  });
  it('a költségként megölt unithoz mért feltétel: Heedless Resurrection', () => {
    const ok = run(base({ trash: { A: [{ id: 'ztA_1', n: 'Blastcone Fae' }], B: [] }, bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', d: 0 }],
      steps: [{ k: 'card', n: 'Heedless Resurrection', pl: 'A', costTg: 'b0', tg: [], ext: {}, zp: { 0: ['ztA_1'] } }] }));
    expect(ok.text).toMatch(/Nem szabályos.*Blastcone Fae Power költsége 1, a feltétel legfeljebb 0 \(206\)/);
  });
});

describe('Célpont a boardon és a chainen', () => {
  it('Rebuttal: 7 költségű spell nem választható (206)', () => {
    const x = run(base({ steps: [{ k: 'card', n: 'Clairvoyance', pl: 'B', tg: [], ext: {} }, { k: 'card', n: 'Rebuttal', pl: 'A', tg: ['s0'], ext: {} }] }));
    expect(x.text).toMatch(/Nem szabályos.*Clairvoyance: Energy költsége 7, a feltétel legfeljebb 4 \(206\)/);
  });
  it('Defy: a Repeat kifizetése nem változtat a nyomtatott költségen (206 példája)', () => {
    const x = run(base({ bd: [{ n: 'Long Sword', pl: 'A', loc: 'base', d: 0 }, { n: 'Long Sword', pl: 'A', loc: 'base', d: 0 }], steps: [
      { k: 'card', n: 'Rocket Barrage', pl: 'B', tg: ['b0', 'b1'], ext: {}, mode: 1, rep: true, mode2: 1 }, { k: 'card', n: 'Defy', pl: 'A', tg: ['s0'], ext: {} }] }));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.item(/^Rocket Barrage/)!.res).toBe('countered');
  });
  it('token költsége 0: Pickpocket megölheti a Gold tokent (185.3.a.1)', () => {
    const x = run(base({ bd: [{ n: 'Gold', pl: 'B', loc: 'base', d: 0 }], steps: [{ k: 'card', n: 'Pickpocket', pl: 'A', tg: ['b0'], ext: {} }] }));
    expect(x.text).not.toMatch(/nincs legális választása/);
    expect(x.r.objs.b0.zone).not.toBe('board');
  });
});

describe('Kijátszás név szerint (Haladó szerkesztés): a resolve-kor ellenőrizve', () => {
  it('Fizz a 9 költségű The Ruinationt nem játszhatja ki: Negated (206)', () => {
    const x = run(base({ steps: [{ k: 'card', n: 'Fizz, Trickster', pl: 'A', loc: 'base', tg: [], ext: {}, plc: { 0: 'The Ruination' } }] }));
    expect(x.text).toMatch(/nem felel meg a költségfeltételnek: Energy költsége 9, a feltétel legfeljebb 3 \(206\)/);
  });
});

describe('Állandó azonosító', () => {
  it('törölt lapra mutató kiválasztás: hiányos, nincs csendes csere', () => {
    const x = run(base({ trash: { A: [{ id: 'ztA_2', n: 'Shipyard Skulker' }], B: [] }, steps: [{ k: 'card', n: 'Morbid Return', pl: 'A', tg: [], ext: {}, zp: { 0: ['ztA_1'] } }] }));
    expect(x.text).toMatch(/Nem szabályos.*nincs megadva.*törölték/);
    expect(x.last.me.hand).toEqual([]);
  });
  it('zónaváltás: az azonosító követi a lapot (kézből a trashbe, onnan vissza a kézbe)', () => {
    const x = run(base({ hand: { A: [{ id: 'zhA_7', n: 'Shipyard Skulker' }], B: [] }, steps: [
      { k: 'card', n: 'Lunar Boon', pl: 'A', tg: [], ext: {}, zp: { 0: ['zhA_7'] } }, { k: 'res' },
      { k: 'card', n: 'Morbid Return', pl: 'A', tg: [], ext: {}, zp: { 0: ['zhA_7'] } }] }));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.r.objs.zhA_7).toMatchObject({ zone: 'hand', name: 'Shipyard Skulker' });
    expect(x.last.me.hand).toEqual(['Shipyard Skulker']);
  });
  it('régi, sorszámos helyzet betöltése: átalakul azonosítóssá, az elemzés azonos', () => {
    const old = { lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], hand: { A: ['Flash', 'Void Seeker'], B: [] }, trash: { A: ['Shipyard Skulker'], B: [] },
      steps: [{ k: 'card', n: 'Morbid Return', pl: 'A', tg: [], ext: {}, zp: { 0: ['ztA0'] } }, { k: 'card', n: 'Lunar Boon', pl: 'A', tg: [], ext: {}, zp: { 0: ['zhA1'] } }] };
    const conv = normZones(JSON.parse(JSON.stringify(old)));
    expect(conv.hand.A).toEqual([{ id: 'zhA0', n: 'Flash' }, { id: 'zhA1', n: 'Void Seeker' }]);
    expect(conv.trash.A).toEqual([{ id: 'ztA0', n: 'Shipyard Skulker' }]);
    const a = analyze(JSON.parse(JSON.stringify(old))), b = analyze(conv);
    expect(b.rows).toEqual(a.rows);
    expect(JSON.stringify(b.frames)).toEqual(JSON.stringify(a.frames));
    expect(b.html).toEqual(a.html);
  });
});
