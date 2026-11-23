/* Chain korlátok javítása körönként, valós lapokkal. A futásidejű leltár (unit/leltar.ts) őrzi, mely utasításokat nem követi még az elemzés. */
import { describe, expect, it } from 'vitest';
import { attachedEff, stepInfo } from '../src/domain/chain/steps';
import { triggersOf } from '../src/domain/chain/parser';
import { vsCard } from '../src/domain/data/store';
import { migrateTg, normZones } from '../src/domain/chain/cs';
import { cs, ruleText, run } from './util';
import { sweep } from './leltar';
import { coverage } from './lefedettseg';
import { analyze } from '../src/render/html/chainReport';

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

describe('3. kör: rejtett adat a pályás építőben megadott lapokból (108.4.e, 128.4, 128.5)', () => {
  const zb = (o: any) => ({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: 'A' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
  const dk = (...n: string[]) => ({ A: n.map((x, i) => ({ id: 'zdA_' + (i + 1), n: x })), B: [] });
  const hd = (...n: string[]) => ({ A: n.map((x, i) => ({ id: 'zhA_' + (i + 1), n: x })), B: [] });
  const go = (c: any) => { const r = analyze(JSON.parse(JSON.stringify(c))); return { r, text: r.rows.map((x) => x.join(' ')).join('\n'), o: (id: string) => r.objs[id] }; };
  it('Ivern, Nurturer: a felfedett unit tagje dönt (Poro: van [Buff], nem Bird/Cat/Dog/Poro: nincs)', () => {
    const ivern = (top: string) => go(zb({ deck: dk('Long Sword', top), bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Ivern, Nurturer', pl: 'A', loc: 'base', tg: ['b0'], ext: {}, zp: { 1: ['zdA_2'] } }] }));
    const yes = ivern('Daring Poro');
    expect(yes.text).toMatch(/"you revealed a Bird"\) teljesül \(a pályás építőben megadott lapok alapján: Daring Poro \(.*Poro/);
    expect(yes.o('b0').bu).toBe(true);
    const no = ivern('Shipyard Skulker');
    expect(no.text).toMatch(/"you revealed a Bird"\) nem teljesül \(a pályás építőben megadott lapok alapján: Shipyard Skulker/);
    expect(no.o('b0').bu).toBe(false);
  });
  it('Ava Achiever: a kézből kijátszott [Hidden] unit ide kerül ("If it\'s a unit, play it here")', () => {
    const x = go(zb({ hand: hd('Bedeviling Stranger'), bd: [{ n: 'Ava Achiever', pl: 'A', loc: 'bf0' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Ava Achiever', tg: [], ext: {}, zp: { 0: ['zhA_1'] } }] }));
    expect(Object.values(x.r.objs).find((o: any) => o.name === 'Bedeviling Stranger' && o.zone === 'board')).toMatchObject({ loc: 'bf0' });
    expect(x.text).toMatch(/a lap unit, az előző utasítással már ide került \(1\. battlefield\)/);
  });
  it('Pakaa Protector: nem unit felső lap a trashbe, +2 Might; unit: kézbe, nincs +2 (135.2.b.5.a)', () => {
    const pk = (top: string) => go(zb({ deck: dk(top), bd: [{ n: 'Pakaa Protector', pl: 'A', loc: 'bf0' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Pakaa Protector', tg: [], ext: {} }] }));
    const sp = pk('Flash');
    expect(sp.o('zdA_1').zone).toBe('trash');
    expect(sp.text).toMatch(/Pakaa Protector Mightja 4 → 6/);
    const un = pk('Shipyard Skulker');
    expect(un.o('zdA_1').zone).toBe('hand');
    expect(un.text).not.toMatch(/Mightja 4 → 6/);
  });
  it('Ravenbloom Conservatory: spell a kézbe, más recycle (417)', () => {
    const rv = (top: string) => go(zb({ deck: dk(top, 'Block'), steps: [{ k: 'tr', n: 'Ravenbloom Conservatory', src: null, pl: 'A', eff: "reveal the top card of your Main Deck. If it's a spell, put it in your hand. Otherwise, recycle it.", why: 'When you defend here', tg: [], ext: {} }] }));
    expect(rv('Flash').r.objs.zdA_1.zone).toBe('hand');
    const u = rv('Shipyard Skulker');
    expect(u.r.objs.zdA_1).toMatchObject({ zone: 'deck' });
    expect(u.r.objs.zdA_1.ord).toBeGreaterThanOrEqual(900);
  });
  it('Forgotten Relic: [Burn 1] a felső lapot a trashbe teszi; unit esetén annak Mightja, más lapnál nincs reflexív hatás', () => {
    const fr = (top: string) => go(zb({ deck: dk(top), bd: [{ n: 'Forgotten Relic', pl: 'A', loc: 'base' }, { n: 'Daring Poro', pl: 'A', loc: 'base' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Forgotten Relic', tg: ['b1'], ext: {} }] }));
    const u = fr('Mega-Mech');
    expect(u.o('zdA_1').zone).toBe('trash');
    expect(u.text).toMatch(/Daring Poro \+8 Might ebben a körben \(az égetett unit Mightja\)/);
    const s = fr('Flash');
    expect(s.text).toMatch(/az égetett lap \(Flash\) nem unit/);
    expect(s.text).not.toMatch(/Daring Poro \+/);
  });
  it('Teemo, Strategist: a felfedett 5 lap [Hidden] lapjai adják a damage-et, utána recycle', () => {
    const x = go(zb({ deck: dk('Ava Achiever', 'Flash', 'Back Off', 'Mega-Mech', 'Shipyard Skulker'), bd: [{ n: 'Teemo, Strategist', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Teemo, Strategist', tg: ['b1'], ext: {} }] }));
    expect(x.text).toMatch(/közül 2 \[Hidden\] lap: Ava Achiever, Back Off/);
    expect(x.o('b1').dmg).toBe(2);
    expect(x.o('zdA_1').ord).toBeGreaterThanOrEqual(900);
  });
  it('Scrutinizing Scope: az ellenfél tippje (a lapnál) és a felfedett lap típusa dönt; a felfedés nem recycle-öl előre', () => {
    const sc = (guess: string) => go(zb({ deck: dk('Flash'), bd: [{ n: 'Scrutinizing Scope', pl: 'A', loc: 'base' }], steps: [{ k: 'ab', src: 'b0', ai: 0, pl: 'A', n: 'Scrutinizing Scope', tg: [], ext: {}, hv: { 1: guess } }] }));
    const hit = sc('spell');
    expect(hit.text).toMatch(/tipp: spell, felfedve: Flash \(spell\)/);
    expect(hit.o('zdA_1').zone).toBe('deck');
    const miss = sc('unit');
    expect(miss.o('zdA_1').zone).toBe('hand');
  });
  it('Gutter Palace: a megadott kéz mérete és a battlefielden álló unitok száma', () => {
    const units = ['Mega-Mech', 'Shipyard Skulker', 'Daring Poro', 'Blastcone Fae'].map((n) => ({ n, pl: 'A', loc: 'bf0' }));
    const gp = (h: string[]) => go(zb({ hand: hd(...h), bd: [{ n: 'Gutter Palace', pl: 'A', loc: 'base' }, ...units], steps: [{ k: 'tr', n: 'Gutter Palace', src: 'b0', pl: 'A', eff: 'if you have exactly 4 cards in hand and exactly 4 units at battlefields, you win the game.', why: 'At the start of your Beginning Phase', tg: [], ext: {} }] }));
    expect(gp(['Flash', 'Flash', 'Flash', 'Flash']).text).toMatch(/teljesül \(a pályás építőben megadott lapok alapján: kéz: 4 lap/);
    expect(gp(['Flash']).text).toMatch(/nem teljesül \(a pályás építőben megadott lapok alapján: kéz: 1 lap/);
  });
  it('Invert Timelines: mindkét játékos eldobja a megadott kezét (423.1), majd mindkettő húz 4-et', () => {
    const x = go(zb({ hand: { A: [{ id: 'zhA_1', n: 'Flash' }], B: [{ id: 'zhB_1', n: 'Block' }] }, steps: [{ k: 'card', n: 'Invert Timelines', pl: 'A', tg: [], ext: {} }] }));
    expect(x.o('zhA_1').zone).toBe('trash');
    expect(x.o('zhB_1').zone).toBe('trash');
    expect(x.r.ev.filter((e: any) => e.k === 'draw').map((e: any) => [e.pl, e.n]).sort()).toEqual([['A', 4], ['B', 4]]);
  });
  it('Divine Judgment: a rune-ok száma a megtartott 2-re csökken, a többi recycle a Rune Deckbe (417)', () => {
    const x = go(zb({ ps: { A: { runes: 5, runeDeck: 3 }, B: { runes: 1 } }, bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Divine Judgment', pl: 'A', tg: [], ext: {}, zp: { 0: ['b0'] } }] }));
    expect(x.text).toMatch(/Te rune-jai: 5 → 2, a többi 3 recycle a Rune Deck aljára \(417\)/);
    expect(x.text).not.toMatch(/Az ellenfél rune-jai/);
  });
  it('Clocktower Guardian (Deathknell, lépés nélküli trigger): a banishelt felső lapot kijátssza', () => {
    const x = go(zb({ deck: dk('Shipyard Skulker'), bd: [{ n: 'Clocktower Guardian', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'], ext: {} }, { k: 'res' }] }));
    expect(x.o('zdA_1').zone).toBe('played');
    expect(Object.values(x.r.objs).some((o: any) => o.name === 'Shipyard Skulker' && o.zone === 'board')).toBe(true);
  });
  it('lefedettség: az "adatot kér" utasítások közül csak a builderen kívüli adat marad (Jhin előzmény, Twisted Fate rune deck)', () => {
    const c = coverage();
    expect(c.hid.filter((h) => !c.pick.some((p) => h.startsWith(p))).map((h) => h.split(':')[0])).toEqual(['Jhin, Virtuoso', 'Twisted Fate, Gambler']);
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
