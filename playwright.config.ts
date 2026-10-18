import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

// Runs against the production build served by `vite preview` (run `npm run build` first).
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  workers: CI ? 1 : 2,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/color-critters/',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'pixel-7', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'galaxy-tab-s4', use: { ...devices['Galaxy Tab S4 landscape'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/color-critters/',
    reuseExistingServer: !CI,
  },
});
