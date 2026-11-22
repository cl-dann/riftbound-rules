/* Deck és ár: nyomat a decklistában (visszafelé kompatibilis jelölés), a sor ára, legend-megfelelés (Core Rules 103),
   ártörténet dekódolása. */
import { describe, expect, it } from 'vitest';
import { CARDS, byName } from '../src/domain/data/store';
import { parseDeck } from '../src/domain/deck/parse';
import { rowPrice, setPrinting, priceOf } from '../src/domain/deck/edit';
import { splitPr, withPr, prPrice } from '../src/domain/deck/printing';
import { legendsFor } from '../src/domain/deck/legends';
import { decodeSeries, printingSeries } from '../src/domain/deck/historyData';
import { norm } from '../src/domain/text/norm';
import type { Prices } from '../src/domain/deck/prices';

const card = (n: string) => byName.get(norm(n))!;
const P = { updated: '2026-11-19', cards: { 'ahri inquisitive': { a1: 1, a7: 2, id: 1 } }, pr: { 'ogn-119a-298': { a1: 4, a7: 5, f1: 6, f7: 7, id: 2 } } } as unknown as Prices;

describe('nyomat a decklistában', () => {
  it('jelölés nélkül a régi viselkedés, jelöléssel a nyomat', () => {
    expect(splitPr('Ahri, Inquisitive')).toEqual({ name: 'Ahri, Inquisitive' });
    expect(splitPr('Ahri, Inquisitive [ogn-119a-298 foil]')).toEqual({ name: 'Ahri, Inquisitive', pr: 'ogn-119a-298', foil: true });
    expect(withPr('Ahri, Inquisitive [x]', null, false)).toBe('Ahri, Inquisitive');
    const [s] = parseDeck('MainDeck:\n2 Ahri, Inquisitive [ogn-119a-298 foil]\n1 Ahri, Inquisitive');
    expect(s.rows[0]).toMatchObject({ qty: 2, name: 'Ahri, Inquisitive', pr: 'ogn-119a-298', foil: true });
    expect(s.rows[0].card?.n).toBe('Ahri, Inquisitive');
    expect(s.rows[1]).not.toHaveProperty('pr');
  });
  it('a sor ára a választott nyomatból, alapból a legolcsóbb', () => {
    const c = card('Ahri, Inquisitive');
    expect(rowPrice(P, { card: c })).toEqual(priceOf(c, P));
    expect(rowPrice(P, { card: c, pr: 'ogn-119a-298', foil: true })).toEqual({ a1: 6, a7: 7 });
    expect(prPrice(P, 'ogn-119a-298', false)).toEqual({ a1: 4, a7: 5 });
    expect(prPrice(P, 'nincs', false)).toBeNull();
  });
  it('setPrinting a szövegbe írja, és vissza is állítható', () => {
    const c = card('Ahri, Inquisitive');
    const t = setPrinting('MainDeck:\n2 Ahri, Inquisitive\n', 'MainDeck', c, 'ogn-119a-298', false);
    expect(t).toContain('2 Ahri, Inquisitive [ogn-119a-298]');
    expect(setPrinting(t, 'MainDeck', c, null, false)).toContain('2 Ahri, Inquisitive\n');
  });
});

describe('melyik legenddel játszható (103)', () => {
  it('két domain: csak a mindkettőt tartalmazó legendek (103.2.b.4)', () => {
    const f = legendsFor(card('Jinx, Loose Cannon'), CARDS);
    expect(f).toBeNull();
    const g = legendsFor(card('Acceleration Gate'), CARDS)!;
    expect(g.legends.map((x) => x.n)).toEqual(['Jayce, Defender of Tomorrow']);
    expect(g.why.map((w) => w[0])).toEqual(['103.2.b.4', '103.3.d, 103.3.d.2']);
  });
  it('champion unit: Chosen Champion csak az azonos tagű legenddel (103.3.a.2)', () => {
    const f = legendsFor(card('Jinx, Demolitionist'), CARDS)!;
    expect(f.legends.length).toBe(CARDS.filter((x) => x.t === 'Legend' && x.d.includes('Fury')).length);
    expect(f.chosen.map((x) => x.n)).toEqual(['Jinx, Loose Cannon']);
  });
  it('domain nélküli lap és rune', () => {
    const bf = legendsFor(CARDS.find((x) => x.t === 'Battlefield')!, CARDS)!;
    expect(bf.all).toBe(true);
    expect(bf.why[0][0]).toBe('103.5.b, 103.2.b.5');
    const r = legendsFor(card('Fury Rune'), CARDS)!;
    expect(r.all).toBe(false);
    expect(r.why[0][0]).toBe('103.4.a.1');
  });
});

describe('ártörténet', () => {
  it('delta kódolás dekódolása és a legalább 2 pontos sorok', () => {
    expect(decodeSeries([500, null, -20, 0])).toEqual([5, null, 4.8, 4.8]);
    const h = { v: 1, d: ['a', 'b'], s: { x: { n: [100, 10], f: [null, 200] } } };
    expect(printingSeries(h, 'x')).toEqual({ n: [1, 1.1], f: null });
  });
});
