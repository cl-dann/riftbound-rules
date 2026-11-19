/* A Core Rules hivatalos példái (rules.json "ex" mező), amelyek konkrét lapot neveznek meg, és chainre, célzásra,
   mistargetre, linked instructionre, Hidden kijátszásra, költségként ölésre, triggerekre, kontrollra vagy Equipre vonatkoznak.
   Minden teszt elején exampleOf() ellenőrzi, hogy a példa szövege valóban ott van a megadott szabályszám alatt.
   A combat damage kiosztás példái a combat.test.ts-ben vannak. */
import { describe, expect, it } from 'vitest';
import { cs, run, exampleOf } from './util';
import { interp, stepInfo } from '../src/legacy/chainCore';

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

describe('Nem modellezett hivatalos példák (a felület ezeket nem számolja ki, csak megnevezi)', () => {
  it.todo('355.11.b Fox-Fire: összesített Might megkötés részhalmaza');
  it.todo('355.14.h.1 Alpha Strike: split damage célpontjainak elhagyása');
  it.todo('359.3.e.9.a Volibear és Repulse: mistargetelt célpontok számolása');
  it.todo('758.2, 758.2.a Falling Star, Rebuke, Alpha Wildclaw: célozhatatlanság megszűnése a chain alatt');
  it.todo('359.3.f.3 Lillia: a trigger feltételéből feljegyzett location');
  it.todo('383.2.a.1 Sona: kör végi trigger feltétele');
  it.todo('467.2.c.5 Lotus Trap és duplázás a kiosztásban');
  it.todo('820.2.a Rocket Barrage Repeat, 832.1.d Primordial Roar Show Off');
});
