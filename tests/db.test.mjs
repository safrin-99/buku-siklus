// Uji skema Supabase memakai PGlite (Postgres in-process). Jalankan: node --test db.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../supabase/', import.meta.url);
const migration = readFileSync(new URL('migrations/20261015000001_init.sql', root), 'utf8');
const seed = readFileSync(new URL('seed.sql', root), 'utf8');

const A = '00000000-0000-4000-8000-0000000000a1';   // pengguna seed
const B = '00000000-0000-4000-8000-0000000000b2';   // pengguna lain
const BOOK = '10000000-0000-4000-8000-000000000001';
const D = (n) => `20000000-0000-4000-8000-00000000000${n}`;
const HENDRA = D(1), LAPTOP = D(2), KOPERASI = D(3), ARISAN = D(4), REZA = D(5), BUDI = D(6);

// Pengganti lingkungan Supabase: peran, skema auth, auth.uid().
const prelude = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, aud text, role text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated, anon;
`;

async function fresh({ withSeed = true } = {}) {
  const db = new PGlite();
  await db.exec(prelude);
  await db.exec(migration);
  if (withSeed) await db.exec(seed);
  await db.exec(`insert into auth.users (id, email) values ('${B}', 'b@test.local') on conflict do nothing;`);
  return db;
}

// Jalankan sebagai pengguna terautentikasi (RLS berlaku). role: 'authenticated' | 'anon'.
async function as(db, userId, fn, role = 'authenticated') {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`);
  try { return await fn(); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

const num = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));
const q = async (db, sql, params) => num((await db.query(sql, params)).rows);
const rejects = async (p, re) => assert.rejects(p, re);

test('seed: debt_list pada 15 Okt 2026 cocok dengan data kanonik', async () => {
  const db = await fresh();
  const rows = await q(db, `select debt_id, name, direction, total_idr, paid_idr, remaining_idr,
      next_due_date::text as next_due_date, next_due_amount_idr, next_due_seq, installment_count, days_to_due, status
    from debt_list($1, '2026-10-15')`, [BOOK]);
  const by = Object.fromEntries(rows.map((r) => [r.debt_id, r]));
  assert.equal(rows.length, 6);

  assert.deepEqual(
    [by[HENDRA].status, by[HENDRA].days_to_due, by[HENDRA].remaining_idr, by[HENDRA].next_due_seq, by[HENDRA].next_due_amount_idr],
    ['overdue', -4, 600000, 3, 600000]);
  assert.deepEqual([by[LAPTOP].status, by[LAPTOP].days_to_due, by[LAPTOP].remaining_idr, by[LAPTOP].next_due_seq, by[LAPTOP].installment_count],
    ['active', 10, 5400000, 4, 12]);
  assert.deepEqual([by[KOPERASI].status, by[KOPERASI].days_to_due, by[KOPERASI].remaining_idr, by[KOPERASI].next_due_seq],
    ['active', 13, 1600000, 2]);
  assert.deepEqual([by[ARISAN].status, by[ARISAN].remaining_idr, by[ARISAN].next_due_date], ['paid', 0, null]);
  assert.deepEqual([by[REZA].status, by[REZA].days_to_due, by[REZA].remaining_idr], ['due_soon', 0, 350000]);
  assert.deepEqual([by[BUDI].status, by[BUDI].days_to_due, by[BUDI].remaining_idr], ['active', 17, 500000]);

  // urutan: belum lunas menurut jatuh tempo, lunas terakhir
  assert.deepEqual(rows.map((r) => r.name), ['dr. Hendra', 'Reza Firdaus', 'Cicilan Laptop', 'Pinjaman Koperasi', 'Budi Santo', 'Arisan Bulanan RT 04']);
});

