/* Vizuális regresszió (toHaveScreenshot), csak a "visual-1300" és "visual-390" projektben (VISUAL=1).
   A baseline CI-ban (ubuntu) készül: e2e.yml, workflow_dispatch, update-snapshots bemenet. Helyben a renderelés eltér,
   ezért ott a baseline nem készül és nem hasonlít. Külső források: Riot CDN helyett üres kép, Google Fonts tiltva,
   a dátum rögzített (a ban és az árfrissítés jelzése a mai naptól függ). */
import { expect, test, type Page } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const errors: string[] = [];
test.beforeEach(async ({ page, context }) => {
  page.on('pageerror', (e) => errors.push(e.message));
  await context.route(/cmsassets\.rgpub\.io/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
});
test.afterEach(() => { expect(errors, 'nincs JS hiba').toEqual([]); errors.length = 0; });

const narrow = (p: Page) => (p.viewportSize()?.width || 1300) <= 700;
const shot = async (p: Page, name: string) => {
  await p.evaluate(() => document.fonts.ready);
  await expect(p).toHaveScreenshot(name + '.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 });
};
async function go(p: Page, hash: string) {
  await p.goto('/' + hash);
  await expect(p.locator('.view.on')).toBeVisible();
}
async function pickCard(p: Page, q: string, n: string) {
  const box = narrow(p) ? '.cb2-sheet' : '.cb2-pick';
  await p.locator(box + ' .cb2-q').fill(q);
  await p.locator(box + ' .cb2-res button', { hasText: n }).first().click();
}
const menuBtn = (p: Page, t: string) => p.locator('.cb2-menu .pb-btn, .cb2-sheet .pb-btn', { hasText: t }).first();

for (const [tab, ready] of [['kartyak', '.tile'], ['deck', '#deckin'], ['szabalyok', '[data-rid]'], ['chain', '.pm2'], ['hogyan', 'h1.chtitle'], ['tanulas', '.view.on main.learn-main'], ['kezikonyv', '[data-fs]']] as const) {
  test('fül: ' + tab, async ({ page }) => {
    await go(page, '#' + tab);
    await expect(page.locator(ready).first()).toBeVisible();
    await shot(page, 'tab-' + tab);
  });
}

test('kártyamodál', async ({ page }) => {
  await go(page, '#kartyak');
  await page.locator('input').first().fill('Hidden Blade');
  await page.locator('.tile').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await shot(page, 'card-modal');
});

test('Chain: akció-menü', async ({ page }) => {
  await go(page, '#chain');
  await page.locator('#cb-ex').click();
  await page.locator('.pm-unit[data-uid="b0"]').first().click();
  await expect(page.locator('.cb2-menu, .cb2-sheet').first()).toBeVisible();
  await shot(page, 'chain-action-menu');
});

test('Chain: célzás (keskeny nézetben a varázsló lépései is)', async ({ page }) => {
  await go(page, '#chain');
  await page.locator('#cb-ex').click();
  await page.locator('.pm2-chain .pm2-add').click();
  if (narrow(page)) {
    await expect(page.locator('.cb2-sheet')).toContainText('1 / 4');
    await shot(page, 'chain-wizard');
    await pickCard(page, 'flash', 'Flash');
    await expect(page.locator('.cb2-sheet')).toContainText('2 / 4');
    await menuBtn(page, 'Kijátszás').click();
    await expect(page.locator('.cb2-wbar')).toBeVisible();
  } else {
    await pickCard(page, 'flash', 'Flash');
    await expect(page.locator('.cb2-mode')).toBeVisible();
  }
  await shot(page, 'chain-targeting');
});

test('Chain: combat panel', async ({ page }) => {
  await go(page, '#chain');
  await page.locator('#cb-ex2').click();
  await page.locator('.pm-unit[data-uid="b0"]').first().click();
  await menuBtn(page, 'Combat ezen a battlefielden').click();
  await expect(page.locator('#cb-combat')).toHaveAttribute('open', '');
  await page.locator('#cb-combat').scrollIntoViewIfNeeded();
  await shot(page, 'chain-combat');
});

test('Practice: kiértékelés', async ({ page }) => {
  await go(page, '#tanulas/sz/egyszeru-combat-conquer');
  const v = page.locator('.view.on');
  await v.getByRole('button', { name: 'Szituáció indítása' }).click();
  await v.getByRole('button', { name: 'End Turn' }).click();
  await expect(v.locator('.pb-panel.out.bad')).toBeVisible();
  await shot(page, 'practice-outcome');
});
