import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['dist', 'dist-fixture', 'dist-e2e', 'audit-out', 'node_modules', 'src/data/fixtures.generated.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Fungsi yang dikirim ke page.evaluate()/addInitScript() dijalankan di dalam browser oleh Playwright, jadi memakai global DOM.
    files: ['scripts/audit-ui.mjs', 'scripts/e2e-local.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);
