/* A builder beépített példái és a korábban kipróbált helyzetek. */
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/domain/chain/examples';
import { cs, run } from './util';

describe('Beépített példák', () => {
  it('"Példa betöltése": Star-Crossed visszaviszi Rexet és a Merchantet, a Long Sword leválik és a base-be kerül, Flash és Rex triggere mistargetel', () => {
    const x = run(EXAMPLES.base());
    expect(x.r.frames.map((f: any) => f.label)).toEqual(['Kiinduló helyzet', 'Te: kijátszás, Riptide Rex', 'Ellenfél: kijátszás, Flash', 'Te: kijátszás, Star-Crossed',
      'Resolve: Star-Crossed, lefutott', 'Cleanup: Long Sword recall', 'Resolve: Flash, hatás nélkül', 'Resolve: Riptide Rex (play trigger), hatás nélkül', 'Végállapot: a chain üres']);
    expect(x.zone('s0')).toBe('hand');
    expect(x.zone('b0')).toBe('hand');
    expect(x.o('b1')).toMatchObject({ zone: 'board', loc: 'base', on: null });
    expect(x.item(/^Flash/)!.res).toBe('fizzle');
    expect(x.item(/Riptide Rex/)!.res).toBe('fizzle');
    // a Kennen legend nem triggerel: minden lap kézből jött
    expect(x.ev('empower')).toHaveLength(0);
    // a leválás külön látható: a resolve frame-ben a gear a battlefielden, "detached" jelzéssel
    const f = x.r.frames[4];
    expect(f.board.bfs[0].opp.find((u: any) => u.n === 'Long Sword').status).toContain('detached');
    expect(f.changes.some((c: any) => /^719\.5/.test(c[0]))).toBe(true);
  });
  it('Kontrollváltás példa: Hostile Takeover után Yasuo az ellenfél oldalán áll, a trigger mégis lefut', () => {
    const x = run(EXAMPLES.ctrl());
    const after = x.r.frames.find((f: any) => /^Resolve: Hostile Takeover/.test(f.label));
    expect(after.board.bfs[0].opp.map((u: any) => u.n)).toContain('Yasuo, Remorseful');
    expect(after.board.bfs[0].opp.find((u: any) => u.n === 'Yasuo, Remorseful').status).toContain('ctrlnew');
    expect(x.zone('b1')).toBe('trash');
    expect(x.r.delayed).toHaveLength(1);
  });
  it('Gear példa: a csatolatlan Guardian Angel gearként jelenik meg, Akshan halála után a Long Sword leválik', () => {
    const x = run(EXAMPLES.gear());
    const f0 = x.r.frames[0];
    expect(f0.board.opp.base[0]).toMatchObject({ n: 'Guardian Angel', kind: 'gear' });
    expect(f0.board.bfs[0].me[0].gear).toEqual(['Long Sword']);
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'A', n: 2 }]);
    expect(x.o('b1').loc).toBe('base');
  });
});

