import { expect, test } from '@playwright/test';

/* Következő kör: a sablon betöltése és a "+ Következő kör" lépés asztalon és keskeny nézetben (315, 391.2). */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

for (const w of [1300, 390]) {
  test('Következő kör sablon (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.getByRole('button', { name: 'Példák', exact: true }).click();
    await page.locator('[data-tpl="nextturn"] .btn', { hasText: 'Betöltés' }).click();
    const out = page.locator('#cb-out');
    await expect(out).toContainText('Holdolod: Grove of the God-Willow, 1 pontot kapsz');
    await expect(out).toContainText('Delayed trigger jön létre');
    await expect(out).toContainText('Fizz, Trickster mozog: 2. battlefield → Grove of the God-Willow');
    await expect(page.locator('.cb2-sc.bad, .cb2-sc.need')).toHaveCount(0);
  });
}

test('"+ Következő kör" lépés felvétele üres pályán', async ({ page }) => {
  await page.goto('/#chain');
  await page.getByRole('button', { name: '+ Következő kör' }).click();
  await expect(page.locator('#cb-out')).toContainText('Következő kör: az ellenfél köre kezdődik');
});
