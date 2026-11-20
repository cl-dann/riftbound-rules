/* A határokon (S18) a séma csak ellenőriz: a régi #c= és #d= linkek, az rb-deck és rb-view2 értékek és a prices.json
   ugyanazt adják, mint korábban; érvénytelen bemenetnél a korábbi alapérték. */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { chainFromLink } from '../../src/domain/chain/link';
import { deckFromHash } from '../../src/domain/deck/link';
import { parsePrices } from '../../src/domain/deck/prices';
import { b64d, b64e } from '../../src/domain/text/b64';
import { hasDeck, readDeck, readViewMode, writeDeck, writeViewMode } from '../../src/shared/lib/storage';
import CASES from './cases.json';
import FIX from './fixtures.json';

describe('#c= linkek', () => {
  it.each(Object.entries(FIX.chainLinks))('%s: betölthető, változatlan tartalommal', (_k, link) => {
    expect(chainFromLink(link.slice(3))).toEqual(JSON.parse(b64d(link.slice(3))));
  });
  it('a unit tesztek mind a 305 helyzete érvényes link lenne', () => {
    for (const c of CASES as unknown[]) expect(chainFromLink(b64e(JSON.stringify(c)))).not.toBeNull();
  });
  it('érvénytelen link: null', () => {
    expect(chainFromLink('nem-base64!')).toBeNull();
    expect(chainFromLink(b64e('{"x":1}'))).toBeNull();
    expect(chainFromLink(b64e('[1,2]'))).toBeNull();
  });
});

describe('#d= linkek', () => {
  it.each(Object.entries(FIX.deckLinks))('%s', (_k, link) => { expect(deckFromHash(link)).toBe(b64d(link.slice(3))); });
  it('nem deck hash vagy hibás kódolás: null', () => { expect(deckFromHash('#deck')).toBeNull(); expect(deckFromHash('#d=%%%')).toBeNull(); });
});

describe('prices.json', () => {
  it('a commitolt árfájl érvényes', () => {
    const j = JSON.parse(readFileSync('public/prices.json', 'utf8'));
    expect(parsePrices(j)).toBe(j);
  });
  it('hibás árfájl: nincs ár', () => { expect(parsePrices({ cards: {} })).toBeNull(); expect(parsePrices(null)).toBeNull(); });
});

describe('localStorage (rb-deck, rb-view2)', () => {
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  afterEach(() => mem.clear());
  it('rb-view2: grid és list marad, más érték vagy hiány esetén grid', () => {
    expect(readViewMode()).toBe('grid');
    writeViewMode('list'); expect(mem.get('rb-view2')).toBe('list'); expect(readViewMode()).toBe('list');
    mem.set('rb-view2', 'valami'); expect(readViewMode()).toBe('grid');
  });
  it('rb-deck: a szöveg változatlanul', () => {
    expect(hasDeck()).toBe(false); expect(readDeck()).toBe('');
    writeDeck(FIX.rbDeck.legal); expect(mem.get('rb-deck')).toBe(FIX.rbDeck.legal); expect(readDeck()).toBe(FIX.rbDeck.legal); expect(hasDeck()).toBe(true);
  });
});
