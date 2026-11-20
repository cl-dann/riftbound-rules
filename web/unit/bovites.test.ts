/* Lefedettség bővítése: módválasztás, szorzók, replacement és Prevent, osztott damage, kijátszás hatásból, reflexív trigger.
   Ahol van hivatalos példa, a teszt elején exampleOf() ellenőrzi a rules.json szövegét. */
import { describe, expect, it } from 'vitest';
import { cs, run, exampleOf, ruleText } from './util';
import { stepInfo, actOf } from '../src/domain/chain/chainCore';
const k = (t: string) => actOf(t).k;

describe('1. Choose one: a builderben választott módot követi az elemzés', () => {
  it('820.2.a Rocket Barrage: "Kill a gear" mód', () => {
    exampleOf('820.2.a', 'Rocket Barrage');
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 1, tg: ['b0'] }] }));
    expect(x.zone('b0')).toBe('trash');
    const y = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 0, tg: ['b0'] }] }));
    expect(y.ev('dmg')).toEqual([{ k: 'dmg', id: 'b0', name: 'Mega-Mech', n: 4 }]);
  });
  it('a módok listája a builder választóhoz, és a mód a CS része (a linkbe is bekerül)', () => {
    const s = { k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 1, tg: [] };
    const inf: any = stepInfo(cs({ steps: [s] }), s);
    expect(inf.modes).toEqual(['Deal 4 to a unit in a base.', 'Kill a gear.']);
    expect(inf.eff).toBe('Kill a gear.');
    expect(JSON.parse(JSON.stringify(cs({ steps: [s] }))).steps[0].mode).toBe(1);
  });
  it('trigger módja (The Ball): "Deal 2 to enemy units here"', () => {
    const x = run(cs({ bd: [{ n: 'The Ball', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'base' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', mode: 1 }] }));
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b1', name: 'Shipyard Skulker', n: 2 }]);
  });
});

describe('2. "for each" szorzó a frame boardjáról', () => {
  it('418.8 Riven, Shattered: három Equipment, egyetlen 6 damage-es példány', () => {
    exampleOf('418.8', 'Riven, Shattered');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'B' }], bd: [{ n: 'Riven, Shattered', pl: 'A', loc: 'bf0' }, { n: 'Long Sword', pl: 'A', loc: 'bf0', on: 0 }, { n: 'Guardian Angel', pl: 'A', loc: 'bf0', on: 0 }, { n: 'Long Sword', pl: 'A', loc: 'bf0', on: 0 }, { n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'tg', src: 'b0', ti: 0, pl: 'A', tg: ['b4'] }] }));
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b4', name: 'Mountain Drake', n: 6 }]);
    expect(x.text).toMatch(/418\.8/);
  });
  it('Against the Odds: +2 minden ott álló enemy unitért, a számolt érték kiírva', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Vanguard Sergeant', pl: 'B', loc: 'bf0' }, { n: 'Recruit', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Against the Odds', pl: 'A', tg: ['b0'] }] }));
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b0', name: 'Shipyard Skulker', from: 3, to: 7 }]);
    expect(x.text).toMatch(/Szorzó: 2/);
  });
  it('Consuming Curse: a trashben lévő azonos nevű lapok Bonus Damage-et adnak (lapnál megadott korábbi + az elemzésben odakerült)', () => {
    const s = { k: 'card', n: 'Consuming Curse', pl: 'A', tg: [] };
    const I = (stepInfo(cs({ steps: [s] }), s) as any);
    expect(I.eff).toMatch(/for each card with this name/);
    const bd = [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }];
    const a = run(cs({ bd, steps: [{ k: 'card', n: 'Consuming Curse', pl: 'A', tg: ['b0'] }] }));
    const n0 = a.ev('dmg')[0].n;
    const b = run(cs({ bd, steps: [{ k: 'card', n: 'Consuming Curse', pl: 'A', tg: ['b0'], hv: { 1: 2 } }] }));
    expect(b.ev('dmg')[0].n).toBe(n0 + 2);
    expect(b.text).toMatch(/Bonus Damage: 2/);
  });
});

