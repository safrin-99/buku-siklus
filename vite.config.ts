import { configDefaults, defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolveConfig } from './src/lib/config.ts';

export default defineConfig(({ command, mode }) => {
  // A build meant for deployment must fail when env is wrong: otherwise a secret key could be inlined into the bundle
  // and a build without env would produce an unusable app. Fixture mode and dev/test are exempt.
  if (command === 'build' && mode !== 'fixture') {
    const config = resolveConfig({ MODE: mode, ...loadEnv(mode, process.cwd(), 'VITE_') });
    if (config.kind === 'invalid') {
      throw new Error(`Konfigurasi build tidak valid:\n- ${config.problems.join('\n- ')}\nLihat .env.example.`);
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      // `*.local.test.ts` need a running local Supabase: run separately with `pnpm test:local`.
      exclude: [...configDefaults.exclude, 'src/**/*.local.test.ts'],
    },
  };
});
