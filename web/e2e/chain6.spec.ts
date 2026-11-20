import { expect, test, type Page } from '@playwright/test';

/* Kéz, trash és deck lapjai a pályán kiválasztva (355.9.a, 355.10.a, 355.18): asztalon és a mobilos varázslóban. */
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-pick .cb2-q').fill(q);
  await p.locator('.cb2-pick .cb2-res button', { hasText: n }).first().click();
  await expect(p.locator('.cb2-pick')).toHaveCount(0);
}

test('Asztal: trash lap felvétele, célpont a trashből, eldobás a kézből', async ({ page }) => {
  await page.goto('/#chain');
  const trash = page.locator('.pm2-band.me-bottom [data-zone="trash"]');
  await trash.click();
  await expect(page.locator('.cb2-zp')).toContainText('Nyilvános zóna');
  await page.locator('.cb2-zp .pb-btn', { hasText: '+ Lap a trashbe' }).click();
  await pickCard(page, 'shipyard skulker', 'Shipyard Skulker');
  await expect(page.locator('.cb2-zp .cb2-zl')).toContainText('Shipyard Skulker');
  await page.locator('.cb2-zp .pb-btn', { hasText: 'Kész' }).click();
  await expect(trash).toContainText('1');
  // Morbid Return: a trash nyilvános, a választás célpont
  await page.locator('.pm2-chain .pm2-add').click();
  await pickCard(page, 'morbid return', 'Morbid Return');
  await expect(page.locator('.cb2-mode')).toContainText('355.10.a');
  await expect(trash).toHaveClass(/g-act/);
  await trash.click();
  await page.locator('.cb2-zp .cb2-zl li.ok .btn', { hasText: 'Kiválasztás' }).click();
  await expect(page.locator('.cb2-mode')).toHaveCount(0);
  { const cs = await getCS(page); expect(cs.steps[0].zp[0]).toEqual([cs.trash.A[0].id]); }
  await page.locator('.cb2-zp .pb-btn', { hasText: 'Kész' }).click();
  await expect(page.locator('#cb-out')).toContainText('355.10.a');
  await page.getByRole('button', { name: 'Következő' }).click();
  await page.getByRole('button', { name: 'Következő' }).click();
  await expect(page.locator('.pm2-band.me-bottom .pm2-hand')).toContainText('Hand · 1');
  // Lunar Boon: a kéz privát, a választás a resolve-kor; a kiemelt kézlapra kattintva
  await page.locator('#cb-clear').click();
  await page.locator('.pm2-band.me-bottom .pm2-hand .pm2-add').click();
  await pickCard(page, 'void seeker', 'Void Seeker');
  await page.locator('.pm2-chain .pm2-add').click();
  await pickCard(page, 'lunar boon', 'Lunar Boon');
  await expect(page.locator('.cb2-mode')).toContainText('355.18');
  await page.locator('.pm2-band.me-bottom .pm2-hc.g-act').click();
  { const cs = await getCS(page); expect(cs.steps[0].zp[0]).toEqual([cs.hand.A[0].id]); }
  await expect(page.locator('#cb-out')).toContainText('423.1');
});

test('Mobil 390 px: trash célpont a varázslóban', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#chain');
  await page.locator('.pm2-band.me-bottom [data-zone="trash"]').click();
  await page.locator('.cb2-zp .pb-btn', { hasText: '+ Lap a trashbe' }).click();
  await pickCard(page, 'shipyard skulker', 'Shipyard Skulker');
  await page.locator('.cb2-zp .pb-btn', { hasText: 'Kész' }).click();
  await page.locator('.cb2-fab .btn').click();
  await page.locator('.cb2-sheet .cb2-q').fill('the harrowing');
  await page.locator('.cb2-sheet .cb2-res button', { hasText: 'The Harrowing' }).first().click();
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  await expect(page.locator('.cb2-wbar')).toContainText('Válassz lapot (trash)');
  await page.locator('.cb2-wbar .cb2-chip', { hasText: 'Shipyard Skulker' }).click();
  await expect(page.locator('.cb2-wbar, .cb2-sheet')).toHaveCount(0);
  { const cs = await getCS(page); expect(cs.steps[0].zp[0]).toEqual([cs.trash.A[0].id]); }
  await expect(page.locator('#cb-out')).toContainText('trashből');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
