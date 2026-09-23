import { defineConfig } from 'vitest/config';

// Served from GitHub Pages at https://<user>.github.io/hearthwake/poc/.
export default defineConfig({
  base: '/hearthwake/poc/',
  build: { target: 'es2022' },
  // transformers.js and WebLLM ship prebuilt ESM with WASM side files; pre-bundling them breaks asset lookup.
  optimizeDeps: { exclude: ['@huggingface/transformers', '@mlc-ai/web-llm'] },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
