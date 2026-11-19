/* A második független ellenőrzés javításai (szabályszámok a rules.json szövegével ellenőrizve). */
import { describe, expect, it } from 'vitest';
import { cs, run, ruleText, exampleOf } from './util';
import { actOf, classOf } from '../src/legacy/chainCore';

const R = (pl: string, loc = 'bf0') => ({ n: 'Recruit', pl, loc });

describe('1. 143.4: minden unit exhausted lép be, kivétel 143.4.a', () => {
  it('a kijátszott unit exhausted, Upstage Comedy readyzi (végrehajtódik, nem Negated)', () => {
    expect(ruleText('143.4')).toMatch(/Units enter the Board exhausted/);
    const a = run(cs({ steps: [{ k: 'card', n: 'Shipyard Skulker', pl: 'A', loc: 'base' }] }));
    expect(a.o('s0').ex).toBe(true);
    const x = run(cs({ steps: [{ k: 'card', n: 'Shipyard Skulker', pl: 'A', loc: 'base' }, { k: 'card', n: 'Upstage Comedy', pl: 'A', tg: ['s0'] }] }));
    expect(x.item(/Upstage Comedy/)!.instr[0].st).toBe('executed');
    expect(x.o('s0').ex).toBe(false);
  });
  it('143.4.a: kifizetett Accelerate esetén ready lép be (805.6)', () => {
    expect(ruleText('143.4.a')).toMatch(/Accelerate/);
    const x = run(cs({ steps: [{ k: 'card', n: 'Ancient Warmonger', pl: 'A', loc: 'base', accel: true }] }));
    expect(x.o('s0').ex).toBe(false);
    expect(x.text).toMatch(/143\.4\.a/);
  });
  it('Confront: "Units you play this turn enter ready" folyamatos hatásként felismerve (143.4.a)', () => {
    expect(actOf('Units you play this turn enter ready.').k).toBe('enterReady');
    const x = run(cs({ steps: [{ k: 'card', n: 'Confront', pl: 'A' }] }));
    expect(x.text).toMatch(/ready lépnek be \(143\.4\.a\)/);
  });
});

describe('2. Osztott damage célpontszáma (355.14.c, 715.3)', () => {
  it('Scorched Earth 5 damage 6 célponttal szabálytalan; Annie, Fiery mellett (6 damage) szabályos', () => {
    expect(ruleText('355.14.c')).toMatch(/not exceeding, the initial amount of damage/);
    expect(ruleText('715.3')).toMatch(/alter the number of targets/);
    const bd = [R('B'), R('B'), R('B'), R('B'), R('B'), R('B')];
    const tg = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'];
    const bad = run(cs({ bd, steps: [{ k: 'card', n: 'Scorched Earth', pl: 'A', tg }] }));
    expect(bad.text).toMatch(/Nem szabályos.*355\.14\.c/);
    const ok = run(cs({ bd: [...bd, { n: 'Annie, Fiery', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Scorched Earth', pl: 'A', tg }] }));
    expect(ok.text).not.toMatch(/Nem szabályos/);
    expect(ok.ev('dmg')).toHaveLength(6);
  });
});

describe('3-4. Duplázás és Prevent sorrendje (372, 467.2.c.5), teljes megelőzés Negated', () => {
  it('mindkét sorrend eredménye kiírva, a unit controllere dönt, a 372 mindig megjelenik', () => {
    exampleOf('467.2.c.5', 'Lotus Trap');
    expect(ruleText('372')).toMatch(/controller of the object being acted on determines the order/);
    expect(ruleText('433.1.b')).toMatch(/Doubled/);
    const x = run(cs({ bd: [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Lotus Trap', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Ki Barrier', pl: 'B', tg: ['b0'] }] }));
    expect(x.text).toMatch(/Prevent előbb 0 damage \(megmaradó Prevent: 3\), duplázás előbb 1 damage \(megmaradó Prevent: 0\)/);
    expect(x.text).toMatch(/372/);
    expect(x.item(/^Void Seeker/)!.instr[0].st).toBe('negated');
  });
  it('teljesen megelőzött damage: a Deal utasítás Negated (438.2, 438.4, 359.3.e.14.b)', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Counter Strike', pl: 'B', tg: ['b0'] }] }));
    expect(x.item(/^Void Seeker/)!.instr.map((i: any) => i.st)).toEqual(['negated', 'executed']);
  });
});

describe('5. Szabályszámok', () => {
  it('Choose one: 355.3; extra kör: 735; Smite: 383.2.c.3.a', () => {
    expect(ruleText('355.3')).toMatch(/bulleted list of modes/);
    expect(ruleText('735')).toMatch(/take a turn after this/);
    const rb = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 1, tg: ['b0'] }] }));
    expect(rb.text).toMatch(/^355\.3 Választott mód/m);
    const tw = run(cs({ steps: [{ k: 'card', n: 'Time Warp', pl: 'A' }] }));
    expect(tw.r.html).toMatch(/extra kör \(735\)/);
    const sm = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Smite', pl: 'A', tg: ['b0'] }] }));
    expect(sm.changes + sm.text).toMatch(/383\.2\.c\.3\.a/);
    expect(sm.changes + sm.text).not.toMatch(/808\.1\.d\.1/);
  });
});

