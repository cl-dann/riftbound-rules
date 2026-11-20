/* Teljesítménymérés a buildelt oldalon (vite preview). Csak PERF=1 mellett fut (playwright.config.ts "perf" projekt):
   PERF=1 PW_CHROME=/usr/bin/google-chrome npx playwright test --project=perf
   - kezdő letöltés: a #kartyak megnyitásakor betöltött JS és JSON chunkok gzip mérete (a dist fájljaiból, zlib 9),
     mert a vite preview nem tömörít, a transferSize ott a nyers méret;
   - első tile: a navigáció kezdetétől az első .tile megjelenéséig, 4x CPU lassítással, 5 futás mediánja;
   - long taskok (50 ms felett) a betöltéskor, a rács végiggörgetésekor és egy keresésnél (az S23 döntéséhez).
   Külső források: a Riot CDN képei helyett üres kép, a Google Fonts tiltva (a mérés ne függjön a hálózattól).
   Az eredmény a perf-results.json-ba is kerül (nincs verziókezelve). */
import { test, type Page } from '@playwright/test';
import { appendFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
async function offline(page: Page) {
  await page.context().route(/cmsassets\.rgpub\.io/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.context().route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}
const DATA = /^(cards|rules|meta|learn|fonts|formats)-/;

test('kezdő letöltés és első tile', async ({ context, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP kell a CPU lassításhoz');
  test.setTimeout(120_000);
  const times: number[] = [];
  let longs: Record<string, number[]> = {};
  let sizes = { js: 0, json: 0, css: 0, raw: 0, files: [] as string[] };
  for (let i = 0; i < 5; i++) {
    const page = await context.newPage();
    if (i === 0) await offline(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      const w = window as any;
      w.__long = [] as number[];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch { /* nincs longtask API */ }
      new MutationObserver((_, o) => { if (document.querySelector('.tile')) { w.__firstTile = performance.now(); o.disconnect(); } }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/#kartyak');
    await page.waitForFunction(() => (window as any).__firstTile != null, null, { timeout: 60_000 });
    times.push(await page.evaluate(() => (window as any).__firstTile));
    if (i === 0) {
      // long taskok: betöltés, majd görgetés a rács végéig (továbbtöltés) és egy keresés, 4x CPU lassítással
      await page.waitForTimeout(500);
      const loadLong: number[] = await page.evaluate(() => (window as any).__long.splice(0));
      for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 20000); await page.waitForTimeout(400); }
      const scrollLong: number[] = await page.evaluate(() => (window as any).__long.splice(0));
      await page.locator('input').first().fill('jinx');
      await page.waitForTimeout(600);
      const searchLong: number[] = await page.evaluate(() => (window as any).__long.splice(0));
      longs = { load: loadLong, scroll: scrollLong, search: searchLong };
    }
    if (i === 0) {
      const urls: string[] = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
      const files = urls.filter((u) => u.includes('/assets/')).map((u) => new URL(u).pathname.split('/assets/')[1]);
      sizes = { js: 0, json: 0, css: 0, raw: 0, files };
      for (const f of files) {
        const buf = readFileSync(join('dist', 'assets', f));
        const gz = gzipSync(buf, { level: 9 }).length;
        sizes.raw += buf.length;
        if (f.endsWith('.css')) sizes.css += gz; else if (DATA.test(f)) sizes.json += gz; else sizes.js += gz;
      }
    }
    await cdp.detach();
    await page.close();
  }
  times.sort((a, b) => a - b);
  const kb = (n: number) => Math.round(n / 1024);
  const row = { initialJsGzipKB: kb(sizes.js), initialJsonGzipKB: kb(sizes.json), initialCssGzipKB: kb(sizes.css), initialRawKB: kb(sizes.raw), firstTileMs: Math.round(times[2]), firstTileAllMs: times.map(Math.round), longTasks: Object.fromEntries(Object.entries(longs).map(([k, v]) => [k, { max: Math.max(0, ...v), over50: v.filter((x) => x > 50).length }])), files: sizes.files };
  console.log(JSON.stringify(row, null, 1));
  appendFileSync('perf-results.json', JSON.stringify(row) + '\n');
});
