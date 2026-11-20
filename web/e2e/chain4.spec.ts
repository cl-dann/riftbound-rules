import { expect, test, type Page } from '@playwright/test';

/* Chain építő, 2. ütem: sablonok, beszúrás a chain közepére, kör és fázis a pálya fejlécében, pályán kívüli célpont, kézből választás. */
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-q').fill(q);
  await p.locator('.cb2-res button', { hasText: n }).first().click();
  await expect(p.locator('.cb2-pick')).toHaveCount(0);
}
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

test('Sablonok: betöltés üres pályára azonnal, tartalom mellett megerősítéssel', async ({ page }) => {
  await page.goto('/#chain');
  await page.getByRole('button', { name: 'Sablonok' }).click();
  await expect(page.locator('.cb2-tpl')).toHaveCount(8);
  await page.locator('[data-tpl="counter"] .btn', { hasText: 'Betöltés' }).click();
  await expect(page.locator('.cb2-sc')).toHaveCount(2);
  await expect(page.locator('#cb-out')).toContainText('counterelve');
  await page.getByRole('button', { name: 'Sablonok' }).click();
  await page.locator('[data-tpl="ignored"] .btn', { hasText: 'Betöltés' }).click();
  await expect(page.locator('[data-tpl="ignored"]')).toContainText('A mostani helyzet elvész');
  expect((await getCS(page)).steps[1].n).toBe('Wind Wall');
  await page.locator('[data-tpl="ignored"] .btn', { hasText: 'Betöltés mégis' }).click();
  expect((await getCS(page)).steps.map((s: any) => s.n)).toEqual(['Hidden Blade', 'Flash']);
  await expect(page.locator('#cb-out')).toContainText('Ignored');
  await expect(page.locator('.cb2-sc.bad, .cb2-sc.need')).toHaveCount(0);
});

test('Beszúrás a chain közepére: a lépés-hivatkozások átszámozódnak', async ({ page }) => {
  await page.goto('/#chain');
  await page.locator('#cb-ex').click();
  // Resolve az 1. és a 2. lépés közé az idővonal + gombjával
  await page.getByRole('button', { name: 'Beszúrás a 1. és a 2. lépés közé' }).click();
  await expect(page.locator('.cb2-mode')).toContainText('1. lépés után');
  await page.locator('.cb2-mode .btn', { hasText: 'Resolve' }).click();
  let cs = await getCS(page);
  expect(cs.steps.map((s: any) => s.k === 'res' ? 'res' : s.n)).toEqual(['Riptide Rex', 'res', 'Flash', 'Star-Crossed']);
  expect(cs.steps[3].tg).toEqual(['s0', 'b0']);
  await expect(page.locator('#cb-out')).toContainText('340.1');
  // lap beszúrása az 1. lépés elé a lépés-panelből: a Star-Crossed hivatkozása s0-ról s1-re vált
  await page.locator('.cb2-sc .cb2-sb').first().click();
  await page.locator('.cb2-sp .btn', { hasText: 'Beszúrás elé' }).click();
  await page.locator('.cb2-mode .btn', { hasText: 'Lap kereséssel' }).click();
  await page.locator('.cb2-pick .cb2-seg button', { hasText: 'Te' }).click();
  await pickCard(page, 'traveling merchant', 'Traveling Merchant');
  cs = await getCS(page);
  expect(cs.steps[0]).toMatchObject({ n: 'Traveling Merchant', pl: 'A' });
  expect(cs.steps[4].tg).toEqual(['s1', 'b0']);
  await expect(page.locator('.cb2-sc').first()).toContainText('Traveling Merchant');
});

test('Kör és fázis a pálya fejlécében, szinkronban a Haladó szerkesztéssel', async ({ page }) => {
  await page.goto('/#chain');
  await page.locator('#cb-ex').click();
  await page.locator('.cb2-hdr button', { hasText: 'ellenfél' }).click();
  expect((await getCS(page)).turn).toBe('B');
  await expect(page.locator('#cb-steps select[data-turn]')).toHaveValue('B');
  await expect(page.locator('.pm2-bar.opp .pm2-turn')).toBeVisible();
  await page.locator('.cb2-hdr button', { hasText: 'Beginning Phase' }).click();
  expect((await getCS(page)).phase).toBe('beginning');
  await page.locator('#cb-adv > summary').click();
  await page.selectOption('#cb-steps select[data-turn]', 'A');
  await expect(page.locator('.cb2-hdr button', { hasText: /^te$/ })).toHaveAttribute('aria-pressed', 'true');
});

test('Pályán kívüli célpont a pályán és lap választása a kézből', async ({ page }) => {
  await page.goto('/#chain');
  await page.locator('.pm2-chain .pm2-add').click();
  await pickCard(page, 'void seeker', 'Void Seeker');
  await expect(page.locator('.cb2-mode')).toContainText('1. célpont');
  const zone = page.locator('.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add');
  await expect(zone).toHaveClass(/g-act/);
  await expect(page.locator('.pm2-band.opp-base .pm2-base .pm2-add')).not.toHaveClass(/g-act/);
  await zone.click();
  const cs = await getCS(page);
  expect(cs.steps[0].tg).toEqual(['x']);
  expect(cs.steps[0].ext[0]).toMatchObject({ loc: 'bf0', pl: 'B' });
  await expect(page.locator('.pm-unit[data-uid="t0_0"]')).toBeVisible();
  await expect(page.locator('#cb-out')).toContainText('Void Seeker célpontja');
  // Show Off: unit a kézből
  await page.locator('#cb-clear').click();
  await page.locator('.pm2-band.me-bottom .pm2-hand .pm2-add').click();
  await pickCard(page, 'traveling merchant', 'Traveling Merchant');
  await page.locator('.pm2-band.opp-base .pm2-base .pm2-add').click();
  await pickCard(page, 'shipyard skulker', 'Shipyard Skulker');
  await page.locator('.pm2-chain .pm2-add').click();
  await pickCard(page, 'primordial roar', 'Primordial Roar');
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await expect(page.locator('.cb2-sp')).toContainText('Primordial Roar');
  await page.locator('.cb2-sp .btn', { hasText: 'Unit a kézből' }).click();
  await expect(page.locator('.pm2-band.me-bottom .pm2-hc.g-act')).toHaveCount(1);
  await page.locator('.pm2-band.me-bottom .pm2-hc').first().click();
  expect((await getCS(page)).steps[0].so).toBe('h:Traveling Merchant');
  await expect(page.locator('#cb-out')).toContainText('832.1.d.1');
});
