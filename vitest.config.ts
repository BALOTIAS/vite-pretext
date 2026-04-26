import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom is required for the walk tests (which build DOM trees) and is
    // harmless for the plugin tests, so set it globally.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // Plugin tests do real Vite builds against tmp dirs; give them headroom.
    testTimeout: 30000,
  },
});