describe('3. Replacement és Prevent (367-375, 438)', () => {
  it('467.2.c.10 Counter Strike: a következő damage megelőzve, nem számít megtörténtnek (438.4)', () => {
    exampleOf('467.2.c.10', 'Counter Strike');
    expect(ruleText('438.4')).toMatch(/not considered to have been dealt/);
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Counter Strike', pl: 'B', tg: ['b0'] }] }));
    expect(x.ev('prevented')).toEqual([{ k: 'prevented', id: 'b0', name: 'Shipyard Skulker', n: 4 }]);
    expect(x.o('b0').dmg).toBe(0);
    const f = x.r.frames.find((q: any) => /^Resolve: Counter Strike/.test(q.label));
    expect(f.board.bfs[0].opp[0].status).toContain('shield');
  });
  it('438.3 Ki Barrier: 7 megelőzés, Singularity 6-ja elfogy, 1 marad', () => {
    expect(ruleText('438.3')).toMatch(/reduce the Prevent Value/);
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Singularity', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Ki Barrier', pl: 'B', tg: ['b0'] }] }));
    expect(x.o('b0').dmg).toBe(0);
    expect(x.o('b0').shields).toEqual([{ n: 1, next: false }]);
  });
  it('Lotus Trap: a damage duplázódik', () => {
    const x = run(cs({ bd: [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Lotus Trap', pl: 'A', tg: ['b0'] }] }));
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b0', name: 'Mountain Drake', n: 8 }]);
  });
  it('Highlander, Yi: a halál helyett gyógyul, exhausted, recall; az utasítás Negated', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0', d: 2 }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Highlander, Yi', pl: 'B', tg: ['b0'] }] }));
    expect(x.item(/^Vengeance/)!.instr[0].st).toBe('negated');
    expect(x.o('b0')).toMatchObject({ zone: 'board', loc: 'base', ex: true, dmg: 0 });
  });
  it('Smite: a cleanupban meghalna, helyette banishelődik', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Smite', pl: 'A', tg: ['b0'] }] }));
    expect(x.zone('b0')).toBe('banish');
  });
  it('"If ..., X instead": Ruthless Strike fizetett additional costtal 5, nélküle 3 damage', () => {
    const bd = [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0' }];
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Ruthless Strike', pl: 'A', addc: true, tg: ['b0'] }] })).ev('dmg')[0].n).toBe(5);
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Ruthless Strike', pl: 'A', tg: ['b0'] }] })).ev('dmg')[0].n).toBe(3);
  });
  it('Sudden Storm: az "attacking" feltétel a board attacker jelöléséből számolva', () => {
    const bd = [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0' }];
    expect(run(cs({ bd, steps: [{ k: 'card', n: 'Sudden Storm', pl: 'A', tg: ['b0'] }] })).ev('dmg')[0].n).toBe(2);
    expect(run(cs({ bd: [{ ...bd[0], atk: 'a' }], steps: [{ k: 'card', n: 'Sudden Storm', pl: 'A', tg: ['b0'] }] })).ev('dmg')[0].n).toBe(4);
  });
});

describe('4. Osztott damage (355.14)', () => {
  it('355.14.h.1 Alpha Strike: 3 damage maradt, legfeljebb 2 célpont eshet ki; a 3-at egy célpontra osztás szabálytalan', () => {
    exampleOf('355.14.h.1', 'Alpha Strike');
    const R = (pl: string) => ({ n: 'Recruit', pl, loc: 'bf0' });
    const x = run(cs({ bd: [{ n: 'Playful Phantom', pl: 'A', loc: 'bf0' }, R('B'), R('B'), R('B'), R('B'), R('B')], steps: [
      { k: 'card', n: 'Alpha Strike', pl: 'A', tg: ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'], split: { 1: 3 } },
      { k: 'card', n: 'Feral Strength', pl: 'B', tg: ['b1'] },
      { k: 'card', n: 'Frigid Touch', pl: 'B', tg: ['b0'] }] }));
    expect(x.ev('dmg').map((e: any) => e.n)).toEqual([1, 1, 1]);
    expect(x.text).toMatch(/355\.14\.h\.1/);
    expect(x.zone('b1')).toBe('board');
    expect(['b2', 'b3'].map(x.zone)).toEqual(['trash', 'trash']);
    expect(x.ev('xp')).toHaveLength(2);
  });
  it('a megadott kiosztást követi, ha szabályos', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Scorched Earth', pl: 'A', tg: ['b0', 'b1'], split: { 0: 2, 1: 3 } }] }));
    expect(x.ev('dmg').map((e: any) => [e.id, e.n])).toEqual([['b0', 2], ['b1', 3]]);
  });
});

