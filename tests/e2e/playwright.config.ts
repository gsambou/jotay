import { defineConfig, devices } from '@playwright/test';

// Le serveur de test (server.ts) sert la PWA participant + monte l'API avec des adapters
// in-memory seedés (OPAQUE -> W1, solde 3000, OTP fixe 654321). Playwright le lance.
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  webServer: {
    command: 'tsx server.ts',
    url: 'http://127.0.0.1:4321/w/OPAQUE',
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
  use: { baseURL: 'http://127.0.0.1:4321', ...devices['Desktop Chrome'] },
});
