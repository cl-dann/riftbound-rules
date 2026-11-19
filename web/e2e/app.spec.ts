import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];
async function open(page: Page, hash: string) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/' + hash);
  await expect(page.locator('nav, header').first()).toBeVisible();
}
test.afterEach(() => { expect(errors, 'nincs JS hiba').toEqual([]); errors.length = 0; });

test('Kártyák: keresés, elgépelés-tűrés, lap megnyitása Q&A-val', async ({ page }) => {
  await open(page, '#kartyak');
  const q = page.locator('input').first();
  await q.fill('Annie, Stubborn');
  await page.locator('.tile').first().click();
  await expect(page.locator('dl.qa dt').first()).toBeVisible();
  await expect(page.locator('details.ntd summary')).toContainText('Szabályi részletek');
  await page.keyboard.press('Escape');
  await q.fill('Arhi Aluring');
  await expect(page.locator('.tile').first()).toBeVisible();
});

test('Deck: építés kereséssel, legalitás azonnal frissül', async ({ page }) => {
  await open(page, '#deck');
  await page.fill('#dq', 'Jinx');
  await page.selectOption('.bq select', 'Legend');
  await page.locator('.bres button').first().click();
  await page.selectOption('.bq select', '');
  await page.fill('#dq', 'Jinx, Demolitionist');
  await page.locator('.bres button').first().click();
  await expect(page.locator('#deckin')).toHaveValue(/Legend:\n1 Jinx, Loose Cannon[\s\S]*Champion:\n1 Jinx, Demolitionist/);
  await expect(page.getByText('103.3.a.2')).toBeVisible();
  await page.locator('.drow button[data-inc="1"]').first().click();
  await expect(page.locator('.prices')).toBeVisible();
});

test('Deck: megosztható link visszatölti a decket', async ({ page }) => {
  const text = 'Legend:\n1 Jinx, Loose Cannon\n';
  await open(page, '#deck');
  const enc = await page.evaluate((t) => btoa(unescape(encodeURIComponent(t))), text);
  await page.goto('/#d=' + enc);
  await expect(page.locator('#deckin')).toHaveValue(/Jinx, Loose Cannon/);
});

test('Szabályzat: szabályhivatkozás és versenyformátum oldal', async ({ page }) => {
  await open(page, '#r-103.2');
  await expect(page.locator('[data-rid="103.2"]').first()).toBeVisible();
  await page.goto('/#fmt-duel');
  await expect(page.getByText('Összehasonlítás')).toBeVisible();
});

test('Chain: példa lejátszása lépésenként', async ({ page }) => {
  await open(page, '#chain');
  await page.locator('#cb-ex').click();
  await page.locator('#cb-run').click();
  const next = page.getByRole('button', { name: 'Következő' }).first();
  await expect(next).toBeVisible();
  await next.click();
  await expect(page.getByText(/Mi változott/i).first()).toBeVisible();
});

test('Chain: kontrollváltás és csatolatlan gear a Playmaton', async ({ page }) => {
  await open(page, '#chain');
  await page.locator('#cb-ex2').click();
  const next = page.getByRole('button', { name: 'Következő' }).first();
  for (let i = 0; i < 3; i++) await next.click();
  await expect(page.locator('.pm2-ubox.opp .pm-lab.ctl').first()).toHaveText('Kontroll átvéve');
  await page.locator('#cb-ex3').click();
  await expect(page.locator('.pm2-gears .pm-unit.gear').first()).toBeVisible();
  await expect(page.locator('.pm2-gears .pm-might')).toHaveCount(0);
  await next.click(); await next.click();
  await expect(page.locator('.pm-lab.det').first()).toHaveText('Levált');
  await expect(page.locator('.cbv-chg')).toContainText('719.5');
});

