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
    expect(x.text).toMatch(/nyitott kérdés.*Shady Spectacles választása.*judge dönt/);
    expect(x.r.rows.find((r: any) => /Shady Spectacles választása/.test(r.join(' ')))!.join(' ')).toMatch(/f2|nyitott/);
    expect(x.o('b0').on).toBe('b1');
    const y = run(cs({ turn: 'A', bd, steps: [eq, { k: 'res' }, { k: 'card', n: 'Vengeance', pl: 'A', tg: ['b1'] }, { k: 'res' }] }));
    expect(y.o('b1')).toMatchObject({ name: 'Shipyard Skulker', zone: 'trash', m: 3 });
    expect(y.changes).toMatch(/a copy effect véget ér/);
    // választás nélkül (régi lépés, egy célpont) nincs copy, a csatolás ugyanaz
    const z = run(cs({ turn: 'A', bd, steps: [{ ...eq, tg: ['b1'] }, { k: 'res' }] }));
    expect(z.o('b1').name).toBe('Shipyard Skulker');
    expect(z.o('b0').on).toBe('b1');
  });
  it('Svellsongur: a csatolt unit szövege az Equipment Effect Textje, így a unit triggerei kétszer szerepelnek (435.1.c, 136.2.c)', () => {
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
  it('lefedettség: minden "adatot kér" utasítás kiváltható a pályán megadott lapokkal vagy a Játékállapottal (Twisted Fate: Rune Deck, Jhin: korábbi banish, 7. kör)', () => {
    const c = coverage();
    expect(c.hid.filter((h) => !c.pick.some((p) => h.startsWith(p))).map((h) => h.split(':')[0])).toEqual([]);
  });
});

