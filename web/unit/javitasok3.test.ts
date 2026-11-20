/* Feltételes és más lapok által adott ready belépés (143.4, 143.4.a), és a Prevent maradék kijelzése. */
import { describe, expect, it } from 'vitest';
import { cs, run, ruleText } from './util';
import { actOf, enterReadyCond } from '../src/domain/chain/chainCore';
import { vsCard } from '../src/legacy/core';

const play = (n: string, extra: Record<string, unknown> = {}) => ({ k: 'card', n, pl: 'A', loc: 'base', ...extra });

describe('1. A lap saját, feltételes "enter ready" sora', () => {
  it('Breakneck Mech: másik Mech a boardon: ready; nélküle exhausted', () => {
    expect(ruleText('143.4')).toMatch(/exhausted/);
    expect(run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }], steps: [play('Breakneck Mech')] })).o('s0').ex).toBe(false);
    expect(run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'base' }], steps: [play('Breakneck Mech')] })).o('s0').ex).toBe(true);
  });
  it('Direwing (Dragon), Disposal Expert (nincs más unit), Xin Zhao (2 másik unit a base-ben), Shadow (battlefieldre), Vayne (ellenfél battlefieldje)', () => {
    expect(run(cs({ bd: [{ n: 'Mountain Drake', pl: 'A', loc: 'base' }], steps: [play('Direwing')] })).o('s0').ex).toBe(false);
    expect(run(cs({ steps: [play('Disposal Expert')] })).o('s0').ex).toBe(false);
    expect(run(cs({ bd: [{ n: 'Recruit', pl: 'A', loc: 'base' }], steps: [play('Disposal Expert')] })).o('s0').ex).toBe(true);
    expect(run(cs({ bd: [{ n: 'Recruit', pl: 'A', loc: 'base' }, { n: 'Recruit', pl: 'A', loc: 'base' }], steps: [play('Xin Zhao, Vigilant')] })).o('s0').ex).toBe(false);
    expect(run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], steps: [play('Shadow', { loc: 'bf0' })] })).o('s0').ex).toBe(false);
    expect(run(cs({ steps: [play('Shadow')] })).o('s0').ex).toBe(true);
    expect(run(cs({ bf: [{ n: 'Zaun Warrens', c: 'B' }], steps: [play('Vayne, Hunter')] })).o('s0').ex).toBe(false);
  });
  it('játékállapotból számolt feltétel (Bandle Soldier [Level 3]): kezdő XP alapból 0, így exhausted; 6 XP-vel ready', () => {
    expect(enterReadyCond(vsCard('Bandle Soldier'))).toMatchObject({ how: 'state' });
    const a = run(cs({ steps: [play('Bandle Soldier')] }));
    expect(a.o('s0').ex).toBe(true);
    expect(a.r.html).toMatch(/"\[Level 3\]\[&gt;\] I enter ready\.": a feltétel nem teljesül \(a játékállapotból számolva\)/);
    const b = run({ ...cs({ steps: [play('Bandle Soldier')] }), ps: { A: { xp: 6 } } } as any);
    expect(b.o('s0').ex).toBe(false);
  });
  it('rejtett adat (Dunebreaker, kéz mérete): alapból nem teljesül, a lapnál megadható', () => {
    expect(enterReadyCond(vsCard('Dunebreaker'))).toMatchObject({ how: 'hidden' });
    const a = run(cs({ steps: [play('Dunebreaker')] }));
    expect(a.o('s0').ex).toBe(true);
    expect(a.r.html).toMatch(/feltételezés: nem teljesül/);
    expect(run(cs({ steps: [play('Dunebreaker', { erd: '1' })] })).o('s0').ex).toBe(false);
  });
  it('Towering Pairofant: "If a unit died this turn" a lépésekből számolva', () => {
    const a = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }, play('Towering Pairofant')] }));
    expect(a.zone('b0')).toBe('trash');
    expect(a.o('s1').ex).toBe(false);
    expect(run(cs({ steps: [play('Towering Pairofant')] })).o('s0').ex).toBe(true);
  });
});

describe('2. Más lapok által adott ready belépés', () => {
  it('Magma Wurm (más friendly unit), Firebrand Raider (más unit), Riven legend (saját battlefieldre kijátszott)', () => {
    expect(run(cs({ bd: [{ n: 'Magma Wurm', pl: 'A', loc: 'base' }], steps: [play('Shipyard Skulker')] })).o('s0').ex).toBe(false);
    expect(run(cs({ bd: [{ n: 'Magma Wurm', pl: 'B', loc: 'base' }], steps: [play('Shipyard Skulker')] })).o('s0').ex).toBe(true);
    expect(run(cs({ bd: [{ n: 'Firebrand Raider', pl: 'B', loc: 'base' }], steps: [play('Shipyard Skulker')] })).o('s0').ex).toBe(false);
    const rv = cs({ lg: { A: 'Riven, The Exile' }, bf: [{ n: 'Zaun Warrens', c: 'A' }], steps: [play('Shipyard Skulker', { loc: 'bf0' })] });
    expect(run(rv).o('s0').ex).toBe(false);
  });
  it('Renata Glasc: a token unit ready lép be, a nem token nem', () => {
    expect(run(cs({ bd: [{ n: 'Renata Glasc, Industrialist', pl: 'A', loc: 'base' }], steps: [play('Recruit')] })).o('s0').ex).toBe(false);
    expect(run(cs({ bd: [{ n: 'Renata Glasc, Industrialist', pl: 'A', loc: 'base' }], steps: [play('Shipyard Skulker')] })).o('s0').ex).toBe(true);
  });
  it('nem követett ready belépés (Master Yi legend, [Level 11]): a felület megnevezi', () => {
    const x = run(cs({ lg: { A: 'Master Yi, Wuju Master' }, steps: [play('Shipyard Skulker')] }));
    expect(x.o('s0').ex).toBe(true);
    expect(x.text).toMatch(/nem követett ready belépés: Master Yi, Wuju Master/);
  });
  it('Bushwhack és Sun Disc felismerése', () => {
    expect(actOf('Friendly units enter ready this turn.').k).toBe('enterReady');
    expect(actOf('[Legion] \u2014 The next unit you play this turn enters ready.')).toMatchObject({ k: 'nextReady', cond: { how: 'state', key: 'played' } });
  });
});

describe('3. A belépés szövege az újrakijátszásnál és a hatásból kijátszásnál a tényleges okot írja', () => {
  it('Thrill of the Hunt Magma Wurm mellett: ready lép be, a forrás megnevezve', () => {
    const x = run(cs({ bd: [{ n: 'Magma Wurm', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Thrill of the Hunt', pl: 'A', tg: ['b1'], dest: 'bf1' }] }));
    expect(x.o('b1r').ex).toBe(false);
    expect(x.text).toMatch(/a unit ready lép be \(Magma Wurm/);
    expect(x.text).not.toMatch(/exhausted lép be \(143\.4\)/);
  });
  it('The Harrowing Magma Wurm mellett: ready lép be; nélküle exhausted (143.4)', () => {
    const a = run(cs({ bd: [{ n: 'Magma Wurm', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'The Harrowing', pl: 'A', plc: { 0: 'Mega-Mech' } }] }));
    expect(a.o('p0_0').ex).toBe(false);
    expect(a.text).toMatch(/ready lép be \(Magma Wurm/);
    const b = run(cs({ steps: [{ k: 'card', n: 'The Harrowing', pl: 'A', plc: { 0: 'Mega-Mech' } }] }));
    expect(b.text).toMatch(/exhausted lép be \(143\.4\)/);
  });
});
