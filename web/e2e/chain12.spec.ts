import { expect, test } from '@playwright/test';

/* Rek'Sai, Void Burrower és The Candlelit Sanctum sablon: betöltés asztalon és keskeny nézetben, a lefutás sorrendje. */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

for (const w of [1300, 390]) {
  test("Rek'Sai sablon (" + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.getByRole('button', { name: 'Példák', exact: true }).click();
    await page.locator('[data-tpl="reksai-sanctum"] .btn', { hasText: 'Betöltés' }).click();
    const out = page.locator('#cb-out');
    await expect(out).toContainText('Chemtech Enforcer: megnézett lapok közül recycle');
    await expect(out).toContainText('Felfedett lapok (nyilvánossá válnak, 128.5): Bilgewater Tracker, Dangerous Duo');
    await expect(out).toContainText('Az ellenfél válaszként kijátssza a Ki Barrier lapot');
    await expect(page.locator('.cb2-sc.bad, .cb2-sc.need')).toHaveCount(0);
  });
}
