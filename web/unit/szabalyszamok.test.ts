/* Minden szabályszám, amelyet a Chain kód kiír, létezik a rules.json-ban; és a kódban nincs em-dash vagy en-dash. */
import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import RULES from '../src/generated/rules.json';

const CHAIN = (readdirSync('src/domain/chain', { recursive: true }) as string[]).filter((f) => f.endsWith('.ts')).map((f) => 'src/domain/chain/' + f).sort();
const FILES = [...CHAIN, 'src/features/chain/legacyForm.ts', 'src/domain/combat/combatCore.ts', 'src/features/chain/CombatPanel.tsx', 'src/features/chain/ChainView.tsx', 'src/shared/board/Playmat.tsx', 'src/render/html/chainReport.ts'];
const ids = new Set((RULES as any[]).map((r) => r[0]));
it('a hivatkozott szabályszámok léteznek', () => {
  const missing: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?<![\d.\w])(\d{3}(?:\.\d+)?(?:\.[a-z0-9]+)*)(?![\d\w])/g)) {
      const r = m[1];
      if (!/^\d{3}\.|^(1\d\d|2\d\d|3\d\d|4\d\d|7\d\d|8\d\d)$/.test(r)) continue;
      const ctx = src.slice(Math.max(0, m.index! - 2), m.index! + r.length + 2);
      if (/px|ms|\d{4}|#|\[\d|width|height/.test(ctx)) continue;
      if (!ids.has(r) && !/^\d{3}$/.test(r)) missing.push(f + ': ' + r);
      if (/^\d{3}$/.test(r) && !ids.has(r) && /'[^']*\b\d{3}\b[^']*'/.test(ctx)) missing.push(f + ': ' + r);
    }
  }
  expect(missing).toEqual([]);
});
it('nincs em-dash és en-dash', () => {
  for (const f of FILES.concat(['unit/hivatalos.test.ts', 'unit/esetek.test.ts', 'unit/felismeres.test.ts', 'unit/combat.test.ts', 'unit/javitasok.test.ts', 'unit/javitasok2.test.ts', 'unit/javitasok3.test.ts', 'unit/javitasok4.test.ts', 'unit/bovites.test.ts', 'unit/kezi.test.ts', 'unit/korvege.test.ts', 'unit/lefedettseg.test.ts', 'unit/lefedettseg.ts', 'unit/util.ts'])) expect(readFileSync(f, 'utf8')).not.toMatch(/[\u2013\u2014]/);
});
