import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import tauriConfig from './src-tauri/tauri.conf.json';

// @ts-expect-error `process` is a Node global; the app's tsconfig carries no Node types (as in Tauri's template).
const debug = Boolean(process.env.TAURI_ENV_DEBUG);

// The Tauri window loads this dev server in development and the `dist` build in release.
export default defineConfig({
  plugins: [
    react(),
    // The page title is the app's display name, which lives in tauri.conf.json only.
    { name: 'app-name', transformIndexHtml: (html: string) => html.replace('%APP_NAME%', tauriConfig.productName) },
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/crates/**', '**/target/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2022',
    minify: debug ? false : 'esbuild',
    sourcemap: debug,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
