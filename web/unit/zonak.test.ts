/* Kéz, deck és trash lapjai mint célpont vagy választás (355.7, 355.9.a, 355.10.a, 355.18, 359.3.e.4-6), valós lapokkal. */
import { describe, expect, it } from 'vitest';
import { analyze, zoneRefOf } from '../src/domain/chain/chainCore';
import { ruleText } from './util';

const base = (o: any) => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
const run = (cs: any) => {
  const r = analyze(JSON.parse(JSON.stringify(cs)));
  const text = r.rows.map((x) => x.join(' ')).join('\n') + '\n' + r.frames.flatMap((f: any) => f.changes.map((c: any) => c.join(' '))).join('\n');
  const last = r.frames[r.frames.length - 1].board;
  return { r, text, last, item: (re: RegExp) => r.items.find((i: any) => re.test(i.name)) };
};

describe('A Core Rules alapja', () => {
  it('a trash nyilvános, a kéz privát, a deck sorrendje titkos; ami nem nyilvános zónában van, nem célpont', () => {
    expect(ruleText('108.2.d')).toMatch(/Public Information/);
    expect(ruleText('108.7.c')).toMatch(/Private Information/);
    expect(ruleText('108.4.e')).toMatch(/Secret Information/);
    expect(ruleText('355.10.a')).toMatch(/Return a unit from your trash to your hand.*targets a unit card in your trash/);
    expect(ruleText('355.10.a')).toMatch(/does not target a unit card in your hand/);
    expect(ruleText('355.18')).toMatch(/made on resolution/);
    expect(ruleText('359.3.e.4')).toMatch(/not treated as the same object/);
  });
  it('felismerés: trash célpont, kéz és deck választás', () => {
    expect(zoneRefOf('Return a unit from your trash to your hand.')).toMatchObject({ z: 'trash', who: 'you', target: true, type: ['unit'], act: 'hand' });
    expect(zoneRefOf('Discard 1')).toMatchObject({ z: 'hand', target: false, act: 'discard', n: 1 });
    expect(zoneRefOf('reveal the top card of your Main Deck.')).toMatchObject({ z: 'deck', top: true, target: false });
    expect(zoneRefOf("Choose up to 3 cards from opponents' trashes.")).toMatchObject({ z: 'trash', who: 'they', n: 3 });
    expect(zoneRefOf('banish all units from your trash.')).toBeNull();
  });
});

