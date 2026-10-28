import { defineConfig, devices } from '@playwright/test';

const frontendOrigin = 'http://localhost:14200';

export default defineConfig({
  testDir: './e2e/advertisement',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/advertisement/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results-advertisement',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-advertisement' }]],
  use: {
    baseURL: frontendOrigin,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'advertisement-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'advertisement-mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm start -- --configuration browser-test --port 14200',
    url: frontendOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
