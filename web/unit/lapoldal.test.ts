/* Megosztható lapoldalak: a build lapoldal-generátora (scripts/card-pages.mjs) ugyanazt a slugot képzi, mint a SPA (#kartya/<slug>),
   a slug minden lapra egyedi, és az oldal tartalmazza a kötelező meta tageket. */
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/domain/data/store';
import { cardSlug } from '../src/domain/data/cards';
import { viewOf } from '../src/app/router';
// @ts-expect-error: a build szkript JavaScript modul, típusdeklaráció nélkül
import { pageHTML, slugOf, SITE } from '../../scripts/card-pages.mjs';

describe('lapoldalak', () => {
  it('a slug azonos a SPA-ban és a generátorban, és egyedi', () => {
    const s = CARDS.map((c) => cardSlug(c.n));
    expect(CARDS.map((c) => slugOf(c.n))).toEqual(s);
    expect(new Set(s).size).toBe(CARDS.length);
    s.forEach((x) => expect(x).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });
  it('meta tagek és átirányítás', () => {
    const c = CARDS.find((x) => x.n === 'Hidden Blade')!;
    const h: string = pageHTML(c, { sh: 'Rövid leírás.' });
    expect(SITE).toBe('https://cl-dann.github.io/riftbound-rules/');
    expect(h).toContain('<title>Hidden Blade | Riftbound HU</title>');
    expect(h).toContain('<link rel="canonical" href="https://cl-dann.github.io/riftbound-rules/card/hidden-blade/">');
    expect(h).toMatch(/<meta property="og:image" content="https:\/\/cmsassets\.rgpub\.io\/[^"]+">/);
    expect(h).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(h).toContain("location.replace('../../#kartya/hidden-blade')");
    expect(viewOf('#kartya/hidden-blade')).toBe('kartyak');
  });
});