describe('Lapok a zónákból', () => {
  it('trashből visszahozás: Morbid Return a trash unitját a kézbe teszi', () => {
    const x = run(base({ trash: { A: ['Shipyard Skulker'], B: [] }, steps: [{ k: 'card', n: 'Morbid Return', pl: 'A', tg: [], ext: {}, zp: { 0: ['ztA0'] } }] }));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.last.me.hand).toEqual(['Shipyard Skulker']);
    expect(x.last.me.trash).toEqual(['Morbid Return']);
    expect(x.item(/^Morbid Return/)!.instr[0].st).toBe('executed');
    expect(x.text).toMatch(/355\.10\.a/);
  });
  it('trash célpont a lerakáskor nem legális (rossz típus): a lépés nem szabályos (355.8, 355.9.b)', () => {
    const x = run(base({ trash: { A: ['Flash'], B: [] }, steps: [{ k: 'card', n: 'Morbid Return', pl: 'A', tg: [], ext: {}, zp: { 0: ['ztA0'] } }] }));
    expect(x.text).toMatch(/Nem szabályos.*Flash nem unit/);
  });
  it('a zóna elhagyása resolve előtt: Disposal Order recycle-öli a célpontot, a Morbid Return Ignored (359.3.e.5, 359.3.e.6)', () => {
    const x = run(base({ trash: { A: ['Shipyard Skulker'], B: [] }, steps: [
      { k: 'card', n: 'Morbid Return', pl: 'A', tg: [], ext: {}, zp: { 0: ['ztA0'] } },
      { k: 'card', n: 'Disposal Order', pl: 'B', tg: [], ext: {}, mode: 0, zp: { 0: ['ztA0'] } }] }));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.item(/^Disposal Order/)!.res).toBe('ok');
    expect(x.item(/^Morbid Return/)!.instr[0].st).toBe('ignored');
    expect(x.text).toMatch(/359\.3\.e\.5, 359\.3\.e\.6/);
    expect(x.last.me.hand).toEqual([]);
  });
  it('kézből eldobás: Lunar Boon a megadott lapot dobja el, a kéz privát, a választás a resolve-kor (355.18, 423.1)', () => {
    const x = run(base({ hand: { A: ['Flash', 'Void Seeker'], B: [] }, steps: [{ k: 'card', n: 'Lunar Boon', pl: 'A', tg: [], ext: {}, zp: { 0: ['zhA1'] } }] }));
    expect(x.last.me.hand).toEqual(['Flash']);
    expect(x.last.me.trash).toEqual(expect.arrayContaining(['Void Seeker', 'Lunar Boon']));
    expect(x.text).toMatch(/355\.18/);
    expect(x.text).toMatch(/423\.1/);
  });
  it('a kézből választott lap a resolve-kor már nincs a kézben: Negated, levezetés (355.18, 359.3.e.6)', () => {
    const x = run(base({ hand: { A: ['Flash', 'Lunar Boon'], B: [] }, bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0', d: 0 }], steps: [
      { k: 'card', n: 'Lunar Boon', pl: 'A', tg: [], ext: {}, zp: { 0: ['zhA0'] } },
      { k: 'card', n: 'Flash', pl: 'A', from: 'hand', tg: ['b0'], ext: {} }] }));
    expect(x.item(/^Lunar Boon/)!.instr[0].st).toBe('negated');
    expect(x.text).toMatch(/355\.18/);
  });
  it('trashből kijátszás: The Harrowing a trash unitját a boardra teszi', () => {
    const x = run(base({ trash: { A: ['Shipyard Skulker'], B: [] }, steps: [{ k: 'card', n: 'The Harrowing', pl: 'A', tg: [], ext: {}, zp: { 0: ['ztA0'] } }] }));
    expect(x.last.me.base.map((u: any) => u.n)).toEqual(['Shipyard Skulker']);
    expect(x.last.me.trash).toEqual(['The Harrowing']);
  });
  it('a deck felső lapja: Apprentice Smith felfedi, gear, ezért a kézbe kerül (rejtett adat helyett megadott lap, 108.4.e)', () => {
    const cs = (top: string) => base({ deck: { A: [top], B: [] }, bd: [{ n: 'Apprentice Smith', pl: 'A', loc: 'bf0', d: 0 }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Apprentice Smith', tg: [], ext: {} }] });
    const g = run(cs('Long Sword'));
    expect(g.last.me.hand).toEqual(['Long Sword']);
    expect(g.text).toMatch(/a deck felső lapja a pályás építőben megadva: Long Sword/);
    const u = run(cs('Shipyard Skulker'));
    expect(u.last.me.hand).toEqual([]);
  });
});

describe('Rejtett adat helyett kiválasztott lap', () => {
  it('Get Excited!: az eldobott lap Energy költsége a kézből kiválasztott lapból jön', () => {
    const x = run(base({ hand: { A: ['Void Seeker'], B: [] }, bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }], steps: [{ k: 'card', n: 'Get Excited!', pl: 'A', tg: ['b0'], ext: {}, zp: { 0: ['zhA0'] } }] }));
    expect(x.text).toMatch(/Az eldobott lap: Void Seeker \(Energy költség 3\)/);
    expect(x.r.objs.b0.zone).toBe('trash');
  });
});

describe('Nyitott kérdés (flag 2)', () => {
  it('típust előíró kézválasztás, a lap nincs a kézben: Negated levezetéssel, 128.6.a miatt nyitott kérdés', () => {
    expect(ruleText('128.6.a')).toMatch(/Ignored instructions are deemed impossible/);
    const x = run(base({ hand: { A: ['Flash'], B: [] }, steps: [{ k: 'card', n: 'Here to Help', pl: 'A', tg: [], ext: {}, zp: { 0: ['zhA0'] } }] }));
    const rh = x.r.items.find((i: any) => /Here to Help/.test(i.name));
    const txt = x.text + JSON.stringify(x.r.items);
    expect(txt).toMatch(/128\.6\.a/);
    expect(rh!.instr[0].st).toBe('negated');
  });
});
