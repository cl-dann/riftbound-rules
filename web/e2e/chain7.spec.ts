import { expect, test, type Page } from '@playwright/test';

/* Költségfeltétel a kiválasztáskor (206) és a kéz lapjainak állandó azonosítója. */
const getCS = (p: Page) => p.evaluate(() => (window as any).__getCS());
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });
async function pickCard(p: Page, q: string, n: string) {
  await p.locator('.cb2-pick .cb2-q').fill(q);
  await p.locator('.cb2-pick .cb2-res button', { hasText: n }).first().click();
  await expect(p.locator('.cb2-pick')).toHaveCount(0);
}
async function addTrash(p: Page, q: string, n: string) {
  await p.locator('.cb2-zp .pb-btn', { hasText: '+ Lap a trashbe' }).click();
  await pickCard(p, q, n);
}

for (const w of [1300, 390]) {
  test('túl drága lap szürke a kiválasztáskor, okkal (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    await page.locator('.pm2-band.me-bottom [data-zone="trash"]').click();
    await addTrash(page, 'shipyard skulker', 'Shipyard Skulker');
    await addTrash(page, 'blastcone fae', 'Blastcone Fae');
    await page.locator('.cb2-zp .pb-btn', { hasText: 'Kész' }).click();
    if (w > 700) { await page.locator('.pm2-chain .pm2-add').click(); await pickCard(page, 'undying loyalty', 'Undying Loyalty'); }
    else {
      await page.locator('.cb2-fab .btn').click();
      await page.locator('.cb2-sheet .cb2-q').fill('undying loyalty');
      await page.locator('.cb2-sheet .cb2-res button').first().click();
      await page.locator('.cb2-sheet .pb-btn', { hasText: 'Kijátszás' }).click();
    }
    const bar = w > 700 ? page.locator('.cb2-mode') : page.locator('.cb2-wbar');
    const bad = bar.locator('.cb2-chip.bad', { hasText: 'Shipyard Skulker' });
    await expect(bad).toContainText('Energy költsége 3, a feltétel legfeljebb 2 (206)');
    await bad.click();
    expect((await getCS(page)).steps[0].zp).toBeUndefined();
    // a trash paklit megnyitva is szürke, a választás gombja tiltott
    if (w > 700) {
      await page.locator('.pm2-band.me-bottom [data-zone="trash"]').click();
      await expect(page.locator('.cb2-zp li.bad')).toContainText('legfeljebb 2');
      await expect(page.locator('.cb2-zp li.bad .btn')).toBeDisabled();
      await page.locator('.cb2-zp li.ok .btn').click();
      await page.locator('.cb2-zp .pb-btn', { hasText: 'Kész' }).click();
    } else await bar.locator('.cb2-chip', { hasText: 'Blastcone Fae' }).click();
    const cs = await getCS(page);
    const id = cs.steps[0].zp[1][0];
    expect(cs.trash.A.find((e: any) => e.id === id).n).toBe('Blastcone Fae');
    await expect(page.locator('#cb-out')).toContainText('Blastcone Fae');
  });
}

test('kézlap törlése után nincs elcsúszás: a kiválasztás az azonosítót követi, törlés után hiányos', async ({ page }) => {
  await page.goto('/#chain');
  for (const [q, n] of [['flash', 'Flash'], ['void seeker', 'Void Seeker']]) {
    await page.locator('.pm2-band.me-bottom .pm2-hand .pm2-add').click();
    await pickCard(page, q, n);
  }
  await page.locator('.pm2-chain .pm2-add').click();
  await pickCard(page, 'lunar boon', 'Lunar Boon');
  await page.locator('.cb2-mode .cb2-chip', { hasText: 'Void Seeker' }).click();
  let cs = await getCS(page);
  const vid = cs.steps[0].zp[0][0];
  expect(cs.hand.A.find((e: any) => e.id === vid).n).toBe('Void Seeker');
  // a Flash törlése (az első kézlap): a kiválasztás nem csúszik át más lapra
  await page.locator('.cbv-dots i').first().click();
  await page.locator('.pm2-band.me-bottom .pm2-hc').first().click();
  await page.locator('.cb2-menu .pb-btn', { hasText: 'Eltávolítás a kézből' }).click();
  cs = await getCS(page);
  // a kereséssel kijátszott Lunar Boon magától a kézbe került (onnan játszotta ki)
  expect(cs.hand.A.map((e: any) => e.n)).toEqual(['Void Seeker', 'Lunar Boon']);
  expect(cs.steps[0].zp[0]).toEqual([vid]);
  await expect(page.locator('#cb-out')).toContainText('eldobja: Void Seeker');
  // a kiválasztott lap törlése: a lépés hiányos, nem kerül más lap a helyére
  await page.locator('.cbv-dots i').first().click();
  await expect(page.locator('.pm2-band.me-bottom .pm2-hc')).toHaveCount(2);
  await page.locator('.pm2-band.me-bottom .pm2-hc').first().click();
  await page.locator('.cb2-menu .pb-btn', { hasText: 'Eltávolítás a kézből' }).click();
  await expect(page.locator('.cb2-sc.need')).toContainText('Hiányzik');
  expect((await getCS(page)).steps[0].zp[0]).toEqual([vid]);
});