describe('5. Kijátszás hatásból (420.3)', () => {
  it('Thrill of the Hunt: a banishelt unit új objektumként a választott battlefieldre kerül, exhausted (359.3.e.4, 143.4); a rá célzó Void Seeker mistargetel', () => {
    expect(ruleText('359.3.e.4')).toMatch(/not treated as the same object/);
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0', d: 3 }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Thrill of the Hunt', pl: 'B', tg: ['b0'], dest: 'bf1' }] }));
    expect(x.o('b0r')).toMatchObject({ zone: 'board', loc: 'bf1', dmg: 0, ex: true, ctrl: 'B' });
    expect(x.item(/^Void Seeker/)!.instr[0].st).toBe('ignored');
  });
  it('The Harrowing: a megadott unit a trashből a base-be kerül; a Kennen legend triggerel (nem kézből)', () => {
    const x = run(cs({ lg: { A: 'Kennen, Heart of the Tempest' }, steps: [{ k: 'card', n: 'The Harrowing', pl: 'A', plc: { 0: 'Mega-Mech' } }] }));
    expect(x.o('p0_0')).toMatchObject({ name: 'Mega-Mech', zone: 'board', loc: 'base', ex: true });
    expect(x.ev('empower')).toHaveLength(1);
  });
  it('135.2.b.7: a hatásból kijátszott Back Off nem kézből jött, a "draw 1" elmarad', () => {
    exampleOf('135.2.b.7', 'Back Off');
    const x = run(cs({ steps: [{ k: 'card', n: 'Fizz, Trickster', pl: 'A', loc: 'base', plc: { 0: 'Back Off' } }] }));
    const bo = x.item(/Back Off/)!;
    expect(bo.instr.find((i: any) => /from your hand/.test(i.t)).st).toBe('skipped');
    expect(x.ev('draw')).toHaveLength(0);
  });
  it('kijátszandó lap megadása nélkül a felület kéri az adatot', () => {
    const x = run(cs({ steps: [{ k: 'card', n: 'The Harrowing', pl: 'A' }] }));
    expect(x.text).toMatch(/Melyik lap\? Add meg a builderben/);
  });
  it('388 "Then do this": reflexív trigger, a spell után külön chain elemként resolve-ol', () => {
    expect(ruleText('388.1')).toMatch(/Do this:/);
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: "Dragon's Rage, Lee Sin", pl: 'A', tg: ['b0', 'b1'], dest: 'base' }] }));
    expect(x.r.done.map((d: any) => d.name)).toEqual(["Dragon's Rage, Lee Sin", "Dragon's Rage, Lee Sin reflexív triggere"]);
  });
});

