import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/meetings',
  testMatch: /\.spec\.ts$/,
  outputDir: 'test-results-meetings',
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
    ['html', { outputFolder: 'playwright-report-meetings', open: 'never' }],
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
