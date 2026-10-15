// Contract test: the exact selects the Supabase source sends (COLUMNS) are run against the real migration + seed
// in PGlite as an RLS-bound `authenticated` user, and the rows go through the same mappers and Zod schemas the app
// uses. PGlite parsers mimic PostgREST's JSON (dates as strings, bigint as numbers). This does NOT cover HTTP, JWT
// or PostgREST itself; that is src/integration/data.local.test.ts.
import { readFileSync } from 'node:fs';
import { PGlite, types } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bookSchema, pickActiveBook } from './book';
import raw from './fixtures.generated.json';
import { mapInstallmentRow } from './mappers';
import { cycleSummarySchema, debtMetaSchema, debtRowSchema, fixtureSchema, paymentRowSchema } from './schemas';
import { COLUMNS } from './supabaseSource';

const fx = fixtureSchema.parse(raw);
const sql = (path: string) => readFileSync(new URL(`../../supabase/${path}`, import.meta.url), 'utf8');

const OWNER = '00000000-0000-4000-8000-0000000000a1';
const STRANGER = '00000000-0000-4000-8000-0000000000b2';
const BOOK = fx.book.id;
const TODAY = fx.today;

// Stand-in for the Supabase environment: roles, auth schema, auth.uid().
const prelude = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, aud text, role text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated, anon;
`;

let db: PGlite;

async function rowsAs<T = unknown>(userId: string, query: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return (await db.query<T>(query, params)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

beforeAll(async () => {
  db = new PGlite({
    parsers: {
      [types.DATE]: (value: string) => value,
      [types.TIMESTAMPTZ]: (value: string) => value,
      [types.INT8]: (value: string) => {
        const n = Number(value);
        if (!Number.isSafeInteger(n)) throw new Error(`bigint di luar rentang aman: ${value}`);
        return n;
      },
    },
  });
  await db.exec(prelude);
  await db.exec(sql('migrations/20261015000001_init.sql'));
  await db.exec(sql('seed.sql'));
  await db.exec(`insert into auth.users (id, email) values ('${STRANGER}', 'b@test.local') on conflict do nothing;`);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('buku', () => {
  it('pemilik mendapat bukunya; bentuk lolos bookSchema', async () => {
    const rows = await rowsAs(OWNER, `select ${COLUMNS.book} from books where archived_at is null`);
    const book = pickActiveBook(z.array(bookSchema).parse(rows));
    expect(book).toMatchObject({ id: BOOK, name: 'Buku Saya', timezone: 'Asia/Makassar', payday_day: 1 });
  });

  it('orang asing tidak mendapat buku apa pun (RLS) → null', async () => {
    const rows = await rowsAs(STRANGER, `select ${COLUMNS.book} from books where archived_at is null`);
    expect(pickActiveBook(z.array(bookSchema).parse(rows))).toBeNull();
  });
});

describe('fungsi hitung SQL → skema Zod', () => {
  it('debt_list sama persis dengan fixture', async () => {
    const rows = await rowsAs(OWNER, `select * from debt_list($1, $2::date)`, [BOOK, TODAY]);
    expect(z.array(debtRowSchema).parse(rows)).toEqual(fx.debts);
  });

  it('cycle_summary sama persis dengan fixture', async () => {
    const [row] = await rowsAs(OWNER, `select * from cycle_summary($1, $2::date)`, [BOOK, TODAY]);
    expect(cycleSummarySchema.parse(row)).toEqual(fx.cycle);
  });

  it('orang asing mendapat nol baris dari kedua fungsi (bukan galat)', async () => {
    expect(await rowsAs(STRANGER, `select * from debt_list($1, $2::date)`, [BOOK, TODAY])).toEqual([]);
    expect(await rowsAs(STRANGER, `select * from cycle_summary($1, $2::date)`, [BOOK, TODAY])).toEqual([]);
  });
});

describe('detail catatan', () => {
  it('meta (memo, kategori) sama dengan fixture', async () => {
    const rows = await rowsAs<{ id: string }>(OWNER, `select ${COLUMNS.meta} from debts where book_id = $1 order by id`, [BOOK]);
    const parsed = rows.map((r) => debtMetaSchema.parse({ ...r, debt_id: r.id }));
    expect(parsed).toEqual(fx.meta);
  });

  it('pembayaran (urut paid_on, created_at) lolos skema dan sama dengan ledger fixture', async () => {
    const rows = await rowsAs(
      OWNER,
      `select ${COLUMNS.payment} from payments where book_id = $1 order by paid_on, created_at`,
      [BOOK],
    );
    const key = (p: { debt_id: string; paid_on: string; amount_idr: number }) => `${p.debt_id}|${p.paid_on}|${p.amount_idr}`;
    const got = z.array(paymentRowSchema).parse(rows).map(key).sort();
    expect(got).toEqual(fx.payments.map(key).sort());
  });

  it('installment_status dipetakan ke InstallmentRow dan sama dengan fixture (selain id)', async () => {
    const rows = await rowsAs(
      OWNER,
      `select ${COLUMNS.installment} from installment_status where book_id = $1 order by debt_id, seq`,
      [BOOK],
    );
    const strip = (row: { id: string }) => {
      const copy: Record<string, unknown> = { ...row };
      delete copy.id;
      return copy;
    };
    const got = rows.map(mapInstallmentRow).map(strip);
    const want = [...fx.installments].sort((a, b) => a.debt_id.localeCompare(b.debt_id) || a.seq - b.seq).map(strip);
    expect(got).toEqual(want);
  });

  it('id cicilan berasal dari installment_id (uuid), bukan dari kunci sintetis fixture', async () => {
    const rows = await rowsAs(OWNER, `select ${COLUMNS.installment} from installment_status where book_id = $1 limit 1`, [BOOK]);
    expect(mapInstallmentRow(rows[0]).id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('pengaman nominal', () => {
  it('skema menolak bilangan di luar rentang aman', () => {
    const base = fx.debts[0]!;
    expect(debtRowSchema.safeParse({ ...base, total_idr: 2 ** 53 }).success).toBe(false);
    expect(debtRowSchema.safeParse({ ...base, total_idr: 1.5 }).success).toBe(false);
    expect(debtRowSchema.safeParse({ ...base, total_idr: 2 ** 53 - 1 }).success).toBe(true);
  });
});
