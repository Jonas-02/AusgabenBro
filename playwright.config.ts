import { defineConfig, devices } from '@playwright/test';

// Zielgeraet: iPhone 14/15 Pro, 393x852. In der CI laeuft echtes WebKit.
// Lokal steht nur Chromium zur Verfuegung (siehe DECISIONS.md).
const iphone = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin'
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/AusgabenBro/',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/AusgabenBro/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  },
  projects: [
    { name: 'webkit-iphone', use: { ...devices['iPhone 14 Pro'], ...iphone, browserName: 'webkit' } },
    { name: 'chromium-iphone', use: { ...iphone, browserName: 'chromium' } }
  ]
});
