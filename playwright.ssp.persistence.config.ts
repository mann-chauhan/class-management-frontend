import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/ssp-persistence',
  testMatch: /\.spec\.ts$/,
  globalSetup: './e2e/ssp-persistence/global-setup.ts',
  globalTeardown: './e2e/ssp-persistence/global-teardown.ts',
  outputDir: 'test-results-ssp-persistence',
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
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-ssp-persistence', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:14200',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
});
