#!/usr/bin/env node
// Push előtti teljes ellenőrzés: ugyanazok a lépések, ugyanabban a sorrendben, mint a .github/workflows/tests.yml.
// Futtatás: cd web && npm run verify
// Ha egy lépés bukik, a szkript ott megáll, és nem nulla kóddal lép ki. Push csak zöld verify után.
// Helyi eltérések (a végén kiírja):
//   - a Playwright a rendszer Chrome-ját használja (PW_CHROME, alap: /usr/bin/google-chrome), mert a böngészőletöltés blokkolt;
//   - a vizuális projektek (visual-1300, visual-390) lefutnak, de pixel-összevetés nélkül (--ignore-snapshots):
//     a baseline ubuntun készül, helyben a betűrenderelés eltér; a képeket csak a CI hasonlítja;
//   - a Lighthouse CI kimarad (a CI-ban is continue-on-error, nem buktat).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const WEB = join(ROOT, 'web');
const t0 = Date.now();
const done = [];

function step(name, cmd, args, opts = {}) {
  const s = Date.now();
  console.log(`\n=== ${name}: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: opts.cwd || WEB, stdio: 'inherit', env: { ...process.env, ...(opts.env || {}) } });
  const sec = ((Date.now() - s) / 1000).toFixed(0);
  if (r.status !== 0) {
    console.error(`\nVERIFY PIROS: "${name}" bukott (${sec} s). Push nem mehet, amíg ez nem zöld.`);
    process.exit(r.status || 1);
  }
  done.push(`${name} (${sec} s)`);
}

// A nem verziókezelt, még nem commitolt fájlokat a check-dashes nem látja (git ls-files); itt ezeket is nézzük.
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
function dashesUntracked() {
  const list = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0').filter((p) => p && !/\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|zip)$/i.test(p));
  const bad = list.filter((p) => existsSync(join(ROOT, p)) && DASH.test(readFileSync(join(ROOT, p), 'utf8')));
  if (bad.length) {
    console.error('Kötőjel (U+2013 vagy U+2014) nem verziókezelt fájlban:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
}

const chrome = process.env.PW_CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '');
// CI=1: mint a CI-ban (retries 1, és nem használ már futó, esetleg régi buildet kiszolgáló preview szervert).
const pwEnv = { CI: '1', ...(chrome ? { PW_CHROME: chrome } : {}) };

step('ruff', 'ruff', ['check', 'src/', 'tools/'], { cwd: ROOT });
step('pytest (adatépítés kétszer)', 'python3', ['-m', 'pytest', 'src/tests', '-q'], { cwd: ROOT });
step('kötőjelek', 'node', ['scripts/check-dashes.mjs'], { cwd: ROOT });
dashesUntracked();
step('lint:install', 'npm', ['run', 'lint:install', '--silent']);
step('lint (ESLint, dependency-cruiser)', 'npm', ['run', 'lint', '--silent']);
step('knip', 'npx', ['knip']);
step('build (tsc -b, vite build, lapoldalak, check-dist)', 'npm', ['run', 'build', '--silent']);
step('unit és golden (vitest)', 'npx', ['vitest', 'run']);
step('Playwright: e2e és axe', 'npx', ['playwright', 'test', '--reporter=line'], { env: pwEnv });
step('Playwright: visual-1300 és visual-390 (pixel-összevetés nélkül)', 'npx',
  ['playwright', 'test', '--project=visual-1300', '--project=visual-390', '--ignore-snapshots', '--reporter=line'],
  { env: { ...pwEnv, VISUAL: '1' } });

console.log(`\nVERIFY ZÖLD (${((Date.now() - t0) / 1000).toFixed(0)} s):\n  ` + done.join('\n  '));
console.log('\nHelyben nem ellenőrzött (csak a CI-ban):');
console.log('  - a vizuális képek pixel-összevetése (a baseline ubuntun készül); szándékos vizuális változásnál');
console.log('    előbb az e2e.yml workflow_dispatch update-snapshots fusson az ágra;');
console.log('  - Lighthouse CI (a CI-ban sem buktat);');
console.log(`  - a Playwright böngészője: ${chrome ? chrome + ' (rendszer Chrome)' : 'a Playwright saját Chromiuma'}, a CI-ban a Playwright Chromiuma.`);
