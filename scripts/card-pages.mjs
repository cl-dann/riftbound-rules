#!/usr/bin/env node
// Megosztható lapoldalak a build után: web/dist/card/<slug>/index.html minden laphoz (valódi tartalom, title, meta description,
// Open Graph, Twitter card, canonical), valamint sitemap.xml és robots.txt. A látogatót a SPA-ba irányítja (#kartya/<slug>),
// ott a kártya-ablak nyílik meg. A slug képzése azonos a SPA cardSlug() függvényével (web/src/domain/data/cards.ts, unit teszt őrzi).
// Futtatás: node scripts/card-pages.mjs (a web/dist és a web/src/generated kell hozzá). SITE: a kanonikus alap URL.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SITE = process.env.SITE || 'https://cl-dann.github.io/riftbound-rules/';
const IMGBASE = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/';
const DOMS = { R: 'Fury', G: 'Calm', B: 'Mind', O: 'Body', P: 'Chaos', Y: 'Order' };

/** URL-barát név: ékezet nélkül, kisbetűvel, aposztróf nélkül, a többi írásjel helyén kötőjel (ASCII 45). */
export const slugOf = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** A lapszöveg jelölései szövegként (a PDF exporttal azonos átírás). */
const plain = (t) => (t || '').replace(/\[S\]/g, 'Might').replace(/\[>\]/g, ' > ').replace(/\[>>\]/g, ' >> ').replace(/\[[TE]\]/g, '[Exhaust]').replace(/\[([RGBOPY])\]/g, (_m, k) => '[' + DOMS[k] + ']');
const typeLine = (c) => [...(c.st || []).filter((s) => s !== 'Basic' && s !== 'Token'), c.t, (c.st || []).includes('Token') ? 'Token' : ''].filter(Boolean).join(' ');
const costLine = (c) => [c.e != null ? 'Energy ' + c.e : '', c.p ? 'Power ' + c.p : '', c.m != null ? 'Might ' + c.m : ''].filter(Boolean).join(', ');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

export function pageHTML(c, d) {
  const slug = slugOf(c.n); const url = SITE + 'card/' + slug + '/'; const img = c.img ? IMGBASE + c.img : '';
  const head = [typeLine(c), (c.d || []).join(' + '), costLine(c)].filter(Boolean).join(' · ');
  const desc = clip((d && d.sh ? d.sh + ' ' : '') + head + '. ' + plain(c.txt).replace(/\s+/g, ' '), 300);
  const title = c.n + ' | Riftbound HU';
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Riftbound HU"><meta property="og:locale" content="hu_HU">
<meta property="og:title" content="${esc(c.n)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">${img ? `
<meta property="og:image" content="${img}"><meta property="og:image:alt" content="${esc(c.n)}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${esc(c.n)}"><meta name="twitter:description" content="${esc(desc)}">${img ? `<meta name="twitter:image" content="${img}">` : ''}
<style>body{margin:0;background:#0a1428;color:#f0e6d2;font:16px/1.5 system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:24px;display:flex;gap:24px;flex-wrap:wrap}img{width:280px;max-width:100%;border-radius:12px}h1{margin:0 0 4px}p.t{white-space:pre-line}a{color:#c8aa6e}.m{color:#a09b8c}</style>
<script>location.replace('../../#kartya/${slug}');</script>
</head><body><main>${img ? `<img src="${img}" alt="${esc(c.n)}" width="280">` : ''}<div>
<h1>${esc(c.n)}</h1><p class="m">${esc(head)}</p>
<p class="t">${esc(plain(c.txt))}</p>${d && d.sh ? `<p>${esc(d.sh)}</p>` : ''}
<p><a href="../../#kartya/${slug}">Megnyitás a Riftbound HU-ban</a></p></div></main></body></html>
`;
}

function main() {
  const web = fileURLToPath(new URL('../web/', import.meta.url));
  const cards = JSON.parse(readFileSync(web + 'src/generated/cards.json', 'utf8'));
  const det = JSON.parse(readFileSync(web + 'src/generated/cards-detail.json', 'utf8'));
  const seen = new Set(); const urls = [SITE];
  cards.forEach((c, i) => {
    const slug = slugOf(c.n);
    if (!slug || seen.has(slug)) throw new Error('Ütköző vagy üres slug: ' + c.n);
    seen.add(slug);
    mkdirSync(web + 'dist/card/' + slug, { recursive: true });
    writeFileSync(web + 'dist/card/' + slug + '/index.html', pageHTML(c, det[i]));
    urls.push(SITE + 'card/' + slug + '/');
  });
  writeFileSync(web + 'dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => '<url><loc>' + u + '</loc></url>').join('\n') + '\n</urlset>\n');
  writeFileSync(web + 'dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + SITE + 'sitemap.xml\n');
  console.log('card-pages: ' + cards.length + ' lapoldal, sitemap.xml, robots.txt');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
