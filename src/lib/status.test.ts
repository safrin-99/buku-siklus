import { describe, expect, it } from 'vitest';
import { chipFor, progressToneFor } from './status';

describe('chipFor', () => {
  it('terlambat = merah dengan jumlah hari positif', () => {
    expect(chipFor('overdue', -4)).toEqual({ tone: 'overdue', label: 'Terlambat 4 hari' });
  });
  it('jatuh tempo dekat = amber; hari ini bertuliskan "Hari ini"', () => {
    expect(chipFor('due_soon', 0)).toEqual({ tone: 'due', label: 'Hari ini' });
    expect(chipFor('due_soon', 2)).toEqual({ tone: 'due', label: '2 hari lagi' });
  });
  it('aktif = netral (bukan warna status)', () => {
    expect(chipFor('active', 10)).toEqual({ tone: 'neutral', label: '10 hari lagi' });
    expect(chipFor('active', null)).toEqual({ tone: 'neutral', label: 'Aktif' });
  });
  it('lunas = hijau', () => {
    expect(chipFor('paid', null)).toEqual({ tone: 'paid', label: 'Lunas' });
  });
});

describe('progressToneFor', () => {
  it('merah hanya untuk terlambat, hijau hanya untuk lunas', () => {
    expect(progressToneFor('overdue')).toBe('overdue');
    expect(progressToneFor('paid')).toBe('paid');
    expect(progressToneFor('due_soon')).toBe('ink');
    expect(progressToneFor('active')).toBe('ink');
  });
});
