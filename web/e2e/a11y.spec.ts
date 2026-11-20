/* Akadálymentesség (axe-core) nézetenként: critical és serious szintű új hiba bukik.
   Kivétel a KNOWN listán lehet (szabály-azonosító nézetenként), indoklással. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// A kezdeti kivétellista (S06) kiürült: a hibák javítva (S24 után). Új kivétel csak indoklással kerülhet ide.
const KNOWN: Record<string, string[]> = {};

async function check(page: Page, view: string) {
  const r = await new AxeBuilder({ page }).include('body').analyze();
  const bad = r.violations.filter((v) => (v.impact === 'critical' || v.impact === 'serious') && !(KNOWN[view] || []).includes(v.id));
  expect(bad.map((v) => v.id + ' (' + v.impact + ', ' + v.nodes.length + ' elem): ' + v.help), view).toEqual([]);
}
test.beforeEach(async ({ context }) => { await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); });

for (const [tab, ready] of [['kartyak', '.tile'], ['deck', '#deckin'], ['szabalyok', '[data-rid]'], ['chain', '.pm2'], ['hogyan', 'h1.chtitle'], ['tanulas', '.view.on main.learn-main'], ['kezikonyv', '[data-fs]']] as const) {
  test('axe: ' + tab, async ({ page }) => {
    await page.goto('/#' + tab);
    await expect(page.locator(ready).first()).toBeVisible();
    await check(page, tab);
  });
}

test('axe: kártyamodál', async ({ page }) => {
  await page.goto('/#kartyak');
  await page.locator('input').first().fill('Hidden Blade');
  await page.locator('.tile').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await check(page, 'modal');
});

test('axe: Chain akció-menü', async ({ page }) => {
  await page.goto('/#chain');
  await page.locator('#cb-ex').click();
  await page.locator('.pm-unit[data-uid="b0"]').first().click();
  await expect(page.locator('.cb2-menu').first()).toBeVisible();
  await check(page, 'chain-menu');
});
