// Creating, editing and deleting records against a real local PostgREST + Postgres with RLS (create_debt RPC,
// column grants, ON DELETE RESTRICT), including injected transport faults. Needs `supabase start`; `pnpm test:local`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSupabaseAuthService } from '../auth/authService';
import type { Book } from '../data/book';
import { DebtWriteError, type DebtWriteFailure } from '../data/debtErrors';
import type { DataSource, NewDebt } from '../data/source';
import { COLUMNS, createSupabaseSource } from '../data/supabaseSource';
import { todayInZone } from '../lib/dates';
import { newUuid } from '../lib/uuid';
import { TEST_PASSWORD, adminClient, appClient, appClientWithFetch, createOwner, readLocalStack, uniqueEmail, type LocalStack } from './stack';

const TZ = 'Asia/Makassar';
const today = () => todayInZone(TZ);
function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

let stack: LocalStack;
let ownerEmail: string;
let owner: SupabaseClient;
let stranger: SupabaseClient;
let book: Book;
let source: DataSource;

async function signedIn(client: SupabaseClient, email: string): Promise<SupabaseClient> {
  await createSupabaseAuthService(client).signIn(email, TEST_PASSWORD);
  return client;
}

async function failureKind(promise: Promise<unknown>): Promise<DebtWriteFailure> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DebtWriteError) return error.kind;
    throw error;
  }
  throw new Error('Seharusnya gagal, tetapi berhasil.');
}

const newDebt = (over: Partial<NewDebt> = {}): NewDebt => ({
  id: newUuid(),
  direction: 'owe',
  name: 'Uji',
  totalIdr: 300_000,
  installments: [{ dueDate: today(), amountIdr: 300_000 }],
  description: null,
  category: null,
  memo: null,
  ...over,
});

const rowsOf = async (debtId: string) => {
  const debts = await owner.from('debts').select('id').eq('id', debtId);
  const installments = await owner.from('installments').select('id').eq('debt_id', debtId);
  return { debts: debts.data?.length ?? -1, installments: installments.data?.length ?? -1 };
};

