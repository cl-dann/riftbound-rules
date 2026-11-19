/* A független ellenőrzés által talált hibák javításának tesztjei (szabályszámok a rules.json szövegével ellenőrizve). */
import { describe, expect, it } from 'vitest';
import { cs, run, exampleOf, ruleText } from './util';
import { check, DEF_OPT, type CU, type Opt } from '../src/components/combatCore';

const sentry = (pl: string, loc = 'bf0') => ({ n: 'Watchful Sentry', pl, loc });

describe('1. "When you play a spell" a spell resolve-jakor triggerel (420.4.a)', () => {
  it('a trigger a spell után kerül a chainre és utána resolve-ol', () => {
    expect(ruleText('420.4.a')).toMatch(/completed by the resolution of the card/);
    const x = run(cs({ bd: [{ n: 'Ravenbloom Student', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b1'] }] }));
    expect(x.r.done.map((d: any) => d.name)).toEqual(['Void Seeker', 'Ravenbloom Student triggere']);
    expect(x.r.frames[1].board.chain).toEqual(['Void Seeker']);
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b0', name: 'Ravenbloom Student', from: 2, to: 3 }]);
  });
  it('counterelt spellnél nem triggerel (420.4.a.1, 426.1.b)', () => {
    expect(ruleText('420.4.a.1')).toMatch(/countered/);
    const x = run(cs({ bd: [{ n: 'Ravenbloom Student', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b1'] }, { k: 'card', n: 'Wind Wall', pl: 'B', tg: ['s0'] }] }));
    expect(x.item(/^Void Seeker/)!.res).toBe('countered');
    expect(x.ev('might')).toHaveLength(0);
    expect(x.text).toMatch(/420\.4\.a\.1/);
  });
  it('359.3.e.10: minden célpont illegális, a spell mégis kijátszottnak számít, a trigger lefut', () => {
    exampleOf('359.3.e.10', 'still triggers as the spell resolves');
    const x = run(cs({ bd: [{ n: 'Ravenbloom Student', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b1'] }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b1'] }] }));
    expect(x.item(/^Void Seeker/)!.instr[0].st).toBe('ignored');
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b0', name: 'Ravenbloom Student', from: 2, to: 3 }]);
  });
  it('unitnál a kijátszás azonnal befejeződik (337.2), a trigger rögtön a chainre kerül', () => {
    const x = run(cs({ lg: { A: 'Kennen, Heart of the Tempest' }, bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Kennen, Keeper of Balance', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(x.r.frames[1].board.chain.length).toBe(2);
  });
});

describe('2-3. Play effect célpontja: önmaga is lehet (355.9.c), legális választás kötelező (403.4.b)', () => {
  it('a kijátszott unit play effectje önmagát célozhatja', () => {
    expect(ruleText('355.9.c')).toMatch(/An ability of a permanent can target that permanent/);
    const x = run(cs({ steps: [{ k: 'card', n: 'Blastcone Fae', pl: 'A', loc: 'base', tg: ['s0'] }] }));
    expect(x.text).not.toMatch(/nem legális|Nem szabályos/);
    expect(x.ev('might')).toEqual([{ k: 'might', id: 's0', name: 'Blastcone Fae', from: 2, to: 1 }]);
  });
  it('ha nincs legális választás, a trigger lekerül (403.4), a unit kint marad', () => {
    expect(ruleText('403.4.b')).toMatch(/must choose them/);
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Riptide Rex', pl: 'A', loc: 'base', tg: [] }] }));
    expect(x.text).toMatch(/403\.4\.b/);
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b0', name: 'Shipyard Skulker', n: 6 }]);
    const y = run(cs({ steps: [{ k: 'card', n: 'Riptide Rex', pl: 'A', loc: 'base', tg: [] }] }));
    expect(y.text).toMatch(/403\.4/);
    expect(y.zone('s0')).toBe('board');
    expect(y.r.done).toHaveLength(0);
  });
});

describe('4. Egyszerre triggerelő abilityk sorrendje (383.3.d, 383.3.d.1)', () => {
  it('különböző controller: a turn player teszi fel először a sajátját, így az ellenfélé resolve-ol előbb', () => {
    expect(ruleText('383.3.d.1')).toMatch(/starting with the Turn Player/);
    const x = run(cs({ turn: 'A', bd: [sentry('A'), sentry('B')], steps: [{ k: 'card', n: 'The Ruination', pl: 'A' }]}));
    expect(x.text).toMatch(/383\.3\.d\.1/);
    expect(x.ev('draw').map((e: any) => e.pl)).toEqual(['B', 'A']);
  });
  it('a turn player átállítható: az ellenfél körében fordított a sorrend', () => {
    const x = run(cs({ turn: 'B', bd: [sentry('A'), sentry('B')], steps: [{ k: 'card', n: 'The Ruination', pl: 'A' }]}));
    expect(x.ev('draw').map((e: any) => e.pl)).toEqual(['A', 'B']);
  });
  it('azonos controller: a sorrendet a játékos választja, ezt a felület kiírja', () => {
    expect(ruleText('383.3.d')).toMatch(/selects the order/);
    const x = run(cs({ bd: [sentry('B'), sentry('B', 'bf1')], steps: [{ k: 'card', n: 'The Ruination', pl: 'A' }] }));
    expect(x.text).toMatch(/383\.3\.d .*A sorrendet az ellenfél választja/);
  });
});

describe('5-6. Automatikus triggerek és a Deathknell lekerülése', () => {
  it('automatikus trigger sora a forrás nevét írja, nem "undefined"-et', () => {
    const x = run(cs({ bd: [sentry('B')], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).not.toMatch(/undefined/);
    expect(x.text).toMatch(/Watchful Sentry triggere \(Deathknell\) resolve-ol/);
  });
  it('808.1.d.1: nem a trashbe került forrás Deathknellje lekerül; a trashbe került forrásé lefut', () => {
    expect(ruleText('808.1.d.1')).toMatch(/is not sent to the Trash/);
    const alive = run(cs({ bd: [sentry('B')], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'B' }] }));
    expect(alive.r.done[0].res).toBe('removed');
    expect(alive.ev('draw')).toHaveLength(0);
    const dead = run(cs({ bd: [sentry('B')], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }] }));
    expect(dead.ev('draw')).toEqual([{ k: 'draw', pl: 'B', n: 1 }]);
  });
});

describe('7-8. Szabályszámok és szövegek', () => {
  it('nem [Reaction] ability válaszként: 358.4, 338.1.a.1, 813.1.c.2', () => {
    expect(ruleText('813.1.c.2')).toMatch(/Activated Abilities/);
    const x = run(cs({ lg: { A: 'Kennen, Heart of the Tempest' }, bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Void Seeker', pl: 'B', tg: ['b0'] }, { k: 'ab', src: 'LA', ai: 0, n: 'Kennen, Heart of the Tempest', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).toMatch(/358\.4, 338\.1\.a\.1, 813\.1\.c\.2 Nem szabályos/);
  });
  it('kontrollszerzés: 191, nem 359.3.e.16', () => {
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Hostile Takeover', pl: 'A', tg: ['b0'] }] }));
    expect(x.changes).toMatch(/^191 Mega-Mech: az irányítója/m);
    expect(x.changes).not.toMatch(/^191, 359\.3\.e\.16/m);
  });
  it('a delayed trigger a megadott időpontban kerül chainre (391.2, 392)', () => {
    expect(ruleText('392')).toMatch(/only during the specified time/);
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Hostile Takeover', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).toMatch(/akkor kerül a chainre \(391\.2, 392\)/);
  });
  it('a kijátszás közben keletkezett trigger: 337.1.b, 359.3.b, 340.1', () => {
    const x = run(cs({ bd: [sentry('A', 'base')], steps: [{ k: 'card', n: 'Cruel Patron', pl: 'A', loc: 'base', costTg: 'b0' }] }));
    expect(x.text).toMatch(/337\.1\.b, 359\.3\.b, 340\.1 A kijátszás közben/);
  });
  it('combat utáni nem Conquer trigger: 383.3, nem 383.4.c.2', () => {
    const cb = { bf: 'bf0', dead: [], recall: [], ctrl: '', label: 't' };
    const x = run(cs({ bd: [{ n: 'Yasuo, Remorseful', pl: 'A', loc: 'bf0' }], steps: [{ k: 'tr', n: 'Yasuo, Remorseful', src: 'b0', pl: 'A', eff: 'draw 1.', why: 'egyéb', tg: [], cb }] }));
    expect(x.changes).toMatch(/^383\.3 Yasuo/m);
  });
});

describe('9. Már ready, már exhausted, már csatolt: a game action nem hajtható végre, Negated', () => {
  it('ready a már ready unitra: Negated (416.1.b, 359.3.e.6)', () => {
    expect(ruleText('416.1.b')).toMatch(/cannot be Readied again/);
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Ride the Wind', pl: 'A', tg: ['b0'], dest: 'base' }] }));
    expect(x.item(/Ride the Wind/)!.instr.map((i: any) => i.st)).toEqual(['executed', 'negated']);
    expect(x.text).toMatch(/416\.1\.b/);
    expect(x.text).not.toMatch(/nyitott kérdés/);
  });
  it('"if you do" a már exhausted lap exhaustja után nem hajtódik végre (415.1.b, 359.3.e.14.b)', () => {
    expect(ruleText('415.1.b')).toMatch(/cannot be Exhausted again/);
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0', ex: true }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Deathgrip', pl: 'A', tg: ['b0', 'b1'], ov: { 0: { k: 'exhaust' } } }] }));
    expect(x.item(/Deathgrip/)!.instr.map((i: any) => i.st)).toEqual(['negated', 'skipped', 'executed']);
    expect(x.ev('might')).toHaveLength(0);
  });
  it('"if you do" a már ready unit readyzése után nem hajtódik végre (416.1.b, 359.3.e.14.b)', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Deathgrip', pl: 'A', tg: ['b0', 'b1'], ov: { 0: { k: 'ready' } } }] }));
    expect(x.item(/Deathgrip/)!.instr.map((i: any) => i.st)).toEqual(['negated', 'skipped', 'executed']);
  });
  it('Equip a már rajta lévő gearre: Negated, levezetés címkével (435.1.g, 435.1.i)', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }, { n: 'Long Sword', pl: 'A', loc: 'base', on: 0 }], steps: [{ k: 'ab', src: 'b1', ai: 0, n: 'Long Sword', pl: 'A', tg: ['b0'] }] }));
    expect(x.item(/Long Sword/)!.instr[0].st).toBe('negated');
    expect(x.r.html).toMatch(/435\.1\.i[\s\S]*?class="fl f1"/);
  });
  it('buff a már buffolt unitra: Negated (427.1.b.1, 427.1.c)', () => {
    expect(ruleText('427.1.b.1')).toMatch(/does not get another one/);
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0', bu: true }], steps: [{ k: 'card', n: 'Stand United', pl: 'A', tg: ['b0'] }] }));
    expect(x.item(/Stand United/)!.instr[0].st).toBe('negated');
    expect(x.text).toMatch(/427\.1\.b\.1/);
  });
});

describe('B-C. "You may" spellnél és a 403.4.b sor helye', () => {
  it('spell "you may": a döntés a resolve-kor (355.18, 355.12), szabály, nem levezetés', () => {
    expect(ruleText('355.18')).toMatch(/made on resolution/);
    expect(ruleText('355.12')).toMatch(/may perform a Game Action/);
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Salvage', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).toMatch(/355\.18, 355\.12 "You may"/);
    expect(x.text).not.toMatch(/359\.3\.d "You may"/);
  });
  it('a 403.4.b sor a "Kijátszod" sor után jön', () => {
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Riptide Rex', pl: 'A', loc: 'base', tg: [] }] }));
    const i1 = x.text.indexOf('Kijátszod a Riptide Rex'), i2 = x.text.indexOf('403.4.b, 403.2');
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
  });
});

describe('10. "When another unit you control dies" (Viktor, Leader)', () => {
  it('Viktor triggerel, ha egy másik saját, nem Recruit unit meghal', () => {
    const x = run(cs({ bd: [{ n: 'Viktor, Leader', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'B', tg: ['b1'] }] }));
    expect(x.item(/Viktor/)!.res).toBe('ok');
    expect(x.ev('token')).toHaveLength(1);
  });
  it('383.2.c.2: ha Viktor ugyanabban a cleanupban hal meg, nem triggerel', () => {
    exampleOf('383.2.c.2', 'Unchecked Power');
    const x = run(cs({ bd: [{ n: 'Viktor, Leader', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Singularity', pl: 'B', tg: ['b0', 'b1'] }] }));
    expect(x.zone('b0')).toBe('trash');
    expect(x.zone('b1')).toBe('trash');
    expect(x.r.items.some((i: any) => /Viktor/.test(i.name))).toBe(false);
  });
  it('enemy unit halála nem triggereli; a fel nem ismert halál-trigger jelölve', () => {
    const x = run(cs({ bd: [{ n: 'Viktor, Leader', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Altar of Memories', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b1'] }] }));
    expect(x.r.items.some((i: any) => /Viktor/.test(i.name))).toBe(false);
    expect(x.r.items.some((i: any) => /Altar of Memories/.test(i.name))).toBe(false);
  });
});

describe('11. Tank és Backline csak azonos controller között (815.1.b, 826.3)', () => {
  const u = (id: string, m: number, ctrl: string, o: Partial<Opt> = {}): CU => ({ id, uid: id, n: id, side: 'opp', ctrl, m, dmg: 0, stun: false, opt: { ...DEF_OPT, ...o }, sugs: [] });
  it('más controller Tank unitja nem köti a kiosztást', () => {
    expect(ruleText('815.1.b')).toMatch(/with the same controller as me/);
    expect(ruleText('826.3')).toMatch(/with the same controller as me/);
    expect(check([u('T', 2, 'B', { tank: true }), u('X', 2, 'C')], { T: 0, X: 2 }, 2)).toEqual([]);
    expect(check([u('T', 2, 'B', { tank: true }), u('X', 2, 'B')], { T: 0, X: 2 }, 2).length).toBeGreaterThan(0);
    expect(check([u('K', 2, 'B', { back: true }), u('X', 2, 'C')], { K: 2, X: 0 }, 2)).toEqual([]);
  });
});
