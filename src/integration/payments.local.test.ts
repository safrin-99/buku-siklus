// Ledger writes against a real local PostgREST + Postgres with RLS, including injected transport faults.
// Needs `supabase start`; run with `pnpm test:local`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSupabaseAuthService } from '../auth/authService';
import type { Book } from '../data/book';
import { PaymentWriteError, type PaymentWriteFailure } from '../data/paymentErrors';
import type { DataSource } from '../data/source';
import { COLUMNS, createSupabaseSource, loadActiveBook } from '../data/supabaseSource';
import { todayInZone } from '../lib/dates';
import { newUuid } from '../lib/uuid';
import {
  TEST_PASSWORD,
  adminClient,
  appClient,
  appClientWithFetch,
  createOwner,
  readLocalStack,
  uniqueEmail,
  type LocalStack,
} from './stack';

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

async function must<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error || data === null) throw new Error(`Penyiapan data uji gagal: ${error?.message ?? 'tanpa data'}`);
  return data;
}

/** A debt with the given installment amounts, due in the future so it never counts as overdue. */
async function addDebt(name: string, amounts: number[]): Promise<string> {
  const { id } = await must<{ id: string }>(
    owner
      .from('debts')
      .insert({ book_id: book.id, direction: 'owe', name, total_idr: amounts.reduce((a, b) => a + b, 0) })
      .select('id')
      .single(),
  );
  await must(
    owner
      .from('installments')
      .insert(amounts.map((amount, n) => ({ debt_id: id, book_id: book.id, seq: n + 1, due_date: shift(today(), 10 + n * 30), amount_idr: amount })))
      .select('id'),
  );
  return id;
}

const ledger = async (debtId: string) =>
  must<Array<{ id: string; amount_idr: number; reverses_payment_id: string | null }>>(
    owner.from('payments').select('id, amount_idr, reverses_payment_id').eq('debt_id', debtId).order('created_at'),
  );

const balance = async (debtId: string) => {
  const detail = await source.debtDetail(debtId);
  return { paid: detail.debt.paid_idr, remaining: detail.debt.remaining_idr, status: detail.debt.status };
};

const payment = (debtId: string, amountIdr: number, over: Partial<{ id: string; paidOn: string; reference: string | null; note: string | null }> = {}) => ({
  id: newUuid(),
  debtId,
  paidOn: today(),
  amountIdr,
  reference: null,
  note: null,
  ...over,
});

async function failureKind(promise: Promise<unknown>): Promise<PaymentWriteFailure> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PaymentWriteError) return error.kind;
    throw error;
  }
  throw new Error('Seharusnya gagal, tetapi berhasil.');
}

