/* Chain korlátok javítása körönként, valós lapokkal. A futásidejű leltár (unit/leltar.ts) őrzi, mely utasításokat nem követi még az elemzés. */
import { describe, expect, it } from 'vitest';
import { attachedEff, stepInfo } from '../src/domain/chain/steps';
import { triggersOf } from '../src/domain/chain/parser';
import { vsCard } from '../src/domain/data/store';
import { migrateTg, normZones } from '../src/domain/chain/cs';
import { cs, ruleText, run } from './util';
import { sweep } from './leltar';

const listOf = (n: string) => stepInfo({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], steps: [] } as never, { k: 'card', n, pl: 'A', tg: [], ext: {} } as never)!.list;

describe('1. kör: feltétel-tagmondat nem célpont (355.10.b, 355.10.c)', () => {
  it('a szabály: korlátozás, feltétel, trigger feltétel nem célpont', () => {
    expect(ruleText('355.10.b')).toMatch(/only as a restriction or permission for a game action/);
    expect(ruleText('355.10.c')).toMatch(/trigger condition/);
  });
  it('Hold \'Em: csak a "Give a unit" célpont, a költségcsökkentés feltétele nem', () => {
    expect(listOf("Hold 'Em")).toHaveLength(1);
    expect(listOf('Spoils of War')).toHaveLength(0);
    expect(listOf('Isolate')).toHaveLength(1);
    expect(listOf('Shadow Dash')).toHaveLength(1);
    expect(listOf('Crumbling Sands')).toHaveLength(1);
  });
  it('Hold \'Em egy célponttal: +3 Might, nincs "nem követi" sor', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Blastcone Fae', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: "Hold 'Em", pl: 'A', tg: ['b0'] }, { k: 'res' }] }));
    expect(x.text).toMatch(/Blastcone Fae Mightja 2 → 5/);
    expect(x.text).not.toMatch(/nem követi/);
  });
  it('régi #c= link (két célpont-hely): betöltéskor a feltétel helye kimarad, az eredmény ugyanaz', () => {
    const old = cs({ turn: 'A', bd: [{ n: 'Blastcone Fae', pl: 'A', loc: 'bf0' }, { n: 'Blastcone Fae', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: "Hold 'Em", pl: 'A', tg: ['b1', 'b0'] }, { k: 'res' }] });
    const m = normZones(JSON.parse(JSON.stringify(old)));
    expect(m.steps[0].tg).toEqual(['b0']);
    expect(run(m).text).toMatch(/Blastcone Fae #1 Mightja 2 → 5/);
    // új lépés (legfeljebb annyi hely, ahány célpont) nem változik
    const neu = JSON.parse(JSON.stringify(m)); migrateTg(neu);
    expect(neu.steps[0].tg).toEqual(['b0']);
  });
});

describe('1. kör: "for each" szorzó', () => {
  it('Show of Strength: a számolt szorzó mellett nincs "nem számolja" megjegyzés (414.1)', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }, { n: 'Playful Phantom', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Show of Strength', pl: 'A' }, { k: 'res' }] }));
    expect(x.text).toMatch(/Szorzó: 2 \(a Mighty saját unitok\)\. Te húz 2 lapot\./);
    expect(x.text).not.toMatch(/nem számolja/);
  });
});

describe("1. kör: Firelights' Hideout, a következő unit Accelerate-et kap (805.1.b, 805.6)", () => {
  it('a szabály: Accelerate = additional cost, kifizetve ready lép be', () => {
    expect(ruleText('805.1.b')).toMatch(/I enter ready/);
    expect(ruleText('805.6')).toMatch(/entering ready/);
  });
  it('nem kerül a chainre "kijátszás hatásból" spellként, hanem a kör hátralevő részére szóló engedély', () => {
    const x = run(cs({ turn: 'A', bf: [{ n: "Firelights' Hideout" }], steps: [{ k: 'tr', n: "Firelights' Hideout", src: null, pl: 'A', eff: 'the next unit you play this turn has [Accelerate].', why: 'When you conquer here' }, { k: 'end' }] }));
    expect(x.text).not.toMatch(/spell a chainre kerül/);
    expect(x.text).toMatch(/Accelerate-et kap \(805\.1\.b\); ha a kijátszáskor kifizetik, ready lép be \(805\.6\)/);
  });
});

