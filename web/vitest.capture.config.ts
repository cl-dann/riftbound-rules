import { defineConfig } from 'vitest/config';

// A golden esetek gyűjtése: a unit tesztek analyze() bemenetei (unit/golden/capture.setup.ts). Futtatás: npm run golden:capture
export default defineConfig({
  test: { include: ['unit/*.test.ts'], setupFiles: ['unit/golden/capture.setup.ts', 'unit/setup.ts'], environment: 'node' },
});
