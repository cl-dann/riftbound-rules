/* Szabálylinkek: a href a konkrét szabály hash-e (#r-...), kimásolva is a szabályt nyitja; a data-ref kezelés marad. */
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/domain/data/store';
import { hashRef, refHash } from '../src/domain/rules/refs';
import { inline } from '../src/shared/content/richText';
import { relLinks } from '../src/render/html/rules';
import { notesHTML } from '../src/render/html/card';
import { fmtResolve } from '../src/domain/chain/engine/labels';

const hrefs = (h: string) => [...h.matchAll(/<a [^>]*href="([^"]*)"[^>]*data-ref="([^"]*)"/g)].map((m) => [m[1], m[2]]);

describe('szabálylinkek', () => {
  it('refHash és hashRef oda-vissza', () => {
    for (const r of ['103.2', '359.3.e.14.a', '140-146']) expect(hashRef(refHash(r))).toBe(r);
  });
  it('richText, Kapcsolódó, kártya jegyzet és chain resolve sor: #r- hash a data-ref szabályára', () => {
    const c = CARDS.find((x) => x.nt && x.nt.length)!;
    const all = [
      ...hrefs(inline('Lásd {{103.2, 359.3.e.6}}.')),
      ...hrefs(relLinks(['805.1.b'])),
      ...hrefs(notesHTML(c)),
      ...hrefs(fmtResolve('<b>Void Rush</b> resolve-ol. Egy (805.6). Kettő.')),
    ];
    expect(all.length).toBeGreaterThan(4);
    for (const [h, r] of all) expect(h).toBe(refHash(r));
  });
});
