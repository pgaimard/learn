import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    env: { NODE_ENV: 'test', PORT: '3000' },
    include: ['**/*.e2e-spec.ts'],
  },
});
