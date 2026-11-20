#!/usr/bin/env node
// Build utáni ellenőrzés: a GitHub Pages alútvonalon szolgál ki (base: './'), ezért a dist-ben nem lehet
// gyökérhez kötött "/assets/ hivatkozás. Futtatás: node scripts/check-dist.mjs (a web/dist-et nézi).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../web/dist/', import.meta.url).pathname;
const bad = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) return walk(p);
  if (!/\.(html|js|css)$/.test(f)) return;
  if (/["'(]\/assets\//.test(readFileSync(p, 'utf8'))) bad.push(p.slice(root.length));
});
walk(root);
if (bad.length) { console.error('Abszolút /assets/ hivatkozás a dist-ben: ' + bad.join(', ')); process.exit(1); }
console.log('check-dist: rendben');
