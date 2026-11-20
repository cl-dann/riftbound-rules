/* Maradék korlátok: Nasus az ability aktiválására (206.1, 827.1), Baited Hook Might-feltétele (359.3.e.13),
   többjátékos választás (355.10.e, 412.1): Promising Future, Divine Judgment, Mechanical Bandit. Valós lapok. */
import { describe, expect, it } from 'vitest';
import { analyze, abilitiesOf } from '../src/domain/chain/chainCore';
import { vsCard } from '../src/legacy/core';
import { ruleText } from './util';

const base = (o: any) => ({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
const run = (cs: any) => {
  const r = analyze(JSON.parse(JSON.stringify(cs)));
  const text = r.rows.map((x) => x.join(' ')).join('\n');
  return { r, text, last: r.frames[r.frames.length - 1].board, o: (id: string) => r.objs[id], items: r.items.map((i: any) => i.name) };
};
const empAi = (n: string) => abilitiesOf(vsCard(n)).findIndex((a: any) => a.empower);
const dk = (p: string, ...n: string[]) => n.map((x, i) => ({ id: 'zd' + p + '_' + (i + 1), n: x }));

describe('1. Nasus: activated ability Energy költséggel', () => {
  it('az Empower activated ability (827.1), a lista végén', () => {
    expect(ruleText('827.1')).toMatch(/Activated Ability keyword/);
    expect(ruleText('206.1')).toMatch(/ability.s cost.*base cost/);
    expect(abilitiesOf(vsCard('Steel Paws'))[empAi('Steel Paws')]).toMatchObject({ cost: '[7]', empower: true });
  });
  it('Steel Paws Empower [7]: Nasus triggerel; Kharox [6][C][C]: nem', () => {
    const yes = run(base({ lg: { A: 'Nasus, Curator of the Sands', B: '' }, bd: [{ n: 'Steel Paws', pl: 'A', loc: 'base', d: 0 }], steps: [{ k: 'ab', src: 'b0', ai: empAi('Steel Paws'), pl: 'A', n: 'Steel Paws', tg: [], ext: {} }] }));
    expect(yes.items).toContain('Nasus, Curator of the Sands triggere');
    expect(yes.text).toMatch(/Steel Paws abilityjének alapköltsége 7 Energy/);
    expect(yes.o('b0').emp).toBe(true);
    const no = run(base({ lg: { A: 'Nasus, Curator of the Sands', B: '' }, bd: [{ n: 'Kharox', pl: 'A', loc: 'base', d: 0 }], steps: [{ k: 'ab', src: 'b0', ai: empAi('Kharox'), pl: 'A', n: 'Kharox', tg: [], ext: {} }] }));
    expect(no.items).not.toContain('Nasus, Curator of the Sands triggere');
    expect(no.text).toMatch(/nem triggerel, mert Kharox abilityjének alapköltsége 6 Energy/);
  });
  it('már Empowered forrás: az Empower nem aktiválható', () => {
    const x = run(base({ bd: [{ n: 'Steel Paws', pl: 'A', loc: 'base', d: 0, emp: true }], steps: [{ k: 'ab', src: 'b0', ai: empAi('Steel Paws'), pl: 'A', n: 'Steel Paws', tg: [], ext: {} }] }));
    expect(x.text).toMatch(/Nem szabályos.*már Empowered/);
  });
});

describe('2. Baited Hook: "Might up to 1 more than the killed unit"', () => {
  const cs = (pick: string) => base({ bd: [{ n: 'Baited Hook', pl: 'A', loc: 'base', d: 0 }, { n: 'Blastcone Fae', pl: 'A', loc: 'base', d: 0 }],
    deck: { A: dk('A', 'Shipyard Skulker', 'Kharox'), B: [] }, steps: [{ k: 'ab', src: 'b0', ai: 0, pl: 'A', n: 'Baited Hook', tg: ['b1'], ext: {}, zp: { 2: [pick] } }] });
  it('a megölt Blastcone Fae (2): a 3 Mightú unit választható, a boardra kerül', () => {
    const x = run(cs('zdA_1'));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(x.last.me.base.map((u: any) => u.n)).toContain('Shipyard Skulker');
  });
  it('az 5 Mightú unit nem választható, okkal', () => {
    const x = run(cs('zdA_2'));
    expect(x.text).toMatch(/Kharox Mightja 5, a feltétel legfeljebb 3 \(a megölt unit Mightja 2 \+ 1; visszatekintés, 359\.3\.e\.13\)/);
    expect(x.last.me.base.map((u: any) => u.n)).not.toContain('Kharox');
  });
});

describe('3. Többjátékos választás (355.10.e, 412.1)', () => {
  it('Promising Future: mindkét játékos a saját felső lapjai közül banishel, majd kijátssza', () => {
    expect(ruleText('355.10.e')).toMatch(/Each player kills a unit they control/);
    const x = run(base({ deck: { A: dk('A', 'Void Seeker', 'Shipyard Skulker'), B: dk('B', 'Blastcone Fae') },
      steps: [{ k: 'card', n: 'Promising Future', pl: 'A', tg: [], ext: {}, zp: { 0: ['zdA_2', 'zdB_1'] } }] }));
    expect(x.text).toMatch(/Te banisheli: Shipyard Skulker/);
    expect(x.text).toMatch(/Az ellenfél banisheli: Blastcone Fae/);
    expect(x.last.me.base.map((u: any) => u.n)).toEqual(['Shipyard Skulker']);
    expect(x.last.opp.base.map((u: any) => u.n)).toEqual(['Blastcone Fae']);
    expect(x.o('zdA_1').ord).toBeGreaterThanOrEqual(900);
  });
  it('Promising Future: más játékos lapja nem választható a saját választásként', () => {
    const x = run(base({ deck: { A: dk('A', 'Void Seeker'), B: dk('B', 'Blastcone Fae') },
      steps: [{ k: 'card', n: 'Promising Future', pl: 'A', tg: [], ext: {}, zp: { 0: ['zdA_1', 'zdA_1'] } }] }));
    expect(x.text).toMatch(/csak egy lapot banishelhet/);
  });
  it('Divine Judgment: a megtartott lapok maradnak, a többi recycle (417)', () => {
    const x = run(base({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', d: 0 }, { n: 'Pickpocket', pl: 'A', loc: 'base', d: 0 }, { n: 'Blastcone Fae', pl: 'A', loc: 'base', d: 0 }, { n: 'Kharox', pl: 'B', loc: 'base', d: 0 }],
      hand: { A: [{ id: 'zhA_1', n: 'Flash' }], B: [] }, steps: [{ k: 'card', n: 'Divine Judgment', pl: 'A', tg: [], ext: {}, zp: { 0: ['b0', 'b1', 'b3'] } }] }));
    expect(x.last.me.base.map((u: any) => u.n).sort()).toEqual(['Pickpocket', 'Shipyard Skulker']);
    expect(x.last.opp.base.map((u: any) => u.n)).toEqual(['Kharox']);
    expect(x.last.me.hand).toEqual([]);
    expect(x.text).toMatch(/Blastcone Fae, Flash: recycle/);
  });
  it('Divine Judgment: legfeljebb 2 unit játékosonként', () => {
    const x = run(base({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', d: 0 }, { n: 'Pickpocket', pl: 'A', loc: 'base', d: 0 }, { n: 'Blastcone Fae', pl: 'A', loc: 'base', d: 0 }],
      steps: [{ k: 'card', n: 'Divine Judgment', pl: 'A', tg: [], ext: {}, zp: { 0: ['b0', 'b1', 'b2'] } }] }));
    expect(x.text).toMatch(/legfeljebb 2 unit/);
  });
  it('Mechanical Bandit: a legalacsonyabb költségű felfedett lap a tiéd, húzod; döntetlennél nyitott kérdés', () => {
    const cs = (a: string, b: string) => base({ deck: { A: dk('A', a), B: dk('B', b) }, bd: [{ n: 'Mechanical Bandit', pl: 'A', loc: 'base', d: 0 }],
      steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Mechanical Bandit', tg: [], ext: {} }] });
    const w = run(cs('Blastcone Fae', 'Kharox'));
    expect(w.last.me.hand).toEqual(['Blastcone Fae']);
    expect(w.o('zdB_1').ord).toBeGreaterThanOrEqual(900);
    const l = run(cs('Kharox', 'Blastcone Fae'));
    expect(l.last.me.hand).toEqual([]);
    const t = run(cs('Shipyard Skulker', 'Pickpocket'));
    expect(t.text).toMatch(/döntetlen: a Core Rules nem dönti el/);
  });
});
