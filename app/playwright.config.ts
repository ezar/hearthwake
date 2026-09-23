import { defineConfig, devices } from '@playwright/test';

// End-to-end runs use the mock engine (?mock): the real models need WebGPU and a large download.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/hearthwake/',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    permissions: ['camera', 'microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    // Local runs bypass any HTTP proxy for the preview server.
    proxy: { server: 'direct://', bypass: '<-loopback>,localhost,127.0.0.1' },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/hearthwake/',
    // Always a fresh build: a leftover preview server would test old files.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
