import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];
async function open(page: Page, hash: string) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/' + hash);
  await expect(page.locator('nav, header').first()).toBeVisible();
}
test.afterEach(() => { expect(errors, 'nincs JS hiba').toEqual([]); errors.length = 0; });

test('Kártyák: keresés, elgépelés-tűrés, lap megnyitása Q&A-val', async ({ page }) => {
  await open(page, '#kartyak');
  const q = page.locator('input').first();
  await q.fill('Annie, Stubborn');
  await page.locator('.tile').first().click();
  await expect(page.locator('dl.qa dt').first()).toBeVisible();
  await expect(page.locator('details.ntd summary')).toContainText('Szabályi részletek');
  await page.keyboard.press('Escape');
  await q.fill('Arhi Aluring');
  await expect(page.locator('.tile').first()).toBeVisible();
});

test('Deck: építés kereséssel, legalitás azonnal frissül', async ({ page }) => {
  await open(page, '#deck');
  await page.fill('#dq', 'Jinx');
  await page.selectOption('.bq select', 'Legend');
  await page.locator('.bres button').first().click();
  await page.selectOption('.bq select', '');
  await page.fill('#dq', 'Jinx, Demolitionist');
  await page.locator('.bres button').first().click();
  await expect(page.locator('#deckin')).toHaveValue(/Legend:\n1 Jinx, Loose Cannon[\s\S]*Champion:\n1 Jinx, Demolitionist/);
  await expect(page.getByText('103.3.a.2')).toBeVisible();
  await page.locator('.drow button[data-inc="1"]').first().click();
  await expect(page.locator('.prices')).toBeVisible();
});

test('Deck: megosztható link visszatölti a decket', async ({ page }) => {
  const text = 'Legend:\n1 Jinx, Loose Cannon\n';
  await open(page, '#deck');
  const enc = await page.evaluate((t) => btoa(unescape(encodeURIComponent(t))), text);
  await page.goto('/#d=' + enc);
  await expect(page.locator('#deckin')).toHaveValue(/Jinx, Loose Cannon/);
});

test('Szabályzat: szabályhivatkozás és versenyformátum oldal', async ({ page }) => {
  await open(page, '#r-103.2');
  await expect(page.locator('[data-rid="103.2"]').first()).toBeVisible();
  await page.goto('/#fmt-duel');
  await expect(page.getByText('Összehasonlítás')).toBeVisible();
});

test('Chain: példa lejátszása lépésenként', async ({ page }) => {
  await open(page, '#chain');
  await page.locator('#cb-ex').click();
  await page.locator('#cb-run').click();
  const next = page.getByRole('button', { name: 'Következő' }).first();
  await expect(next).toBeVisible();
  await next.click();
  await expect(page.getByText(/Mi változott/i).first()).toBeVisible();
});

test('How to Play és Practice: nincs kvíz, nincs Elolvastam gomb', async ({ page }) => {
  await open(page, '#hogyan');
  await page.locator('a.btn.hex').first().click();
  await expect(page.locator('.quiz')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Elolvastam' })).toHaveCount(0);
  await page.goto('/#tanulas');
  await expect(page.locator('.quiz')).toHaveCount(0);
});

test('Fogalomtár: játékmenet lépésábra és errata szűrés', async ({ page }) => {
  await open(page, '#kezikonyv');
  await page.locator('[data-fs="0:3"]').first().click();
  await expect(page.locator('[data-fp="0:3"]')).toBeVisible();
  await expect(page.locator('[data-fp="0:0"]')).toBeHidden();
  await page.fill('.errq', 'annie');
  await expect(page.locator('.errc:not([hidden])')).toHaveCount(1);
});
