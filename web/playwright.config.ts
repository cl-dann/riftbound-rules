import { defineConfig } from '@playwright/test';

// A tesztek a buildelt oldalt nézik (vite preview). Helyben a rendszer Chrome-ja is megadható:
// PW_CHROME=/usr/bin/google-chrome npx playwright test
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4174/',
    viewport: { width: 1300, height: 900 },
    launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  },
  // Alapból a funkcionális tesztek futnak; a mérés (PERF=1) külön projekt.
  projects: [
    { name: 'e2e', testIgnore: /(perf|visual)\.spec\.ts/ },
    ...(process.env.PERF ? [{ name: 'perf', testMatch: /perf\.spec\.ts/, retries: 0 }] : []),
    // Vizuális regresszió: a baseline csak CI-ban (ubuntu) készül, helyben a renderelés eltér.
    ...(process.env.VISUAL ? [
      { name: 'visual-1300', testMatch: /visual\.spec\.ts/, use: { viewport: { width: 1300, height: 900 } } },
      { name: 'visual-390', testMatch: /visual\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    ] : []),
  ],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  webServer: { command: 'npx vite preview --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: !process.env.CI },
});
