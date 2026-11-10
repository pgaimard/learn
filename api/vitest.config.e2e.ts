import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Les accès à la base viennent du .env de la racine ; seule la base change.
const rootEnv = loadEnv('test', '..', 'DATABASE_');

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    env: {
      ...rootEnv,
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_NAME: `${rootEnv.DATABASE_NAME}_test`,
    },
  },
});