describe('Korábban kipróbált helyzetek', () => {
  it('Hidden Blade kézből válaszként nem játszható ki (nincs [Reaction], csak facedown-ból kap, 811.6)', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Hidden Blade', pl: 'B', from: 'hand', tg: ['b0'] }] }));
    expect(x.text).toMatch(/Nem szabályos.*nem \[Reaction\]/);
  });
  it('Akshan: fizetett additional cost, az ellenfél gearje a base-ébe kerül, irányítja és felcsatolja', () => {
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Akshan, Mischievous', pl: 'A', loc: 'base', addc: true, tg: ['b0'] }] }));
    expect(x.o('b0')).toMatchObject({ ctrl: 'A', own: 'B', on: 's0', loc: 'base' });
    expect(x.r.frames.at(-1).board.me.base.find((u: any) => u.n === 'Akshan, Mischievous').m).toBe(6);
  });
  it('Akshan additional cost nélkül: a play effect nem triggerel (383.2.a.1)', () => {
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Akshan, Mischievous', pl: 'A', loc: 'base', tg: ['b0'] }] }));
    expect(x.text).toMatch(/383\.2\.a\.1/);
    expect(x.o('b0').ctrl).toBe('B');
  });
  it('Sacrifice Akshan triggerére válaszként: Mighty friendly unit a költség, utána draw 2 és channel 1', () => {
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }, { n: 'Playful Phantom', pl: 'A', loc: 'base' }], steps: [
      { k: 'card', n: 'Akshan, Mischievous', pl: 'A', loc: 'base', addc: true, tg: ['b0'] }, { k: 'card', n: 'Sacrifice', pl: 'A', costTg: 'b1' }] }));
    expect(x.zone('b1')).toBe('trash');
    expect(x.ev('cost')).toEqual([{ k: 'cost', id: 'b1' }]);
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'A', n: 2 }]);
    expect(x.ev('channel')).toEqual([{ k: 'channel', pl: 'A', n: 1 }]);
    expect(x.o('b0').ctrl).toBe('A');
  });
  it('Sacrifice nem Mighty unittal (Akshan, 4 Might) nem szabályos (708)', () => {
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }], steps: [
      { k: 'card', n: 'Akshan, Mischievous', pl: 'A', loc: 'base', addc: true, tg: ['b0'] }, { k: 'card', n: 'Sacrifice', pl: 'A', costTg: 's0' }] }));
    expect(x.text).toMatch(/Nem szabályos.*nem Mighty/);
  });
  it('Kennen, Keeper of Balance facedown-ból: a legend empowerel, a play effect stunol, Kennen +2 Mightot kap', () => {
    const x = run(cs({ lg: { A: 'Kennen, Heart of the Tempest' }, bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Kennen, Keeper of Balance', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(x.ev('empower')).toEqual([{ k: 'empower', id: 'LA', name: 'Kennen, Heart of the Tempest' }]);
    expect(x.o('b0').st).toBe(true);
    expect(x.r.frames.at(-1).board.bfs[0].me.find((u: any) => u.n === 'Kennen, Keeper of Balance').m).toBe(4);
    // a legend triggere került fel később, ezért az fut le előbb
    expect(x.r.done.map((d: any) => d.name)).toEqual(['Kennen, Heart of the Tempest triggere', 'Kennen, Keeper of Balance (play trigger)']);
  });
  it('Kennen legend abilityje nem Empowered állapotban nem aktiválható', () => {
    const x = run(cs({ lg: { A: 'Kennen, Heart of the Tempest' }, bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'ab', src: 'LA', ai: 0, n: 'Kennen, Heart of the Tempest', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).toMatch(/Nem szabályos.*Disempower/);
  });
  it('403.4: célpont nélkül maradó trigger lekerül a chainről', () => {
    const x = run(cs({ bd: [{ n: 'Yasuo, Remorseful', pl: 'A', loc: 'bf0' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', tg: [] }] }));
    expect(x.text).toMatch(/403\.4/);
    expect(x.r.done).toHaveLength(0);
  });
  it('809.1.c: Deflectes lap választása plusz költség', () => {
    const x = run(cs({ bd: [{ n: 'Draven, Audacious', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).toMatch(/809\.1\.c.*Deflect: Draven, Audacious \(1\)/);
  });
  it('Combat utáni trigger célponttal és legalitás-ellenőrzéssel', () => {
    const cb = { bf: 'bf0', dead: [], recall: [], ctrl: '', label: 'teszt' };
    const ok = run(cs({ bd: [{ n: 'Yasuo, Remorseful', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'tr', n: 'Riptide Rex', src: 'b0', pl: 'A', eff: 'deal 6 to an enemy unit at a battlefield.', why: 'Conquer', tg: ['b1'], cb }] }));
    expect(ok.ev('dmg')).toEqual([{ k: 'dmg', id: 'b1', name: 'Mega-Mech', n: 6 }]);
    const bad = run(cs({ bd: [{ n: 'Yasuo, Remorseful', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'tr', n: 'Riptide Rex', src: 'b0', pl: 'A', eff: 'deal 6 to an enemy unit at a battlefield.', why: 'Conquer', tg: ['b1'], cb }] }));
    expect(bad.changes).toMatch(/403\.4/);
    expect(bad.ev('dmg')).toHaveLength(0);
  });
});
