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
  return { email, debtId: debt.id, owner };
}

async function main() {
  const stack = readStack();
  const { email, debtId, owner } = await seed(stack);
  // Ground truth for the payment steps: read the ledger straight from the database, not from the UI.
  const ledger = async () => {
    const { data, error } = await owner.from('payments').select('amount_idr, reverses_payment_id, reference, note').eq('debt_id', debtId).order('created_at');
    if (error) throw new Error(error.message);
    return data;
  };

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

    await step('Catat pembayaran: validasi sisa, lalu klik ganda Simpan hanya mencatat SATU pembayaran', async () => {
      await page.goto(`${BASE}/catatan/${debtId}`);
      await page.getByRole('link', { name: 'Catat pembayaran' }).click();
      await page.getByRole('heading', { name: 'Catat pembayaran' }).waitFor();
      const amount = page.getByLabel('Nominal dibayar');
      assert.equal(await amount.inputValue(), '600.000');
      await amount.fill('700000');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Nominal melebihi sisa (Rp600.000).').waitFor();
      assert.deepEqual(await ledger(), []);

      await amount.fill('250000');
      await page.getByLabel('Referensi (opsional)').fill('E2E-REF');
      await page.getByRole('button', { name: 'Simpan' }).dblclick();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.getByText('Ref: E2E-REF').waitFor();
      assert.deepEqual(await ledger(), [{ amount_idr: 250_000, reverses_payment_id: null, reference: 'E2E-REF', note: null }]);
    });

    await step('Offline: Simpan ditolak di klien dan tidak ada yang terkirim', async () => {
      await page.getByRole('link', { name: 'Catat pembayaran' }).click();
      await page.getByRole('heading', { name: 'Catat pembayaran' }).waitFor();
      await ctx.setOffline(true);
      await page.getByLabel('Nominal dibayar').fill('10000');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Kamu sedang offline. Perubahan belum bisa dicatat.').waitFor();
      await ctx.setOffline(false);
      assert.equal((await ledger()).length, 1);
    });

    await step('Batalkan pembayaran: entri pembalik negatif, baris asli tetap ada dan bertanda Dibatalkan', async () => {
      await page.goto(`${BASE}/catatan/${debtId}`);
      await page.getByRole('link', { name: /Pembayaran sebagian/ }).click();
      await page.getByRole('heading', { name: 'Pembayaran', exact: true }).waitFor();
      await page.getByLabel('Alasan (opsional)').fill('salah nominal');
      await page.getByRole('button', { name: 'Batalkan pembayaran' }).click();
      await page.getByRole('button', { name: 'Ya, batalkan pembayaran' }).click();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.getByText('Dibatalkan', { exact: true }).waitFor();
      await page.getByText('Dikoreksi', { exact: true }).waitFor();
      const rows = await ledger();
      assert.equal(rows.length, 2);
      assert.deepEqual(rows.map((r) => r.amount_idr), [250_000, -250_000]);
      assert.equal(rows[1].note, 'salah nominal');
      assert.ok(rows[1].reverses_payment_id, 'pembalik menunjuk pembayaran asal');
    });

    await step('Yang sudah dibatalkan dan entri pembalik tidak menawarkan pembatalan lagi', async () => {
      await page.getByRole('link', { name: /Pembayaran sebagian/ }).click();
      await page.getByText('Pembayaran ini sudah dibatalkan pada').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Batalkan pembayaran' }).count(), 0);
      await page.goto(`${BASE}/catatan/${debtId}`);
      await page.getByRole('link', { name: /Pembalikan/ }).click();
      await page.getByText('Entri pembalik tidak bisa dibatalkan.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Batalkan pembayaran' }).count(), 0);
    });

    await step('Pelunasan: status Lunas, tombol Catat pembayaran hilang, Beranda ikut berubah', async () => {
      await page.goto(`${BASE}/catatan/${debtId}`);
      await page.getByRole('link', { name: 'Catat pembayaran' }).click();
      assert.equal(await page.getByLabel('Nominal dibayar').inputValue(), '600.000');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.getByText('Lunas', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('link', { name: 'Catat pembayaran' }).count(), 0);
      assert.equal((await ledger()).reduce((sum, r) => sum + r.amount_idr, 0), 600_000);

      await page.goto(BASE + '/');
      await page.getByRole('heading', { name: 'Beranda' }).waitFor();
      await page.getByText('Total utang').waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('Utang Telat E2E'), 'utang lunas tidak lagi di Perlu dibayar');
    });

    await step('Gajian: tanggal di luar 1–28 ditolak di klien; simpan mengubah buku dan kartu siklus Beranda', async () => {
      const bookRow = async () => {
        const { data, error } = await owner.from('books').select('payday_day, base_salary_idr').single();
        if (error) throw new Error(error.message);
        return data;
      };
      await page.goto(`${BASE}/pengaturan`);
      const gajian = page.getByRole('list', { name: 'Gajian' });
      await gajian.getByText('Tanggal 1', { exact: true }).waitFor();
      await gajian.getByText('Rp9.500.000', { exact: true }).waitFor();
      await page.getByRole('link', { name: /Tanggal gajian/ }).click();
      await page.getByRole('heading', { name: 'Gajian', level: 1 }).waitFor();

      await page.getByLabel('Tanggal gajian').fill('29');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Isi tanggal antara 1 dan 28.').waitFor();
      assert.deepEqual(await bookRow(), { payday_day: 1, base_salary_idr: 9_500_000 });

      await page.getByLabel('Tanggal gajian').fill('25');
      await page.getByLabel('Gaji pokok bulanan (opsional)').fill('');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByRole('heading', { name: 'Pengaturan' }).waitFor();
      await gajian.getByText('Tanggal 25', { exact: true }).waitFor();
      await gajian.getByText('Belum diisi', { exact: true }).waitFor();
      assert.deepEqual(await bookRow(), { payday_day: 25, base_salary_idr: null });

      await page.goto(BASE + '/');
      await page.getByText('Kewajiban siklus').waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('Sisa kas setelah cicilan'));
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
      await page.getByRole('heading', { name: 'Beranda' }).waitFor(); // the debt is settled by now, so it is not listed
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
