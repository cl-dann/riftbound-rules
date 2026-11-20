/* Csak a golden esetek gyűjtéséhez (npm run golden:capture): minden unit teszt analyze() bemenetét kiírja.
   A futás után a capture.mjs szűri és rendezi az unit/golden/cases.json-ba. */
import { appendFileSync } from 'node:fs';
import { vi } from 'vitest';

vi.mock('../../src/domain/chain/chainCore', async (orig) => {
  const m: any = await orig();
  const file = process.env.GOLDEN_CAPTURE || '/tmp/golden-capture.jsonl';
  return { ...m, analyze: (cs: any) => { appendFileSync(file, JSON.stringify(cs) + '\n'); return m.analyze(cs); } };
});
