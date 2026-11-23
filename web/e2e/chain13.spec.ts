import { expect, test } from '@playwright/test';

/* Példák: egyetlen panel (beépített példák, sablonok, gyakori kérdések) kategóriánként, kereshetően, jelvénnyel; egy példa betöltése asztalon és keskeny nézetben. */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

for (const w of [1300, 390]) {
  test('Példák: keresés és betöltés (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.getByRole('button', { name: 'Példák', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Példák', exact: true });
    await expect(panel).toContainText('Legendek: felhasználói tier list, 2026-11-23');
    await expect(panel.locator('.cb2-hex').first()).toBeVisible();
    // egy helyen: beépített példák, sablonok (a Rek'Sai sablonokkal) és a kérdés formájú példák; a "nehéz" szó nem szerepel
    await expect(panel.locator('#cb-ex')).toBeVisible();
    await expect(panel.locator('[data-tpl="counter"]')).toBeVisible();
    await expect(panel.locator('[data-tpl="reksai-queen"]')).toBeVisible();
    await expect(panel).not.toContainText(/nehéz/i);
    await expect(panel.locator('[data-hex="yi-defy"] .cb2-tier').first()).toContainText('Master Yi · S (2v2-ben tiltott)');
    await panel.getByRole('searchbox').fill('Kennen Switcheroo');
    await expect(panel.locator('.cb2-hex')).toHaveCount(1);
    const ex = panel.locator('[data-hex="kaisa-kennen"]');
    await expect(ex.locator('.cb2-tier')).toHaveText(["Kai'Sa · S", 'Kennen · A']);
    await ex.locator('summary').click();
    await expect(ex).toContainText('811.1.d.2');
    await ex.getByRole('button', { name: 'Betöltés' }).click();
    await expect(panel).toHaveCount(0);
    const out = page.locator('#cb-out');
    await expect(out).toContainText('Az ellenfél válaszként kijátssza a Switcheroo lapot (facedown-ból [Reaction]-ként jön)');
    await expect(out).toContainText('Kennen, Heart of the Tempest Empowered lesz');
    await expect(page.locator('.cb2-sc.bad, .cb2-sc.need')).toHaveCount(0);
  });
}

test('Példák: flag 2 példa mindkét értelmezéssel', async ({ page }) => {
  await page.goto('/#chain');
  await page.getByRole('button', { name: 'Példák', exact: true }).click();
  const ex = page.locator('[data-hex="azir-weaponmaster"]');
  await ex.locator('summary').click();
  await expect(ex.locator('.cb2-hex-alt li')).toHaveCount(2);
  await expect(ex).toContainText('nyitott kérdés');
});
