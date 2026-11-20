/* "From among them" minden felismert lapra, valós lapokkal: a megnézett lapok közül választott lap a lapszöveg szerinti helyre kerül, a többi recycle. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/domain/chain/chainCore';
import { interp } from '../src/domain/chain/actions';
import { stepInfo } from '../src/domain/chain/steps';
import { zoneRefOf } from '../src/domain/chain/zones';

const base = (o: any) => ({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: 'A' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
const amongXi = (cs: any, j: number) => { const s = cs.steps[j]; return interp(s, stepInfo(cs, s)).findIndex((x: any) => zoneRefOf(x.t)?.z === 'among'); };
const run = (cs: any, pick: string, j = 0) => {
  const xi = amongXi(cs, j); expect(xi, 'among utasítás').toBeGreaterThanOrEqual(0);
  cs.steps[j].zp = { [xi]: [pick] };
  const r = analyze(JSON.parse(JSON.stringify(cs)));
  const text = r.rows.map((x) => x.join(' ')).join('\n');
  return { r, text, last: r.frames[r.frames.length - 1].board, o: (id: string) => r.objs[id] };
};
const deckA = (...n: string[]) => ({ A: n.map((x, i) => ({ id: 'zdA_' + (i + 1), n: x })), B: [] });
const deckB = (...n: string[]) => ({ A: [], B: n.map((x, i) => ({ id: 'zdB_' + (i + 1), n: x })) });
const recycled = (x: any, id: string) => expect(x.o(id)).toMatchObject({ zone: 'deck' }) && expect(x.o(id).ord).toBeGreaterThanOrEqual(900);

describe('From among them: kézbe húzás', () => {
  it.each([
    ['Ornn, Blacksmith', 'card', 'Long Sword', 'Shipyard Skulker'],
    ['Ivern, Nurturer', 'card', 'Shipyard Skulker', 'Long Sword'],
    ['Double Trouble', 'card', 'Shipyard Skulker', 'Flash'],
    ['Stacked Deck', 'card', 'Flash', 'Long Sword'],
  ])('%s', (n, _k, good, other) => {
    const cs = base({ deck: deckA(other, good), steps: [{ k: 'card', n, pl: 'A', loc: 'base', tg: [], ext: {} }] });
    const x = run(cs, 'zdA_2');
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.last.me.hand).toEqual([good]);
    recycled(x, 'zdA_1');
  });
  it('Command: Attack (2. mód): csak gear választható', () => {
    const cs = base({ deck: deckA('Shipyard Skulker', 'Long Sword'), steps: [{ k: 'card', n: 'Command: Attack', pl: 'A', mode: 1, tg: [], ext: {} }] });
    expect(run(JSON.parse(JSON.stringify(cs)), 'zdA_2').last.me.hand).toEqual(['Long Sword']);
    expect(run(cs, 'zdA_1').text).toMatch(/Shipyard Skulker nem gear/);
  });
  it('Rift Herald (mozgás trigger): csak unit', () => {
    const cs = base({ deck: deckA('Flash', 'Shipyard Skulker'), bd: [{ n: 'Rift Herald', pl: 'A', loc: 'bf0', d: 0 }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Rift Herald', tg: [], ext: {} }] });
    expect(run(JSON.parse(JSON.stringify(cs)), 'zdA_2').last.me.hand).toEqual(['Shipyard Skulker']);
    expect(run(cs, 'zdA_1').text).toMatch(/Flash nem unit/);
  });
});

describe('From among them: banish és kijátszás', () => {
  it.each([
    ['Reinforce', 'Shipyard Skulker'],
    ['Wild Claw', 'Shipyard Skulker'],
  ])('%s: a választott unit a boardra kerül', (n, good) => {
    const cs = base({ deck: deckA('Flash', good), steps: [{ k: 'card', n, pl: 'A', tg: [], ext: {} }] });
    const x = run(cs, 'zdA_2');
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.last.me.base.map((u: any) => u.n)).toContain(good);
    recycled(x, 'zdA_1');
  });
  it("Rek'Sai, Swarm Queen (támadás trigger): banish one, then play it", () => {
    const cs = base({ deck: deckA('Flash', 'Shipyard Skulker'), bd: [{ n: "Rek'Sai, Swarm Queen", pl: 'A', loc: 'bf0', d: 0 }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: "Rek'Sai, Swarm Queen", tg: [], ext: {} }] });
    const x = run(cs, 'zdA_2');
    expect([...x.last.me.base, ...x.last.bfs.flatMap((b: any) => b.me || [])].map((u: any) => u.n)).toContain('Shipyard Skulker');
    recycled(x, 'zdA_1');
  });
  it("Rek'Sai, Void Burrower (legend trigger)", () => {
    const cs = base({ lg: { A: "Rek'Sai, Void Burrower", B: '' }, deck: deckA('Flash', 'Shipyard Skulker'), steps: [{ k: 'tg', src: 'LA', ti: 0, pl: 'A', n: "Rek'Sai, Void Burrower", tg: [], ext: {} }] });
    const x = run(cs, 'zdA_2');
    expect(x.last.me.base.map((u: any) => u.n)).toContain('Shipyard Skulker');
  });
  it('Blind Fury: az ellenfél felső lapja, te játszod ki', () => {
    const cs = base({ deck: deckB('Shipyard Skulker'), steps: [{ k: 'card', n: 'Blind Fury', pl: 'A', tg: [], ext: {} }] });
    const x = run(cs, 'zdB_1');
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.last.me.base.map((u: any) => u.n)).toContain('Shipyard Skulker');
    expect(x.o('zdB_1').zone).toBe('played');
  });
  it('Drakehound Packmaster: az ellenfél felső lapja', () => {
    const cs = base({ deck: deckB('Shipyard Skulker'), steps: [{ k: 'card', n: 'Drakehound Packmaster', pl: 'A', loc: 'base', tg: [], ext: {} }] });
    const x = run(cs, 'zdB_1');
    expect(x.last.me.base.map((u: any) => u.n)).toContain('Shipyard Skulker');
  });
});
