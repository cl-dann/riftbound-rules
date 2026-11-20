/* A Core Rules hivatalos példái (rules.json "ex" mező), amelyek konkrét lapot neveznek meg, és chainre, célzásra,
   mistargetre, linked instructionre, Hidden kijátszásra, költségként ölésre, triggerekre, kontrollra vagy Equipre vonatkoznak.
   Minden teszt elején exampleOf() ellenőrzi, hogy a példa szövege valóban ott van a megadott szabályszám alatt.
   A combat damage kiosztás példái a combat.test.ts-ben vannak. */
import { describe, expect, it } from 'vitest';
import { cs, run, exampleOf } from './util';
import { interp } from '../src/domain/chain/actions';
import { stepInfo } from '../src/domain/chain/steps';
import { CARDS } from '../src/domain/data/store';

const insts = (x: ReturnType<typeof run>, re: RegExp) => x.item(re)!.instr.map((i: any) => i.st);

describe('359.3.e.5: illegális célpontra nem hat, a többi utasítás végrehajtódik', () => {
  it('Void Seeker: a célpont a base-be mozog, a damage elmarad, a draw megtörténik', () => {
    exampleOf('359.3.e.5', 'Void Seeker');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b0'] }] }));
    expect(insts(x, /^Void Seeker/)).toEqual(['ignored', 'executed']);
    expect(x.ev('dmg')).toHaveLength(0);
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'A', n: 1 }]);
    expect(x.o('b0').loc).toBe('base');
  });
  it('Hidden Blade facedown-ból, Tideturner helycserével másik battlefieldre viszi a célpontot: Ignored', () => {
    exampleOf('359.3.e.5', 'Tideturner');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: "Vilemaw's Lair", c: 'B' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Hidden Blade', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] },
      { k: 'card', n: 'Tideturner', pl: 'B', from: 'facedown', loc: 'bf1', tg: ['b0'] }] }));
    expect(x.o('b0').loc).toBe('bf1');
    expect(x.o('s1').loc).toBe('bf0');
    expect(insts(x, /^Hidden Blade/)).toEqual(['ignored', 'ignored']);
    expect(x.zone('b0')).toBe('board');
    expect(x.ev('draw')).toHaveLength(0);
    expect(x.text).toMatch(/811\.1\.d\.2/);
  });
});

describe('359.3.e.6: Ignored és Negated', () => {
  it("Ride the Wind Vilemaw's Lairen: a mozgás Negated", () => {
    exampleOf('359.3.e.6', 'Ride the Wind');
    const x = run(cs({ bf: [{ n: "Vilemaw's Lair", c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0', ex: true }], steps: [
      { k: 'card', n: 'Ride the Wind', pl: 'A', tg: ['b0'], dest: 'base' }] }));
    expect(insts(x, /^Ride the Wind/)[0]).toBe('negated');
    expect(x.o('b0').loc).toBe('bf0');
  });
  it('Hidden Blade, a célpontot Flash a base-be viszi: a "Kill a unit" Ignored', () => {
    exampleOf('359.3.e.6', 'Hidden Blade');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Hidden Blade', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b0'] }] }));
    expect(insts(x, /^Hidden Blade/)[0]).toBe('ignored');
    expect(x.zone('b0')).toBe('board');
  });
});