describe('4. kör: "banished with", hatásból kijátszott lapok célpontjai, Chronobreak, Dancing Grenade', () => {
  const zb = (o: any) => ({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: 'A' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
  const go = (c: any) => { const r = analyze(JSON.parse(JSON.stringify(c))); return { r, text: r.rows.map((x) => x.join(' ')).join('\n'), o: (id: string) => r.objs[id] }; };
  const onBoard = (x: ReturnType<typeof go>, n: string) => Object.values(x.r.objs).filter((o: any) => o.name === n && o.zone === 'board');
  it('a szabály: kijátszás hatásból (420.3), a célpont a kijátszáskor (355.8), banishment (108.6)', () => {
    expect(ruleText('420.3')).toMatch(/Played as part of their resolution/);
    expect(ruleText('355.8')).toMatch(/valid choices must be made for all targets/);
    expect(ruleText('136.2.c')).toMatch(/appended to the Rules Text/);
  });
  it('Cursed Sarcophagus: a trash unitjai vele banishelődnek, a [T] ability a megadott lapot kijátssza (a költséget fizetni kell)', () => {
    const tr = { A: [{ id: 'ztA_1', n: 'Shipyard Skulker' }, { id: 'ztA_2', n: 'Flash' }, { id: 'ztA_3', n: 'Mega-Mech' }], B: [] };
    const x = go(zb({ trash: tr, steps: [{ k: 'card', n: 'Cursed Sarcophagus', pl: 'A', tg: [], ext: {} }, { k: 'res' }, { k: 'ab', src: 's0', ai: 0, pl: 'A', n: 'Cursed Sarcophagus', tg: [], ext: {}, plc: { 0: 'Mega-Mech' } }, { k: 'res' }] }));
    expect(x.o('ztA_1')).toMatchObject({ zone: 'banish', banWith: 's0' });
    expect(x.o('ztA_2').zone).toBe('trash');
    expect(onBoard(x, 'Mega-Mech')).toHaveLength(1);
    expect(x.text).toMatch(/Mega-Mech kijátszva a banishmentből \(Base, a költségét ki kell fizetni\)/);
    // a [T] ability nem kér board célpontot (a "unit banished with this" nem a board lapja)
    expect(stepInfo(cs({ bd: [{ n: 'Cursed Sarcophagus', pl: 'A', loc: 'base' }], steps: [] }) as never, { k: 'ab', src: 'b0', ai: 0, pl: 'A', n: 'Cursed Sarcophagus', tg: [], ext: {} } as never)!.list).toHaveLength(0);
  });
  it('The Zero Drive: a csatolt unit Equipment-ből kapott Deathknellje triggerel (435.1.c, 136.2.c), banishelődik vele, és az ability kijátssza', () => {
    const x = go(zb({ bd: [{ n: 'Shipyard Skulker', pl: 'A', loc: 'base' }, { n: 'The Zero Drive', pl: 'A', loc: 'base', on: 0 }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'], ext: {} }, { k: 'res' }, { k: 'res' }, { k: 'ab', src: 'b1', ai: 1, pl: 'A', n: 'The Zero Drive', tg: [], ext: {} }, { k: 'res' }] }));
    expect(x.text).toMatch(/a Deathknell The Zero Drive Effect Textjéből jön, így "banished with" The Zero Drive/);
    expect(onBoard(x, 'Shipyard Skulker')).toHaveLength(1);
    expect(x.text).toMatch(/Shipyard Skulker kijátszva a banishmentből \(Base, költség nélkül\)/);
  });
  it('Jhin, Virtuoso: a [4] fölötti spellek vele banishelődnek; a 4. után a trashbe kerülnek, channel 4 és draw 1, előtte a folytatás sem fut', () => {
    const steps: any[] = []; for (let i = 0; i < 4; i++) steps.push({ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b' + i], ext: {} }, { k: 'res' }, { k: 'res' });
    const x = go(zb({ lg: { A: 'Jhin, Virtuoso' }, ps: { A: { spent: 5 } }, bd: [0, 1, 2, 3].map(() => ({ n: 'Mega-Mech', pl: 'B', loc: 'bf0' })), steps }));
    expect(x.text).toMatch(/ebben a helyzetben 3 spell banishelve vele.*"draw 1\.": az előző feltételes utasítás folytatása/s);
    expect(x.text).toMatch(/ebben a helyzetben 4 spell banishelve vele/);
    expect(x.r.ev.filter((e: any) => ['draw', 'channel'].includes(e.k)).map((e: any) => [e.k, e.n])).toEqual([['channel', 4], ['draw', 1]]);
    expect(Object.values(x.r.objs).filter((o: any) => /^Vengeance/.test(o.name) && o.zone === 'trash')).toHaveLength(4);
  });
  it('hatásból kijátszott spell (Fizz, Death from Below): a célpont az első legális választás, a többi felsorolva (355.8)', () => {
    const x = go(zb({ bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }, { n: 'Blastcone Fae', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Death from Below', pl: 'A', tg: ['b0'], ext: {} }, { k: 'res' }, { k: 'res' }] }));
    expect(x.text).toMatch(/Death from Below spell a chainre kerül.*az elemzés az első legális választással számol: 1\. célpont: Blastcone Fae/s);
    expect(x.o('b1').zone).toBe('trash');
  });
  it('Chronobreak: a kifizetett Power számú választott saját unit banishelődik és új objektumként visszatér ugyanoda (428, 420.3, 359.3.e.4)', () => {
    const x = go(zb({ bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0', d: 3 }, { n: 'Blastcone Fae', pl: 'A', loc: 'base' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Chronobreak', pl: 'A', tg: [], ext: {}, hv: { 0: 1 }, zp: { 0: ['b0', 'b1', 'b2'] } }, { k: 'res' }] }));
    expect(x.o('b0').zone).toBe('gone');
    expect(x.o('b0r')).toMatchObject({ zone: 'board', loc: 'bf0', dmg: 0 });
    expect(x.o('b1').zone).toBe('board');
    expect(x.o('b2').zone).toBe('board');
  });
  it('Dancing Grenade: az újrakijátszó a célpont irányítója, a második példány +1 Bonus Damage-et kap (715.1); további újrakijátszás nincs', () => {
    const x = go(zb({ bd: [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Dancing Grenade', pl: 'A', tg: ['b0'], ext: {} }, { k: 'res' }, { k: 'res' }] }));
    expect(x.text).toMatch(/Az újrakijátszó a célpont irányítója \(az ellenfél\)/);
    expect(x.o('b0').dmg).toBe(5);
    expect(x.text).toMatch(/a további újrakijátszás ismét "may" döntés/);
  });
  it('Temporal Breach: az újra kijátszott unit play triggere is célpontot kap (403.4.b)', () => {
    const x = go(zb({ bd: [{ n: 'Blastcone Fae', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Temporal Breach', pl: 'A', tg: ['b0'], ext: {} }, { k: 'res' }, { k: 'res' }] }));
    expect(x.text).toMatch(/A play effectje is triggerel \(403\.4\.b\); az elemzés az első legális választással számol/);
    expect(x.text).not.toMatch(/nem követi/);
  });
});

describe('5. kör: halálra figyelő triggerek, ready belépés, Mordekaiser (383.2.c.2, 143.4.a, 369.1)', () => {
  const kill = (bd: any[], tg: string, extra: any = {}) => run({ ...cs({ turn: 'A', bd, steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: [tg] }, { k: 'res' }, { k: 'res' }] }), ...extra });
  const trig = (x: ReturnType<typeof run>, n: string) => x.r.items.some((i: any) => i.name.startsWith(n + ' triggere'));
  it('Demacian Illuminators: "one or more friendly units die", egy trigger, célpont a buffhoz', () => {
    const x = kill([{ n: 'Demacian Illuminators', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'base' }], 'b1');
    expect(trig(x, 'Demacian Illuminators')).toBe(true);
    expect(x.o('b0').bu).toBe(true);
  });
  it('Nasus, Guardian of Knowledge: csak az itt meghalt enemy unitra (channel 1)', () => {
    const here = kill([{ n: 'Nasus, Guardian of Knowledge', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], 'b1');
    expect(here.r.ev.filter((e: any) => e.k === 'channel')).toHaveLength(1);
    const away = kill([{ n: 'Nasus, Guardian of Knowledge', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'base' }], 'b1');
    expect(trig(away, 'Nasus, Guardian of Knowledge')).toBe(false);
  });
  it('Pyke, Returned: csak ha Pyke battlefielden áll', () => {
    expect(trig(kill([{ n: 'Pyke, Returned', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'base' }], 'b1'), 'Pyke, Returned')).toBe(true);
    expect(trig(kill([{ n: 'Pyke, Returned', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'base' }], 'b1'), 'Pyke, Returned')).toBe(false);
  });
  it('Storm Raptor: a stunned enemy unit itt (utolsó ismert állapot)', () => {
    expect(trig(kill([{ n: 'Storm Raptor', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', st: true }], 'b1'), 'Storm Raptor')).toBe(true);
    expect(trig(kill([{ n: 'Storm Raptor', pl: 'A', loc: 'bf0' }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0' }], 'b1'), 'Storm Raptor')).toBe(false);
  });
  it('Vanguard Helm: a buffolt friendly unit halála, a buff egy másik friendly unitra kerül', () => {
    const x = kill([{ n: 'Vanguard Helm', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'base', bu: true }, { n: 'Mega-Mech', pl: 'A', loc: 'base' }], 'b1');
    expect(trig(x, 'Vanguard Helm')).toBe(true);
    expect(x.o('b2').bu).toBe(true);
    expect(trig(kill([{ n: 'Vanguard Helm', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'base' }, { n: 'Mega-Mech', pl: 'A', loc: 'base' }], 'b1'), 'Vanguard Helm')).toBe(false);
  });
  it('Sivir, Battle Mistress (legend): "one or more enemy units die", ready', () => {
    const x = run(cs({ turn: 'A', lg: { A: 'Sivir, Battle Mistress' }, bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'base' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }, { k: 'res' }, { k: 'res' }] }));
    expect(trig(x, 'Sivir, Battle Mistress')).toBe(true);
  });
  it('Battlefield Armorer: battlefielden meghalt friendly gear, "it" a gear', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Battlefield Armorer', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'A', loc: 'bf0' }, { n: 'Long Sword', pl: 'A', loc: 'bf0', on: 1 }],
      steps: [{ k: 'tr', n: 'Stalwart Goatherd', src: null, pl: 'B', eff: 'kill a gear.', why: 'x', tg: ['b2'] }] }));
    expect(x.changes).toMatch(/Battlefield Armorer triggerel, mert Long Sword meghalt/);
    expect(x.changes).toMatch(/Long Sword a tulajdonosa kezébe kerül/);
  });
  it('Master Yi, Wuju Master: XP 11-től a unitok ready lépnek be; a saját magára vonatkozó sor (Bandle Soldier) nem ad hamis jelzést', () => {
    const y = run({ ...cs({ lg: { A: 'Master Yi, Wuju Master' }, steps: [{ k: 'card', n: 'Shipyard Skulker', pl: 'A' }] }), ps: { A: { xp: 11 } } } as never);
    expect(y.o('s0').ex).toBe(false);
    const b = run(cs({ bd: [{ n: 'Bandle Soldier', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Shipyard Skulker', pl: 'A' }] }));
    expect(b.text).not.toMatch(/nem követett ready belépés/);
  });
  it('Mordekaiser, Twice Slain: körönként egyszer egy másik friendly unit hal meg helyette, ő gyógyulva, exhausted a base-be kerül', () => {
    const x = run(cs({ turn: 'A', bd: [{ n: 'Mordekaiser, Twice Slain', pl: 'A', loc: 'bf0', d: 2 }, { n: 'Mega-Mech', pl: 'A', loc: 'base' }, { n: 'Shipyard Skulker', pl: 'A', loc: 'base' }],
      steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }, { k: 'res' }, { k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }, { k: 'res' }] }));
    expect(x.text).toMatch(/a legkisebb Mightú másik friendly unitot öli meg: Shipyard Skulker \(választható helyette: Mega-Mech\)/);
    expect(x.o('b2').zone).toBe('trash');
    // a második kill már nem helyettesíthető (körönként egyszer)
    expect(x.o('b0').zone).toBe('trash');
    expect(x.o('b1').zone).toBe('board');
    const solo = run(cs({ turn: 'A', bd: [{ n: 'Mordekaiser, Twice Slain', pl: 'A', loc: 'bf0' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'] }, { k: 'res' }] }));
    expect(solo.o('b0').zone).toBe('trash');
  });
});

describe('7. kör: Rune Deck és rune pool tartalma, Jhin előzménye (417, 431.1)', () => {
  const zb = (o: any) => ({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: 'A' }, { n: '', c: '' }], bd: [], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] }, ...o });
  const go = (c: any) => { const r = analyze(JSON.parse(JSON.stringify(c))); return { r, text: r.rows.map((x) => x.join(' ')).join('\n'), o: (id: string) => r.objs[id], last: r.frames[r.frames.length - 1].board }; };
  const rd = (...n: string[]) => ({ A: n.map((x, i) => ({ id: 'zrA_' + (i + 1), n: x })), B: [] });
  const tf = (deck?: any) => go(zb({ ...(deck ? { runeDeck: deck } : {}), bd: [{ n: 'Twisted Fate, Gambler', pl: 'A', loc: 'bf0' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0' }, { n: 'Blastcone Fae', pl: 'B', loc: 'bf0' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Twisted Fate, Gambler', tg: [], ext: {} }] }));
  it('a szabály: channel és recycle', () => {
    expect(ruleText('431.1')).toBeTruthy();
    expect(ruleText('417')).toMatch(/Recycle/);
  });
  it('Twisted Fate, Gambler: a megadott Rune Deck felső rune-ja dönt, recycle az aljára; Fury: 2 damage a célpontra, 1 a többi enemy unitra itt', () => {
    const x = tf(rd('Fury Rune', 'Mind Rune'));
    expect(x.text).toMatch(/felfedve Fury Rune/);
    expect(x.o('zrA_1')).toMatchObject({ zone: 'runedeck' });
    expect(x.o('zrA_1').ord).toBeGreaterThanOrEqual(900);
    expect([x.o('b1').dmg, x.o('b2').dmg]).toEqual([2, 1]);
    const m = tf(rd('Mind Rune'));
    expect(m.r.ev.filter((e: any) => e.k === 'draw')).toHaveLength(1);
    expect(m.o('b1').dmg).toBe(0);
    // Rune Deck tartalom nélkül a régi viselkedés: a mező alapértéke ("más"), egyik pont sem
    const n = tf();
    expect(n.o('b1').dmg).toBe(0);
    expect(n.r.ev.filter((e: any) => e.k === 'draw')).toHaveLength(0);
  });
  it('channel: a megadott Rune Deck felső lapjai a poolba kerülnek, a darabszámok ebből számolnak', () => {
    const x = go(zb({ runeDeck: rd('Calm Rune', 'Body Rune', 'Fury Rune'), runePool: { A: [{ id: 'zpA_1', n: 'Mind Rune' }], B: [] }, steps: [{ k: 'card', n: 'Mobilize', pl: 'A', tg: [], ext: {} }, { k: 'res' }] }));
    expect(x.o('zrA_1')).toMatchObject({ zone: 'runes', ex: true });
    expect(x.last.me.runeDeck).toBe(2);
    expect(x.last.me.runes).toEqual({ ready: 1, exhausted: 1, domains: ['Mind', 'Calm'] });
  });
  it('Divine Judgment: a megadott poolból a választott 2 rune marad a domainjével, a többi a Rune Deck aljára', () => {
    const pool = { A: ['Fury Rune', 'Calm Rune', 'Mind Rune', 'Body Rune'].map((n, i) => ({ id: 'zpA_' + (i + 1), n })), B: [] };
    const x = go(zb({ runePool: pool, runeDeck: rd('Order Rune'), bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'base' }], steps: [{ k: 'card', n: 'Divine Judgment', pl: 'A', tg: [], ext: {}, zp: { 0: ['b0', 'zpA_2', 'zpA_4'] } }] }));
    expect(x.text).toMatch(/Te rune-jai: marad Calm Rune, Body Rune; recycle a Rune Deck aljára: Fury Rune, Mind Rune \(417\)/);
    expect(x.last.me.runes.domains).toEqual(['Calm', 'Body']);
    expect(x.last.me.runeDeck).toBe(3);
  });
  it('Coalesced Energy jellegű "recycle all your runes" és Hwei gear pontja: ready up to 2 runes a poolban', () => {
    const x = go(zb({ hand: { A: [{ id: 'zhA_1', n: 'Long Sword' }], B: [] }, deck: { A: [{ id: 'zdA_1', n: 'Flash' }], B: [] }, runePool: { A: [{ id: 'zpA_1', n: 'Calm Rune', ex: true }, { id: 'zpA_2', n: 'Fury Rune', ex: true }, { id: 'zpA_3', n: 'Body Rune', ex: true }], B: [] },
      bd: [{ n: 'Hwei, Brooding Painter', pl: 'A', loc: 'bf0' }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Hwei, Brooding Painter', tg: [], ext: {}, zp: { 1: ['zhA_1'] } }] }));
    expect(x.text).toMatch(/"Ready up to 2 runes\.": Calm Rune, Fury Rune ready lesz/);
    expect(x.last.me.runes).toMatchObject({ ready: 2, exhausted: 1 });
  });
  it('Jhin, Virtuoso: a Játékállapotban megadott korábbi banish (3) és egy új spell már négy', () => {
    const x = go(zb({ lg: { A: 'Jhin, Virtuoso' }, ps: { A: { spent: 5, jhinBan: 3 } }, bd: [{ n: 'Mega-Mech', pl: 'B', loc: 'bf0' }], steps: [{ k: 'card', n: 'Vengeance', pl: 'A', tg: ['b0'], ext: {} }, { k: 'res' }, { k: 'res' }] }));
    expect(x.text).toMatch(/ebben a helyzetben 1 spell banishelve vele, korábban 3 \(a Játékállapotban megadott feltételezés, alap 0\)/);
    expect(x.r.ev.filter((e: any) => e.k === 'channel').map((e: any) => e.n)).toEqual([4]);
  });
});

describe('Futásidejű leltár', () => {
  it('a még nem követett utasítások listája (minden kör szűkíti)', () => {
    const h = sweep();
    expect(h.filter((x) => x.k === 'hiba')).toEqual([]);
    expect([...new Set(h.map((x) => x.n))].sort()).toEqual(LELTAR);
  });
});
/* A leltár szerint még nem követett lapok (a lefutás egyszerű pályán, üres kéz, trash és deck mellett). Iascylla: a következő kör Main Phase-ére
   szóló késleltetett trigger (391.2); a builder egy kört elemez. */
const LELTAR = ['Iascylla'];
