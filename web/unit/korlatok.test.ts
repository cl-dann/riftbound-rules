/* A maradt korlátok: trigger költségfeltétele (206, 383.2), "from among them" választás (128.4, 355.18, 417), ismeretlen változó (359.3.e.12, 359.3.e.13). */
import { describe, expect, it } from 'vitest';
import { analyze, zoneRefOf } from '../src/domain/chain/chainCore';
import { exampleOf, ruleText } from './util';

const base = (o: any) => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
const run = (cs: any) => {
  const r = analyze(JSON.parse(JSON.stringify(cs)));
  const text = r.rows.map((x) => x.join(' ')).join('\n') + '\n' + r.frames.flatMap((f: any) => f.changes.map((c: any) => c.join(' '))).join('\n');
  return { r, text, last: r.frames[r.frames.length - 1].board, item: (re: RegExp) => r.items.find((i: any) => re.test(i.name)), ev: (k: string) => r.ev.filter((e: any) => e.k === k) };
};
const D = (n: string, i: number) => ({ id: 'zdA_' + i, n });

describe('1. Trigger költségfeltétele: a kijátszott lap nyomtatott költsége (206)', () => {
  it('Lux és Sky Splitter: a csökkentett költség ellenére triggerel (a 206 példája)', () => {
    expect(exampleOf('206', 'Sky Splitter')).toMatch(/regardless of how much was actually paid/);
    const x = run(base({ bd: [{ n: 'Lux, Illuminated', pl: 'A', loc: 'base', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }], steps: [{ k: 'card', n: 'Sky Splitter', pl: 'A', tg: ['b1'], ext: {} }] }));
    expect(x.r.items.map((i: any) => i.name)).toContain('Lux, Illuminated triggere');
    expect(x.text).toMatch(/Triggerel, mert Sky Splitter nyomtatott költsége 8 Energy/);
  });
  it('Lux: 3 költségű spellre nem triggerel, az ok kiírva', () => {
    const x = run(base({ bd: [{ n: 'Lux, Illuminated', pl: 'A', loc: 'base', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b1'], ext: {} }] }));
    expect(x.r.items.map((i: any) => i.name)).not.toContain('Lux, Illuminated triggere');
    expect(x.text).toMatch(/Lux, Illuminated: .* nem triggerel, mert Void Seeker nyomtatott költsége 3 Energy.*Energy költsége 3, a feltétel legalább 5/);
  });
  it('Yordle Explorer: Power költség [A][A] vagy több', () => {
    const yes = run(base({ bd: [{ n: 'Yordle Explorer', pl: 'A', loc: 'base', d: 0 }], steps: [{ k: 'card', n: 'The Ruination', pl: 'A', tg: [], ext: {} }] }));
    expect(yes.text).toMatch(/Yordle Explorer triggere/);
    const no = run(base({ bd: [{ n: 'Yordle Explorer', pl: 'A', loc: 'base', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b1'], ext: {} }] }));
    expect(no.text).toMatch(/Power költsége 1, a feltétel legalább 2/);
  });
  it('Nasus (legend): 7 költségű unit kijátszására triggerel, a "unit, gear, or activated ability" alak', () => {
    const x = run(base({ lg: { A: 'Nasus, Curator of the Sands', B: '' }, steps: [{ k: 'card', n: 'Corina Veraza', pl: 'A', loc: 'base', tg: [], ext: {} }] }));
    expect(x.text).toMatch(/Nasus, Curator of the Sands triggere/);
    const y = run(base({ lg: { A: 'Nasus, Curator of the Sands', B: '' }, steps: [{ k: 'card', n: 'Shipyard Skulker', pl: 'A', loc: 'base', tg: [], ext: {} }] }));
    expect(y.text).toMatch(/nem triggerel.*legalább 7/);
  });
  it('Meticulous Restorationist a trashből: 7 költségű lap kijátszására triggerel és a trashből a boardra kerül', () => {
    const x = run(base({ trash: { A: [{ id: 'ztA_1', n: 'Meticulous Restorationist' }], B: [] }, steps: [{ k: 'card', n: 'Corina Veraza', pl: 'A', loc: 'base', tg: [], ext: {} }] }));
    expect(x.text).toMatch(/Meticulous Restorationist triggere/);
    expect(x.last.me.base.map((u: any) => u.n)).toEqual(expect.arrayContaining(['Meticulous Restorationist']));
    expect(x.last.me.trash).not.toContain('Meticulous Restorationist');
  });
});

describe('2. "From among them": a megnézett lapok közül választás', () => {
  const fw = (pick?: string) => base({ deck: { A: [D('Void Seeker', 1), D('Clairvoyance', 2), D('Shipyard Skulker', 3), D('Long Sword', 4)], B: [] },
    steps: [{ k: 'card', n: 'Fate Weaver', pl: 'A', loc: 'base', tg: [], ext: {}, ...(pick ? { zp: { 1: [pick] } } : {}) }] });
  it('felismerés', () => {
    expect(zoneRefOf('You may reveal a spell with Energy cost [4] or more from among them and draw it.')).toMatchObject({ z: 'among', type: ['spell'], act: 'hand', cost: { e: ['>=', 4] } });
    expect(ruleText('128.4')).toMatch(/Private/);
  });
  it('Fate Weaver: a választott spell a kézbe, a többi recycle a deck aljára (417)', () => {
    const x = run(fw('zdA_2'));
    expect(x.last.me.hand).toEqual(['Clairvoyance']);
    expect(x.text).toMatch(/rejtett adat, csak a tulajdonos látja, 128\.4/);
    expect(x.text).toMatch(/Void Seeker, Shipyard Skulker, Long Sword: recycle, a Main Deck aljára \(417\)/);
    expect(x.r.objs.zdA_1.ord).toBeGreaterThan(x.r.objs.zdA_4.ord - 10);
  });
  it('Fate Weaver: a 3 költségű spell nem választható (206), Negated', () => {
    const x = run(fw('zdA_1'));
    expect(x.text).toMatch(/Void Seeker Energy költsége 3, a feltétel legalább 4 \(206\)/);
    expect(x.last.me.hand).toEqual([]);
  });
  it('lap megadása nélkül marad a korábbi viselkedés: konkrét lap nem kerül a kézbe', () => {
    const x = run(fw());
    expect(x.last.me.hand).toEqual([]);
  });
  it('Lightning Rush: a többi a trashbe kerül (108.2)', () => {
    const x = run(base({ deck: { A: [D('Void Seeker', 1), D('Flash', 2), D('Long Sword', 3)], B: [] }, steps: [{ k: 'card', n: 'Lightning Rush', pl: 'A', tg: [], ext: {}, zp: { 1: ['zdA_2'] } }] }));
    expect(x.last.me.hand).toEqual(['Flash']);
    expect(x.last.me.trash).toEqual(expect.arrayContaining(['Void Seeker', 'Long Sword', 'Lightning Rush']));
  });
  it('Trifarian Captain: típus és költség, a gear választható, a unit drága', () => {
    const cs = (pick: string) => base({ deck: { A: [D('Corina Veraza', 1), D('Long Sword', 2), D('Flash', 3), D('Void Seeker', 4)], B: [] },
      steps: [{ k: 'card', n: 'Trifarian Captain', pl: 'A', loc: 'base', tg: [], ext: {}, zp: { 1: [pick] } }] });
    expect(run(cs('zdA_2')).last.me.hand).toEqual(['Long Sword']);
    expect(run(cs('zdA_1')).text).toMatch(/Corina Veraza Energy költsége 7, a feltétel legfeljebb 3/);
  });
});

describe('3. Ismeretlen változó', () => {
  it('Noxian Demolitionist: a forrás a resolve előtt elhagyja a boardot, a "my Might" null, Ignored (359.3.e.12)', () => {
    expect(ruleText('359.3.e.12')).toMatch(/returns "null"/);
    const x = run(base({ turn: 'A', bd: [{ n: 'Noxian Demolitionist', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Gold', pl: 'B', loc: 'base', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Noxian Demolitionist', tg: ['b1'], ext: {} }, { k: 'card', n: 'Star-Crossed', pl: 'B', tg: ['b2', 'b0'], ext: {} }] }));
    expect(x.text).toMatch(/a forrás Mightja nem elérhető.*359\.3\.e\.12/);
    expect(x.r.objs.b1.zone).toBe('board');
  });
  it("Kai'Sa: a pontszám a Játékállapotból, kiírt feltételezéssel", () => {
    const cs = (score: string) => base({ ps: { A: { score }, B: {} }, bd: [{ n: "Kai'Sa, Evolutionary", pl: 'A', loc: 'bf0', d: 0 }], trash: { A: [{ id: 'ztA_1', n: 'Void Seeker' }], B: [] },
      steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: "Kai'Sa, Evolutionary", tg: [], ext: {}, zp: { 0: ['ztA_1'] } }] });
    const ok = run(cs('5'));
    expect(ok.text).toMatch(/a játékos pontszáma: 5 \(a Játékállapot kezdő pontszáma/);
    const no = run(cs('2'));
    expect(no.text).toMatch(/Energy költsége 3, a feltétel kevesebb, mint 2/);
  });
  it('Heedless Resurrection: a megölt unit költsége visszatekintéssel (359.3.e.13)', () => {
    const x = run(base({ trash: { A: [{ id: 'ztA_1', n: 'Pickpocket' }], B: [] }, bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', d: 0 }],
      steps: [{ k: 'card', n: 'Heedless Resurrection', pl: 'A', costTg: 'b0', tg: [], ext: {}, zp: { 0: ['ztA_1'] } }] }));
    expect(x.text).toMatch(/visszatekintés a költségként megölt unitra, 359\.3\.e\.13/);
    expect(x.last.me.base.map((u: any) => u.n)).toEqual(['Pickpocket']);
  });
});