describe('358.3.a: tiltott game action', () => {
  it("Flash Vilemaw's Lairen álló unitra kijátszható, a mozgás Negated", () => {
    exampleOf('358.3.a', 'Flash');
    const x = run(cs({ bf: [{ n: "Vilemaw's Lair", c: 'B' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Flash', pl: 'B', tg: ['b0'] }] }));
    expect(x.text).not.toMatch(/Nem szabályos/);
    expect(insts(x, /^Flash/)).toEqual(['negated']);
    expect(x.o('b0').loc).toBe('bf0');
  });
});

describe('359.3.e.8: részleges mistarget', () => {
  it('Singularity: az egyik célpont elérhetetlen, a másikra hat', () => {
    exampleOf('359.3.e.8', 'Singularity');
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Singularity', pl: 'A', tg: ['b0', 'b1'] }, { k: 'card', n: 'Retreat', pl: 'B', tg: ['b1'] }] }));
    expect(x.item(/^Singularity/)!.res).toBe('partial');
    expect(insts(x, /^Singularity/)).toEqual(['partial']);
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b0', name: 'Mega-Mech', n: 6 }]);
  });
});

describe('359.3.e.14: linked instructions (Hidden Blade, Deathgrip, Ride the Wind)', () => {
  it('Hidden Blade két utasítás, a második linked', () => {
    exampleOf('359.3.e.14', 'Hidden Blade');
    const s = { k: 'card', n: 'Hidden Blade', pl: 'A', tg: [] };
    const I = interp(s, stepInfo(cs({ steps: [s] }), s));
    expect(I.map((x: any) => [x.t, x.act.k, x.lk])).toEqual([['Kill a unit at a battlefield.', 'kill', false], ['Its controller draws 2.', 'draw', true]]);
  });
  it('359.3.e.14.a: ha a kill Ignored, a "draws 2" is Ignored', () => {
    exampleOf('359.3.e.14.a', 'Hidden Blade');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Hidden Blade', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b0'] }] }));
    expect(insts(x, /^Hidden Blade/)).toEqual(['ignored', 'ignored']);
    expect(x.ev('draw')).toHaveLength(0);
  });
  it("359.3.e.14.b: a kill Negated (Zhonya's Hourglass helyettesíti), a célpont irányítója mégis húz 2-t", () => {
    exampleOf('359.3.e.14.b', 'Hidden Blade');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: "Zhonya's Hourglass", pl: 'B', loc: 'base' }], steps: [
      { k: 'card', n: 'Hidden Blade', pl: 'A', tg: ['b0'] }] }));
    expect(insts(x, /^Hidden Blade/)).toEqual(['negated', 'executed']);
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'B', n: 2 }]);
    expect(x.zone('b0')).toBe('board');
    expect(x.o('b0')).toMatchObject({ loc: 'base', ex: true, dmg: 0 });
    expect(x.zone('b1')).toBe('trash');
  });
  it('359.3.e.14.b: Deathgrip, a halált Guardian Angel helyettesíti, az "If you do" nem hajtódik végre, a "Draw 1" igen', () => {
    exampleOf('359.3.e.14.b', 'Deathgrip');
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0' }, { n: 'Guardian Angel', pl: 'A', loc: 'bf0', on: 0 }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Deathgrip', pl: 'A', tg: ['b0', 'b2'] }] }));
    expect(insts(x, /^Deathgrip/)).toEqual(['negated', 'skipped', 'executed']);
    expect(x.ev('might')).toHaveLength(0);
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'A', n: 1 }]);
    expect(x.zone('b1')).toBe('trash');
    expect(x.o('b0').loc).toBe('base');
  });
  it('Deathgrip helyettesítés nélkül: a megölt unit Mightját kapja a másik', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Deathgrip', pl: 'A', tg: ['b0', 'b1'] }] }));
    expect(insts(x, /^Deathgrip/)).toEqual(['executed', 'executed', 'executed']);
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b1', name: 'Shipyard Skulker', from: 3, to: 11 }]);
  });
  it("359.3.e.14.b: Ride the Wind Vilemaw's Lairen, a mozgás Negated, a ready végrehajtódik", () => {
    exampleOf('359.3.e.14.b', 'Ride the Wind');
    const x = run(cs({ bf: [{ n: "Vilemaw's Lair", c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0', ex: true }], steps: [
      { k: 'card', n: 'Ride the Wind', pl: 'A', tg: ['b0'], dest: 'base' }] }));
    expect(insts(x, /^Ride the Wind/)).toEqual(['negated', 'executed']);
    expect(x.o('b0')).toMatchObject({ loc: 'bf0', ex: false });
  });
});

