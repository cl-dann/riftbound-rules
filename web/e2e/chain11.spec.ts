import { expect, test } from '@playwright/test';

/* Frame-enkénti számlálók a Playmaton: XP, pont, rune pool és Rune Deck, a változás kiemelve. */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

for (const w of [1300, 390]) {
  test('Mobilize channel: a rune pool és a Rune Deck változása kiemelve (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.waitForFunction(() => typeof (window as any).__setCS === 'function');
    await page.evaluate(() => (window as any).__setCS({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], ps: { A: { runes: 2, runeDeck: 9, xp: 3, score: 1 } },
      steps: [{ k: 'card', n: 'Mobilize', pl: 'A', tg: [], ext: {} }, { k: 'res' }] }));
    const me = page.locator('.pm2-band.me-bottom');
    await expect(page.locator('.pm2-pts.me')).toContainText('1pts');
    await expect(page.locator('.pm2-pts.me')).toContainText('3XP');
    await expect(me.locator('[data-zone="runeDeck"]')).toContainText('9');
    const next = page.locator('button', { hasText: 'Következő' });
    for (let k = 0; k < 6 && !(await me.locator('[data-zone="runeDeck"]').textContent())?.includes('8'); k++) await next.click();
    await expect(me.locator('[data-zone="runeDeck"]')).toContainText('8');
    await expect(me.locator('[data-zone="runeDeck"].chg')).toHaveCount(1);
    await expect(me.locator('.pm2-runes.chg')).toHaveCount(1);
  });
}
