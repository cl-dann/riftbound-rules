/* Lapértelmezés lefedettsége mind az 1101 lapon, ugyanazokon a forrásokon mérve. A riport a konzolra kerül:
   npx vitest run unit/lefedettseg.test.ts --reporter=verbose */
import { expect, it } from 'vitest';
import { coverage, coverageOld, coveragePrev } from './lefedettseg';

it('lefedettség: a nem felismert és bizonytalan utasítások aránya 6% alatt', () => {
  const o = coverageOld(), p = coveragePrev(), c = coverage();
  const pct = (a: number, b: number) => (100 * a / b).toFixed(1) + '%';
  console.log('Legelső (chainCore előtt): ' + o.tot + ' utasítás, ' + o.other + ' nem felismert (' + pct(o.other, o.tot) + ')');
  console.log('Előző commit: ' + p.tot + ' utasítás, ' + p.other + ' nem felismert, ' + p.unsure + ' bizonytalan (' + pct(p.other + p.unsure, p.tot) + ')');
  console.log('Most: ' + c.tot + ' utasítás, ' + c.other + ' nem felismert, ' + c.unsure + ' bizonytalan (' + pct(c.other + c.unsure, c.tot) + '); ' + c.user + ' felismert, de a builderben kell megadni egy adatot (mód, feltétel, kijátszott lap); ' + c.costs + ' költségsor');
  console.log('A 20 leggyakoribb nem felismert vagy bizonytalan minta:\n' + c.top.map((x) => x.n + '  ' + x.k + '   | ' + x.ex).join('\n'));
  expect((c.other + c.unsure) / c.tot).toBeLessThan(0.06);
});
