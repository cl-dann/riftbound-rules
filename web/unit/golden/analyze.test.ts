/* Karakterizáció: analyze() teljes kimenete (html, rows, story, frames, objs és a többi mező) a sablonokon, a beépített
   példákon, a unit tesztek összes bemenetén (cases.json, npm run golden:capture) és valódi #c= linkeken.
   A refaktor alatt ennek byte-azonosnak kell maradnia. Szándékos változásnál: npx vitest run --project golden -u */
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/render/html/chainReport';
import { EXAMPLES, normZones } from '../../src/features/chain/legacyForm';
import { TEMPLATES } from '../../src/domain/chain/templates';
import { b64d } from '../../src/domain/text/b64';
import CASES from './cases.json';
import FIX from './fixtures.json';
import { block } from './serialize';

const out = (cs: any) => analyze(JSON.parse(JSON.stringify(cs))) as any;
const PARTS = 4;

describe('analyze golden', () => {
  it('sablonok', async () => {
    await expect(TEMPLATES.map((t) => block(t.id, out(t.cs()))).join('')).toMatchFileSnapshot('./__golden__/analyze-templates.txt');
  });
  it('beépített példák', async () => {
    await expect(Object.entries(EXAMPLES).map(([k, f]: any) => block(k, out(f()))).join('')).toMatchFileSnapshot('./__golden__/analyze-examples.txt');
  });
  for (let p = 0; p < PARTS; p++) {
    it('unit esetek ' + (p + 1) + '/' + PARTS, async () => {
      const list = (CASES as any[]).map((c, i) => [i, c] as const).filter(([i]) => i % PARTS === p);
      await expect(list.map(([i, c]) => block('eset ' + i, out(c))).join('')).toMatchFileSnapshot('./__golden__/analyze-unit-' + (p + 1) + '.txt');
    });
  }
  it('#c= linkek (normZones migrációval, ahogy a builder betölti)', async () => {
    const txt = Object.entries(FIX.chainLinks).map(([k, link]) => {
      const cs = normZones(JSON.parse(b64d(link.slice(3))));
      return block(k, { cs, ...out(cs) });
    }).join('');
    await expect(txt).toMatchFileSnapshot('./__golden__/analyze-links.txt');
  });
});