describe('359.3.e.2.a és 811.1.d: facedown-ból kijátszott lap célzási megkötése', () => {
  it('Temporal Breach facedown-ból: a célpont másik battlefieldre kerül, illegális', () => {
    exampleOf('359.3.e.2.a', 'Temporal Breach');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: 'Zaun Warrens', c: 'B' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Temporal Breach', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] },
      { k: 'card', n: 'Tideturner', pl: 'B', from: 'facedown', loc: 'bf1', tg: ['b0'] }] }));
    expect(insts(x, /^Temporal Breach/)[0]).toBe('ignored');
    expect(x.zone('b0')).toBe('board');
  });
  it("811.1.d.2: Emperor's Divide facedown-ból csak az adott battlefield unitjait választhatja", () => {
    exampleOf('811.1.d.2', "Emperor’s Divide");
    const bad = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf1' }], steps: [
      { k: 'card', n: "Emperor's Divide", pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(bad.text).toMatch(/Nem szabályos.*811\.1\.d\.2/);
    const ok = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'card', n: "Emperor's Divide", pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(ok.o('b0').loc).toBe('base');
  });
  it('811.1.d.3, 403.4.b: Blastcone Fae play effectje csak a saját battlefieldjén választhat; ha ott csak ő maga van, őt kell választania, Mightja 2-ről 1 lesz', () => {
    exampleOf('811.1.d.3', 'must be chosen from among units at the battlefield it was played to');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: 'Zaun Warrens', c: 'B' }], bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf1' }], steps: [
      { k: 'card', n: 'Blastcone Fae', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(x.text).toMatch(/403\.4\.b.*811\.1\.d\.3|811\.1\.d\.3.*403\.4\.b/s);
    expect(x.zone('s0')).toBe('board');
    expect(x.ev('might')).toEqual([{ k: 'might', id: 's0', name: 'Blastcone Fae', from: 2, to: 1 }]);
    expect(x.ev('might', (e) => e.id === 'b0')).toHaveLength(0);
  });
  it('811.1.d.3: Tideturner megkötése sosem teljesülhetne a saját battlefieldjén, ezért szabadon választ', () => {
    exampleOf('811.1.d.3', 'Tideturner');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: '', c: '' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base' }], steps: [
      { k: 'card', n: 'Tideturner', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(x.text).not.toMatch(/nem szabályos/i);
    expect(x.o('b0').loc).toBe('bf0');
    expect(x.o('s0').loc).toBe('base');
  });
  it('811.1.d.4: Smoke and Mirrors, az első unit a battlefieldről, a második bárhonnan', () => {
    exampleOf('811.1.d.4', 'Smoke and Mirrors');
    const base = { bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf1' }] };
    const ok = run(cs({ ...base, steps: [{ k: 'card', n: 'Smoke and Mirrors', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0', 'b1'] }] }));
    expect(ok.text).not.toMatch(/Nem szabályos/);
    const bad = run(cs({ ...base, steps: [{ k: 'card', n: 'Smoke and Mirrors', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b1', 'b0'] }] }));
    expect(bad.text).toMatch(/Nem szabályos/);
  });
  it('811.2: Stand United facedown-ból csak az adott battlefield friendly unitját buffolhatja', () => {
    exampleOf('811.2', 'Stand United');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }, { n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf1' }], steps: [
      { k: 'card', n: 'Stand United', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(x.text).toMatch(/Nem szabályos/);
  });
});

describe('359.3.f: a trigger információi a végrehajtáskor', () => {
  const yasuo = (resp: Record<string, unknown>) => cs({ bf: [{ n: 'Zaun Warrens', c: 'B' }], bd: [{ n: 'Yasuo, Remorseful', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }],
    steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', tg: ['b1'] }, resp] });
  it('359.3.f.2: Fight or Flight a base-be viszi Yasuót, a "here" már nem a combat helye, a trigger mistargetel', () => {
    exampleOf('359.3.f.2', 'Fight or Flight');
    const x = run(yasuo({ k: 'card', n: 'Fight or Flight', pl: 'B', from: 'facedown', loc: 'bf0', tg: ['b0'] }));
    expect(x.o('b0').loc).toBe('base');
    expect(x.item(/Yasuo/)!.res).toBe('fizzle');
    expect(x.ev('dmg')).toHaveLength(0);
  });
  it('359.3.f.2: Stupefy után Yasuo 5 Mighttal sebez', () => {
    exampleOf('359.3.f.2', 'Stupefy');
    const x = run(yasuo({ k: 'card', n: 'Stupefy', pl: 'B', tg: ['b0'] }));
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b1', name: 'Mega-Mech', n: 5 }]);
  });
  it('359.3.f.4: Hostile Takeover átveszi Yasuót, a trigger "enemy" vonatkozása nem változik, a damage megtörténik', () => {
    exampleOf('359.3.f.4', 'Hostile Takeover');
    const x = run(yasuo({ k: 'card', n: 'Hostile Takeover', pl: 'B', from: 'facedown', loc: 'bf0', tg: ['b0'] }));
    expect(x.ev('ctrl')).toEqual([{ k: 'ctrl', id: 'b0', name: 'Yasuo, Remorseful', from: 'A', to: 'B' }]);
    expect(x.ev('dmg')).toEqual([{ k: 'dmg', id: 'b1', name: 'Mega-Mech', n: 6 }]);
    expect(x.item(/Yasuo/)!.res).toBe('ok');
  });
});

describe('359.3.e.16: delayed ability', () => {
  it('Akshan elhagyja a boardot a play effectje előtt: a kontroll egy pillanatra sem változik, a gear a cleanupban visszakerül', () => {
    exampleOf('359.3.e.16', 'Akshan');
    const x = run(cs({ bd: [{ n: 'Long Sword', pl: 'B', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'base' }], steps: [
      { k: 'card', n: 'Akshan, Mischievous', pl: 'A', loc: 'base', addc: true, tg: ['b0'] },
      { k: 'card', n: 'Star-Crossed', pl: 'B', tg: ['b1', 's0'] }] }));
    expect(x.zone('s0')).toBe('hand');
    const I = x.item(/Akshan/)!.instr;
    expect(I.map((i: any) => [i.k, i.st])).toEqual([['base', 'executed'], ['ctrlUntil', 'ignored'], ['attach', 'ignored']]);
    expect(I[1].ref).toBe('359.3.e.16');
    expect(x.ev('ctrl')).toHaveLength(0);
    expect(x.o('b0')).toMatchObject({ ctrl: 'B', loc: 'base', baseOf: 'B' });
    expect(x.ev('recall', (e) => e.cleanup)).toHaveLength(1);
  });
  it('Hostile Takeover: a "Lose control ... at end of turn" delayed hatásként jön létre, a chainen nem fut le', () => {
    exampleOf('359.3.e.16', 'Hostile Takeover');
    const x = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0', ex: true }], steps: [
      { k: 'card', n: 'Hostile Takeover', pl: 'A', tg: ['b0'] }] }));
    expect(x.o('b0')).toMatchObject({ ctrl: 'A', own: 'B', ex: false, loc: 'bf0' });
    expect(x.r.delayed).toHaveLength(1);
    expect(x.r.delayed[0].t).toMatch(/at end of turn/);
  });
});

describe('Triggerek', () => {
  it('383.3.a: Tideturner "you may" a hatás elején, a döntés a chainre tételkor', () => {
    exampleOf('383.3.a', 'Tideturner');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base' }], bf: [{ n: 'Zaun Warrens', c: 'A' }], steps: [
      { k: 'card', n: 'Tideturner', pl: 'A', loc: 'bf0', tg: ['b0'] }] }));
    expect(x.text).toMatch(/383\.3\.a.*finalizálás/);
  });
  it('204.1.c: Overzealous Fan, a "kill me" a trigger költsége, a finalizáláskor fizetendő', () => {
    exampleOf('204.1.c', 'Overzealous Fan');
    const x = run(cs({ bd: [{ n: 'Overzealous Fan', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0' }], steps: [
      { k: 'tg', src: 'b0', ti: 0, pl: 'B', tg: ['b1'] }] }));
    expect(x.r.frames[1].board.bfs[0].opp).toHaveLength(0);
    expect(x.zone('b0')).toBe('trash');
    expect(x.o('b1').loc).toBe('base');
    expect(x.text).toMatch(/204\.1\.c/);
  });
  it('808.1.d.1: ha a halált replacement helyettesíti, a Deathknell nem triggerel', () => {
    exampleOf('808.1.d.1', 'Zhonya');
    const x = run(cs({ bd: [{ n: 'Watchful Sentry', pl: 'B', loc: 'bf0' }, { n: "Zhonya's Hourglass", pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }] }));
    expect(x.r.items.some((i: any) => /Deathknell/.test(i.name))).toBe(false);
    expect(x.ev('draw')).toHaveLength(0);
  });
  it('429.1.a.1.b, 808.1.d.2: a Deathknell a trashbe kerülés előtt a chainre kerül, és lefut', () => {
    exampleOf('429.1.a.1.b', 'Draven');
    const x = run(cs({ bd: [{ n: 'Watchful Sentry', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }] }));
    expect(x.item(/Deathknell/)!.res).toBe('ok');
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'B', n: 1 }]);
  });
  it('383.2.c.3: Treasure Trove "leaves the board" triggere a kill előtt a chainre kerül', () => {
    exampleOf('383.2.c.3', 'Treasure Trove');
    const x = run(cs({ bd: [{ n: 'Treasure Trove', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Thermo Beam', pl: 'A' }] }));
    expect(x.zone('b0')).toBe('trash');
    expect(x.ev('draw')).toEqual([{ k: 'draw', pl: 'B', n: 1 }]);
    expect(x.ev('channel')).toEqual([{ k: 'channel', pl: 'B', n: 1 }]);
  });
});

describe('Költség és replacement', () => {
  it("357.2.a: Cruel Patron költségét Zhonya's Hourglass helyettesíti, a költség ki van fizetve", () => {
    exampleOf('357.2.a', 'Cruel Patron');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base' }, { n: "Zhonya's Hourglass", pl: 'A', loc: 'base' }], steps: [
      { k: 'card', n: 'Cruel Patron', pl: 'A', loc: 'base', costTg: 'b0' }] }));
    expect(x.zone('s0')).toBe('board');
    expect(x.zone('b0')).toBe('board');
    expect(x.zone('b1')).toBe('trash');
    expect(x.text).toMatch(/357\.2\.a/);
  });
  it('135.2.b.7: Back Off a resolve-kor nézi, honnan játszották ki', () => {
    exampleOf('135.2.b.7', 'Back Off');
    const bd = [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }];
    const hand = run(cs({ bd, steps: [{ k: 'card', n: 'Back Off', pl: 'A', from: 'hand', tg: ['b0'] }] }));
    expect(hand.ev('draw')).toEqual([{ k: 'draw', pl: 'A', n: 1 }]);
    const fd = run(cs({ bf: [{ n: 'Zaun Warrens', c: 'A' }], bd, steps: [{ k: 'card', n: 'Back Off', pl: 'A', from: 'facedown', loc: 'bf0', tg: ['b0'] }] }));
    expect(fd.ev('draw')).toHaveLength(0);
    expect(fd.item(/Back Off/)!.instr[1].st).toBe('skipped');
  });
});

describe('Célzás és damage', () => {
  it('757.1, 758: Ruin Runner nem választható enemy spellel', () => {
    exampleOf('757.1', 'Ruin Runner');
    const x = run(cs({ bd: [{ n: 'Ruin Runner', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }] }));
    expect(x.text).toMatch(/Nem szabályos/);
  });
  it('355.11.b.1: Bellows Breath, Flash kettőt a base-be visz: bármelyik location csoportja választható, de abból az összes célpont (az elemzés a base-ben lévő kettőt számolja)', () => {
    exampleOf('355.11.b.1', 'Flash');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Vanguard Sergeant', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Bellows Breath', pl: 'A', tg: ['b0', 'b1', 'b2'] }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b0', 'b1'] }] }));
    expect(x.ev('dmg').map((e: any) => e.id).sort()).toEqual(['b0', 'b1']);
    expect(x.text).toMatch(/355\.11\.b\.1/);
    expect(x.text).toMatch(/bármelyik location választható/);
  });
  it('359.3.e.12: Strike Down, az Equipmentet Angle Shot leválasztja, a célpont már nem "equipped", minden kapcsolódó utasítás Ignored', () => {
    exampleOf('359.3.e.12', 'Strike Down');
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0' }, { n: 'Long Sword', pl: 'A', loc: 'bf0', on: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Strike Down', pl: 'A', tg: ['b0', 'b2'] },
      { k: 'card', n: 'Angle Shot', pl: 'B', tg: ['b0', 'b1'], ov: { 1: { k: 'detach' } } }] }));
    expect(x.o('b1').on).toBeNull();
    expect(insts(x, /^Strike Down/)).toEqual(['ignored', 'ignored', 'ignored']);
    expect(x.ev('dmg')).toHaveLength(0);
  });
  it('715.2: Singularity Annie, Fiery mellett mindkét célpontra 7-et sebez', () => {
    exampleOf('715.2', 'Annie, Fiery');
    const x = run(cs({ bd: [{ n: 'Annie, Fiery', pl: 'A', loc: 'base' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [
      { k: 'card', n: 'Singularity', pl: 'A', tg: ['b1', 'b2'] }] }));
    expect(x.ev('dmg').map((e: any) => e.n)).toEqual([7, 7]);
  });
  it('142.4.b: Frigid Touch után a már rajta lévő damage lethal, a cleanupban meghal', () => {
    exampleOf('142.4.b', 'Frigid Touch');
    const x = run(cs({ bd: [{ n: 'Playful Phantom', pl: 'B', loc: 'bf0', d: 3 }], steps: [{ k: 'card', n: 'Frigid Touch', pl: 'A', tg: ['b0'] }] }));
    expect(x.ev('might')).toEqual([{ k: 'might', id: 'b0', name: 'Playful Phantom', from: 5, to: 3 }]);
    expect(x.zone('b0')).toBe('trash');
    expect(x.r.frames.some((f: any) => /^Cleanup/.test(f.label))).toBe(true);
  });
  it('424.1.a.1: stunned unit nem stunolható újra, az utasítás Negated', () => {
    exampleOf('424.1.a.1', 'Eclipse Herald');
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', st: true }], steps: [{ k: 'card', n: 'Back Off', pl: 'A', tg: ['b0'] }] }));
    expect(x.item(/Back Off/)!.instr[0].st).toBe('negated');
  });
});

