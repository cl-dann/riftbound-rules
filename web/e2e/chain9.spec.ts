import { expect, test, type Page } from '@playwright/test';

/* Chronobreak: a kifizetett Power számú saját unit a pályán választva (428, 420.3, 359.3.e.4). */
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

test('Chronobreak: a saját unitok választhatók, az ellenfélé nem; a választott unit új objektumként visszatér', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto('/#chain');
  await page.waitForFunction(() => typeof (window as any).__setCS === 'function');
  await page.evaluate(() => (window as any).__setCS({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: 'A' }, { n: '', c: '' }], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] },
    bd: [{ n: 'Mega-Mech', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Mountain Drake', pl: 'B', loc: 'bf0', d: 0 }], steps: [] }));
  await page.locator('.pm2-chain .pm2-add').click();
  await page.locator('.cb2-pick .cb2-q').fill('chronobreak');
  await page.locator('.cb2-pick .cb2-res button', { hasText: 'Chronobreak' }).first().click();
  const bar = page.locator('.cb2-mode');
  await expect(bar.locator('.cb2-chip.bad', { hasText: 'Mountain Drake' })).toContainText('nem a saját unitod');
  await bar.locator('.cb2-chip', { hasText: 'Mega-Mech' }).click();
  const cs = await getCS(page);
  expect(cs.steps[0].zp[0]).toEqual(['b0']);
  // a kifizetett Power a lapnál (Haladó szerkesztés mező); 0 Power mellett nincs banish
  await expect(page.locator('#cb-out')).toContainText('a kifizetett Power 0');
  await page.evaluate(() => { const c = (window as any).__getCS(); c.steps[0].hv = { 0: 1 }; (window as any).__setCS(c); });
  await expect(page.locator('#cb-out')).toContainText('Mega-Mech: a tulajdonosa újra kijátssza');
});