describe('2. kör: copy effectek (446.1, 446.3, 479.1.b, 479.1.b.1, 479.1.c)', () => {
  const tokens = (x: ReturnType<typeof run>) => Object.values(x.r.objs).filter((o: any) => o.token) as any[];
  it('a szabály: a copy a másolható (nyomtatott vagy másolt) jellemzőket veszi át, a későbbi módosításokat nem', () => {
    expect(ruleText('479.1.b')).toMatch(/all traits of the Game Object are replaced/);
    expect(ruleText('479.1.b.1')).toMatch(/printed.*copied.*traits/);
    expect(ruleText('479.1.c')).toMatch(/distinct from the actual traits/);
    expect(ruleText('446.3')).toMatch(/created as a Copy/);
  });
  it('Mirror Image: a token a választott unit másolata (nyomtatott Might, damage nélkül), a [Temporary] a tokené', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0', d: 3 }], steps: [{ k: 'card', n: 'Mirror Image', pl: 'A', tg: ['b0'] }, { k: 'res' }] }));
    const [t] = tokens(x);
    expect(t).toMatchObject({ name: 'Mountain Drake (másolat)', m: 10, dmg: 0, ctrl: 'A', loc: 'base', ex: false, kws: ['Temporary'] });
    expect(t.card.n).toBe('Mountain Drake');
    expect(x.o('b0').kws).toEqual([]);
    expect(x.text).toMatch(/A token Mountain Drake másolata lesz.*\(446\.1, 479\.1\.b, 479\.1\.b\.1, 479\.1\.c\)/);
  });
  it('Mirror Image: ha a választott unit elhagyja a boardot, mistarget, a copy és a [Temporary] Ignored (359.3.e.14.a)', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Mirror Image', pl: 'A', tg: ['b0'] }, { k: 'card', n: 'Gust', pl: 'B', tg: ['b0'] }, { k: 'res' }, { k: 'res' }] }));
    const [t] = tokens(x);
    expect(t.name).toBe('Reflection token');
    expect(x.r.items.find((i: any) => i.name === 'Mirror Image').instr.map((i: any) => i.st)).toEqual(['ignored', 'executed', 'ignored', 'ignored']);
  });
  it('Keeper of Masks: a két Reflection token Keeper of Masks másolata', () => {
    const x = run(cs({ turn: 'A', steps: [{ k: 'card', n: 'Keeper of Masks', pl: 'A', loc: 'bf0' }, { k: 'res' }] }));
    expect(tokens(x).map((t) => [t.name, t.m, t.loc])).toEqual([['Keeper of Masks (másolat)', 1, 'bf0'], ['Keeper of Masks (másolat)', 1, 'bf0']]);
  });
  it('LeBlanc, Deceiver: a token ott jön létre, ahol a conquer volt (359.3.f.3), egy másik ott álló unit másolata, [Temporary]', () => {
    const cb = { bf: 'bf0', dead: [], recall: [], ctrl: 'A', label: 'teszt' };
    const x = run(cs({ turn: 'A', lg: { A: 'LeBlanc, Deceiver' }, bd: [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0' }], steps: [{ k: 'tr', n: 'LeBlanc, Deceiver', src: 'LA', pl: 'A', eff: 'you may discard 1 and exhaust me to play a ready Reflection unit token there. Then do this: It becomes a copy of another unit there. Give it [Temporary].', why: 'When you conquer or hold', tg: ['b1'], cb }] }));
    expect(tokens(x).map((t) => [t.name, t.m, t.loc, t.kws])).toEqual([['Mega-Mech (másolat)', 8, 'bf0', ['Temporary']]]);
    expect(x.o('LA').ex).toBe(true);
    expect(x.o('b1').kws).toEqual([]);
  });
  it('Zilean, Time Mage battlefielden: körönként egyszer egy további token-másolat (369.1, 446.3)', () => {
    const z = (loc: string) => run(cs({ turn: 'A', bd: [{ n: 'Zilean, Time Mage', pl: 'A', loc }], steps: [{ k: 'card', n: 'Recruit the Vanguard', pl: 'A' }, { k: 'res' }, { k: 'card', n: 'Recruit the Vanguard', pl: 'A' }, { k: 'res' }] }));
    expect(tokens(z('bf0'))).toHaveLength(9);
    expect(tokens(z('base'))).toHaveLength(8);
    expect(z('bf0').text).toMatch(/Zilean, Time Mage \(replacement, körönként egyszer\)/);
  });
  it('Shady Spectacles: csatoláskor a választott másik friendly unit másolata, a csatolás végéig (a cleanup visszaállítja)', () => {
    const bd = [{ n: 'Shady Spectacles', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'base' }, { n: 'Mountain Drake', pl: 'A', loc: 'bf0' }];
    const eq = { k: 'ab', src: 'b0', ai: 0, pl: 'A', n: 'Shady Spectacles', tg: ['b1', 'b2'] };
    const x = run(cs({ turn: 'A', bd, steps: [eq, { k: 'res' }] }));
    expect(x.o('b1')).toMatchObject({ name: 'Mountain Drake (Shipyard Skulker, másolat)', m: 10 });
    expect(x.o('b0').on).toBe('b1');
    const y = run(cs({ turn: 'A', bd, steps: [eq, { k: 'res' }, { k: 'card', n: 'Vengeance', pl: 'A', tg: ['b1'] }, { k: 'res' }] }));
    expect(y.o('b1')).toMatchObject({ name: 'Shipyard Skulker', zone: 'trash', m: 3 });
    expect(y.changes).toMatch(/a copy effect véget ér/);
    // választás nélkül (régi lépés, egy célpont) nincs copy, a csatolás ugyanaz
    const z = run(cs({ turn: 'A', bd, steps: [{ ...eq, tg: ['b1'] }, { k: 'res' }] }));
    expect(z.o('b1').name).toBe('Shipyard Skulker');
    expect(z.o('b0').on).toBe('b1');
  });
  it('Svellsongur: a csatolt unit szövege az Equipment Effect Textje, így a unit triggerei kétszer szerepelnek (435.1.d)', () => {
    const CS = cs({ bd: [{ n: 'Watchful Sentry', pl: 'A', loc: 'base' }, { n: 'Svellsongur', pl: 'A', loc: 'base', on: 0 }], steps: [] });
    expect(attachedEff(CS as never, 'b0')).toMatch(/Deathknell/);
    expect(triggersOf(vsCard('Watchful Sentry')!, attachedEff(CS as never, 'b0')).filter((t) => t.why === 'Deathknell')).toHaveLength(2);
  });
});

describe('Futásidejű leltár', () => {
  it('a még nem követett utasítások listája (minden kör szűkíti)', () => {
    const h = sweep();
    expect(h.filter((x) => x.k === 'hiba')).toEqual([]);
    expect([...new Set(h.map((x) => x.n))].sort()).toEqual(LELTAR);
  });
});
/* A leltár szerint még nem követett lapok (a lefutás egyszerű pályán, üres kéz, trash és deck mellett). */
const LELTAR = ['Chronobreak', 'Cursed Sarcophagus', 'Dancing Grenade', 'Death from Below', 'Forbidden Technique', 'Iascylla', 'Temporal Breach'];
