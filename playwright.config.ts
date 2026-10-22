import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
