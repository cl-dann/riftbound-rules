/* Kör vége (317): Ending Step (317.1.a, delayed "at end of turn" és "At the end of your turn" triggerek, 383.2.a.1),
   Expiration Step (317.2: heal, a "this turn" hatások lejárnak); "Resolve" lépés (340.1); token létrehozás (350.2, 440.2). */
import { describe, expect, it } from 'vitest';
import { cs, run } from './util';

describe('Ending Step és Expiration Step', () => {
  it('Hostile Takeover: a kör végén a kontroll visszakerül és a unit a tulajdonosa base-ébe megy', () => {
    const steps = [{ k: 'card', n: 'Hostile Takeover', pl: 'A', tg: ['b0'] }];
    const bd = [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }];
    const no = run(cs({ bd, steps }));
    expect(no.o('b0').ctrl).toBe('A');
    expect(no.r.delayed).toHaveLength(1);
    const x = run(cs({ bd, steps: [...steps, { k: 'end' }] }));
    expect(x.o('b0')).toMatchObject({ ctrl: 'B', loc: 'base', zone: 'board' });
    expect(x.r.delayed).toHaveLength(0);
    expect(x.text).toMatch(/317\.1\.a, 391\.2/);
    // ugyanez a builder "kör vége" jelzőjével (lépés nélkül)
    expect(run({ ...cs({ bd, steps }), end: true } as any).o('b0').ctrl).toBe('B');
  });
  it('Sanction: Empower most, Disempower a kör végén', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Sanction', pl: 'A', tg: ['b0'], mode: 0 }, { k: 'end' }] }));
    expect(x.o('b0').emp).toBe(false);
    expect(x.ev('empower')).toHaveLength(1);
  });
  it('Glowstone: a saját kör végén meghal és 5 damage-et oszt a saját unitokra', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Glowstone', pl: 'A', loc: 'base' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'end' }] }));
    expect(x.zone('b0')).toBe('trash');
    expect(x.ev('dmg').map((e: any) => e.id)).toEqual(['b1']);
    // az Expiration Step meggyógyítja a túlélőt (317.2.b)
    expect(x.o('b1').dmg).toBe(0);
    expect(x.text).toMatch(/317\.2\.b 3c: minden unit gyógyul: Mega-Mech \(5\)/);
  });
  it('Resource Extractor: "if you control this battlefield" a triggereléskor, Gold token exhausted', () => {
    const bd = [{ n: 'Resource Extractor', pl: 'A', loc: 'bf0' }];
    const yes = run(cs({ turn: 'A', bf: [{ n: 'Zaun Warrens', c: 'A' }], bd, steps: [{ k: 'end' }] }));
    expect(yes.ev('token')).toHaveLength(1);
    expect(yes.o('k1')).toMatchObject({ type: 'gear', ex: true, loc: 'base' });
    const no = run(cs({ turn: 'A', bf: [{ n: 'Zaun Warrens', c: 'B' }], bd, steps: [{ k: 'end' }] }));
    expect(no.ev('token')).toHaveLength(0);
  });
  it('Expiration Step: a "this turn" Might módosító lejár (317.2.c)', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Discipline', pl: 'A', tg: ['b0'] }, { k: 'end' }] }));
    expect(x.o('b0').mods).toEqual([]);
    expect(x.text).toMatch(/317\.2\.c, 424\.1\.a\.2 3d: minden "this turn" hatás egyszerre lejár: Shipyard Skulker: Might módosítók/);
  });
  it('a kör végi triggerre lehet válaszolni: a "kör vége" utáni lépések a chainre kerülnek', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Glowstone', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }], steps: [{ k: 'end' }, { k: 'card', n: 'Flash', pl: 'A', tg: ['b1'] }] }));
    expect(x.r.items.map((i: any) => i.name)).toEqual(['Flash', 'Glowstone triggere (kör vége)']);
  });
});

describe('Expiration Step sorrend (317.2, 323.4, 424.1.a.2, 317.2.f)', () => {
  it('a lethal damage-es unit a heal előtt meghal (3a), a stun megszűnik (3d)', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0', d: 3 }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0', st: true }], steps: [{ k: 'end' }] }));
    expect(x.zone('b0')).toBe('trash');
    expect(x.o('b1').st).toBe(false);
    const t = x.text;
    expect(t.indexOf('3a:')).toBeLessThan(t.indexOf('3c:'));
    expect(t).toMatch(/a stun megszűnik: Mega-Mech/);
  });
  it('317.2.f: ha a 3a halál triggert ad, az lefut, és az Expiration Step elölről kezdődik', () => {
    const x = run(cs({ bd: [{ n: 'Viktor, Leader', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'bf0', d: 3 }], steps: [{ k: 'end' }] }));
    expect(x.zone('b1')).toBe('trash');
    expect(x.text).toMatch(/317\.2\.f Az Expiration Step közben chain elem keletkezett/);
    expect(x.text).toMatch(/Expiration Step \(újra, 317\.2\.f\)/);
  });
});

describe('Resolve lépés (340.1)', () => {
  it('a chain teteje a következő lépés előtt resolve-ol', () => {
    const bd = [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }];
    // Resolve nélkül a Flash resolve-ol előbb, a Void Seeker célpontja a base-be kerül
    const a = run(cs({ bd, steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b0'] }] }));
    expect(a.ev('dmg')).toHaveLength(0);
    const b = run(cs({ bd, steps: [{ k: 'card', n: 'Void Seeker', pl: 'A', tg: ['b0'] }, { k: 'res' }, { k: 'card', n: 'Flash', pl: 'B', tg: ['b0'] }] }));
    expect(b.zone('b0')).toBe('trash');
    expect(b.text).toMatch(/Mindkét játékos passzol: a chain legfelső eleme \(Void Seeker\) most resolve-ol/);
    expect(b.text).toMatch(/Nem szabályos[^\n]*Flash/);
  });
});

describe('Token létrehozás (350.2, 440.2)', () => {
  it('Sprite Fountain: Deathknell, a play effect megismétlése (ready Sprite token a base-be)', () => {
    const x = run(cs({ bd: [{ n: 'Sprite Fountain', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Acceptable Losses', pl: 'A', mp: { 0: { A: 'b0' } } }] }));
    expect(x.zone('b0')).toBe('trash');
    expect(x.ev('token').length).toBeGreaterThanOrEqual(1);
    expect(Object.values(x.r.objs).some((o: any) => o.token && o.name === 'Sprite token' && o.ex === false)).toBe(true);
  });
  it('Friendship: tagenként +1 Might a saját unitok között (Bird, Poro)', () => {
    const x = run(cs({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'bf0' }, { n: 'Bird', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Friendship', pl: 'A', tg: ['b0'] }] }));
    expect(x.ev('might')[0]).toMatchObject({ id: 'b0', from: 3, to: 4 });
  });
});
