/* Teljesítménymérés: analyze() a sablonokon és a beépített példákon, valamint a pályás építő próba-elemzései
   (tryStep, targetOpts, zoneCands, setupFrame), amelyek egy kattintásra sokszor futnak. Futtatás: npm run bench */
import { test } from 'vitest';
import { analyze } from '../../src/render/html/chainReport';
import { EXAMPLES } from '../../src/features/chain/legacyForm';
import { TEMPLATES } from '../../src/domain/chain/templates';
import { setupFrame, targetOpts, tryStep, zoneCands, zonePicks } from '../../src/features/chain/chainBuild';
import { measure } from './measure';

const CASES: (() => any)[] = [...TEMPLATES.map((t) => t.cs), ...Object.values(EXAMPLES) as (() => any)[]];
const states = CASES.map((f) => f());
const withSteps = states.filter((s) => s.steps.length);

test('analyze() egy elemzés (a sablonokon és példákon körbe)', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'analyze', () => { analyze(JSON.parse(JSON.stringify(states[i++ % states.length]))); });
});
test('tryStep: újabb lépés a végére', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'tryStep', () => { const s = withSteps[i++ % withSteps.length]; tryStep(s, s.steps[s.steps.length - 1]); });
});
test('targetOpts: az utolsó lépés első célpontja', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'targetOpts', () => { const s = withSteps[i++ % withSteps.length]; targetOpts(s, s.steps.length - 1, 0); });
});
test('setupFrame', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'setupFrame', () => { setupFrame(states[i++ % states.length]); });
});
test('zoneCands: minden zónás választás egy esetben', async ({ bench }) => {
  let i = 0;
  await measure(bench, 'zoneCands', () => { const s = withSteps[i++ % withSteps.length]; s.steps.forEach((_: any, j: number) => zonePicks(s, j).forEach((z) => zoneCands(s, j, z.xi))); });
});
