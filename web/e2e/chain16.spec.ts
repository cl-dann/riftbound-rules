import { expect, test } from '@playwright/test';

/* Nyitott kérdés (flag 2): az elemzés a két értelmezés eredményét egymás mellett mutatja. */
test('flag 2: Mechanical Bandit döntetlen, a két értelmezés egymás mellett', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/#chain');
  const cs = { turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], hand: { A: [], B: [] }, ch: { A: '', B: '' },
    deck: { A: [{ id: 'zdA_1', n: 'Shipyard Skulker' }], B: [{ id: 'zdB_1', n: 'Pickpocket' }] }, zseq: 1,
    bd: [{ n: 'Mechanical Bandit', pl: 'A', loc: 'base', d: 0 }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Mechanical Bandit', tg: [], ext: {} }] };
  const enc = await page.evaluate((t) => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), JSON.stringify(cs));
  await page.goto('/#c=' + enc);
  await page.reload();
  const alt = page.locator('#cb-out .cbalt').first();
  await expect(alt).toContainText('1. értelmezés:');
  await expect(alt).toContainText('2. értelmezés: egyenlő költségnél nincs legalacsonyabb');
  expect(errs).toEqual([]);
});