test('How to Play: 10 fejezet, ABCD, Try It, régi linkek', async ({ page }) => {
  await open(page, '#hogyan');
  await expect(page.locator('.view.on .learn-side li')).toHaveCount(10);
  await expect(page.locator('.view.on .chhead .pos')).toHaveText('1 / 10');
  await expect(page.locator('.view.on h1.chtitle')).toHaveText('Overview');
  await page.locator('.view.on .learn-side a', { hasText: 'Turn Structure' }).click();
  await expect(page.locator('.view.on .chhead .pos')).toHaveText('4 / 10');
  await expect(page.locator('.view.on .labcd .lab')).toHaveCount(6);
  await page.goto('/#hogyan/resource-system');
  const t = page.locator('.view.on .tryit').first();
  for (let i = 0; i < 9; i++) await t.locator('.ti-rune > button:first-child').nth(i).click();
  await t.getByRole('button', { name: 'Ellenőrzés' }).click();
  await expect(t.locator('.ti-fb.ok')).toBeVisible();
  await t.getByRole('button', { name: 'Újra' }).click();
  await expect(t.locator('.ti-fb')).toHaveCount(0);
  await page.goto('/#hogyan/mi-a-cel');
  await expect(page).toHaveURL(/#hogyan\/win-conditions$/);
  await page.goto('/#tanulas/tempo-es-ertek');
  await expect(page).toHaveURL(/#tanulas\/lecke\/tempo-es-ertek$/);
});

test('How to Play és Practice: nincs kvíz, nincs Elolvastam gomb, nincs haladásmérő', async ({ page }) => {
  for (const h of ['#hogyan', '#hogyan/spell-speeds', '#tanulas', '#tanulas/lecke', '#tanulas/lecke/tempo-es-ertek']) {
    await open(page, h);
    await expect(page.locator('.view.on main.learn-main')).toBeVisible();
    await expect(page.locator('.quiz')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Elolvastam' })).toHaveCount(0);
    await expect(page.locator('.view.on main.learn-main')).not.toContainText(/completed|teljesítve|elvégezve/i);
  }
  await page.goto('/#tanulas/sz');
  await expect(page.locator('.view.on .scnlist li')).toHaveCount(10);
  await page.locator('.view.on .scnlist a').first().click();
  await expect(page.locator('.view.on .chhead .pos')).toHaveText('1 / 10');
  await page.getByRole('button', { name: 'Szituáció indítása' }).click();
  await expect(page.locator('.view.on .scn-choice')).toBeVisible();
});

test('Practice: szituációban kattintással mozgatás, rossz kattintásra hibaüzenet, billentyűzettel is', async ({ page }) => {
  await open(page, '#tanulas/sz/egyszeru-combat-conquer');
  const v = page.locator('.view.on');
  await v.getByRole('button', { name: 'Szituáció indítása' }).click();
  await v.locator('.scn-choice button').first().click();
  await v.locator('.scn-ctl .btn.hex').click();
  await expect(v.locator('.scn-actbar')).toBeVisible();
  await expect(v.locator('.scn-ctl .btn.hex')).toBeDisabled();
  // rossz kattintás: az ellenfél unitja
  await v.locator('.pm-unit.opp').first().click();
  await expect(v.locator('.scn-msg.bad')).toContainText('ellenfél unitja');
  // kijelölés, a legális célzónák kiemelve
  const sgt = v.locator('.pm-unit.me', { hasText: 'Vanguard Sergeant' });
  await expect(sgt).toHaveClass(/g-act/);
  await sgt.click();
  await expect(sgt).toHaveClass(/g-sel/);
  await expect(v.locator('.pm2-bf.g-dest')).toHaveCount(2);
  // szabályos, de nem a feladat szerinti cél: konkrét üzenet szabályszámmal
  await v.locator('.pm2-bf[data-bfi="1"]').click({ position: { x: 4, y: 4 } });
  await expect(v.locator('.scn-msg.bad')).toContainText('144.4.a');
  // Mégse, majd a jó lépés billentyűzettel
  await v.getByRole('button', { name: 'Mégse' }).click();
  await sgt.focus();
  await page.keyboard.press('Enter');
  const bf0 = v.locator('.pm2-bf[data-bfi="0"]');
  await expect(bf0).toHaveClass(/g-dest/);
  await bf0.focus();
  await page.keyboard.press('Enter');
  await expect(v.locator('.scn-actbar.ok')).toBeVisible();
  await expect(bf0.locator('.pm2-ubox.me .pm-unit')).toHaveCount(1);
  await expect(v.locator('.scn-ctl .btn.hex')).toBeEnabled();
});

test('Fogalomtár: játékmenet lépésábra és errata szűrés', async ({ page }) => {
  await open(page, '#kezikonyv');
  await page.locator('[data-fs="0:3"]').first().click();
  await expect(page.locator('[data-fp="0:3"]')).toBeVisible();
  await expect(page.locator('[data-fp="0:0"]')).toBeHidden();
  await page.fill('.errq', 'annie');
  await expect(page.locator('.errc:not([hidden])')).toHaveCount(1);
});

test('Mobil (390 px): egyik fül sem lóg ki vízszintesen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '#kartyak');
  for (const t of ['kartyak', 'deck', 'szabalyok', 'chain', 'hogyan', 'hogyan/turn-structure', 'hogyan/resource-system', 'hogyan/spell-speeds', 'hogyan/chain', 'tanulas', 'tanulas/sz/abcd-kor-eleje', 'tanulas/lecke', 'kezikonyv']) {
    await page.goto('/#' + t);
    if (t === 'chain') { await page.locator('#cb-ex').click(); await page.locator('#cb-run').click(); }
    await page.waitForTimeout(400);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ov, t).toBeLessThanOrEqual(1);
  }
});
