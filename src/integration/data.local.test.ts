// The Supabase data source against a real local PostgREST + Postgres with RLS. Needs `supabase start`;
// run with `pnpm test:local`. Data is created through the API as the owner, exactly like the app would.
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSupabaseAuthService } from '../auth/authService';
import type { Book } from '../data/book';
import { NotFoundError, type DataSource } from '../data/source';
import { COLUMNS, createSupabaseSource, loadActiveBook } from '../data/supabaseSource';
import { todayInZone } from '../lib/dates';
import { adminClient, appClient, createOwner, readLocalStack, uniqueEmail, TEST_PASSWORD, type LocalStack } from './stack';

const TZ = 'Asia/Makassar';

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

let stack: LocalStack;
let owner: SupabaseClient;
let stranger: SupabaseClient;
let book: Book;
let source: DataSource;
const id: Record<'overdue' | 'cicilan' | 'lunas' | 'piutang', string> = { overdue: '', cicilan: '', lunas: '', piutang: '' };
const today = () => todayInZone(TZ);

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = appClient(stack);
  await createSupabaseAuthService(client).signIn(email, TEST_PASSWORD);
  return client;
}

async function must<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error || data === null) throw new Error(`Penyiapan data uji gagal: ${error?.message ?? 'tanpa data'}`);
  return data;
}

async function addDebt(
  direction: 'owe' | 'owed',
  name: string,
  installments: Array<{ due: string; amount: number }>,
  memo: string | null = null,
): Promise<string> {
  const total = installments.reduce((sum, i) => sum + i.amount, 0);
  const { id: debtId } = await must<{ id: string }>(
    owner.from('debts').insert({ book_id: book.id, direction, name, total_idr: total, memo, category: 'Uji' }).select('id').single(),
  );
  await must(
    owner
      .from('installments')
      .insert(installments.map((i, n) => ({ debt_id: debtId, book_id: book.id, seq: n + 1, due_date: i.due, amount_idr: i.amount })))
      .select('id'),
  );
  return debtId;
}

beforeAll(async () => {
  stack = readLocalStack();
  const admin = adminClient(stack);
  const ownerEmail = uniqueEmail('pemilik');
  const strangerEmail = uniqueEmail('asing');
  await createOwner(admin, ownerEmail);
  await createOwner(admin, strangerEmail);
  owner = await signedInClient(ownerEmail);
  stranger = await signedInClient(strangerEmail);

  const created = await must(owner.from('books').insert({ name: 'Buku Uji', base_salary_idr: 9_500_000 }).select(COLUMNS.book).single());
  book = created as unknown as Book;

  id.overdue = await addDebt('owe', 'Utang Telat', [{ due: shift(today(), -4), amount: 600_000 }]);
  id.cicilan = await addDebt('owe', 'Cicilan Uji', [
    { due: shift(today(), 10), amount: 600_000 },
    { due: shift(today(), 40), amount: 600_000 },
  ], 'Memo uji');
  id.lunas = await addDebt('owe', 'Sudah Lunas', [{ due: shift(today(), -3), amount: 500_000 }]);
  id.piutang = await addDebt('owed', 'Piutang Uji', [{ due: today(), amount: 350_000 }]);
  await must(
    owner
      .from('payments')
      .insert({ debt_id: id.lunas, book_id: book.id, paid_on: shift(today(), -2), amount_idr: 500_000, reference: 'REF-1' })
      .select('id'),
  );

  const loaded = await loadActiveBook(owner);
  if (!loaded) throw new Error('Buku uji tidak ditemukan');
  source = createSupabaseSource(owner, loaded);
  // Inbox rows are written only by the service role (Edge Function in production).
  await must(
    admin
      .from('inbox_events')
      .insert([
        { book_id: book.id, source: 'Uji', received_at: new Date().toISOString(), masked_text: 'a', idempotency_key: `k1-${book.id}`, status: 'pending' },
        { book_id: book.id, source: 'Uji', received_at: new Date().toISOString(), masked_text: 'b', idempotency_key: `k2-${book.id}`, status: 'pending' },
        { book_id: book.id, source: 'Uji', received_at: new Date().toISOString(), masked_text: 'c', idempotency_key: `k3-${book.id}`, status: 'rejected' },
      ])
      .select('id'),
  );
}, 60_000);

