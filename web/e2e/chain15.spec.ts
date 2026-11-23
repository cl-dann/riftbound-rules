import { expect, test } from '@playwright/test';

/* Combat panel: attack és defend triggerek a combat chainre (383.4.e, 383.4.f, 466.2.d.1), combat győzelem triggerei (468.3.a). */
const errs: string[] = [];
test.beforeEach(({ page }) => { page.on('pageerror', (e) => errs.push(e.message)); });
test.afterEach(() => { expect(errs).toEqual([]); errs.length = 0; });

for (const w of [1300, 390]) {
  test('Combat: attack és defend triggerek, győzelem (' + w + ' px)', async ({ page }) => {
    await page.setViewportSize({ width: w, height: w > 700 ? 900 : 844 });
    await page.goto('/#chain');
    const cs = { turn: 'A', lg: { A: 'Draven, Glorious Executioner', B: "Kai'Sa, Daughter of the Void" }, bf: [{ n: '', c: 'B' }, { n: '', c: '' }],
      bd: [{ n: 'Draven, Vanquisher', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Overzealous Fan', pl: 'B', loc: 'bf0', d: 0 }], steps: [], hand: { A: [], B: [] }, ch: { A: '', B: '' } };
    const enc = await page.evaluate((t) => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), JSON.stringify(cs));
    await page.goto('/#c=' + enc);
    await page.reload();
    const cb = page.locator('#cb-combat');
    await cb.locator(':scope > summary').click();
    const ad = cb.locator('[data-ad]');
    await expect(ad).toContainText('Draven, Vanquisher (te): When I attack or defend');
    await expect(ad).toContainText('Overzealous Fan (ellenfél): When I defend');
    await ad.getByRole('button', { name: 'Attack és defend triggerek a chainre' }).click();
    await expect(ad.locator('.cbc-on')).toHaveCount(2);
    const out = page.locator('#cb-out');
    await expect(out).toContainText('Draven, Vanquisher');
    await expect(out).toContainText('Overzealous Fan');
    await cb.getByRole('button', { name: 'Szabályos javaslat' }).click();
    await expect(cb.locator('.cbc-res')).toContainText('Te (attacker) nyeri a combatot');
    await expect(cb.locator('.cbc-trig').last()).toContainText('Draven, Glorious Executioner (When you win a combat, te): draw 1.');
    await expect(cb.locator('.cbc-trig').last()).toContainText('Draven, Vanquisher (When I win a combat, te)');
  });
}