describe('6. Alpha Strike: a kiválasztott unit kiesik, a Might null (359.3.e.12)', () => {
  it('az osztott damage utasítás Ignored a 359.3.e.12 miatt, nem "minden célpontja illegális"', () => {
    expect(ruleText('359.3.e.12')).toMatch(/returns "null"/);
    const x = run(cs({ bd: [{ n: 'Playful Phantom', pl: 'A', loc: 'bf0' }, R('B'), R('B')], steps: [
      { k: 'card', n: 'Alpha Strike', pl: 'A', tg: ['b0', 'b1', 'b2'] }, { k: 'card', n: 'Retreat', pl: 'A', tg: ['b0'] }] }));
    const I = x.item(/Alpha Strike/)!.instr;
    expect(I[1].st).toBe('ignored');
    expect(I[1].ref).toMatch(/359\.3\.e\.12/);
    expect(x.text).not.toMatch(/minden célpontja illegális/);
    expect(x.ev('dmg')).toHaveLength(0);
  });
});

describe('7. Rosszul felismert minták', () => {
  it('Last Caress: "When you play it, [Buff] it." delayed trigger buff', () => {
    expect(actOf('When you play it, [Buff] it.')).toMatchObject({ k: 'delayed', inner: 'buff' });
    expect(actOf('The next unit you play this turn, even from face down, can be played to any battlefield.').k).toBe('perm');
  });
  it('Chronobreak: az "As an additional cost ... pay any amount of Power" költség, a "that many" bizonytalan', () => {
    expect(actOf('As an additional cost to play this, pay any amount of Power.').k).toBe('cost');
    expect(actOf('Banish that many units you control').unsure).toMatch(/that many/);
  });
  it('Overt Operation: a buff elköltése és ready, majd buff all', () => {
    expect(actOf('For each friendly unit, you may spend its buff to ready it.').k).toBe('spendBuffReady');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', bu: true, ex: true }, { n: 'Mega-Mech', pl: 'A', loc: 'base', ex: true }], steps: [{ k: 'card', n: 'Overt Operation', pl: 'A' }] }));
    expect(x.o('b0')).toMatchObject({ ex: false, bu: true });
    expect(x.o('b1')).toMatchObject({ ex: true, bu: true });
  });
  it('Neeko, Blending In: nem Choose one mód; Decree of Insight: költségmódosítás', () => {
    expect(actOf("choose one of those Legends and add it to your Legend Zone while I'm on the board.").k).not.toBe('modal');
    expect(actOf("Ignore [Deflect] while paying this spell's cost.").k).toBe('costmod');
    expect(classOf("Ignore [Deflect] while paying this spell's cost.")).toBe('known');
  });
});
