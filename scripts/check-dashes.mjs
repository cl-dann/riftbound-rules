#!/usr/bin/env node
// Nagykötőjel (U+2014) és félkvirtmínusz (U+2013) tiltása a repóban.
// Kivétel csak a szó szerinti kártya- és szabályszöveg:
//   - rules.json és rules.txt egészében (Core Rules angol eredeti),
//   - JSON fájlokban a VERBATIM_KEYS kulcsok értéke (cards.json txt/old, nyers Riot adat, audit idézetek),
//   - a tiltást ellenőrző sorok (karakterosztály a két kötőjellel),
//   - GENERATED_DIRS: golden tesztek kimenete (a lapszöveget idézi).
// Futtatás: node scripts/check-dashes.mjs          (minden verziókezelt fájl, plusz web/src/generated ha létezik)
//           node scripts/check-dashes.mjs --staged (pre-commit: a stage-elt tartalom)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const DASH = /[–—]/;
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const WHOLE_FILE = new Set(['rules.json', 'rules.txt']);
const VERBATIM_KEYS = new Set(['txt', 'old', 'text', 'abilityOriginal', 'abilityEffective']);
// Gépi kimenet, amely a lapszöveget szó szerint tartalmazza (golden tesztek).
const GENERATED_DIRS = ['web/unit/golden/__golden__/'];
const BINARY = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|zip)$/i;
// A tiltást ellenőrző kód sora (karakterosztály, amely pont a két kötőjelet sorolja fel) nem sértés.
const DETECTOR = /\[\u2013\u2014\]|\[\u2014\u2013\]/;

const staged = process.argv.includes('--staged');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

function files() {
  const list = staged ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z') : git('ls-files', '-z');
  const out = list.split('\0').filter(Boolean).map((p) => ({ path: p, read: () => (staged ? git('show', ':' + p) : readFileSync(join(ROOT, p), 'utf8')) }));
  const gen = join(ROOT, 'web/src/generated');
  if (!staged && existsSync(gen))
    for (const f of readdirSync(gen)) if (f.endsWith('.json')) out.push({ path: 'web/src/generated/' + f, read: () => readFileSync(join(gen, f), 'utf8') });
  return out;
}

function jsonHits(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  const hits = [];
  const walk = (x, path) => {
    if (Array.isArray(x)) x.forEach((v, i) => walk(v, path + '[' + i + ']'));
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (!(VERBATIM_KEYS.has(k) && typeof v === 'string')) walk(v, path + '.' + k); }
    else if (typeof x === 'string' && DASH.test(x)) hits.push(path + ': ' + x.slice(0, 80).replace(/\n/g, ' '));
  };
  walk(data, '');
  return hits;
}

let bad = 0;
for (const f of files()) {
  const name = basename(f.path);
  if (BINARY.test(name) || WHOLE_FILE.has(name) || GENERATED_DIRS.some((d) => f.path.startsWith(d))) continue;
  let text;
  try { text = f.read(); } catch { continue; }
  if (text.includes('\0') || !DASH.test(text)) continue;
  const hits = name.endsWith('.json') ? jsonHits(text) : null;
  const lines = hits ?? text.split('\n').flatMap((l, i) => (DASH.test(l) && !DETECTOR.test(l) ? [i + 1 + ': ' + l.trim().slice(0, 100)] : []));
  for (const h of lines) { console.error(f.path + ':' + h); bad++; }
}
if (bad) {
  console.error(`\n${bad} tiltott kötőjel (U+2013/U+2014). Szövegben vessző, kettőspont vagy zárójel; kódban \\u2014 escape.`);
  process.exit(1);
}
console.log('check-dashes: rendben');
