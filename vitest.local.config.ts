import { defineConfig } from 'vitest/config';

// Integration tests against a real LOCAL Supabase (GoTrue + PostgREST + Postgres): `supabase start`, then `pnpm test:local`.
// Separate from `pnpm test` so the regular tests stay green without Docker.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.local.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
