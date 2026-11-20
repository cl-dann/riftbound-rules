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

test('Chain: Choose one mód a builderben és a megosztott linkben', async ({ page }) => {
  await open(page, '#chain');
  const cs = { lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [{ n: 'Long Sword', pl: 'B', loc: 'base', d: 0 }], steps: [{ k: 'card', n: 'Rocket Barrage', pl: 'A', tg: ['b0'], ext: {}, mode: 1 }] };
  const enc = await page.evaluate((t) => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), JSON.stringify(cs));
  await page.goto('/#c=' + enc);
  await page.reload();
  await expect(page.locator('select[data-mode="0"]')).toHaveValue('1');
  await expect(page.locator('#cb-out')).toContainText('Long Sword meghal');
  await page.selectOption('select[data-mode="0"]', '0');
  expect(await page.evaluate(() => (window as any).__getCS().steps[0].mode)).toBe(0);
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
  await expect(page.locator('.view.on .scnlist li')).toHaveCount(12);
  await page.locator('.view.on .scnlist a').first().click();
  await expect(page.locator('.view.on .chhead .pos')).toHaveText('1 / 12');
  await page.getByRole('button', { name: 'Szituáció indítása' }).click();
  await expect(page.locator('.view.on .pb-panel')).toContainText('TURN-START');
});

test('Practice: akció-menü, célpont modal, fázispanelek, jó OUTCOME és Újrajátszás', async ({ page }) => {
  await open(page, '#tanulas/sz/spell-hasznalata');
  const v = page.locator('.view.on');
  await expect(v.locator('.pb-panel')).toContainText('HELYZET');
  await v.getByRole('button', { name: 'Szituáció indítása' }).click();
  // akció-menü: a nem a feladathoz tartozó lap menüpontja szürke, indoklással
  await v.getByRole('button', { name: 'Incinerate, kézben' }).click();
  await expect(v.locator('.pb-panel.menu')).toContainText('Incinerate');
  await v.locator('.pb-panel.menu .pb-x').click();
  await v.getByRole('button', { name: 'Hextech Ray, kézben' }).click();
  await expect(v.locator('.pb-panel.menu')).toContainText('1 Energy + 1 Fury Power');
  await v.locator('.pb-panel.menu').getByRole('button', { name: 'Kijátszás' }).click();
  // célpont modal: legális és nem legális célpontok, számláló, Megerősítés (n)
  const t = v.locator('.pb-panel.tgt');
  await expect(t).toContainText('0 / 1 kiválasztva');
  await expect(t).toContainText('355.9.b');
  await t.getByRole('button', { name: /Shipyard Skulker/ }).click();
  await expect(t).toContainText('1 / 1 kiválasztva');
  await t.getByRole('button', { name: 'Megerősítés (1)' }).click();
  // fázispanel: a nem elérhető gomb szürke, indoklással
  const p = v.locator('.pb-panel');
  await expect(p).toContainText('CHAIN-OPEN');
  await expect(p.getByRole('button', { name: 'Még egy spell' })).toBeDisabled();
  await expect(v.locator('.pb-chain').first()).toContainText('Hextech Ray');
  await p.getByRole('button', { name: 'Passz' }).click();
  await p.getByRole('button', { name: 'Chain feloldása' }).click();
  await p.getByRole('button', { name: /Nem, Closed Stateben/ }).click();
  // mozgatás: menü, a unit a célhelyre kerül, Mozgás megerősítése
  await v.getByRole('button', { name: /^Legion Rearguard/ }).click();
  await v.locator('.pb-panel.menu').getByRole('button', { name: 'Mozgatás: Grove of the God-Willow' }).click();
  await expect(v.locator('.pb-bf[data-bfi="0"] .pb-ubox.me .pb-card')).toHaveCount(1);
  await v.getByRole('button', { name: /Mozgás megerősítése/ }).click();
  await p.getByRole('button', { name: 'Tovább' }).click();
  await v.getByRole('button', { name: 'End Turn' }).click();
  const o = v.locator('.pb-panel.out.good');
  await expect(o).toContainText('OUTCOME');
  await expect(o).toContainText('Demó kész');
  await expect(o.getByRole('link', { name: /Következő szituáció/ })).toBeVisible();
  await o.getByRole('button', { name: 'Újrajátszás' }).click();
  await expect(v.locator('.pb-panel')).toHaveCount(0);
  await expect(v.getByRole('button', { name: 'Hextech Ray, kézben' })).toBeVisible();
});

test('Practice: rossz döntés OUTCOME panelt ad optimális sorral, Újrajátszás', async ({ page }) => {
  await open(page, '#tanulas/sz/egyszeru-combat-conquer');
  const v = page.locator('.view.on');
  await v.getByRole('button', { name: 'Szituáció indítása' }).click();
  await v.getByRole('button', { name: 'End Turn' }).click();
  const o = v.locator('.pb-panel.out.bad');
  await expect(o).toContainText('Kihagyott lehetőség');
  await expect(o).toContainText('Optimális sor:');
  await o.getByRole('button', { name: 'Újrajátszás' }).click();
  // két unit egyetlen mozgással: csak az egyik mozgatása rossz kimenet
  await page.goto('/#tanulas/sz/tobb-unit-damage-kiosztas');
  await v.getByRole('button', { name: 'Szituáció indítása' }).click();
  await v.getByRole('button', { name: /^Petty Officer/ }).click();
  await v.locator('.pb-panel.menu').getByRole('button', { name: 'Mozgatás: Grove of the God-Willow' }).click();
  await v.getByRole('button', { name: /Mozgás megerősítése/ }).click();
  await expect(v.locator('.pb-panel.out.bad')).toContainText('Egyedül kevés');
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
  for (const t of ['kartyak', 'deck', 'szabalyok', 'chain', 'hogyan', 'hogyan/turn-structure', 'hogyan/resource-system', 'hogyan/spell-speeds', 'hogyan/chain', 'tanulas', 'tanulas/sz/abcd-kor-eleje', 'tanulas/sz/energy-lebegtetes-power-recycle', 'tanulas/sz/tobb-unit-damage-kiosztas', 'tanulas/lecke', 'tanulas/lecke/tempo-es-ertek', 'kezikonyv']) {
    await page.goto('/#' + t);
    if (t === 'chain') { await page.locator('#cb-ex').click(); await page.locator('#cb-run').click(); }
    await page.waitForTimeout(400);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ov, t).toBeLessThanOrEqual(1);
  }
});