describe('Equip és attach', () => {
  it('435.5: az exhausted Equipment csatoláskor nem lesz ready', () => {
    exampleOf('435.5', 'exhausted equipment');
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }, { n: 'Long Sword', pl: 'A', loc: 'base', ex: true }], steps: [
      { k: 'ab', src: 'b1', ai: 0, n: 'Long Sword', pl: 'A', tg: ['b0'] }] }));
    expect(x.o('b1')).toMatchObject({ on: 'b0', ex: true });
    expect(x.r.frames.at(-1).board.me.base.find((u: any) => u.n === 'Mega-Mech').m).toBe(10);
  });
  it('719.5, 436.4.a: a csatolt gear leválik, a helyén marad, a battlefielden álló gear a cleanupban recall-olódik', () => {
    const x = run(cs({ bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Long Sword', pl: 'B', loc: 'bf0', on: 0 }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }] }));
    const res = x.r.frames.find((f: any) => /^Resolve: Vengeance/.test(f.label));
    const g = res.board.bfs[0].opp.find((u: any) => u.n === 'Long Sword');
    expect(g).toMatchObject({ kind: 'gear' });
    expect(g.status).toContain('detached');
    expect(x.ev('detach')).toHaveLength(1);
    expect(x.ev('recall', (e) => e.cleanup)).toHaveLength(1);
    expect(x.o('b1').loc).toBe('base');
  });
});

describe('Korábban nem modellezett hivatalos példák', () => {
  it('355.11.b Fox-Fire: az együttes Might túllépi a 4-et, legális részhalmaz az eredeti célpontokból', () => {
    exampleOf('355.11.b', 'Fox-Fire');
    const R = { n: 'Recruit', pl: 'B', loc: 'bf0' };
    const bd = [R, R, R, R];
    const steps = (sub?: number[]) => [
      { k: 'card', n: 'Fox-Fire', pl: 'A', tg: ['b0', 'b1', 'b2', 'b3'], ...(sub ? { sub } : {}) },
      { k: 'card', n: 'Combat Experience', pl: 'B', tg: ['b2'] }, { k: 'card', n: 'Combat Experience', pl: 'B', tg: ['b3'] }];
    // alapfeltételezés: a lehető legtöbb célpont (1, 1, 2 Might), a negyedik kimarad
    const a = run(cs({ bd, steps: steps() }));
    expect(['b0', 'b1', 'b2', 'b3'].map((i) => a.zone(i))).toEqual(['trash', 'trash', 'trash', 'board']);
    expect(a.text).toMatch(/együttes Mightja \(6\) már nagyobb, mint 4/);
    expect(a.text).toMatch(/355\.11\.b/);
    // a játékos a két 2 Mightú Recruitot választja
    const b = run(cs({ bd, steps: steps([2, 3]) }));
    expect(['b0', 'b1', 'b2', 'b3'].map((i) => b.zone(i))).toEqual(['board', 'board', 'trash', 'trash']);
    // illegális választás (1 + 2 + 2 = 5): a felület jelzi, és a legtöbb célpontos részhalmazt számolja
    const c = run(cs({ bd, steps: steps([0, 2, 3]) }));
    expect(c.text).toMatch(/A lapnál megadott részhalmaz nem legális/);
    // a 4-en belül maradó célpontok nem esnek ki
    const d = run(cs({ bd, steps: [{ k: 'card', n: 'Fox-Fire', pl: 'A', tg: ['b0', 'b1', 'b2', 'b3'] }] }));
    expect(['b0', 'b1', 'b2', 'b3'].map((i) => d.zone(i))).toEqual(['trash', 'trash', 'trash', 'trash']);
  });
  it('359.3.e.9.a Volibear és Repulse: a base-be mozgott célpontok számítanak, a trashbe kerültek nem', () => {
    exampleOf('359.3.e.9.a', 'Volibear');
    const U = { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' };
    const bd = [{ n: 'Volibear, Furious', pl: 'A', loc: 'bf0' }, U, U, U];
    const vt = { k: 'tg', src: 'b0', ti: 0, n: 'Volibear, Furious', pl: 'A', tg: ['b1', 'b2', 'b3'], split: { 0: 2, 1: 2, 2: 1 } };
    const a = run(cs({ bd, steps: [vt, { k: 'card', n: 'Flash', pl: 'B', tg: ['b1', 'b2'] }, { k: 'res' }, { k: 'card', n: 'Repulse', pl: 'B', tg: ['b3', 's0'] }] }));
    expect(a.text).toMatch(/Nem szabályos:[^\n]*Repulse[^\n]*3 friendly unitot választott[^\n]*359\.3\.e\.9\.a/);
    expect(a.zone('s0')).not.toBe('countered');
    const b = run(cs({ bd, steps: [vt, { k: 'card', n: 'Heedless Resurrection', pl: 'B', costTg: 'b1' }, { k: 'res' },
      { k: 'card', n: 'Heedless Resurrection', pl: 'B', costTg: 'b2' }, { k: 'res' }, { k: 'card', n: 'Repulse', pl: 'B', tg: ['b3', 's0'] }] }));
    expect(b.zone('s0')).toBe('countered');
    expect(b.ev('dmg')).toHaveLength(0);
    expect(b.text).toMatch(/Counterelték: nem csinál semmit, lekerül a chainről és megszűnik/);
  });
  it('758.2 Falling Star, Discipline, Eclipse: a célozhatatlanság a resolve-kor számít', () => {
    exampleOf('758.2', 'Falling Star');
    (CARDS as any[]).push({ n: 'Teszt Védett Unit', a: ['Teszt Védett Unit'], t: 'Unit', st: [], d: ['Calm'], tg: [], e: 1, p: null, m: 1, txt: "I can't be chosen by enemy spells or abilities with Energy cost less than my Might." });
    const bd = [{ n: 'Teszt Védett Unit', pl: 'A', loc: 'bf0' }];
    const fs = { k: 'card', n: 'Falling Star', pl: 'B', tg: ['b0', 'b0'] };
    const prot = run(cs({ bd, steps: [fs, { k: 'card', n: 'Discipline', pl: 'A', tg: ['b0'] }] }));
    expect(prot.ev('dmg')).toHaveLength(0);
    expect(prot.text).toMatch(/Mightja \(3\) nagyobb, mint a forrás Energy költsége \(2\)/);
    const x = run(cs({ bd, steps: [fs, { k: 'card', n: 'Discipline', pl: 'A', tg: ['b0'] }, { k: 'res' }, { k: 'card', n: 'Eclipse', pl: 'B', tg: ['b0'] }] }));
    expect(x.ev('dmg').map((e: any) => e.n)).toEqual([3, 3]);
    expect(x.text).toMatch(/újra legális célpont \(758\.2\)/);
    expect(x.zone('b0')).toBe('trash');
    // a kitalált tesztlapot a teszt végén kivesszük, hogy más tesztet ne befolyásoljon
    const ix = (CARDS as any[]).findIndex((c) => c.n === 'Teszt Védett Unit');
    (CARDS as any[]).splice(ix, 1);
    expect((CARDS as any[]).some((c) => c.n === 'Teszt Védett Unit')).toBe(false);
  });
  it('758.2.a Alpha Wildclaw, Vilemaw, Rebuke, Star-Crossed: a passzív védelem megszűnése után Vilemaw legális célpont', () => {
    exampleOf('758.2.a', 'Alpha Wildclaw');
    const bd = [{ n: 'Alpha Wildclaw', pl: 'A', loc: 'bf0' }, { n: 'Vilemaw', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }];
    const x = run(cs({ bd, steps: [{ k: 'card', n: 'Rebuke', pl: 'B', tg: ['b1'] }, { k: 'card', n: 'Discipline', pl: 'A', tg: ['b0'] }, { k: 'res' },
      { k: 'card', n: 'Star-Crossed', pl: 'B', tg: ['b2', 'b0'] }] }));
    expect(x.zone('b0')).toBe('hand');
    expect(x.zone('b1')).toBe('hand');
    expect(x.text).toMatch(/758\.2\.a/);
    // Star-Crossed nélkül Vilemaw a resolve-kor illegális célpont
    const y = run(cs({ bd, steps: [{ k: 'card', n: 'Rebuke', pl: 'B', tg: ['b1'] }, { k: 'card', n: 'Discipline', pl: 'A', tg: ['b0'] }] }));
    expect(y.zone('b1')).toBe('board');
    expect(y.text).toMatch(/Alpha Wildclaw passzív képessége miatt/);
  });
  it('359.3.f.3 Lillia: a trigger a feltételből feljegyzett locationre teszi a Sprite tokent, akkor is, ha Lillia közben elhagyja a boardot', () => {
    exampleOf('359.3.f.3', 'Lillia');
    const x = run(cs({ bd: [{ n: 'Lillia, Fae Fawn', pl: 'A', loc: 'bf1' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf1' }],
      steps: [{ k: 'tg', src: 'b0', ti: 0, n: 'Lillia, Fae Fawn', pl: 'A', mfrom: 'bf0' }, { k: 'card', n: 'Star-Crossed', pl: 'B', tg: ['b1', 'b0'] }] }));
    expect(x.zone('b0')).toBe('hand');
    expect(x.o('k1')).toMatchObject({ name: 'Sprite token', loc: 'bf0', zone: 'board', m: 3 });
    expect(x.text).toMatch(/359\.3\.f\.3/);
  });
  it('383.2.a.1 Sona: a kör végi trigger csak battlefielden triggerel, és lefut, ha Sona közben eltűnik', () => {
    exampleOf('383.2.a.1', 'Sona');
    const a = run(cs({ turn: 'A', bd: [{ n: 'Sona, Harmonious', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }],
      steps: [{ k: 'end' }, { k: 'card', n: 'Star-Crossed', pl: 'B', tg: ['b1', 'b0'] }] }));
    expect(a.r.items.map((i: any) => i.name)).toEqual(['Star-Crossed', 'Sona, Harmonious triggere (kör vége)']);
    expect(a.text).toMatch(/A forrás már nincs a boardon, de a trigger feltétele a triggereléskor teljesült, ezért a trigger lefut \(383\.2\.a\.1\)/);
    const b = run(cs({ turn: 'A', bd: [{ n: 'Sona, Harmonious', pl: 'A', loc: 'base' }], steps: [{ k: 'end' }] }));
    expect(b.r.items).toHaveLength(0);
    expect(b.text).toMatch(/a kör végén nem teljesül, ezért nem triggerel/);
    // az ellenfél körének végén nem triggerel ("At the end of your turn")
    const c = run(cs({ turn: 'B', bd: [{ n: 'Sona, Harmonious', pl: 'A', loc: 'bf0' }], steps: [{ k: 'end' }] }));
    expect(c.r.items).toHaveLength(0);
  });
  it('820.2.a Rocket Barrage Repeat: két különböző gear a választott sorrendben, vagy más mód a második végrehajtásra', () => {
    exampleOf('820.2.a', 'Rocket Barrage');
    const bd = [{ n: 'Sun Disc', pl: 'B', loc: 'base' }, { n: 'Long Sword', pl: 'B', loc: 'base' }];
    const a = run(cs({ bd, steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 1, rep: true, mode2: 1, tg: ['b1', 'b0'] }] }));
    expect(a.ev('zone').map((e: any) => e.id)).toEqual(['b1', 'b0']);
    expect(a.text).toMatch(/820\.1\.d\.1, 820\.2, 820\.2\.a/);
    const b = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'base' }, bd[0]], steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 0, rep: true, mode2: 1, tg: ['b0', 'b1'] }] }));
    expect(b.ev('dmg')).toEqual([expect.objectContaining({ id: 'b0', n: 4 })]);
    expect(b.zone('b1')).toBe('trash');
    // Repeat nélkül csak egyszer
    const c = run(cs({ bd, steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', mode: 1, tg: ['b1'] }] }));
    expect(c.zone('b0')).toBe('board');
  });
  it("820.1.d.1 Desert's Call Repeat: két Sand Soldier token", () => {
    exampleOf('820.1.d.1', 'Sand Soldier');
    const x = run(cs({ steps: [{ k: 'card', n: "Desert's Call", pl: 'A', rep: true }] }));
    expect(x.ev('token')).toHaveLength(2);
    expect(run(cs({ steps: [{ k: 'card', n: "Desert's Call", pl: 'A' }] })).ev('token')).toHaveLength(1);
  });
  it('832.1.d.1 Primordial Roar: a Show Off-olt unit Mightja a finalizáláskor rögzül', () => {
    exampleOf('832.1.d.1', 'Primordial Roar');
    const x = run(cs({ bd: [{ n: 'Sona, Harmonious', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }],
      steps: [{ k: 'card', n: 'Primordial Roar', pl: 'A', so: 'b0', tg: ['b1'] }, { k: 'card', n: 'Frigid Touch', pl: 'B', tg: ['b0'] }] }));
    expect(x.ev('dmg')).toEqual([expect.objectContaining({ id: 'b1', n: 4 })]);
    expect(x.zone('b1')).toBe('trash');
    expect(x.text).toMatch(/832\.1\.d\.1/);
    // kézből felfedett unit: a lap nyomtatott Mightja
    const h = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Primordial Roar', pl: 'A', so: 'h:Mega-Mech', tg: ['b0'] }] }));
    expect(h.ev('dmg')[0].n).toBe(8);
    // Show Off nélkül nincs damage
    const n = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Primordial Roar', pl: 'A', tg: ['b0'] }] }));
    expect(n.ev('dmg')).toHaveLength(0);
  });
});
