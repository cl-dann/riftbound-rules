import { expect, test, type Page } from '@playwright/test';

/* Chain: pályás építő. A "Példa betöltése" chainje kattintásokkal, a pályán felépítve, ugyanazt az elemzést adja. */
let clicks = 0;
const click = async (p: Page, sel: string, opt: { hasText?: string | RegExp } = {}) => { clicks++; await p.locator(sel, opt).first().click(); };
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-q').fill(q);
  await click(p, '.cb2-res button', { hasText: n });
  await expect(p.locator('.cb2-pick')).toHaveCount(0);
}

test('Chain építő: a példa felépítése a pályán kattintással, élő elemzés, válasz, sorrendcsere, haladó szerkesztés', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#chain');
  await expect(page.locator('.pm2.edm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chain lefuttatása' })).toHaveCount(0);
  clicks = 0;
  // legend
  await click(page, '.pm2-band.me-base [data-zone="legend"]');
  await expect(page.locator('.cb2-pick')).toContainText('Legend');
  await pickCard(page, 'kennen tempest', 'Kennen, Heart of the Tempest');
  // battlefieldek és irányítás
  await click(page, '.pm2-bf[data-bfi="0"] .pm2-bfadd');
  await pickCard(page, 'vilemaw', "Vilemaw's Lair");
  await click(page, '.pm2-bf[data-bfi="0"] .pm2-bfc .cl');
  await click(page, '.cb2-menu .pb-btn', { hasText: 'Kontroll: ellenfél' });
  await click(page, '.pm2-bf[data-bfi="1"] .pm2-bfadd');
  await pickCard(page, 'zaun warrens', 'Zaun Warrens');
  await click(page, '.pm2-bf[data-bfi="1"] .pm2-bfc .cl');
  await click(page, '.cb2-menu .pb-btn', { hasText: 'Kontroll: te' });
  // board: ellenfél unit és gear az 1. battlefielden
  await click(page, '.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add');
  await pickCard(page, 'traveling merchant', 'Traveling Merchant');
  await click(page, '.pm2-bf[data-bfi="0"] .pm2-ubox.opp .pm2-add');
  await pickCard(page, 'long sword', 'Long Sword');
  await click(page, '.pm-unit[data-uid="b1"]');
  await expect(page.locator('.cb2-menu')).toBeVisible();
  await click(page, '.cb2-menu .pb-btn', { hasText: 'Tulajdonságok' });
  clicks++; await page.locator('.cb2-props select').last().selectOption('0');
  await click(page, '.cb2-props .pb-btn', { hasText: 'Kész' });
  // 1. lépés: Riptide Rex a Chain + gombjával, a play trigger célpontja kattintással
  await click(page, '.pm2-chain .pm2-add');
  await pickCard(page, 'riptide rex', 'Riptide Rex');
  await expect(page.locator('.cb2-mode')).toContainText('1. célpont');
  await expect(page.locator('.pm-unit[data-uid="b0"].g-act')).toBeVisible();
  await click(page, '.pm-unit[data-uid="b0"]');
  await expect(page.locator('.cbv-arrow').first()).toBeAttached();
  // válasz: Flash, az ellenfél (automatikusan a másik játékos)
  await click(page, '.pm2-chain .pm2-add');
  await expect(page.locator('.cb2-pick .cb2-seg button.on')).toHaveText('Ellenfél');
  await pickCard(page, 'flash', 'Flash');
  await click(page, '.pm-unit[data-uid="b0"]');
  await click(page, '.cb2-mode .btn', { hasText: 'Kész' });
  // Star-Crossed két célponttal
  await click(page, '.pm2-chain .pm2-add');
  await pickCard(page, 'star-crossed', 'Star-Crossed');
  await click(page, '.cb2-mode .cb2-chip', { hasText: 'Riptide Rex' });
  await click(page, '.pm-unit[data-uid="b0"]');
  await click(page, '.cb2-mode .btn', { hasText: 'Kész' });
  const built = await page.evaluate(() => (window as any).__getCS());
  expect(built.steps.map((s: any) => [s.n, s.pl, s.tg.filter(Boolean)])).toEqual([['Riptide Rex', 'A', ['b0']], ['Flash', 'B', ['b0']], ['Star-Crossed', 'A', ['s0', 'b0']]]);
  console.log('Kattintás a példa felépítéséhez: ' + clicks);
  // élő elemzés: gomb nélkül frissül, és megegyezik a beépített példával
  await expect(page.locator('#cb-out')).toContainText('Star-Crossed');
  await expect(page.locator('.cb2-sc')).toHaveCount(3);
  const mine = await page.locator('#cb-out').textContent();
  await page.getByRole('button', { name: 'Példák', exact: true }).click(); await page.locator('#cb-ex').click();
  await expect(page.locator('#cb-out')).toHaveText(mine!);
  // sorrendcsere nyíllal: Flash fel, a lépésre mutató célpont hivatkozás követi
  await page.getByRole('button', { name: '2. lépés feljebb' }).click();
  await expect(page.locator('.cb2-sc').first()).toContainText('Flash');
  await expect(page.locator('#cb-out')).not.toHaveText(mine!);
  await page.getByRole('button', { name: '1. lépés lejjebb' }).click();
  await expect(page.locator('#cb-out')).toHaveText(mine!);
  // lépés szerkesztése és haladó szerkesztés megnyitása
  await page.locator('.cb2-sc .cb2-sb').nth(2).click();
  await expect(page.locator('.cb2-sp')).toContainText('Star-Crossed');
  await page.locator('.cb2-sp .linkbtn', { hasText: 'Haladó szerkesztés' }).click();
  await expect(page.locator('#cb-adv')).toHaveAttribute('open', '');
  await expect(page.locator('#cb-steps [data-sj="2"] input[data-name="2"]')).toHaveValue('Star-Crossed');
  // törlés
  await page.getByRole('button', { name: '3. lépés törlése' }).click();
  await expect(page.locator('.cb2-sc')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Chain építő: akció-menü legalitása, kijátszás kézből, Standard Move, kontroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#chain');
  // saját kéz: egy nem Reaction unit; a példa chainje mellett kézből válaszként nem jöhet (Closed State)
  await page.getByRole('button', { name: 'Példák', exact: true }).click(); await page.locator('#cb-ex').click();
  await page.locator('.pm2-band.me-bottom .pm2-hand .pm2-add').click();
  await pickCard(page, 'riptide rex', 'Riptide Rex');
  await page.locator('.pm2-band.me-bottom .pm2-hc').first().click();
  const play = page.locator('.cb2-menu .pb-btn', { hasText: 'Kijátszás' });
  await expect(play).toBeDisabled();
  await expect(page.locator('.cb2-menu .pb-why').first()).toContainText('813.1.c.1');
  await expect(page.locator('.cb2-menu .pb-btn', { hasText: 'Elrejtés' })).toBeDisabled();
  await page.keyboard.press('Escape');
  // Standard Move: a unit exhausted lesz
  await page.locator('#cb-clear').click();
  await page.locator('.pm2-band.me-base .pm2-base .pm2-add').click();
  await pickCard(page, 'yasuo remorseful', 'Yasuo, Remorseful');
  await page.locator('.pm2-bf[data-bfi="0"] .pm2-bfadd').click();
  await pickCard(page, 'zaun warrens', 'Zaun Warrens');
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await page.locator('.cb2-menu .pb-btn', { hasText: 'Mozgatás (Standard Move)' }).click();
  await expect(page.locator('.pm2-bf[data-bfi="0"].g-dest')).toBeVisible();
  await page.locator('.pm2-bf[data-bfi="0"]').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.pm2-bf[data-bfi="0"] .pm-unit[data-uid="b0"]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__getCS().bd[0])).toMatchObject({ loc: 'bf0', ex: true });
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await expect(page.locator('.cb2-menu .pb-btn', { hasText: 'Mozgatás (Standard Move)' })).toBeDisabled();
  await expect(page.locator('.cb2-menu .pb-why').filter({ hasText: '144.2' })).toBeVisible();
  // trigger a chainre a menüből, a combat panel megnyitása erre a battlefieldre
  await page.locator('.cb2-menu .pb-btn', { hasText: 'Combat ezen a battlefielden' }).click();
  await expect(page.locator('#cb-combat')).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('Chain építő: mobil 390 px, nincs vízszintes túllógás, a menü és a kereső használható', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#chain');
  const ov = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await ov()).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Példák', exact: true }).click(); await page.locator('#cb-ex').click();
  expect(await ov()).toBeLessThanOrEqual(1);
  // keskeny nézetben az akció-menü és a kereső a lépés-varázsló (bottom sheet) része
  await page.locator('.pm-unit[data-uid="b0"]').click();
  await expect(page.locator('.cb2-sheet')).toContainText('2 / 4');
  expect(await ov()).toBeLessThanOrEqual(1);
  await page.locator('.cb2-sheet .btn', { hasText: 'Mégse' }).click();
  await page.locator('.pm2-chain .pm2-add').click();
  await expect(page.locator('.cb2-sheet .cb2-q')).toBeVisible();
  expect(await ov()).toBeLessThanOrEqual(1);
});
