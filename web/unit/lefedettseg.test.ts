/* Lapértelmezés lefedettsége mind az 1101 lapon, ugyanazokon a forrásokon mérve. A riport a konzolra kerül:
   npx vitest run unit/lefedettseg.test.ts --reporter=verbose
   Cél (a megrendelő kérése): 0 nem felismert és 0 bizonytalan utasítás. "Adatot kér" (hidden) csak rejtett információ miatt
   lehet (kéz, deck, builderen kívüli előzmény); a nyitott kérdés (open) ismert művelet, a felületen flag 2 címkét kap. */
import { expect, it } from 'vitest';
import { coverage, coverageOld, coveragePrev } from './lefedettseg';

it('lefedettség: 0 nem felismert és 0 bizonytalan utasítás', () => {
  const o = coverageOld(), p = coveragePrev(), c = coverage();
  const pct = (a: number, b: number) => (100 * a / b).toFixed(1) + '%';
  console.log('Legelső (chainCore előtt): ' + o.tot + ' utasítás, ' + o.other + ' nem felismert (' + pct(o.other, o.tot) + ')');
  console.log('Előző commit: ' + p.tot + ' utasítás, ' + p.other + ' nem felismert, ' + p.unsure + ' bizonytalan (' + pct(p.other + p.unsure, p.tot) + ')');
  console.log('Most: ' + c.tot + ' utasítás, ' + c.other + ' nem felismert, ' + c.unsure + ' bizonytalan; ' + c.hidden + ' felismert, de rejtett adatot kér; ' + c.open + ' nyitott kérdés; ' + c.costs + ' költségsor');
  console.log('Adatot kér (lap: utasítás | ok):\n' + c.hid.join('\n'));
  console.log('Nyitott kérdés:\n' + c.opn.join('\n'));
  if (c.bad.length) console.log('Nem felismert vagy bizonytalan:\n' + c.bad.join('\n'));
  expect(c.bad).toEqual([]);
  expect(c.other).toBe(0);
  expect(c.unsure).toBe(0);
  // az "adatot kér" csak rejtett információ (kéz, deck, felfedett lap, builderen kívüli előzmény) miatt
  for (const h of c.hid) expect(h).toMatch(/\| .*(kéz|deck|felfed|rejtett|előzmény|kijátszott lap|tipp)/i);
});