test('seed: cycle_summary = Rp7.000.000 sisa, Rp2.500.000 kewajiban, total utang Rp7.600.000, piutang Rp850.000', async () => {
  const db = await fresh();
  const [s] = await q(db, `select cycle_start::text as cycle_start, cycle_end::text as cycle_end, next_payday::text as next_payday,
      days_to_payday, base_salary_idr, obligations_idr, paid_idr, unpaid_idr, free_idr, carryover_overdue_idr,
      total_owe_remaining_idr, total_owed_remaining_idr, overdue_count
    from cycle_summary($1, '2026-10-15')`, [BOOK]);
  assert.deepEqual(s, {
    cycle_start: '2026-10-01', cycle_end: '2026-10-31', next_payday: '2026-11-01', days_to_payday: 17,
    base_salary_idr: 9500000, obligations_idr: 2500000, paid_idr: 500000, unpaid_idr: 2000000, free_idr: 7000000,
    carryover_overdue_idr: 0, total_owe_remaining_idr: 7600000, total_owed_remaining_idr: 850000, overdue_count: 1,
  });
  // persentase pada bilah segmen (dibulatkan): 5% / 21% / 74%
  const pct = [s.paid_idr, s.unpaid_idr, s.free_idr].map((v) => Math.round((v / s.base_salary_idr) * 100));
  assert.deepEqual(pct, [5, 21, 74]);
});

test('seed: tidak ada ketidakcocokan jumlah cicilan vs total', async () => {
  const db = await fresh();
  assert.equal((await q(db, 'select * from debt_integrity_issues')).length, 0);
});

test('cycle_bounds: batas siklus untuk berbagai tanggal gajian', async () => {
  const db = await fresh({ withSeed: false });
  const cases = [
    [1, '2026-10-15', ['2026-10-01', '2026-10-31', '2026-11-01']],
    [1, '2026-11-01', ['2026-11-01', '2026-11-30', '2026-12-01']],
    [1, '2026-12-31', ['2026-12-01', '2026-12-31', '2027-01-01']],
    [25, '2026-10-15', ['2026-09-25', '2026-10-24', '2026-10-25']],
    [25, '2026-10-25', ['2026-10-25', '2026-11-24', '2026-11-25']],
    [28, '2026-03-10', ['2026-02-28', '2026-03-27', '2026-03-28']],
    [1, '2027-01-01', ['2027-01-01', '2027-01-31', '2027-02-01']],
  ];
  for (const [d, today, want] of cases) {
    const [r] = await q(db, `select cycle_start::text a, cycle_end::text b, next_payday::text c from cycle_bounds($1, $2::date)`, [d, today]);
    assert.deepEqual([r.a, r.b, r.c], want, `payday ${d} @ ${today}`);
  }
});

test('ledger: update/delete ditolak, koreksi lewat entri pembalik', async () => {
  const db = await fresh();
  await rejects(db.exec(`update payments set amount_idr = 1 where debt_id = '${HENDRA}'`), /append-only/);
  await rejects(db.exec(`delete from payments where debt_id = '${HENDRA}'`), /append-only/);

  const [orig] = await q(db, `select id from payments where debt_id = $1 and paid_on = '2026-10-02'`, [HENDRA]);
  // pembalik dengan nominal salah ditolak
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by)
      values ($1, $2, '2026-10-15', -100000, $3, $4)`, [HENDRA, BOOK, orig.id, A]), /persis negatif/);
  // pembalik tanpa penunjuk ditolak (check constraint)
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by)
      values ($1, $2, '2026-10-15', -450000, $3)`, [HENDRA, BOOK, A]), /check/i);
  // pembalik yang benar
  await db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by)
      values ($1, $2, '2026-10-15', -450000, $3, $4)`, [HENDRA, BOOK, orig.id, A]);
  const [bal] = await q(db, `select remaining_idr from debt_balances where debt_id = $1`, [HENDRA]);
  assert.equal(bal.remaining_idr, 1050000);
  // pembalikan ganda ditolak
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by)
      values ($1, $2, '2026-10-15', -450000, $3, $4)`, [HENDRA, BOOK, orig.id, A]), /duplicate|unique/i);
  // setelah dibalik, cicilan ke-2 kembali belum lunas -> jatuh tempo 30 Sep, lewat 15 hari
  const [h] = await q(db, `select status, next_due_seq, days_to_due from debt_list($1, '2026-10-15') where debt_id = $2`, [BOOK, HENDRA]);
  assert.deepEqual([h.status, h.next_due_seq, h.days_to_due], ['overdue', 2, -15]);
});

