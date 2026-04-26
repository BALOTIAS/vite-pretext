import { defineConfig } from 'vite';
import { vitePretext } from 'vite-pretext';

export default defineConfig({
  // Set VITE_BASE_URL=/some-path/ for subpath deployments (e.g. GitHub Pages
  // builds it as /vite-pretext/). Defaults to '/' for local dev + previews.
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [vitePretext()],
});
