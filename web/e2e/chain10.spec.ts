import { expect, test, type Page } from '@playwright/test';

/* Rune Deck és rune pool tartalma a pályás építőben (asztal és keskeny nézet): felvétel, sorrend, exhausted, és a Twisted Fate felső rune-ja. */
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-pick .cb2-q').fill(q);
  await p.locator('.cb2-pick .cb2-res button', { hasText: n }).first().click();
  await expect(p.locator('.cb2-pick')).toHaveCount(0);
}

for (const w of [1300, 390]) {
  test('Rune Deck panel: rune a Rune Deck tetejére és a poolba (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.waitForFunction(() => typeof (window as any).__setCS === 'function');
    await page.evaluate(() => (window as any).__setCS({ turn: 'A', lg: { A: '', B: '' }, bf: [{ n: '', c: 'A' }, { n: '', c: '' }], hand: { A: [], B: [] }, trash: { A: [], B: [] }, deck: { A: [], B: [] },
      bd: [{ n: 'Twisted Fate, Gambler', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Mega-Mech', pl: 'B', loc: 'bf0', d: 0 }], steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: 'Twisted Fate, Gambler', tg: [], ext: {} }] }));
    await page.locator('.pm2-band.me-bottom [data-zone="runeDeck"]').click();
    const panel = page.locator('.cb2-zp');
    await panel.locator('.pb-btn', { hasText: '+ Rune a Rune Deck tetejére' }).click();
    await pickCard(page, 'mind rune', 'Mind Rune');
    await panel.locator('.pb-btn', { hasText: '+ Rune a Rune Deck tetejére' }).click();
    await pickCard(page, 'fury rune', 'Fury Rune');
    await panel.locator('.pb-btn', { hasText: '+ Rune a poolba' }).click();
    await pickCard(page, 'calm rune', 'Calm Rune');
    await panel.locator('input[type="checkbox"]').check();
    await expect(panel).toContainText('1. Fury Rune');
    await panel.locator('.pb-btn', { hasText: 'Kész' }).click();
    const cs = await getCS(page);
    expect(cs.runeDeck.A.map((e: any) => e.n)).toEqual(['Fury Rune', 'Mind Rune']);
    expect(cs.runePool.A).toMatchObject([{ n: 'Calm Rune', ex: true }]);
    await expect(page.locator('#cb-out')).toContainText('felfedve Fury Rune');
    await expect(page.locator('#cb-out')).toContainText('Mega-Mech 2 damage-et kap');
  });
}
