/* Lapértelmezés lefedettsége mind az 1101 lapon. "Előtte" = a módosítás előtti felbontás és felismerés ugyanazokon a forrásokon.
   A riport a konzolra kerül (npx vitest run unit/lefedettseg.test.ts --reporter=verbose). */
import { expect, it } from 'vitest';
import { coverage, coverageOld } from './lefedettseg';

it('lefedettség: a nem felismert és bizonytalan utasítások aránya 20% alatt', () => {
  const o = coverageOld(), c = coverage();
  const pct = (a: number, b: number) => (100 * a / b).toFixed(1) + '%';
  console.log('Előtte: ' + o.tot + ' utasítás, ' + o.other + ' nem felismert (' + pct(o.other, o.tot) + ')');
  console.log('Utána: ' + c.tot + ' utasítás, ' + c.other + ' nem felismert, ' + c.unsure + ' bizonytalan (' + pct(c.other + c.unsure, c.tot) + '), ' + c.costs + ' költségsor');
  console.log('A 30 leggyakoribb nem felismert vagy bizonytalan minta:\n' + c.top.map((x) => x.n + '  ' + x.k + '   | ' + x.ex).join('\n'));
  expect(o.other / o.tot).toBeGreaterThan(0.6);
  expect((c.other + c.unsure) / c.tot).toBeLessThan(0.2);
});
