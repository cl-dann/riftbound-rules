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
    { name: 'e2e', testIgnore: /perf\.spec\.ts/ },
    ...(process.env.PERF ? [{ name: 'perf', testMatch: /perf\.spec\.ts/, retries: 0 }] : []),
  ],
  webServer: { command: 'npx vite preview --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: !process.env.CI },
});
