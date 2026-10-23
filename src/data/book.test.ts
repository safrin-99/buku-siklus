import { describe, expect, it } from 'vitest';
import { isUuid, pickActiveBook, type Book } from './book';

const book = (over: Partial<Book>): Book => ({
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Buku Saya',
  timezone: 'Asia/Makassar',
  payday_day: 1,
  base_salary_idr: null,
  archived_at: null,
  created_at: '2026-10-01T00:00:00+00:00',
  ...over,
});

describe('pickActiveBook', () => {
  it('tanpa buku → null', () => {
    expect(pickActiveBook([])).toBeNull();
  });

  it('satu buku → buku itu', () => {
    const only = book({});
    expect(pickActiveBook([only])).toBe(only);
  });

  it('beberapa buku → yang tertua, terlepas dari urutan masuk', () => {
    const old = book({ id: 'a', created_at: '2026-01-01T00:00:00+00:00' });
    const recent = book({ id: 'b', created_at: '2026-09-01T00:00:00+00:00' });
    expect(pickActiveBook([recent, old])).toBe(old);
    expect(pickActiveBook([old, recent])).toBe(old);
  });

  it('buku yang diarsipkan tidak pernah dipilih', () => {
    const archived = book({ id: 'a', created_at: '2026-01-01T00:00:00+00:00', archived_at: '2026-06-01T00:00:00+00:00' });
    const open = book({ id: 'b', created_at: '2026-09-01T00:00:00+00:00' });
    expect(pickActiveBook([archived, open])).toBe(open);
    expect(pickActiveBook([archived])).toBeNull();
  });

  it('waktu sama → urutan stabil berdasarkan id', () => {
    const a = book({ id: 'a' });
    const b = book({ id: 'b' });
    expect(pickActiveBook([b, a])).toBe(a);
  });
});

describe('isUuid', () => {
  it('menerima UUID dan menolak yang lain', () => {
    expect(isUuid('20000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('20000000-0000-4000-8000-00000000000A')).toBe(true);
    expect(isUuid('tidak-ada')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid("20000000-0000-4000-8000-000000000001'; drop table debts;--")).toBe(false);
  });
});