test('ledger: pembayaran melebihi total ditolak; pembayaran sebagian menghitung sisa cicilan', async () => {
  const db = await fresh();
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by)
      values ($1, $2, '2026-10-15', 700000, $3)`, [HENDRA, BOOK, A]), /melebihi total/);

  // Reza membayar Rp300.000 dari Rp350.000
  await db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by) values ($1, $2, '2026-10-15', 300000, $3)`, [REZA, BOOK, A]);
  const [r] = await q(db, `select status, remaining_idr, next_due_amount_idr from debt_list($1, '2026-10-15') where debt_id = $2`, [BOOK, REZA]);
  assert.deepEqual([r.status, r.remaining_idr, r.next_due_amount_idr], ['due_soon', 50000, 50000]);
  const [s] = await q(db, `select total_owed_remaining_idr from cycle_summary($1, '2026-10-15')`, [BOOK]);
  assert.equal(s.total_owed_remaining_idr, 550000);
});

test('ledger: kirim ulang dengan id yang sama setelah pelunasan DITOLAK walau barisnya sudah ada (alasan klien memeriksa id)', async () => {
  const db = await fresh();
  const id = '30000000-0000-4000-8000-000000000001';
  const insert = () => db.query(`insert into payments (id, debt_id, book_id, paid_on, amount_idr, created_by)
      values ($1, $2, $3, '2026-10-15', 350000, $4)`, [id, REZA, BOOK, A]);
  await insert();
  // Trigger BEFORE INSERT berjalan sebelum pemeriksaan kunci: pesan "melebihi total" menyesatkan, bukan "duplikat".
  await rejects(insert(), /melebihi total/);
  await rejects(db.query(`insert into payments (id, debt_id, book_id, paid_on, amount_idr, created_by)
      values ($1, $2, $3, '2026-10-15', 350000, $4) on conflict (id) do nothing`, [id, REZA, BOOK, A]), /melebihi total/);
  const rows = await q(db, `select id from payments where id = $1`, [id]);
  assert.equal(rows.length, 1);
});

test('ledger: pembayaran menaikkan "terbayar" siklus dan pembaliknya menurunkannya kembali', async () => {
  const db = await fresh();
  const cycle = async () => (await q(db, `select paid_idr, unpaid_idr from cycle_summary($1, '2026-10-15')`, [BOOK]))[0];
  assert.deepEqual(await cycle(), { paid_idr: 500000, unpaid_idr: 2000000 });

  const pay = '30000000-0000-4000-8000-000000000002';
  await db.query(`insert into payments (id, debt_id, book_id, paid_on, amount_idr, created_by) values ($1, $2, $3, '2026-10-15', 600000, $4)`, [pay, LAPTOP, BOOK, A]);
  assert.deepEqual(await cycle(), { paid_idr: 1100000, unpaid_idr: 1400000 });

  await db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by) values ($1, $2, '2026-10-15', -600000, $3, $4)`, [LAPTOP, BOOK, pay, A]);
  assert.deepEqual(await cycle(), { paid_idr: 500000, unpaid_idr: 2000000 });
  const [l] = await q(db, `select status, next_due_seq, remaining_idr from debt_list($1, '2026-10-15') where debt_id = $2`, [BOOK, LAPTOP]);
  assert.deepEqual([l.status, l.next_due_seq, l.remaining_idr], ['active', 4, 5400000]);
});

test('ledger: entri pembalik tidak bisa dibalik; pembalik kedua atas pembayaran tunggal ditolak', async () => {
  const db = await fresh();
  const [orig] = await q(db, `select id from payments where debt_id = $1`, [ARISAN]);
  const rev = '30000000-0000-4000-8000-000000000003';
  await db.query(`insert into payments (id, debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by)
      values ($1, $2, $3, '2026-10-15', -500000, $4, $5)`, [rev, ARISAN, BOOK, orig.id, A]);
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by)
      values ($1, $2, '2026-10-15', 500000, $3, $4)`, [ARISAN, BOOK, rev, A]), /check|persis negatif/i);
  // Pembalik kedua (id lain) ditolak sebelum mencapai indeks unik: total pembayaran akan negatif.
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, reverses_payment_id, created_by)
      values ($1, $2, '2026-10-15', -500000, $3, $4)`, [ARISAN, BOOK, orig.id, A]), /tidak boleh negatif|duplicate|unique/i);
});

test('integritas: pembayaran lintas buku ditolak (FK komposit)', async () => {
  const db = await fresh();
  await db.query(`insert into books (id, name, owner_id) values ('10000000-0000-4000-8000-000000000002', 'Buku Pacar', $1)`, [A]);
  await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by)
      values ($1, '10000000-0000-4000-8000-000000000002', '2026-10-15', 1000, $2)`, [HENDRA, A]), /foreign key|violates/i);
});

