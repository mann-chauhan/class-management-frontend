import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/leave',
  testMatch: /\/(?:admin|student|teacher)\.spec\.ts$/,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  webServer: {
    command: 'npm start -- --configuration browser-test --port 14200',
    url: 'http://localhost:14200',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:14200',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
});
