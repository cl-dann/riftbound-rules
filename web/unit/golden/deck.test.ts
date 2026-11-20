/* Karakterizáció: parseDeck és checkDeck (plusz a legalitás és interakció HTML hash) valódi decklistákon,
   #d= linkeken és rb-deck localStorage értékeken (fixtures.json). */
import { expect, it } from 'vitest';
import { b64d } from '../../src/domain/text/b64';
import { checkDeck, setDeck } from '../../src/domain/deck/legality';
import { interactionHTML, legalityHTML } from '../../src/render/html/deck';
import { parseDeck } from '../../src/domain/deck/parse';
import FIX from './fixtures.json';
import { block, hash } from './serialize';

const deckOut = (text: string) => {
  const secs = parseDeck(text);
  setDeck(secs);
  const parsed = secs.map((s: any) => ({ name: s.name, rows: s.rows.map((r: any) => ({ qty: r.qty, name: r.name, card: r.card ? r.card.n : null, sug: r.sug.map((c: any) => c.n) })) }));
  return { parsed, check: checkDeck(), legality: hash(legalityHTML()), interaction: hash(interactionHTML()) };
};

it('rb-deck szövegek', async () => {
  await expect(Object.entries(FIX.rbDeck).map(([k, t]) => block(k, deckOut(t))).join('')).toMatchFileSnapshot('./__golden__/deck-texts.txt');
});

it('#d= linkek', async () => {
  await expect(Object.entries(FIX.deckLinks).map(([k, l]) => block(k, { text: b64d(l.slice(3)), ...deckOut(b64d(l.slice(3))) })).join('')).toMatchFileSnapshot('./__golden__/deck-links.txt');
});
