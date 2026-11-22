/* Azonos nevű lapok a Chainben: a pályán lévő példányok sorszámot kapnak (#1, #2), és ugyanez szerepel az elemzés
   szövegében, a frame-ekben és a célpont-választóban. Ahol egy névből egy példány van, a név változatlan. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/render/html/chainReport';
import { bdLabelOf, instNos, tgOptionsOf } from '../src/domain/chain/cs';
import type { ChainState } from '../src/domain/chain/state';
import { TEMPLATES } from '../src/domain/chain/templates';

const cs = (): ChainState => ({
  lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }],
  bd: [{ n: 'Watchful Sentry', pl: 'A', loc: 'base' }, { n: 'Watchful Sentry', pl: 'B', loc: 'bf0' }, { n: 'Teemo, Scout', pl: 'A', loc: 'base' }],
  steps: [{ k: 'card', n: 'The Ruination', pl: 'A', from: 'hand', tg: [], ext: {} }],
});

describe('Azonos nevű lapok', () => {
  it('a board és a kijátszott permanentek sorszáma: csak a többször szereplő név', () => {
    expect(instNos(cs())).toEqual({ b0: 1, b1: 2 });
    expect(bdLabelOf(cs(), 1)).toBe('Ellenfél: Watchful Sentry #2 (1. battlefield)');
    expect(bdLabelOf(cs(), 2)).toBe('Te: Teemo, Scout (Base)');
  });
  it('az elemzés szövege és a frame-ek a sorszámmal', () => {
    const r = analyze(cs());
    expect(r.objs.b1.name).toBe('Watchful Sentry #2');
    expect(r.objs.b2.name).toBe('Teemo, Scout');
    expect(r.done.map((d) => d.name)).toContain('Watchful Sentry #2 triggere (Deathknell)');
    const units = r.frames[0].board.bfs.flatMap((f) => [...f.me, ...f.opp]).concat(r.frames[0].board.me.base);
    expect(units.find((u) => u.id === 'b1')?.no).toBe(2);
    expect(units.find((u) => u.id === 'b2')?.no).toBeUndefined();
  });
  it('a célpont-választó címkéje', () => {
    const o = tgOptionsOf(cs(), 0, { type: 'unit', rel: 'any' });
    expect(o.map((x) => x[1])).toContain('Board: Te: Watchful Sentry #1 (Base)');
  });
  it('sablonokban, ahol nincs ismétlődő lap, nincs sorszám', () => {
    for (const t of TEMPLATES) {
      const c = t.cs();
      if (Object.keys(instNos(c)).length) continue;
      expect(JSON.stringify(analyze(c).rows)).not.toMatch(/ #\d/);
    }
  });
});
