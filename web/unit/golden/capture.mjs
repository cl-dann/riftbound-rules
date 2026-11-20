// A gyűjtött analyze() bemenetekből (npm run golden:capture) rendezett, ismétlés nélküli unit/golden/cases.json.
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.env.GOLDEN_CAPTURE || '/tmp/golden-capture.jsonl';
const lines = [...new Set(readFileSync(src, 'utf8').split('\n').filter(Boolean))].sort();
writeFileSync(new URL('./cases.json', import.meta.url), '[\n' + lines.join(',\n') + '\n]\n');
console.log('cases.json:', lines.length, 'eset');
