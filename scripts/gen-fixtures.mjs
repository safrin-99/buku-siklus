// Membangkitkan src/data/fixtures.generated.json dengan MENJALANKAN migrasi + seed.sql asli di PGlite
// lalu memanggil fungsi SQL yang sama dengan yang akan dipakai produksi (debt_list, cycle_summary).
// Dengan begitu angka di UI berasal dari SQL yang sudah diuji, bukan dihitung ulang di TypeScript.
//
//   pnpm gen:fixtures      -> menulis berkas
//   (tests/db.test.mjs memastikan berkas ini tidak basi)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../supabase/', import.meta.url);
const OUT = new URL('../src/data/fixtures.generated.json', import.meta.url);
const TODAY = '2026-10-15'; // "hari ini" kanonik (DESIGN.md bagian 9)
const BOOK = '10000000-0000-4000-8000-000000000001';

// Pengganti lingkungan Supabase (sama dengan tests/db.test.mjs).
const prelude = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, aud text, role text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated, anon;
`;

function norm(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'bigint') {
      const n = Number(value);
      if (!Number.isSafeInteger(n)) throw new Error(`bigint di luar rentang aman pada kolom ${key}`);
      out[key] = n;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function buildFixtures() {
  const db = new PGlite();
  await db.exec(prelude);
  for (const f of readdirSync(new URL('migrations/', root)).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`migrations/${f}`, root), 'utf8'));
  }
  await db.exec(readFileSync(new URL('seed.sql', root), 'utf8'));

  const q = async (sql, params = []) => (await db.query(sql, params)).rows.map(norm);

  const [book] = await q('select id, name, timezone from books where id = $1', [BOOK]);
  const [{ count: inbox_pending }] = await q(
    `select count(*) as count from inbox_events where book_id = $1 and status = 'pending'`,
    [BOOK],
  );
  const [cycle] = await q(
    `select cycle_start::text as cycle_start, cycle_end::text as cycle_end, next_payday::text as next_payday,
            days_to_payday, base_salary_idr, obligations_idr, paid_idr, unpaid_idr, free_idr,
            carryover_overdue_idr, total_owe_remaining_idr, total_owed_remaining_idr, overdue_count
       from cycle_summary($1, $2::date)`,
    [BOOK, TODAY],
  );
  const debts = await q(
    `select debt_id::text as debt_id, direction::text as direction, name, description,
            total_idr, paid_idr, remaining_idr, next_due_date::text as next_due_date,
            next_due_amount_idr, next_due_seq, installment_count, days_to_due, status
       from debt_list($1, $2::date)`,
    [BOOK, TODAY],
  );
  const meta = await q(
    `select id::text as debt_id, memo, category, description from debts where book_id = $1 order by id`,
    [BOOK],
  );

  // id baris dari gen_random_uuid() berbeda tiap pembangkitan, jadi diganti id sintetis yang stabil.
  const rawPayments = await q(
    `select id::text as id, debt_id::text as debt_id, paid_on::text as paid_on, amount_idr, reference,
            reverses_payment_id::text as reverses_payment_id, proof_path, note
       from payments where book_id = $1 order by paid_on, debt_id, amount_idr`,
    [BOOK],
  );
  const idMap = new Map(rawPayments.map((p, i) => [p.id, `pay-${i + 1}`]));
  const payments = rawPayments.map((p) => ({
    ...p,
    id: idMap.get(p.id),
    reverses_payment_id: p.reverses_payment_id ? idMap.get(p.reverses_payment_id) ?? null : null,
  }));

  const installments = (
    await q(
      `select debt_id::text as debt_id, seq, due_date::text as due_date, amount_idr, is_paid, due_remaining_idr
         from installment_status where book_id = $1 order by debt_id, seq`,
      [BOOK],
    )
  ).map((i) => ({ id: `${i.debt_id}#${i.seq}`, ...i }));

  await db.close();
  return {
    _generated: 'Dibangkitkan oleh scripts/gen-fixtures.mjs dari supabase/migrations + seed.sql. Jangan edit manual.',
    today: TODAY,
    book,
    inbox_pending,
    cycle,
    debts,
    meta,
    payments,
    installments,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixtures = await buildFixtures();
  writeFileSync(OUT, JSON.stringify(fixtures, null, 2) + '\n');
  console.log(
    `Tertulis ${fileURLToPath(OUT)}: ${fixtures.debts.length} catatan, ${fixtures.payments.length} pembayaran, ` +
      `sisa setelah cicilan Rp${fixtures.cycle.free_idr}`,
  );
}
