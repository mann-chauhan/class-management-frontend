import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e/admin-password-reset',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/process-lifecycle.spec.ts',
  globalSetup: './e2e/admin-password-reset/global-setup.ts',
  globalTeardown: './e2e/admin-password-reset/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: join(tmpdir(), 'cms-admin-password-reset-playwright'),
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:14200',
    browserName: 'chromium',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'admin-password-reset-desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start -- --configuration browser-test --port 14200',
    url: 'http://localhost:14200',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