/** Wraps fetch so that only POSTs to the payments endpoint are affected. */
const onPaymentPost =
  (fault: (real: typeof fetch, input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) =>
  (real: typeof fetch): typeof fetch =>
  (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const isPost = (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'POST';
    return isPost && url.includes('/rest/v1/payments') ? fault(real, input, init) : real(input, init);
  };

beforeAll(async () => {
  stack = readLocalStack();
  const admin = adminClient(stack);
  ownerEmail = uniqueEmail('pemilik');
  const strangerEmail = uniqueEmail('asing');
  await createOwner(admin, ownerEmail);
  await createOwner(admin, strangerEmail);
  owner = await signedIn(appClient(stack), ownerEmail);
  stranger = await signedIn(appClient(stack), strangerEmail);
  const created = await must(owner.from('books').insert({ name: 'Buku Uji Ledger', base_salary_idr: 9_500_000 }).select(COLUMNS.book).single());
  book = created as unknown as Book;
  const loaded = await loadActiveBook(owner);
  if (!loaded) throw new Error('Buku uji tidak ditemukan');
  source = createSupabaseSource(owner, loaded);
}, 60_000);

describe('recordPayment', () => {
  it('menyimpan pembayaran sebagian; server yang menghitung ulang sisa dan status', async () => {
    const id = await addDebt('Sebagian', [600_000, 600_000]);
    await source.recordPayment(payment(id, 250_000, { reference: 'MBCA-1', note: 'cicil awal' }));
    expect(await balance(id)).toEqual({ paid: 250_000, remaining: 950_000, status: 'active' });
    const detail = await source.debtDetail(id);
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({ amount_idr: 250_000, reference: 'MBCA-1', note: 'cicil awal', reverses_payment_id: null });
  });

  it('melebihi sisa ditolak server dan tidak ada yang tersimpan', async () => {
    const id = await addDebt('Melebihi', [300_000]);
    expect(await failureKind(source.recordPayment(payment(id, 300_001)))).toBe('rejected');
    expect(await ledger(id)).toEqual([]);
  });

  it('tanggal masa depan DITERIMA database: batas tanggal hanya ditegakkan di klien', async () => {
    const id = await addDebt('Tanggal depan', [300_000]);
    await source.recordPayment(payment(id, 1_000, { paidOn: shift(today(), 30) }));
    expect(await ledger(id)).toHaveLength(1);
  });

  it('respons hilang (server menyimpan, klien mengira gagal) → saved, tepat satu baris, bahkan untuk pelunasan', async () => {
    const id = await addDebt('Respons hilang', [300_000]);
    const dropped = appClientWithFetch(
      stack,
      onPaymentPost(async (real, input, init) => {
        await real(input, init); // the server processes the request...
        throw new TypeError('Failed to fetch'); // ...but the client never sees the answer
      }),
    );
    await signedIn(dropped, ownerEmail);
    const flaky = createSupabaseSource(dropped, book);

    await flaky.recordPayment(payment(id, 300_000)); // a final payment: naive retry logic would report "exceeds total"
    expect(await ledger(id)).toHaveLength(1);
    expect(await balance(id)).toMatchObject({ remaining: 0, status: 'paid' });
  });

  it('kirim ulang dengan id yang sama setelah berhasil → saved, tetap satu baris (galat server menyesatkan diabaikan)', async () => {
    const id = await addDebt('Kirim ulang', [300_000]);
    const once = payment(id, 300_000);
    await source.recordPayment(once);
    await source.recordPayment(once); // the server alone says "exceeds total" here; the id lookup says it is saved
    expect(await ledger(id)).toHaveLength(1);
  });

  it('permintaan gagal sebelum sampai server → network, tidak ada yang tersimpan, kirim ulang id yang sama berhasil', async () => {
    const id = await addDebt('Gagal jaringan', [300_000]);
    let blocked = true;
    const down = appClientWithFetch(
      stack,
      onPaymentPost(async (real, input, init) => {
        if (blocked) throw new TypeError('Failed to fetch');
        return real(input, init);
      }),
    );
    await signedIn(down, ownerEmail);
    const flaky = createSupabaseSource(down, book);
    const attempt = payment(id, 100_000);

    expect(await failureKind(flaky.recordPayment(attempt))).toBe('network');
    expect(await ledger(id)).toEqual([]);

    blocked = false;
    await flaky.recordPayment(attempt);
    expect(await ledger(id)).toHaveLength(1);
  });

  it('server tak terjangkau sama sekali → unknown (tidak bisa memastikan)', async () => {
    const id = await addDebt('Tak terjangkau', [300_000]);
    const dead = createSupabaseSource(appClient(stack, 'http://127.0.0.1:1'), book);
    expect(await failureKind(dead.recordPayment(payment(id, 100_000)))).toBe('unknown');
  });

  it('orang asing tidak bisa menulis ke buku pemilik (RLS) → rejected, tidak ada baris', async () => {
    const id = await addDebt('Diserang', [300_000]);
    const attacker = createSupabaseSource(stranger, book);
    expect(await failureKind(attacker.recordPayment(payment(id, 1_000)))).toBe('rejected');
    expect(await ledger(id)).toEqual([]);
  });

  it('ledger append-only lewat HTTP: update dan delete ditolak untuk pemilik sekalipun', async () => {
    const id = await addDebt('Append only', [300_000]);
    const row = payment(id, 100_000);
    await source.recordPayment(row);
    const update = await owner.from('payments').update({ amount_idr: 1 }).eq('id', row.id);
    const remove = await owner.from('payments').delete().eq('id', row.id);
    expect(update.error?.code).toBe('42501');
    expect(remove.error?.code).toBe('42501');
    expect(await ledger(id)).toMatchObject([{ amount_idr: 100_000 }]);
  });
});

describe('reversePayment', () => {
  const reverse = (debtId: string, original: { id: string; amount: number }, over: Partial<{ id: string; amountIdr: number }> = {}) => ({
    id: newUuid(),
    debtId,
    reversesPaymentId: original.id,
    amountIdr: original.amount,
    paidOn: today(),
    note: null,
    ...over,
  });

  it('entri pembalik mengembalikan sisa dan status; baris asli tidak berubah', async () => {
    const id = await addDebt('Dibalik', [600_000]);
    const original = payment(id, 600_000);
    await source.recordPayment(original);
    expect(await balance(id)).toMatchObject({ remaining: 0, status: 'paid' });

    await source.reversePayment(reverse(id, { id: original.id, amount: 600_000 }));

    expect(await balance(id)).toMatchObject({ paid: 0, remaining: 600_000, status: 'active' });
    const rows = await ledger(id);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: original.id, amount_idr: 600_000, reverses_payment_id: null });
    expect(rows[1]).toMatchObject({ amount_idr: -600_000, reverses_payment_id: original.id });
    expect(rows.reduce((sum, r) => sum + r.amount_idr, 0)).toBe(0);
  });

  it('kirim ulang pembalik dengan id yang sama → saved, tetap satu pembalik', async () => {
    const id = await addDebt('Pembalik ulang', [600_000]);
    const original = payment(id, 600_000);
    await source.recordPayment(original);
    const entry = reverse(id, { id: original.id, amount: 600_000 });
    await source.reversePayment(entry);
    await source.reversePayment(entry); // the server alone says "negative total" here
    expect((await ledger(id)).filter((r) => r.reverses_payment_id !== null)).toHaveLength(1);
  });

  it('membalik pembayaran yang sama dua kali (id berbeda) ditolak', async () => {
    const id = await addDebt('Dobel', [600_000, 600_000]);
    const a = payment(id, 300_000);
    const b = payment(id, 300_000);
    await source.recordPayment(a);
    await source.recordPayment(b);
    await source.reversePayment(reverse(id, { id: a.id, amount: 300_000 }));
    expect(await failureKind(source.reversePayment(reverse(id, { id: a.id, amount: 300_000 })))).toBe('rejected');
    expect((await ledger(id)).filter((r) => r.reverses_payment_id !== null)).toHaveLength(1);
  });

  it('membalik entri pembalik ditolak', async () => {
    const id = await addDebt('Balik pembalik', [600_000]);
    const original = payment(id, 300_000);
    await source.recordPayment(original);
    const entry = reverse(id, { id: original.id, amount: 300_000 });
    await source.reversePayment(entry);
    expect(await failureKind(source.reversePayment(reverse(id, { id: entry.id, amount: -300_000 })))).toBe('rejected');
  });

  it('nominal pembalik yang tidak persis negatif dari aslinya ditolak', async () => {
    const id = await addDebt('Salah nominal', [600_000]);
    const original = payment(id, 300_000);
    await source.recordPayment(original);
    expect(await failureKind(source.reversePayment(reverse(id, { id: original.id, amount: 300_000 }, { amountIdr: 100_000 })))).toBe('rejected');
    expect(await ledger(id)).toHaveLength(1);
  });

  it('koreksi nominal = batalkan lalu catat ulang (dua langkah eksplisit); saldo akhir benar', async () => {
    const id = await addDebt('Koreksi', [900_000]);
    const wrong = payment(id, 450_000);
    await source.recordPayment(wrong);
    await source.reversePayment(reverse(id, { id: wrong.id, amount: 450_000 }));
    await source.recordPayment(payment(id, 540_000));
    expect(await balance(id)).toMatchObject({ paid: 540_000, remaining: 360_000 });
    expect(await ledger(id)).toHaveLength(3);
  });
});