test('RLS: pengguna lain tidak melihat apa pun di buku A', async () => {
  const db = await fresh();
  await as(db, B, async () => {
    assert.equal((await q(db, 'select * from books')).length, 0);
    assert.equal((await q(db, 'select * from debts')).length, 0);
    assert.equal((await q(db, 'select * from payments')).length, 0);
    assert.equal((await q(db, 'select * from inbox_events')).length, 0);
    assert.equal((await q(db, 'select * from debt_balances')).length, 0);
    assert.equal((await q(db, 'select * from debt_list($1, $2)', [BOOK, '2026-10-15'])).length, 0);
    assert.equal((await q(db, 'select * from cycle_summary($1, $2)', [BOOK, '2026-10-15'])).length, 0);
    await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by) values ($1, $2, '2026-10-15', 1000, $3)`, [HENDRA, BOOK, B]), /row-level security/i);
    await rejects(db.query(`insert into debts (book_id, direction, name, total_idr, created_by) values ($1, 'owe', 'x', 1000, $2)`, [BOOK, B]), /row-level security/i);
    await rejects(db.query(`insert into book_members (book_id, user_id, role) values ($1, $2, 'owner')`, [BOOK, B]), /row-level security/i);
  });
  // pemilik tetap melihat datanya
  await as(db, A, async () => {
    assert.equal((await q(db, 'select * from debts')).length, 6);
    assert.equal((await q(db, `select * from debt_list($1, '2026-10-15')`, [BOOK])).length, 6);
  });
});

test('RLS: anon tidak punya akses sama sekali', async () => {
  const db = await fresh();
  await as(db, '', async () => {
    await rejects(db.query('select * from debts'), /permission denied/i);
    await rejects(db.query('select * from payments'), /permission denied/i);
  }, 'anon');
});

test('RLS: peran viewer hanya baca, editor boleh menulis tapi tidak mengelola anggota', async () => {
  const db = await fresh();
  await as(db, A, () => db.query(`insert into book_members (book_id, user_id, role) values ($1, $2, 'viewer')`, [BOOK, B]));

  await as(db, B, async () => {
    assert.equal((await q(db, 'select * from debts')).length, 6);       // viewer bisa baca
    await rejects(db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by) values ($1, $2, '2026-10-15', 1000, $3)`, [HENDRA, BOOK, B]), /row-level security/i);
    await rejects(db.query(`insert into debts (book_id, direction, name, total_idr, created_by) values ($1, 'owe', 'x', 1000, $2)`, [BOOK, B]), /row-level security/i);
  });

  await as(db, A, () => db.query(`update book_members set role = 'editor' where book_id = $1 and user_id = $2`, [BOOK, B]));
  await as(db, B, async () => {
    await db.query(`insert into payments (debt_id, book_id, paid_on, amount_idr, created_by) values ($1, $2, '2026-10-15', 1000, $3)`, [HENDRA, BOOK, B]);
    // editor tidak bisa mengubah peran dirinya atau menambah anggota
    await db.query(`update book_members set role = 'owner' where book_id = $1 and user_id = $2`, [BOOK, B]);
    const [me] = await q(db, `select role from book_members where book_id = $1 and user_id = $2`, [BOOK, B]);
    assert.equal(me.role, 'editor');   // percobaan menaikkan peran sendiri tidak berefek
    await rejects(db.query(`insert into book_members (book_id, user_id, role) values ($1, $2, 'owner')`, [BOOK, B]), /row-level security/i);
    // ledger tetap append-only walau editor: tidak ada hak update/delete
    await rejects(db.query(`update payments set amount_idr = 5 where debt_id = $1`, [HENDRA]), /permission denied/i);
    await rejects(db.query(`delete from payments where debt_id = $1`, [HENDRA]), /permission denied/i);
  });
});

