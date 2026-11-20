import { expect, test } from '@playwright/test';

/* Chain builder: Repeat, Show Off, rejtett adat mező, "each player chooses" választás, Resolve és Kör vége lépés. */
test('Chain: új lépéstípusok és laponkénti mezők a builderben', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#chain');
  const cs = { lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }],
    bd: [{ n: 'Sun Disc', pl: 'B', loc: 'base', d: 0 }, { n: 'Long Sword', pl: 'B', loc: 'base', d: 0 }, { n: 'Sona, Harmonious', pl: 'A', loc: 'base', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
    steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', tg: ['b1', 'b0'], ext: {}, mode: 1, rep: true, mode2: 1 }, { k: 'res' },
      { k: 'card', n: 'Primordial Roar', pl: 'A', tg: ['b3'], ext: {}, so: 'b2' }, { k: 'res' },
      { k: 'card', n: 'Get Excited!', pl: 'A', tg: [], ext: {} }, { k: 'card', n: 'Cull the Weak', pl: 'A', tg: [], ext: {} }, { k: 'end' }] };
  const enc = await page.evaluate((t) => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), JSON.stringify(cs));
  await page.goto('/#c=' + enc);
  await page.reload();
  await page.locator('#cb-adv > summary').click();
  await expect(page.locator('input[data-rep="0"]')).toBeChecked();
  await expect(page.locator('select[data-modek="0_2"]')).toHaveValue('1');
  await expect(page.locator('select[data-so="2"]')).toHaveValue('b2');
  await expect(page.locator('#cb-out')).toContainText('820.1.d.1');
  await expect(page.locator('#cb-out')).toContainText('832.1.d.1');
  await expect(page.locator('#cb-out')).toContainText('317.2');
  await page.locator('[data-ovj="4"] summary').click();
  await expect(page.locator('input[data-hv="4_1"]')).toBeVisible();
  await page.locator('[data-ovj="5"] summary').click();
  await expect(page.locator('select[data-mp="5_0_B"]')).toBeVisible();
  await page.selectOption('select[data-mp="5_0_A"]', 'b2');
  expect(await page.evaluate(() => (window as any).__getCS().steps[5].mp[0].A)).toBe('b2');
  await expect(page.locator('#cb-out')).toContainText('Sona, Harmonious meghal');
  expect(errors).toEqual([]);
});
