// Book settings (Gajian) against a real local PostgREST + Postgres with RLS. Needs `supabase start`;
// run with `pnpm test:local`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSupabaseAuthService } from '../auth/authService';
import type { Book } from '../data/book';
import { SettingsWriteError, type SettingsWriteFailure } from '../data/settingsErrors';
import type { DataSource } from '../data/source';
import { COLUMNS, createSupabaseSource } from '../data/supabaseSource';
import { adminClient, appClient, createOwner, readLocalStack, uniqueEmail, TEST_PASSWORD, type LocalStack } from './stack';

let stack: LocalStack;
let owner: SupabaseClient;
let stranger: SupabaseClient;
let book: Book;
let source: DataSource;

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = appClient(stack);
  await createSupabaseAuthService(client).signIn(email, TEST_PASSWORD);
  return client;
}

async function failureOf(promise: Promise<unknown>): Promise<SettingsWriteFailure> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SettingsWriteError) return error.kind;
    throw error;
  }
  throw new Error('Seharusnya gagal, tetapi berhasil.');
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

  const { data, error } = await owner.from('books').insert({ name: 'Buku Gajian' }).select(COLUMNS.book).single();
  if (error || !data) throw new Error(`Penyiapan buku uji gagal: ${error?.message ?? 'tanpa data'}`);
  book = data as unknown as Book;
  source = createSupabaseSource(owner, book);
});

describe('pengaturan gajian', () => {
  it('buku baru: tanggal 1, gaji pokok belum diisi', async () => {
    expect(await source.bookSettings()).toEqual({ name: 'Buku Gajian', paydayDay: 1, baseSalaryIdr: null });
  });

  it('pemilik menyimpan tanggal dan gaji; ringkasan siklus memakai nilai baru', async () => {
    await source.updateBookSettings({ paydayDay: 25, baseSalaryIdr: 9_500_000 });
    expect(await source.bookSettings()).toMatchObject({ paydayDay: 25, baseSalaryIdr: 9_500_000 });

    const cycle = await source.cycleSummary();
    expect(cycle.base_salary_idr).toBe(9_500_000);
    expect(cycle.free_idr).toBe(9_500_000); // no debts in this book
    expect(cycle.cycle_start.slice(8)).toBe('25');
    expect(cycle.next_payday.slice(8)).toBe('25');
  });

  it('menyimpan ulang nilai yang sama tetap berhasil (idempoten)', async () => {
    await source.updateBookSettings({ paydayDay: 25, baseSalaryIdr: 9_500_000 });
    await source.updateBookSettings({ paydayDay: 25, baseSalaryIdr: 9_500_000 });
    expect(await source.bookSettings()).toMatchObject({ paydayDay: 25, baseSalaryIdr: 9_500_000 });
  });

  it('mengosongkan gaji pokok menyimpan null; kartu siklus tidak lagi punya sisa kas', async () => {
    await source.updateBookSettings({ paydayDay: 1, baseSalaryIdr: null });
    expect(await source.bookSettings()).toMatchObject({ paydayDay: 1, baseSalaryIdr: null });
    const cycle = await source.cycleSummary();
    expect(cycle.base_salary_idr).toBeNull();
    expect(cycle.free_idr).toBeNull();
  });

  it('orang asing: RLS menyaring baris (0 baris), dipetakan ke ditolak; buku tidak berubah', async () => {
    const foreign = createSupabaseSource(stranger, book);
    expect(await failureOf(foreign.updateBookSettings({ paydayDay: 7, baseSalaryIdr: 1 }))).toBe('rejected');
    expect(await source.bookSettings()).toMatchObject({ paydayDay: 1, baseSalaryIdr: null });
  });

  it('tanggal di luar 1–28 ditolak oleh constraint database (pertahanan kedua di balik validasi klien)', async () => {
    expect(await failureOf(source.updateBookSettings({ paydayDay: 29, baseSalaryIdr: null }))).toBe('rejected');
    expect(await failureOf(source.updateBookSettings({ paydayDay: 0, baseSalaryIdr: null }))).toBe('rejected');
    expect(await source.bookSettings()).toMatchObject({ paydayDay: 1 });
  });

  it('server tidak terjangkau dipetakan ke network', async () => {
    const unreachable = createSupabaseSource(appClient(stack, 'http://127.0.0.1:1'), book);
    expect(await failureOf(unreachable.updateBookSettings({ paydayDay: 2, baseSalaryIdr: null }))).toBe('network');
  });
});