describe('buku', () => {
  it('pemilik mendapat bukunya; orang asing tidak mendapat buku', async () => {
    expect((await loadActiveBook(owner))?.id).toBe(book.id);
    expect(await loadActiveBook(stranger)).toBeNull();
  });

  it('getToday mengikuti zona waktu buku', () => {
    expect(source.kind).toBe('supabase');
    expect(source.bookId).toBe(book.id);
    expect(source.getToday()).toBe(todayInZone(TZ));
  });
});

describe('membaca lewat PostgREST', () => {
  it('debts: status dihitung server dan lolos skema', async () => {
    const debts = await source.debts();
    const byName = Object.fromEntries(debts.map((d) => [d.name, d]));
    expect(debts).toHaveLength(4);
    expect(byName['Utang Telat']).toMatchObject({ status: 'overdue', days_to_due: -4, remaining_idr: 600_000 });
    expect(byName['Cicilan Uji']).toMatchObject({ status: 'active', days_to_due: 10, installment_count: 2, remaining_idr: 1_200_000 });
    expect(byName['Sudah Lunas']).toMatchObject({ status: 'paid', remaining_idr: 0, paid_idr: 500_000 });
    expect(byName['Piutang Uji']).toMatchObject({ direction: 'owed', status: 'due_soon', days_to_due: 0 });
  });

  it('cycleSummary: total dan jumlah terlambat benar', async () => {
    const cycle = await source.cycleSummary();
    expect(cycle).toMatchObject({
      base_salary_idr: 9_500_000,
      total_owe_remaining_idr: 1_800_000,
      total_owed_remaining_idr: 350_000,
      overdue_count: 1,
    });
    expect(cycle.days_to_payday).toBeGreaterThan(0);
  });

  it('debtDetail: pembayaran, cicilan, dan memo', async () => {
    const lunas = await source.debtDetail(id.lunas);
    expect(lunas.debt.status).toBe('paid');
    expect(lunas.payments).toHaveLength(1);
    expect(lunas.payments[0]).toMatchObject({ amount_idr: 500_000, reference: 'REF-1', reverses_payment_id: null });
    expect(lunas.installments.map((i) => i.is_paid)).toEqual([true]);

    const cicilan = await source.debtDetail(id.cicilan);
    expect(cicilan.memo).toBe('Memo uji');
    expect(cicilan.category).toBe('Uji');
    expect(cicilan.payments).toEqual([]);
    expect(cicilan.installments.map((i) => [i.seq, i.is_paid, i.due_remaining_idr])).toEqual([
      [1, false, 600_000],
      [2, false, 600_000],
    ]);
  });

  it('debtDetail: id tak dikenal dan id bukan UUID sama-sama "tidak ditemukan", bukan galat server', async () => {
    await expect(source.debtDetail('20000000-0000-4000-8000-0000000000ff')).rejects.toBeInstanceOf(NotFoundError);
    await expect(source.debtDetail('tidak-ada')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('inboxPendingCount hanya menghitung yang menunggu', async () => {
    expect(await source.inboxPendingCount()).toBe(2);
  });
});

describe('isolasi RLS lewat HTTP', () => {
  it('orang asing yang memakai id buku pemilik tidak mendapat data apa pun', async () => {
    const attacker = createSupabaseSource(stranger, book);
    expect(await attacker.debts()).toEqual([]);
    await expect(attacker.cycleSummary()).rejects.toBeInstanceOf(NotFoundError);
    await expect(attacker.debtDetail(id.cicilan)).rejects.toBeInstanceOf(NotFoundError);
    expect(await attacker.inboxPendingCount()).toBe(0);
  });

  it('klien tanpa sesi (anon) ditolak, bukan dikosongkan', async () => {
    const anonymous = createSupabaseSource(appClient(stack), book);
    await expect(anonymous.debts()).rejects.toThrow(/Permintaan data gagal/);
  });
});
