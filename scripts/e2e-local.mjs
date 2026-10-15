// End-to-end in a real browser against the LOCAL Supabase stack: login, data, session persistence, sign out.
// Needs `supabase start` and Chromium. Refuses any non-local API URL (ledger rows cannot be deleted).
// Usage: pnpm e2e:local
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-core';
import { findChromium, waitForServer } from './lib/browser.mjs';

const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = 'dist-e2e';
const PASSWORD = 'kata-sandi-uji-1234';

function readStack() {
  let raw;
  try {
    raw = execFileSync('npx', ['--yes', 'supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('Supabase lokal tidak menyala. Jalankan `supabase start` dulu.');
  }
  const env = Object.fromEntries([...raw.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map((m) => [m[1], m[2]]));
  const apiUrl = env.API_URL ?? '';
  const host = apiUrl ? new URL(apiUrl).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('e2e hanya boleh berjalan terhadap Supabase lokal.');
  return { apiUrl, publishableKey: env.PUBLISHABLE_KEY ?? env.ANON_KEY, adminKey: env.SERVICE_ROLE_KEY ?? env.SECRET_KEY };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const shift = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const todayMakassar = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

async function seed(stack) {
  const admin = createClient(stack.apiUrl, stack.adminKey, noSession);
  const email = `e2e-${Date.now().toString(36)}@uji.local`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) throw created.error;

  const owner = createClient(stack.apiUrl, stack.publishableKey, noSession);
  const signedIn = await owner.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error) throw signedIn.error;
  const must = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  const book = must(await owner.from('books').insert({ name: 'Buku E2E', base_salary_idr: 9_500_000 }).select('id').single());
  const debt = must(
    await owner
      .from('debts')
      .insert({ book_id: book.id, direction: 'owe', name: 'Utang Telat E2E', total_idr: 600_000 })
      .select('id')
      .single(),
  );
  must(
    await owner
      .from('installments')
      .insert({ debt_id: debt.id, book_id: book.id, seq: 1, due_date: shift(todayMakassar(), -4), amount_idr: 600_000 })
      .select('id'),
  );
  return { email, debtId: debt.id };
}

async function main() {
  const stack = readStack();
  const { email, debtId } = await seed(stack);

  // Real build (not fixture mode) pointed at the local stack.
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', OUT_DIR], {
    stdio: 'ignore',
    env: { ...process.env, VITE_SUPABASE_URL: stack.apiUrl, VITE_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey },
  });
  const server = spawn('pnpm', ['exec', 'vite', 'preview', '--outDir', OUT_DIR, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
  });
  const stop = () => server.kill();
  process.on('exit', stop);

  const results = [];
  const step = async (name, fn) => {
    await fn();
    results.push(name);
    console.log(`OK  ${name}`);
  };

  try {
    await waitForServer(BASE);
    const browser = await chromium.launch({ executablePath: findChromium() });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 800 }, locale: 'id-ID' });
    const page = await ctx.newPage();
    let consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    const sessionKeys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token')));
    const login = async (password) => {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Kata sandi', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    };

    await step('tanpa sesi, membuka / dialihkan ke /masuk', async () => {
      await page.goto(BASE + '/');
      await page.getByRole('heading', { name: 'Masuk' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/masuk');
    });

    await step('kata sandi salah: pesan generik, tetap di /masuk, tanpa sesi tersimpan', async () => {
      await login('sandi-yang-salah');
      await page.getByText('Email atau kata sandi salah.').waitFor();
      assert.equal(new URL(page.url()).pathname, '/masuk');
      assert.deepEqual(await sessionKeys(), []);
      consoleErrors = []; // the browser logs the 400 response as a console error
    });

    await step('masuk benar: Beranda menampilkan data buku ini, bukan data contoh', async () => {
      await login(PASSWORD);
      await page.getByRole('heading', { name: 'Beranda' }).waitFor();
      await page.getByText('Utang Telat E2E').waitFor();
      const body = await page.locator('body').innerText();
      assert.ok(!body.includes('dr. Hendra'), 'data contoh tidak boleh tampil');
      assert.equal((await sessionKeys()).length, 1);
    });

    await step('muat ulang: sesi bertahan dan data tampil lagi', async () => {
      await page.reload();
      await page.getByText('Utang Telat E2E').waitFor();
    });

    await step('Detail catatan terbuka lewat id asli; id asal-asalan menampilkan "tidak ditemukan"', async () => {
      await page.goto(`${BASE}/catatan/${debtId}`);
      await page.getByRole('heading', { name: 'Utang Telat E2E' }).waitFor();
      await page.goto(`${BASE}/catatan/tidak-ada`);
      await page.getByText('Catatan tidak ditemukan.').waitFor();
    });

    await step('Pengaturan menampilkan email; Keluar menghapus sesi dan kembali ke /masuk', async () => {
      await page.goto(`${BASE}/pengaturan`);
      await page.getByText(email).waitFor();
      await page.getByRole('button', { name: 'Keluar', exact: true }).click();
      await page.getByRole('heading', { name: 'Masuk' }).waitFor();
      assert.deepEqual(await sessionKeys(), []);
      await page.goto(BASE + '/');
      await page.getByRole('heading', { name: 'Masuk' }).waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('Utang Telat E2E'));
    });

    await step('Keluar dari semua perangkat: konfirmasi dulu, lalu sesi hilang', async () => {
      await login(PASSWORD);
      await page.getByText('Utang Telat E2E').waitFor();
      await page.goto(`${BASE}/pengaturan`);
      await page.getByRole('button', { name: 'Keluar dari semua perangkat' }).click();
      await page.getByText('Semua perangkat yang masuk dengan akun ini akan keluar').waitFor();
      await page.getByRole('button', { name: 'Keluar dari semua perangkat' }).click();
      await page.getByRole('heading', { name: 'Masuk' }).waitFor();
      assert.deepEqual(await sessionKeys(), []);
    });

    assert.deepEqual(consoleErrors, [], `galat konsol tak terduga: ${consoleErrors.join(' | ')}`);
    await browser.close();
  } finally {
    stop();
  }
  console.log(`\n${results.length} langkah e2e lulus.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
