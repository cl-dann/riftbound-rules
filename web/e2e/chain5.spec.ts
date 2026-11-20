import { expect, test, type Page } from '@playwright/test';

/* Chain építő, mobilos lépés-varázsló (390 px): a példa chain felépítése, Vissza és Mégse, célzás pályán kívüli célpontra. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-pick .cb2-q').fill(q);
  await p.locator('.cb2-pick .cb2-res button', { hasText: n }).first().click();
}
async function wizCard(p: Page, q: string, n: string) {
  await expect(p.locator('.cb2-sheet')).toContainText('1 / 4');
  await p.locator('.cb2-sheet .cb2-q').fill(q);
  await p.locator('.cb2-sheet .cb2-res button', { hasText: n }).first().click();
  await expect(p.locator('.cb2-sheet')).toContainText('2 / 4');
}
const ov = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('Varázsló: a példa chain felépítése 390 px-en, azonos elemzéssel', async ({ page }) => {
  await page.goto('/#chain');
  // kiinduló helyzet a pályán (kártyakereső)
  await page.locator('.pm2-band.me-base [data-zone="legend"]').click(); await pickCard(page, 'kennen tempest', 'Kennen, Heart of the Tempest');
  await page.locator('.pm2-bf[data-bfi="0"] .pm2-bfadd').click(); await pickCard(page, 'vilemaw', "Vilemaw's Lair");
  await page.locator('.pm2-bf[data-bfi="0"] .pm2-bfc .cl').click();
  await expect(page.locator('.cb2-sheet')).toContainText('2 / 4');
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kontroll: ellenfél' }).click();
  await expect(page.locator('.cb2-sheet')).toHaveCount(0);
  await page.locator('.pm2-bf[data-bfi="1"] .pm2-bfadd').click(); await pickCard(page, 'zaun warrens', 'Zaun Warrens');
  await page.locator('.pm2-bf[data-bfi="1"] .pm2-bfc .cl').click();
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kontroll: te' }).click();
  await page.locator('.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add').click(); await pickCard(page, 'traveling merchant', 'Traveling Merchant');
  await page.locator('.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add').click(); await pickCard(page, 'long sword', 'Long Sword');
  await page.locator('.pm-unit[data-uid="b1"]').click();
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Tulajdonságok' }).click();
  await page.locator('.cb2-props select').last().selectOption('0');
  await page.locator('.cb2-props .pb-btn', { hasText: 'Kész' }).click();
  // 1. lépés: Chain + gomb, varázsló
  await page.locator('.pm2-chain .pm2-add').click();
  await wizCard(page, 'riptide rex', 'Riptide Rex');
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  await expect(page.locator('.cb2-wbar')).toContainText('Válassz célpontot');
  await expect(page.locator('.pm-unit[data-uid="b0"].g-act')).toBeVisible();
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await expect(page.locator('.cb2-wbar, .cb2-sheet')).toHaveCount(0);
  // 2. lépés: az idővonal "Lap a chainre" gombja, az ellenfél automatikusan
  await page.locator('.cb2-add .btn', { hasText: 'Lap a chainre' }).click();
  await wizCard(page, 'flash', 'Flash');
  await expect(page.locator('.cb2-sheet .cb2-seg button.on')).toHaveText('Ellenfél');
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await page.locator('.cb2-wbar .btn', { hasText: 'Kész' }).click();
  // 3. lépés: két célpont a pályán
  await page.locator('.pm2-chain .pm2-add').click();
  await wizCard(page, 'star-crossed', 'Star-Crossed');
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  await page.locator('.pm-unit[data-uid="s0"]').click();
  await expect(page.locator('.cb2-wbar')).toContainText('2 / 2');
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await page.locator('.cb2-wbar .btn', { hasText: 'Kész' }).click();
  await expect(page.locator('.cb2-wbar, .cb2-sheet')).toHaveCount(0);
  const cs = await getCS(page);
  expect(cs.steps.map((s: any) => [s.n, s.pl, s.tg.filter(Boolean)])).toEqual([['Riptide Rex', 'A', ['b0']], ['Flash', 'B', ['b0']], ['Star-Crossed', 'A', ['s0', 'b0']]]);
  const mine = await page.locator('#cb-out').textContent();
  await page.locator('#cb-ex').click();
  await expect(page.locator('#cb-out')).toHaveText(mine!);
  expect(await ov(page)).toBeLessThanOrEqual(1);
});

test('Varázsló: Vissza minden lépésnél, a Mégse nem hagy félkész lépést, Resolve és beszúrás', async ({ page }) => {
  await page.goto('/#chain');
  await page.locator('#cb-ex').click();
  // nem Reaction spell a nem üres chain mellett: az akció szürke, okkal és szabályszámmal
  await page.locator('.pm2-chain .pm2-add').click();
  await wizCard(page, 'void seeker', 'Void Seeker');
  await expect(page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' })).toBeDisabled();
  await expect(page.locator('.cb2-sheet .pb-why')).toContainText('813.1.c.1');
  await page.locator('.cb2-sheet .btn', { hasText: 'Vissza' }).click();
  await expect(page.locator('.cb2-sheet')).toContainText('1 / 4');
  await wizCard(page, 'flash', 'Flash');
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  await expect(page.locator('.cb2-wbar')).toBeVisible();
  expect((await getCS(page)).steps).toHaveLength(4);
  await page.locator('.cb2-wbar .btn', { hasText: 'Vissza' }).click();
  await expect(page.locator('.cb2-sheet')).toContainText('2 / 4');
  expect((await getCS(page)).steps).toHaveLength(3);
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  await page.locator('.cb2-wbar .btn', { hasText: 'Mégse' }).click();
  await expect(page.locator('.cb2-wbar, .cb2-sheet')).toHaveCount(0);
  expect((await getCS(page)).steps).toHaveLength(3);
  // a hand lapra bökés is a varázslót nyitja (2. lépés: akció)
  await page.locator('.cb2-add .btn', { hasText: 'Resolve' }).click();
  await expect(page.locator('.cb2-sheet')).toContainText('2 / 4');
  await page.locator('.cb2-sheet .btn', { hasText: 'Vissza' }).click();
  await expect(page.locator('.cb2-sheet')).toContainText('1 / 4');
  await page.locator('.cb2-sheet .btn', { hasText: 'Mégse' }).click();
  // beszúrás az 1. és 2. közé: Resolve
  await page.getByRole('button', { name: 'Beszúrás a 1. és a 2. lépés közé' }).click();
  await expect(page.locator('.cb2-sheet')).toContainText('1. lépés után');
  await page.locator('.cb2-sheet .btn', { hasText: 'Resolve' }).click();
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Resolve' }).click();
  await expect(page.locator('.cb2-sheet')).toHaveCount(0);
  const cs = await getCS(page);
  expect(cs.steps.map((s: any) => s.k === 'res' ? 'res' : s.n)).toEqual(['Riptide Rex', 'res', 'Flash', 'Star-Crossed']);
  expect(cs.steps[3].tg).toEqual(['s0', 'b0']);
});

test('Varázsló: célzás pályán kívüli célpontra, a sáv nem takarja a célpontot', async ({ page }) => {
  await page.goto('/#chain');
  await page.locator('.pm2-chain .pm2-add').click();
  await wizCard(page, 'void seeker', 'Void Seeker');
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
  const zone = page.locator('.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add');
  await expect(zone).toHaveClass(/g-act/);
  await zone.scrollIntoViewIfNeeded();
  const bar = await page.locator('.cb2-wbar').boundingBox();
  const z = await zone.boundingBox();
  expect(z!.y + z!.height).toBeLessThanOrEqual(bar!.y);
  expect(z!.height).toBeGreaterThanOrEqual(44);
  await zone.click();
  // a pályán kívüli célpontnak a Might értéke megadható: ez a varázsló 4. lépése
  await expect(page.locator('.cb2-sheet')).toContainText('4 / 4');
  await page.locator('.cb2-sheet input[data-em="0_0"]').fill('3');
  await page.locator('.cb2-sheet input[data-em="0_0"]').blur();
  await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kész' }).click();
  await expect(page.locator('.cb2-wbar, .cb2-sheet')).toHaveCount(0);
  const cs = await getCS(page);
  expect(cs.steps[0].tg).toEqual(['x']);
  expect(cs.steps[0].ext[0]).toMatchObject({ loc: 'bf0', pl: 'B', m: 3 });
  expect(await ov(page)).toBeLessThanOrEqual(1);
});
