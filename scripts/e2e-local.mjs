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
const NEW_PASSWORD = 'kata-sandi-baru-e2e-5678';

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
  const mailUrl = env.MAILPIT_URL ?? env.INBUCKET_URL ?? '';
  if (!mailUrl || !['127.0.0.1', 'localhost'].includes(new URL(mailUrl).hostname)) {
    throw new Error('Mailpit tidak menyala. Jalankan `supabase start` tanpa mengecualikan mailpit.');
  }
  return { apiUrl, publishableKey: env.PUBLISHABLE_KEY ?? env.ANON_KEY, adminKey: env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, mailUrl };
}

/** The Supabase Auth confirmation link in the newest email Mailpit caught for `to` (waits up to 10 s). */
async function confirmationLink(mailUrl, to) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const list = await (await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
    if (list.messages[0]) {
      const message = await (await fetch(`${mailUrl}/api/v1/message/${list.messages[0].ID}`)).json();
      const link = [...message.HTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).find((h) => h.includes('/auth/v1/verify'));
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Tidak ada email konfirmasi untuk ${to}.`);
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
  const seeded = await seed(stack);
  const { debtId, owner } = seeded;
  let email = seeded.email; // replaced by the email-change step
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
    // A deliberately wrong password makes the browser log the 400 response as a console error. Only that is allowed:
    // the log must be clean before the attempt and hold nothing but 400s after it.
    const rejectedOnPurpose = async (attempt) => {
      assert.deepEqual(consoleErrors, [], `galat konsol tak terduga: ${consoleErrors.join(' | ')}`);
      await attempt();
      assert.ok(consoleErrors.length > 0 && consoleErrors.every((m) => m.includes('status of 400')), consoleErrors.join(' | '));
      consoleErrors = [];
    };
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
      await rejectedOnPurpose(async () => {
        await login('sandi-yang-salah');
        await page.getByText('Email atau kata sandi salah.').waitFor();
      });
      assert.equal(new URL(page.url()).pathname, '/masuk');
      assert.deepEqual(await sessionKeys(), []);
    });

    await step('masuk benar (klik ganda = satu permintaan): Beranda menampilkan data buku ini, bukan data contoh', async () => {
      const tokenRequests = [];
      const onRequest = (r) => r.method() === 'POST' && r.url().includes('/auth/v1/token') && tokenRequests.push(r.url());
      page.on('request', onRequest);
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: 'Masuk', exact: true }).dblclick();
      await page.getByRole('heading', { name: 'Beranda' }).waitFor();
      page.off('request', onRequest);
      assert.equal(tokenRequests.length, 1, `permintaan masuk terkirim ${tokenRequests.length} kali`);
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

    // ---- Catatan: tambah, cari/filter, Beranda, Kalender, ubah, hapus, lunasi (ground truth from the database) ----
    const debtsNamed = async (name) => {
      const { data, error } = await owner.from('debts').select('id, total_idr, memo, installments(seq, due_date, amount_idr)').eq('name', name);
      if (error) throw new Error(error.message);
      return data;
    };
    const today = todayMakassar();

    await step('Tambah utang: validasi per kolom; klik ganda Simpan = satu catatan; tampil di Detail dan bertahan setelah reload', async () => {
      await page.goto(`${BASE}/tambah`);
      await page.getByRole('heading', { name: 'Tambah catatan', level: 1 }).waitFor();
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Isi nama orang atau pihaknya.').waitFor();
      await page.getByText('Isi nominalnya.').waitFor();
      await page.getByText('Isi tanggal jatuh tempo.').waitFor();
      assert.deepEqual(await debtsNamed('Utang Form E2E'), []);

      await page.getByLabel('Berutang kepada').fill('Utang Form E2E');
      await page.getByLabel('Nominal total').fill('450000');
      await page.getByLabel('Jatuh tempo', { exact: true }).fill(today);
      await page.getByLabel('Keterangan (opsional)').fill('Dibuat lewat form');
      await page.getByRole('button', { name: 'Simpan' }).dblclick();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.getByRole('heading', { name: 'Utang Form E2E' }).waitFor();
      const rows = await debtsNamed('Utang Form E2E');
      assert.equal(rows.length, 1, 'klik ganda tidak boleh membuat dua catatan');
      assert.equal(rows[0].total_idr, 450_000);
      assert.deepEqual(rows[0].installments.map((i) => [i.seq, i.due_date, i.amount_idr]), [[1, today, 450_000]]);
      assert.equal(new URL(page.url()).pathname, `/catatan/${rows[0].id}`);

      await page.reload();
      await page.getByRole('heading', { name: 'Utang Form E2E' }).waitFor();
    });

    await step('Catatan: pencarian dan filter status menemukan catatan baru; pencarian bertahan setelah membuka detail; Beranda ikut', async () => {
      await page.goto(`${BASE}/catatan`);
      await page.getByPlaceholder('Cari nama atau catatan').fill('form e2e');
      const list = page.getByRole('list', { name: 'Daftar utang' });
      await list.getByText('Utang Form E2E').waitFor();
      assert.equal(await list.getByRole('listitem').count(), 1);
      await page.getByRole('button', { name: 'Terlambat' }).click();
      await page.getByText('Tidak ada catatan yang cocok.').waitFor();
      await page.getByRole('button', { name: 'Aktif' }).click();
      await list.getByText('Utang Form E2E').click();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.goBack();
      assert.equal(await page.getByPlaceholder('Cari nama atau catatan').inputValue(), 'form e2e');
      await list.getByText('Utang Form E2E').waitFor();

      await page.goto(BASE + '/');
      await page.getByRole('list', { name: 'Perlu dibayar' }).getByText('Utang Form E2E').waitFor();
    });

    // Monthly installments starting next month, so the calendar has to move forward to find them.
    const firstDue = shift(today, 35);
    const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const [fy, fm, fd] = firstDue.split('-').map(Number);
    const monthsAhead = (fy * 12 + fm) - (Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)));

    await step('Tambah piutang 3 cicilan: jadwal tersimpan; Kalender: pindah bulan, pilih tanggal, buka catatan, kembali ke posisi yang sama', async () => {
      await page.goto(`${BASE}/tambah?jenis=piutang`);
      assert.equal(await page.getByRole('radio', { name: 'Piutang' }).isChecked(), true, 'jenis terisi dari tautan');
      await page.getByLabel('Yang berutang kepadamu').fill('Piutang Cicil E2E');
      await page.getByLabel('Nominal total').fill('300000');
      await page.getByText('Cicilan bulanan').click();
      await page.getByLabel('Jumlah cicilan').fill('3');
      await page.getByLabel('Jatuh tempo cicilan pertama').fill(firstDue);
      await page.getByRole('list', { name: 'Jadwal cicilan' }).waitFor();
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByRole('heading', { name: 'Piutang Cicil E2E' }).waitFor();
      const [row] = await debtsNamed('Piutang Cicil E2E');
      assert.equal(row.installments.length, 3);
      assert.equal(row.installments.reduce((sum, i) => sum + i.amount_idr, 0), 300_000);

      await page.goto(`${BASE}/catatan?tab=piutang`);
      await page.getByRole('list', { name: 'Daftar piutang' }).getByText('Piutang Cicil E2E').waitFor();

      await page.goto(`${BASE}/kalender`);
      for (let i = 0; i < monthsAhead; i += 1) await page.getByRole('button', { name: 'Bulan berikutnya' }).click();
      await page.getByRole('heading', { name: `${MONTHS[fm - 1]} ${fy}` }).waitFor();
      await page.getByRole('button', { name: new RegExp(`^\\w+, ${fd} ${MONTHS[fm - 1]} ${fy}`) }).click();
      const agenda = page.getByRole('region', { name: 'Agenda' });
      await agenda.getByText('Piutang Cicil E2E').click();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.goBack();
      await agenda.getByText('Piutang Cicil E2E').waitFor();
      const url = new URL(page.url());
      assert.equal(url.searchParams.get('tanggal'), firstDue, 'tanggal terpilih bertahan setelah kembali');
    });

    await step('Ubah memo tersimpan; hapus catatan tanpa pembayaran (dengan konfirmasi) hilang dari database dan Kalender; catatan berpembayaran tidak bisa dihapus', async () => {
      const [row] = await debtsNamed('Piutang Cicil E2E');
      await page.goto(`${BASE}/catatan/${row.id}`);
      await page.getByRole('link', { name: 'Ubah catatan' }).click();
      await page.getByLabel('Memo (opsional)').fill('Dicicil tiga kali');
      await page.getByRole('button', { name: 'Simpan perubahan' }).click();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.getByText('Dicicil tiga kali').waitFor();
      assert.equal((await debtsNamed('Piutang Cicil E2E'))[0].memo, 'Dicicil tiga kali');

      await page.getByRole('link', { name: 'Ubah catatan' }).click();
      await page.getByRole('button', { name: 'Hapus catatan' }).click();
      await page.getByText('akan dihapus permanen').waitFor();
      assert.equal((await debtsNamed('Piutang Cicil E2E')).length, 1, 'belum terhapus sebelum dikonfirmasi');
      await page.getByRole('button', { name: 'Ya, hapus catatan' }).click();
      await page.getByRole('heading', { name: 'Catatan', level: 1, exact: true }).waitFor();
      assert.deepEqual(await debtsNamed('Piutang Cicil E2E'), []);
      await page.goto(`${BASE}/kalender?bulan=${firstDue.slice(0, 7)}&tanggal=${firstDue}`);
      await page.getByText('Tidak ada tagihan di tanggal ini.').waitFor();

      await page.goto(`${BASE}/catatan/${debtId}/ubah`);
      await page.getByText('sudah punya riwayat pembayaran, jadi tidak bisa dihapus').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Hapus catatan' }).count(), 0);
    });

    await step('Lunasi lewat "Isi sisa penuh": status Lunas, ledger sama dengan total, hilang dari Perlu dibayar di Beranda', async () => {
      const [row] = await debtsNamed('Utang Form E2E');
      await page.goto(`${BASE}/catatan/${row.id}/bayar`);
      const amount = page.getByLabel('Nominal dibayar');
      // A single payment is prefilled with the full rest, so the shortcut is hidden until the amount differs.
      assert.equal(await amount.inputValue(), '450.000');
      assert.equal(await page.getByRole('button', { name: /Isi sisa penuh/ }).count(), 0);
      await amount.fill('100000');
      await page.getByRole('button', { name: /Isi sisa penuh/ }).click();
      assert.equal(await amount.inputValue(), '450.000');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByRole('heading', { name: 'Detail catatan' }).waitFor();
      await page.getByText('Lunas', { exact: true }).first().waitFor();
      const { data } = await owner.from('payments').select('amount_idr').eq('debt_id', row.id);
      assert.equal(data.reduce((sum, p) => sum + p.amount_idr, 0), 450_000);
      await page.goto(BASE + '/');
      await page.getByText('Total utang').waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('Utang Form E2E'), 'utang lunas tidak lagi di Perlu dibayar');
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

    await step('Ganti kata sandi: sandi saat ini salah ditolak; sesudah berhasil, perangkat ini tetap masuk', async () => {
      await page.goto(`${BASE}/pengaturan`);
      await page.getByRole('link', { name: /Kata sandi/ }).click();
      await page.getByRole('heading', { name: 'Ganti kata sandi', level: 1 }).waitFor();
      await page.getByLabel('Kata sandi saat ini', { exact: true }).fill('bukan-sandi-ini-123');
      await page.getByLabel('Kata sandi baru', { exact: true }).fill(NEW_PASSWORD);
      await page.getByLabel('Ulangi kata sandi baru', { exact: true }).fill(NEW_PASSWORD);
      await rejectedOnPurpose(async () => {
        await page.getByRole('button', { name: 'Ganti kata sandi' }).click();
        await page.getByText('Kata sandi saat ini salah.').waitFor();
      });

      await page.getByLabel('Kata sandi saat ini', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: 'Ganti kata sandi' }).click();
      await page.getByText('Kata sandi sudah diganti.').waitFor();
      assert.equal((await sessionKeys()).length, 1, 'perangkat ini tetap masuk');
      await page.getByRole('link', { name: 'Kembali ke Pengaturan' }).click();
      await page.getByText(email).waitFor();
    });

    await step('Ganti email: dua tautan dari Mailpit; token tidak tersisa di URL, sesi tautan dicabut, email baru tampil', async () => {
      const newEmail = `e2e-baru-${Date.now().toString(36)}@uji.local`;
      await page.goto(`${BASE}/pengaturan`);
      await page.getByRole('link', { name: /^Email/ }).click();
      await page.getByRole('heading', { name: 'Ganti email', level: 1 }).waitFor();
      await page.getByLabel('Email baru').fill(newEmail);
      await page.getByLabel('Kata sandi', { exact: true }).fill(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Kirim tautan konfirmasi' }).click();
      await page.getByText('Menunggu konfirmasi').waitFor();
      await page.getByText(newEmail).waitFor();

      // Old address first: accepted, still waiting for the other link.
      await page.goto(await confirmationLink(stack.mailUrl, email));
      await page.getByText('Tautan pertama diterima.').waitFor();
      assert.equal(new URL(page.url()).hash, '');
      assert.equal(new URL(page.url()).search, '?konfirmasi=sebagian');

      // New address: done. The redirect brings tokens in the fragment; the app must drop them and revoke that session.
      const revoked = page.waitForRequest((r) => r.url().includes('/auth/v1/logout') && r.method() === 'POST');
      await page.goto(await confirmationLink(stack.mailUrl, newEmail));
      await revoked;
      await page.getByText('Email sudah diganti.').waitFor();
      assert.ok(!page.url().includes('token'), `token tersisa di URL: ${page.url()}`);
      assert.equal(new URL(page.url()).search, '?konfirmasi=selesai');
      // The pending block also shows the new address, so first wait for the refreshed account to clear it, then check
      // the "current" line (waiting for the address alone passed before the refresh and made this step timing-dependent).
      await page.getByText('Menunggu konfirmasi').waitFor({ state: 'detached' });
      const current = page.getByRole('region', { name: 'Email saat ini' }).locator('p').nth(1);
      assert.equal(await current.textContent(), newEmail);
      assert.equal((await sessionKeys()).length, 1, 'perangkat ini tetap masuk');

      const { data } = await createClient(stack.apiUrl, stack.adminKey, noSession).auth.admin.listUsers({ perPage: 1000 });
      assert.ok(data.users.some((u) => u.email === newEmail), 'email berganti di database');
      email = newEmail;
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

    await step('Sandi lama ditolak, sandi baru diterima; Keluar dari semua perangkat: konfirmasi dulu, lalu sesi hilang', async () => {
      await rejectedOnPurpose(async () => {
        await login(PASSWORD);
        await page.getByText('Email atau kata sandi salah.').waitFor();
      });
      await login(NEW_PASSWORD);
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
