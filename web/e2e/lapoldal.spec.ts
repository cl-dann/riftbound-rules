/* Megosztható lapoldal: a build által generált card/<slug>/ oldal meta tagjei, és hogy a látogató a SPA kártya-ablakában
   ugyanazt a lapot látja; a kártya-ablak "Link másolása" gombja erre az URL-re mutat. */
import { expect, test } from '@playwright/test';

test('lapoldal: meta tagek, átirányítás a kártya-ablakra, link másolása', async ({ page, request, context }) => {
  const res = await request.get('card/hidden-blade/');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('<title>Hidden Blade | Riftbound HU</title>');
  expect(html).toMatch(/<meta name="description" content="[^"]{40,}">/);
  expect(html).toContain('<link rel="canonical" href="https://cl-dann.github.io/riftbound-rules/card/hidden-blade/">');
  expect(html).toContain('<meta property="og:title" content="Hidden Blade">');
  expect(html).toMatch(/<meta property="og:image" content="https:\/\/cmsassets\.rgpub\.io\/[^"]+\.png">/);
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  for (const f of ['sitemap.xml', 'robots.txt']) expect((await request.get(f)).status()).toBe(200);
  expect(await (await request.get('sitemap.xml')).text()).toContain('<loc>https://cl-dann.github.io/riftbound-rules/card/hidden-blade/</loc>');

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('card/hidden-blade/');
  await expect(page).toHaveURL(/#kartya\/hidden-blade$/);
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('h2').first()).toContainText('Hidden Blade');
  await dlg.getByRole('button', { name: 'Link másolása' }).click();
  await expect(dlg.locator('.rb-share [role="status"]')).toContainText('/card/hidden-blade/');
  await dlg.getByRole('button', { name: 'Bezárás' }).click();
  await expect(page).toHaveURL(/#kartyak$/);
});
