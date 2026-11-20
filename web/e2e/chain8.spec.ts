import { expect, test, type Page } from '@playwright/test';

/* "From among them": a megnézett lapok a Deck panelből, a választás költség- és típusfeltétellel (206, 128.4, 355.18). */
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-pick .cb2-q').fill(q);
  await p.locator('.cb2-pick .cb2-res button', { hasText: n }).first().click();
  await expect(p.locator('.cb2-pick')).toHaveCount(0);
}
async function deckTop(p: Page, cards: [string, string][]) {
  await p.locator('.pm2-band.me-bottom [data-zone="deck"]').click();
  for (const [q, n] of cards) { await p.locator('.cb2-zp .pb-btn', { hasText: '+ Lap a deck tetejére' }).click(); await pickCard(p, q, n); }
  await p.locator('.cb2-zp .pb-btn', { hasText: 'Kész' }).click();
}

for (const w of [1300, 390]) {
  test('Fate Weaver: választás a megnézett lapok közül (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    // a deck tetejére fordított sorrendben kerülnek: a végén Void Seeker a felső, alatta Clairvoyance
    await deckTop(page, [['clairvoyance', 'Clairvoyance'], ['void seeker', 'Void Seeker']]);
    if (w > 700) { await page.locator('.pm2-chain .pm2-add').click(); await pickCard(page, 'fate weaver', 'Fate Weaver'); }
    else {
      await page.locator('.cb2-fab .btn').click();
      await page.locator('.cb2-sheet .cb2-q').fill('fate weaver');
      await page.locator('.cb2-sheet .cb2-res button').first().click();
      await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
    }
    const bar = w > 700 ? page.locator('.cb2-mode') : page.locator('.cb2-wbar');
    await expect(bar).toContainText('megnézett lapok');
    await expect(bar.locator('.cb2-chip.bad', { hasText: 'Void Seeker' })).toContainText('legalább 4 (206)');
    await bar.locator('.cb2-chip', { hasText: 'Clairvoyance' }).click();
    const cs = await getCS(page);
    const id = cs.steps[0].zp[1][0];
    expect(cs.deck.A.find((e: any) => e.id === id).n).toBe('Clairvoyance');
    await expect(page.locator('#cb-out')).toContainText('Clairvoyance: megnézett lapok közül a tulajdonosa kezébe kerül');
    await expect(page.locator('#cb-out')).toContainText('128.4');
  });
}
