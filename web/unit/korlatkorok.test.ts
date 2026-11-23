/* Chain korlátok javítása körönként, valós lapokkal. A futásidejű leltár (unit/leltar.ts) őrzi, mely utasításokat nem követi még az elemzés. */
import { describe, expect, it } from 'vitest';
import { stepInfo } from '../src/domain/chain/steps';
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

describe('Futásidejű leltár', () => {
  it('a még nem követett utasítások listája (minden kör szűkíti)', () => {
    const h = sweep();
    expect(h.filter((x) => x.k === 'hiba')).toEqual([]);
    expect([...new Set(h.map((x) => x.n))].sort()).toEqual(LELTAR);
  });
});
/* A leltár szerint még nem követett lapok (a lefutás egyszerű pályán, üres kéz, trash és deck mellett). */
const LELTAR = ['Chronobreak', 'Cursed Sarcophagus', 'Dancing Grenade', 'Death from Below', 'Forbidden Technique', 'Iascylla', 'Temporal Breach'];