describe('6. A maradék gyakori minták (biztonsággal felismerhetők)', () => {
  it('felismerés: Mighty és battlefield szorzó, alap Might, keyword érték, megjelölt damage, Might csere, pakliba helyezés, célozhatatlanság, egyéb', () => {
    expect(actOf('Draw 1 for each of your [Mighty] units.').each.cnt).toMatchObject({ mighty: true });
    expect(actOf('draw 1 for each battlefield you or allies control.').each.cnt).toMatchObject({ bfs: true });
    expect(actOf('Its base Might becomes 5 this turn.')).toMatchObject({ k: 'setbase', n: 5 });
    expect(actOf('you may deal damage equal to my [Shield] to a unit at a battlefield.')).toMatchObject({ k: 'dmgKw', kw: 'Shield', who: 'self' });
    expect(k('deal damage to a unit equal to the damage marked on it.')).toBe('dmgMarked');
    expect(k('Swap the Mights of two units at the same battlefield this turn.')).toBe('swapMight');
    expect(k('Its owner places it on the top or bottom of their Main Deck.')).toBe('todeck');
    expect(k("It can't be chosen by enemy spells and abilities this turn.")).toBe('untgt');
    expect(k('Then, choose an opponent.')).toBe('choose');
    expect(actOf('It gains [Shield 2] this combat.')).toMatchObject({ k: 'kw', kw: 'Shield', n: 2 });
    expect(k('Empower another gear.')).toBe('empower');
    expect(k('put the top 2 cards of your Main Deck into your trash.')).toBe('deck');
    expect(k("This can't be countered.")).toBe('perm');
    expect(k('Take a turn after this one.')).toBe('extraturn');
    expect(actOf('that player gains 1 point.')).toMatchObject({ k: 'score', n: 1 });
    expect(actOf('Give a unit \u2013[S] this turn equal to the number of exhausted units you control.')).toMatchObject({ k: 'might', n: -1 });
    expect(actOf('Each player discards 1.')).toMatchObject({ k: 'discard', n: 1, eachPlayer: true });
    expect(actOf('[Legion] \u2014 Kill it now instead.')).toMatchObject({ k: 'kill', alt: true });
    expect(actOf('if you have 7+ units here, you win the game.')).toMatchObject({ k: 'win', cond: { how: 'board' } });
  });
  it('Show of Strength: annyi lapot húz, ahány Mighty saját unit van', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }, { n: 'Playful Phantom', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'base' }, { n: 'Mountain Drake', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Show of Strength', pl: 'A' }] }));
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'A', n: 2 }]);
  });
  it('Dragon Form: az alap Might 5 lesz, a buff ezen felül számít', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', bu: true }], steps: [{ k: 'card', n: 'Dragon Form', pl: 'A', tg: ['b0'] }] }));
    expect(x.r.frames.at(-1).board.me.base[0].m).toBe(6);
  });
  it('Ntofo Strikes: a kapott [Shield 2] értékével sebez', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Ntofo Strikes', pl: 'A', tg: ['b0', 'b1'] }] }));
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b1', name: 'Mountain Drake', n: 2 }]);
  });
  it('Switcheroo: a két unit Mightja felcserélődik (434.1)', () => {
    expect(ruleText('434.1')).toMatch(/their values are reversed/);
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Switcheroo', pl: 'A', tg: ['b0', 'b1'] }] }));
    expect(x.ev('might').map((e: any) => [e.id, e.to])).toEqual([['b0', 10], ['b1', 3]]);
  });
  it('Twilight Shroud: +1 Might, és a kör hátralevő részében enemy spell nem választhatja (757.1, 758.1)', () => {
    expect(ruleText('758.1')).toMatch(/will mistarget on resolution/);
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Twilight Shroud', pl: 'A', tg: ['b0'] }] }));
    expect(x.o('b0').untgt).toBe(true);
    expect(x.ev('might')).toHaveLength(1);
    expect(x.text).toMatch(/757\.1, 758\.1/);
  });
  it("Keeper's Verdict: a unit a tulajdonosa paklijába kerül, a csatolt gear leválik", () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Long Sword', pl: 'B', loc: 'bf0', on: 0 }], steps: [{ k: 'card', n: "Keeper's Verdict", pl: 'A', tg: ['b0'] }] }));
    expect(x.zone('b0')).toBe('deck');
    expect(x.ev('detach')).toHaveLength(1);
  });
  it('High Note: annyi Might csökkentés, ahány exhausted saját unit van', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base', ex: true }, { n: 'Vanguard Sergeant', pl: 'A', loc: 'base', ex: true }, { n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'High Note', pl: 'A', tg: ['b2'] }] }));
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b2', name: 'Mountain Drake', from: 10, to: 8 }]);
  });
});
