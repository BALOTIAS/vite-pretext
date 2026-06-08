import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { vitePretext } from 'vite-pretext';

export default defineConfig({
  // Set VITE_BASE_URL=/some-path/ for subpath deployments (e.g. GitHub Pages
  // builds it as /vite-pretext/). Defaults to '/' for local dev + previews.
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [vitePretext()],
  build: {
    rollupOptions: {
      input: {
        // Two-page MPA: landing + feature playground.
        main: resolve(__dirname, 'index.html'),
        playground: resolve(__dirname, 'playground.html'),
      },
    },
  },
});
