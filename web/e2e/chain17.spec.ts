import { expect, test, type Page } from '@playwright/test';

/* Hiányzó lap magától: Falling Star és rá Not So Fast összerakása üres pályáról. A kijátszott lap a kézbe kerül és onnan jön,
   a hiányzó célpontot a "Célpont hozzáadása" teszi a pályára. A kattintások száma a régi (kézi) és az új úton. */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });
let clicks = 0;
const click = async (p: Page, sel: string, opt: { hasText?: string | RegExp } = {}) => { clicks++; await p.locator(sel, opt).first().click(); };
const pickCard = async (p: Page, q: string, n: string) => { await p.locator('.cb2-pick .cb2-q').fill(q); await click(p, '.cb2-pick .cb2-res button', { hasText: n }); };
const wizCard = async (p: Page, q: string, n: string) => { await p.locator('.cb2-sheet .cb2-q').fill(q); await click(p, '.cb2-sheet .cb2-res button', { hasText: n }); };
const done = async (p: Page) => {
  const out = p.locator('#cb-out');
  await expect(out).toContainText('Not So Fast resolve-ol. Falling Star counterelve');
  await expect(p.locator('.cb2-sc.bad, .cb2-sc.need')).toHaveCount(0);
};

test('Falling Star és Not So Fast: régi út a pálya előkészítésével, új út a "Célpont hozzáadása" gombbal (asztal)', async ({ page }) => {
  // régi út: előbb a két ellenfél unit a pályára, utána a két lépés
  await page.goto('/#chain');
  clicks = 0;
  await click(page, '.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add'); await pickCard(page, 'shipyard skulker', 'Shipyard Skulker');
  await click(page, '.pm2-chain .pm2-add'); await pickCard(page, 'falling star', 'Falling Star');
  await click(page, '.pm-unit[data-uid="b0"]'); await click(page, '.pm-unit[data-uid="b0"]');
  await click(page, '.pm2-chain .pm2-add'); await pickCard(page, 'not so fast', 'Not So Fast');
  await click(page, '.cb2-mode .cb2-chip', { hasText: 'Falling Star' });
  await done(page);
  const before = clicks;
  // új út: üres pályáról
  await page.goto('/#chain'); await page.reload();
  await page.evaluate(() => localStorage.clear()); await page.goto('/#c=');
  await page.goto('/#chain'); await page.reload();
  await expect(page.locator('.pm-unit')).toHaveCount(0);
  clicks = 0;
  await click(page, '.pm2-chain .pm2-add'); await pickCard(page, 'falling star', 'Falling Star');
  await expect(page.locator('.cb2-mode')).toContainText('1. célpont');
  await click(page, '.cb2-mode .btn', { hasText: 'Célpont hozzáadása' });
  // a 2. célponthoz már van legális unit (az imént hozzáadott), nincs "Célpont hozzáadása"
  await expect(page.locator('.cb2-mode .btn', { hasText: 'Célpont hozzáadása' })).toHaveCount(0);
  await click(page, '.cb2-mode .cb2-chip', { hasText: 'Shipyard Skulker' });
  await click(page, '.pm2-chain .pm2-add'); await pickCard(page, 'not so fast', 'Not So Fast');
  await click(page, '.cb2-mode .cb2-chip', { hasText: 'Falling Star' });
  await done(page);
  const after = clicks;
  await expect(page.locator('.pm-unit[data-uid="b0"]')).toBeVisible();
  console.log('kattintások: régi út ' + before + ', új út ' + after);
  expect(after).toBeLessThan(before);
  // az alap unit valós lapra cserélhető
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await page.locator('.cb2-menu .pb-btn', { hasText: 'Csere másik lapra' }).click();
  await pickCard(page, 'mega-mech', 'Mega-Mech');
  await expect(page.locator('.pm-unit[data-uid="b0"]')).toContainText('Mega-Mech');
  await done(page);
});

test('Falling Star és Not So Fast a mobilos varázslóban, üres pályáról (390 px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // régi út: előbb az ellenfél unitja a pályára
  await page.goto('/#chain');
  clicks = 0;
  await click(page, '.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add'); await pickCard(page, 'shipyard skulker', 'Shipyard Skulker');
  await click(page, '.pm2-chain .pm2-add'); await wizCard(page, 'falling star', 'Falling Star');
  await click(page, '.cb2-sheet .pb-btn', { hasText: 'Kijátszás' });
  await click(page, '.pm-unit[data-uid="b0"]'); await click(page, '.cb2-wbar .cb2-chip', { hasText: 'Shipyard Skulker' });
  await click(page, '.cb2-wbar .btn', { hasText: 'Kész' });
  await click(page, '.cb2-add .btn', { hasText: 'Lap a chainre' }); await wizCard(page, 'not so fast', 'Not So Fast');
  await click(page, '.cb2-sheet .pb-btn', { hasText: 'Kijátszás' });
  await click(page, '.cb2-wbar .cb2-chip', { hasText: 'Falling Star' });
  await done(page);
  const before = clicks;
  await page.evaluate(() => localStorage.clear()); await page.goto('/#chain'); await page.reload();
  await expect(page.locator('.pm-unit')).toHaveCount(0);
  clicks = 0;
  await click(page, '.pm2-chain .pm2-add'); await wizCard(page, 'falling star', 'Falling Star');
  await click(page, '.cb2-sheet .pb-btn', { hasText: 'Kijátszás' });
  await expect(page.locator('.cb2-wbar')).toContainText('Válassz célpontot');
  await click(page, '.cb2-wbar .btn', { hasText: 'Célpont hozzáadása' });
  await click(page, '.cb2-wbar .cb2-chip', { hasText: 'Shipyard Skulker' });
  await click(page, '.cb2-wbar .btn', { hasText: 'Kész' });
  await expect(page.locator('.cb2-wbar, .cb2-sheet')).toHaveCount(0);
  await click(page, '.cb2-add .btn', { hasText: 'Lap a chainre' }); await wizCard(page, 'not so fast', 'Not So Fast');
  await expect(page.locator('.cb2-sheet .cb2-seg button.on')).toHaveText('Ellenfél');
  await click(page, '.cb2-sheet .pb-btn', { hasText: 'Kijátszás' });
  await click(page, '.cb2-wbar .cb2-chip', { hasText: 'Falling Star' });
  await done(page);
  console.log('kattintások (390 px): régi út ' + before + ', új út ' + clicks);
  expect(clicks).toBeLessThan(before);
});
