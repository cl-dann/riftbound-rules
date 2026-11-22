/* Deck és ár: nyomat választása a deck sorában (a szövegbe és a #d= linkbe kerül, az ár ebből számol), ár chip a kártyarácsban,
   Cardmarket keresés és "Melyik legenddel játszható" a kártya-ablakban, ártörténet diagram legalább 2 adatponttal. */
import { expect, test } from '@playwright/test';

test('nyomat a deck sorában: a decklista szövegébe kerül, az ár ebből számol', async ({ page }) => {
  await page.goto('/#deck');
  await page.locator('#deckin').fill('Legend:\n1 Ahri, Nine-Tailed Fox\n\nMainDeck:\n2 Ahri, Inquisitive\n');
  const sel = page.locator('select.prsel[data-card="Ahri, Inquisitive"]');
  await expect(sel).toBeVisible();
  const before = await page.locator('.drow', { has: sel }).locator('.pr').textContent();
  await sel.selectOption('ogn-119a-298');
  await expect(page.locator('#deckin')).toHaveValue(/2 Ahri, Inquisitive \[ogn-119a-298\]/);
  await expect(page.locator('.drow', { has: page.locator('select.prsel[data-card="Ahri, Inquisitive"]') }).locator('.pr')).not.toHaveText(before || '');
  await page.locator('select.prsel[data-card="Ahri, Inquisitive"]').selectOption('');
  await expect(page.locator('#deckin')).toHaveValue(/2 Ahri, Inquisitive\n/);
});

test('ár chip a rácsban, Cardmarket link, legendek és ártörténet a kártya-ablakban', async ({ page }) => {
  await page.route(/price-history\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ v: 1, d: ['2026-11-12', '2026-11-19'], s: { 'ogn-119-298': { n: [400, 56], f: [380, 23] } } }) }));
  await page.goto('/#kartyak');
  await expect(page.locator('.tile .pchip').first()).toContainText('€');
  await page.goto('/#kartya/ahri-inquisitive');
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg.locator('a.cmlink').first()).toHaveAttribute('href', 'https://www.cardmarket.com/en/Riftbound/Products/Search?searchString=Ahri%2C%20Inquisitive');
  await expect(dlg.locator('.lfit h3')).toContainText('Melyik legenddel játszható');
  await expect(dlg.locator('.lfit-why')).toContainText('103.2.b.3');
  await expect(dlg.locator('.lfit-grid li', { hasText: 'Chosen Champion' })).toContainText('Ahri, Nine-Tailed Fox');
  await expect(dlg.locator('.pch svg')).toHaveCount(2);
  await dlg.locator('.lfit-grid button', { hasText: 'Ahri, Nine-Tailed Fox' }).click();
  await expect(dlg.locator('h2').first()).toContainText('Ahri, Nine-Tailed Fox');
});