test('RLS: pembuat buku langsung menjadi owner dan bisa membaca bukunya (INSERT ... RETURNING)', async () => {
  const db = await fresh({ withSeed: false });
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@test.local')`);
  await as(db, A, async () => {
    const [b] = await q(db, `insert into books (name) values ('Buku Pacar') returning id, owner_id, payday_day, timezone`);
    assert.equal(b.owner_id, A);
    assert.equal(b.payday_day, 1);
    assert.equal(b.timezone, 'Asia/Makassar');
    const m = await q(db, `select role from book_members where book_id = $1`, [b.id]);
    assert.deepEqual(m, [{ role: 'owner' }]);
    // buku tidak bisa dihapus (tidak ada hak delete)
    await rejects(db.query(`delete from books where id = $1`, [b.id]), /permission denied/i);
    // tidak bisa membuat buku atas nama orang lain
    await rejects(db.query(`insert into books (name, owner_id) values ('curang', $1)`, [B]), /row-level security/i);
  });
});

test('RLS: Kotak Masuk hanya bisa ditulis service_role; anggota hanya bisa menyelesaikan', async () => {
  const db = await fresh();
  await as(db, A, async () => {
    await rejects(db.query(`insert into inbox_events (book_id, source, received_at, masked_text, idempotency_key) values ($1, 'X', now(), 'y', 'k1')`, [BOOK]), /permission denied/i);
    const upd = await db.query(`update inbox_events set status = 'rejected', resolved_at = now(), resolved_by = $2 where book_id = $1 and source = 'BRImo'`, [BOOK, A]);
    assert.equal(upd.affectedRows, 1);
    assert.equal((await q(db, `select * from inbox_events where status = 'pending'`)).length, 2);
  });
  // idempotensi: kunci yang sama untuk buku yang sama tidak bisa dimasukkan dua kali
  await rejects(db.exec(`insert into inbox_events (book_id, source, received_at, masked_text, idempotency_key)
    values ('${BOOK}', 'BCA Mobile', now(), 'dup', 'seed-bca-0847')`), /duplicate|unique/i);
});

test('debt_list tanpa p_today memakai hari ini menurut zona waktu buku (tanpa error)', async () => {
  const db = await fresh();
  const rows = await q(db, 'select status from debt_list($1)', [BOOK]);
  assert.equal(rows.length, 6);
});

test('fixture frontend sama persis dengan keluaran SQL saat ini (jalankan pnpm gen:fixtures bila gagal)', async () => {
  const { buildFixtures } = await import('../scripts/gen-fixtures.mjs');
  const committed = JSON.parse(readFileSync(new URL('../src/data/fixtures.generated.json', import.meta.url), 'utf8'));
  const fresh = JSON.parse(JSON.stringify(await buildFixtures()));
  assert.deepEqual(committed, fresh);
});
