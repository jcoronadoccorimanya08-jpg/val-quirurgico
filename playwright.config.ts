import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/val-quirurgico/`,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    trace: 'off',
  },
  projects: [
    { name: 'android', use: { ...devices['Galaxy S9+'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/val-quirurgico/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
