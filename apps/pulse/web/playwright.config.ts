import { defineConfig, devices } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

const externalBaseUrl = process.env['BASE_URL']?.trim();
const baseURL = externalBaseUrl && externalBaseUrl.length > 0 ? externalBaseUrl : 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npx ng serve --host 127.0.0.1 --port 4200',
          url: 'http://127.0.0.1:4200',
          reuseExistingServer: !process.env['CI'],
          timeout: 120_000
        }
      })
});
