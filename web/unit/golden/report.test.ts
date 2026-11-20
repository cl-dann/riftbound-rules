/* analyze(CS, { report: false }): a HTML riport kimarad, minden más mező azonos a teljes futáséval
   (az S04 golden összes esetén: sablonok, példák, unit bemenetek, #c= linkek). */
import { expect, it } from 'vitest';
import { analyze } from '../../src/domain/chain/chainCore';
import { EXAMPLES, normZones } from '../../src/features/chain/legacyForm';
import { TEMPLATES } from '../../src/domain/chain/templates';
import { b64d } from '../../src/legacy/core';
import CASES from './cases.json';
import FIX from './fixtures.json';

const ALL: [string, any][] = [
  ...TEMPLATES.map((t) => [t.id, t.cs()] as [string, any]),
  ...Object.entries(EXAMPLES).map(([k, f]: any) => [k, f()] as [string, any]),
  ...(CASES as any[]).map((c, i) => ['eset ' + i, c] as [string, any]),
  ...Object.entries(FIX.chainLinks).map(([k, l]) => [k, normZones(JSON.parse(b64d(l.slice(3))))] as [string, any]),
];

it('report: false esetén csak a html marad üres (' + ALL.length + ' eset)', () => {
  for (const [label, cs] of ALL) {
    const full: any = analyze(JSON.parse(JSON.stringify(cs)));
    const lite: any = analyze(JSON.parse(JSON.stringify(cs)), { report: false });
    const strip = (r: any) => JSON.stringify({ ...r, html: full.empty ? r.html : '' });
    expect(strip(lite), label).toBe(strip(full));
    if (!full.empty) expect(lite.html, label).toBe('');
  }
});
