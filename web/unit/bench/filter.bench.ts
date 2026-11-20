/* Teljesítménymérés: a Kártyák fül szűrése (filterCards) tipikus keresésekkel, és a jegyzetek fogalom-kiemelése (glossify).
   Futtatás: npm run bench */
import { test } from 'vitest';
import { filterCards } from '../../src/features/cards/CardsView';
import { CARDS, notesHTML, qaHTML } from '../../src/legacy/core';
import { measure } from './measure';

const F = { q: '', type: '', dom: '', cost: '', might: '', set: '', kw: '', inText: false, onlyErr: false, showBan: false };
const QUERIES = ['ahri', 'sebzes', 'draw', 'kill a unit', 'jinx', 'yasou', 'xyzqw', 'tamad'];

test('filterCards: egy keresés (8 tipikus szó körbe: név, magyar szinonima, elgépelés, nincs találat)', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'filter', () => { filterCards({ ...F, q: QUERIES[i++ % QUERIES.length] }); });
});
test('filterCards: keresés a lapszövegben is', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'filterText', () => { filterCards({ ...F, q: QUERIES[i++ % QUERIES.length], inText: true }); });
});
test('filterCards: üres szűrő', async ({ bench }) => {
  await measure(bench, 'filterEmpty', () => { filterCards(F); });
});
test('glossify: egy lap jegyzetei és Gyakori kérdései', async ({ bench }) => {
  const cards = (CARDS as any[]).filter((c) => c.nt);
  let i = 0;
  await measure(bench, 'glossify', () => { const c = cards[i++ % cards.length]; notesHTML(c); qaHTML(c); });
});
