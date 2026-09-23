import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';

// Served from GitHub Pages at https://<user>.github.io/hearthwake/. The M0 spike lives beside it at /poc/.
export default defineConfig({
  base: '/hearthwake/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022' },
  // WebLLM ships prebuilt ESM with WASM side files; pre-bundling it breaks asset lookup.
  optimizeDeps: { exclude: ['@mlc-ai/web-llm'] },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
