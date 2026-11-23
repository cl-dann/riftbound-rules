import { expect, test } from '@playwright/test';

/* Látható döntések: Void Rush banish választója a lépés-panelben és a mobilos varázslóban; átállítás Falling Starra. */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

for (const w of [1300, 390]) {
  test('Void Rush: a banish átállítása Falling Starra (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.getByRole('button', { name: 'Nehéz példák' }).click();
    const ex = page.locator('[data-hex="reksai-voidrush"]');
    await ex.locator('summary').click();
    await ex.getByRole('button', { name: 'Betöltés' }).click();
    const out = page.locator('#cb-out');
    await expect(out.locator('.cbch')).toContainText('Banish: Noxus Hopeful (a te választásod)');
    await expect(out.locator('.cbsteps').first()).toBeAttached();
    await expect(out.locator('details.cbdet').first()).not.toHaveAttribute('open', '');
    await expect(out.locator('.cbr a').first()).toHaveAttribute('href', /^#r-\d/);
    // a lépés választója
    await page.locator('.cb2-sc .cb2-sb').first().click();
    const sel = page.locator('.cb2-sp [data-dec="zp:1"] select');
    await expect(sel).toBeVisible();
    await sel.selectOption({ label: 'Falling Star' });
    await expect(out).toContainText('Noxus Hopeful a kézbe kerül');
    await expect(out).toContainText('Falling Star spell a chainre kerül');
    await expect(out).toContainText('Falling Star (kijátszás hatásból) resolve-ol');
    await expect(out.locator('.cbch').first()).toContainText('Banish: Falling Star (a te választásod)');
    // a hatásból kijátszott Falling Star célpontjai automatikusak és módosíthatók
    await expect(page.locator('.cb2-sp .cb2-auto').first()).toHaveText('automatikus, módosítható');
  });
}
