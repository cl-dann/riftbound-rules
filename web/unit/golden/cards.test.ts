/* Karakterizáció: a kártya-HTML függvények kimenete mind az 1101 lapra (hash laponként), és 5 lapra teljes szövegben. */
import { expect, it } from 'vitest';
import { CARDS, cardHeadHTML, cardRulesHTML, esc, glossify, notesHTML, qaHTML } from '../../src/legacy/core';
import { hash } from './serialize';

const fns = (c: any) => ({
  head: cardHeadHTML(c, 'h2'),
  rules: cardRulesHTML(c),
  qa: qaHTML(c),
  notes: notesHTML(c),
  gloss: glossify(esc(c.sh || '') + ' | ' + esc(c.txt || '')),
});

it('1101 lap HTML hash', async () => {
  expect(CARDS.length).toBe(1101);
  const lines = (CARDS as any[]).map((c) => { const f: any = fns(c); return [c.n, c.code, ...Object.keys(f).map((k) => k + ':' + hash(f[k]))].join(' | '); });
  await expect(lines.join('\n') + '\n').toMatchFileSnapshot('./__golden__/cards-hash.txt');
});

it('5 lap teljes HTML', async () => {
  const pick = ['Jinx, Loose Cannon', 'Hidden Blade', 'Baited Hook', 'Flash', 'Ahri, Alluring'];
  const txt = pick.map((n) => { const c = (CARDS as any[]).find((x) => x.n === n); const f: any = fns(c); return '### ' + n + '\n' + Object.keys(f).map((k) => k + ': ' + f[k]).join('\n') + '\n'; }).join('');
  await expect(txt).toMatchFileSnapshot('./__golden__/cards-full.txt');
});