/** Wraps the app client so that requests matching `match` go through `handler`. */
function faulty(match: (url: string, init?: RequestInit) => boolean, handler: (real: typeof fetch, input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return appClientWithFetch(stack, (real) => (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return match(url, init) ? handler(real, input, init) : real(input, init);
  });
}
const isCreateRpc = (url: string) => new URL(url).pathname === '/rest/v1/rpc/create_debt';

beforeAll(async () => {
  stack = readLocalStack();
  const admin = adminClient(stack);
  ownerEmail = uniqueEmail('pemilik');
  const strangerEmail = uniqueEmail('asing');
  await createOwner(admin, ownerEmail);
  await createOwner(admin, strangerEmail);
  owner = await signedIn(appClient(stack), ownerEmail);
  stranger = await signedIn(appClient(stack), strangerEmail);
  const { data, error } = await owner.from('books').insert({ name: 'Buku Catatan', base_salary_idr: 9_500_000 }).select(COLUMNS.book).single();
  if (error || !data) throw new Error(`Penyiapan buku uji gagal: ${error?.message ?? 'tanpa data'}`);
  book = data as unknown as Book;
  source = createSupabaseSource(owner, book);
});

describe('membuat catatan (create_debt)', () => {
  it('utang sekali bayar jatuh tempo hari ini: tampil di daftar, masuk kewajiban siklus, status "Hari ini"', async () => {
    const before = await source.cycleSummary();
    const debt = newDebt({ name: 'Utang Hari Ini', totalIdr: 450_000, installments: [{ dueDate: today(), amountIdr: 450_000 }], memo: 'catatan uji' });
    await source.createDebt(debt);

    const row = (await source.debts()).find((d) => d.debt_id === debt.id);
    expect(row).toMatchObject({ direction: 'owe', name: 'Utang Hari Ini', total_idr: 450_000, remaining_idr: 450_000, status: 'due_soon', days_to_due: 0 });
    const after = await source.cycleSummary();
    expect(after.obligations_idr - before.obligations_idr).toBe(450_000);
    expect(after.total_owe_remaining_idr - before.total_owe_remaining_idr).toBe(450_000);
    expect(after.free_idr! - before.free_idr!).toBe(-450_000);
    const detail = await source.debtDetail(debt.id);
    expect(detail.memo).toBe('catatan uji');
  });

  it('piutang 3 cicilan: jadwal tersimpan urut, tidak memengaruhi kewajiban (hanya utang), menambah total piutang', async () => {
    const before = await source.cycleSummary();
    const debt = newDebt({
      direction: 'owed',
      name: 'Piutang Cicil',
      totalIdr: 1_000_000,
      installments: [
        { dueDate: shift(today(), 40), amountIdr: 333_333 },
        { dueDate: shift(today(), 10), amountIdr: 333_333 },
        { dueDate: shift(today(), 70), amountIdr: 333_334 },
      ],
    });
    await source.createDebt(debt);
    const detail = await source.debtDetail(debt.id);
    expect(detail.installments.map((i) => [i.seq, i.due_date, i.amount_idr])).toEqual([
      [1, shift(today(), 10), 333_333],
      [2, shift(today(), 40), 333_333],
      [3, shift(today(), 70), 333_334],
    ]);
    const after = await source.cycleSummary();
    expect(after.obligations_idr).toBe(before.obligations_idr);
    expect(after.total_owed_remaining_idr - before.total_owed_remaining_idr).toBe(1_000_000);
  });

  it('kirim dua kali dengan id yang sama (klik ganda/kirim ulang): satu catatan', async () => {
    const debt = newDebt({ name: 'Klik Ganda' });
    await Promise.all([source.createDebt(debt), source.createDebt(debt)]);
    await source.createDebt(debt);
    expect(await rowsOf(debt.id)).toEqual({ debts: 1, installments: 1 });
  });

  it('respons hilang (server menyimpan, klien tidak menerima jawaban) → tersimpan, dan kirim ulang tidak menggandakan', async () => {
    const client = faulty(isCreateRpc, async (real, input, init) => {
      await real(input, init);
      throw new TypeError('Failed to fetch');
    });
    await signedIn(client, ownerEmail);
    const flaky = createSupabaseSource(client, book);
    const debt = newDebt({ name: 'Respons Hilang' });
    await flaky.createDebt(debt); // settles by looking the id up
    await source.createDebt(debt); // the user taps "Kirim ulang"
    expect(await rowsOf(debt.id)).toEqual({ debts: 1, installments: 1 });
  });

  it('server tidak terjangkau → network, tidak ada yang tersimpan; validasi server menolak jadwal yang tidak cocok → rejected', async () => {
    const client = faulty(isCreateRpc, async () => {
      throw new TypeError('Failed to fetch');
    });
    await signedIn(client, ownerEmail);
    const down = newDebt({ name: 'Tanpa Jaringan' });
    expect(await failureKind(createSupabaseSource(client, book).createDebt(down))).toBe('network');
    expect(await rowsOf(down.id)).toEqual({ debts: 0, installments: 0 });

    // Bypassing the form: the database is the second line of defence.
    const mismatch = newDebt({ totalIdr: 500_000, installments: [{ dueDate: today(), amountIdr: 400_000 }] });
    expect(await failureKind(source.createDebt(mismatch))).toBe('rejected');
    expect(await rowsOf(mismatch.id)).toEqual({ debts: 0, installments: 0 });
  });

  it('isolasi: orang asing tidak bisa menulis ke buku pemilik dan tidak melihat isinya', async () => {
    const foreign = createSupabaseSource(stranger, book);
    const debt = newDebt({ name: 'Disusupkan' });
    expect(await failureKind(foreign.createDebt(debt))).toBe('rejected');
    expect(await rowsOf(debt.id)).toEqual({ debts: 0, installments: 0 });
    expect(await foreign.debts()).toEqual([]);
    expect(await foreign.installmentsBetween(shift(today(), -400), shift(today(), 400))).toEqual([]);
    expect((await source.debts()).length).toBeGreaterThan(0);
  });
});

describe('mengubah dan menghapus', () => {
  it('ubah teks: tersimpan; orang asing ditolak (0 baris); total tidak bisa diubah lewat API', async () => {
    const debt = newDebt({ name: 'Nama Lama' });
    await source.createDebt(debt);
    await source.updateDebtDetails(debt.id, { name: 'Nama Baru', description: 'Ket', category: 'Kat', memo: 'Memo' });
    const detail = await source.debtDetail(debt.id);
    expect([detail.debt.name, detail.debt.description, detail.category, detail.memo]).toEqual(['Nama Baru', 'Ket', 'Kat', 'Memo']);

    expect(await failureKind(createSupabaseSource(stranger, book).updateDebtDetails(debt.id, { name: 'X', description: null, category: null, memo: null }))).toBe('rejected');
    const total = await owner.from('debts').update({ total_idr: 1 }).eq('id', debt.id).select('id');
    expect(total.error?.code).toBe('42501'); // permission denied: column grant
    expect((await source.debtDetail(debt.id)).debt.total_idr).toBe(300_000);
  });

  it('hapus catatan tanpa pembayaran: hilang dari daftar dan Kalender; hapus ulang (respons hilang) dianggap berhasil', async () => {
    const debt = newDebt({ name: 'Akan Dihapus', installments: [{ dueDate: shift(today(), 5), amountIdr: 300_000 }] });
    await source.createDebt(debt);
    expect((await source.installmentsBetween(today(), shift(today(), 10))).some((i) => i.debt_id === debt.id)).toBe(true);
    await source.deleteDebt(debt.id);
    await source.deleteDebt(debt.id);
    expect(await rowsOf(debt.id)).toEqual({ debts: 0, installments: 0 });
    expect((await source.debts()).some((d) => d.debt_id === debt.id)).toBe(false);
    expect((await source.installmentsBetween(today(), shift(today(), 10))).some((i) => i.debt_id === debt.id)).toBe(false);
  });

  it('catatan berpembayaran tidak bisa dihapus (has_payments); orang asing dan viewer tidak bisa menghapus', async () => {
    const debt = newDebt({ name: 'Sudah Dibayar' });
    await source.createDebt(debt);
    await source.recordPayment({ id: newUuid(), debtId: debt.id, paidOn: today(), amountIdr: 100_000, reference: null, note: null });
    expect(await failureKind(source.deleteDebt(debt.id))).toBe('has_payments');
    expect(await rowsOf(debt.id)).toEqual({ debts: 1, installments: 1 });

    const other = newDebt({ name: 'Milik Pemilik' });
    await source.createDebt(other);
    // A non-member cannot even see the row; for them it does not exist, so the call is a no-op, never a deletion.
    await createSupabaseSource(stranger, book).deleteDebt(other.id);
    expect(await rowsOf(other.id)).toEqual({ debts: 1, installments: 1 });

    // A viewer sees the row but may not delete it: reported as rejected.
    const { data: me } = await stranger.auth.getUser();
    const added = await owner.from('book_members').insert({ book_id: book.id, user_id: me.user!.id, role: 'viewer' }).select('user_id');
    expect(added.error).toBeNull();
    expect(await failureKind(createSupabaseSource(stranger, book).deleteDebt(other.id))).toBe('rejected');
    expect(await rowsOf(other.id)).toEqual({ debts: 1, installments: 1 });
    await owner.from('book_members').delete().eq('book_id', book.id).eq('user_id', me.user!.id);
  });
});

describe('lunas dan Beranda', () => {
  it('melunasi sisa: status Lunas, kewajiban siklus tetap, terbayar siklus naik, total utang turun', async () => {
    const debt = newDebt({ name: 'Dilunasi', totalIdr: 200_000, installments: [{ dueDate: today(), amountIdr: 200_000 }] });
    await source.createDebt(debt);
    const before = await source.cycleSummary();
    await source.recordPayment({ id: newUuid(), debtId: debt.id, paidOn: today(), amountIdr: 200_000, reference: null, note: null });
    const after = await source.cycleSummary();
    expect((await source.debtDetail(debt.id)).debt).toMatchObject({ remaining_idr: 0, status: 'paid' });
    expect(after.obligations_idr).toBe(before.obligations_idr);
    expect(after.paid_idr - before.paid_idr).toBe(200_000);
    expect(after.total_owe_remaining_idr - before.total_owe_remaining_idr).toBe(-200_000);
    const inst = (await source.installmentsBetween(today(), today())).find((i) => i.debt_id === debt.id);
    expect(inst).toMatchObject({ is_paid: true, due_remaining_idr: 0 });
  });
});
