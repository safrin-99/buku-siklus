import { describe, expect, it } from 'vitest';
import { addMonthsClamped, monthlySchedule, singleSchedule } from './schedule';

describe('addMonthsClamped', () => {
  it('bulan berikutnya, lintas tahun', () => {
    expect(addMonthsClamped('2026-10-25', 1)).toBe('2026-11-25');
    expect(addMonthsClamped('2026-12-25', 1)).toBe('2027-01-25');
    expect(addMonthsClamped('2026-11-15', 14)).toBe('2028-01-15');
  });

  it('tanggal yang tidak ada dipotong ke akhir bulan, dihitung dari tanggal awal (bukan berantai)', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29'); // kabisat
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-08-31', 1)).toBe('2026-09-30');
  });
});

describe('monthlySchedule', () => {
  it('bagi rata; sisa pembagian masuk cicilan terakhir; jumlah selalu sama dengan total', () => {
    const s = monthlySchedule(1_000_000, 3, '2026-10-25');
    expect(s).toEqual([
      { dueDate: '2026-10-25', amountIdr: 333_333 },
      { dueDate: '2026-11-25', amountIdr: 333_333 },
      { dueDate: '2026-12-25', amountIdr: 333_334 },
    ]);
    for (const [total, n] of [[7_200_000, 12], [1, 1], [999_999_999_999, 7], [10, 10]] as const) {
      const parts = monthlySchedule(total, n, '2026-01-31');
      expect(parts.reduce((sum, p) => sum + p.amountIdr, 0)).toBe(total);
      expect(parts.every((p) => Number.isSafeInteger(p.amountIdr) && p.amountIdr > 0)).toBe(true);
    }
  });

  it('data kanonik: Cicilan Laptop 12 × Rp600.000 mulai 25 Jul 2026', () => {
    const s = monthlySchedule(7_200_000, 12, '2026-07-25');
    expect(s.every((p) => p.amountIdr === 600_000)).toBe(true);
    expect(s.at(-1)?.dueDate).toBe('2027-06-25');
  });

  it('menolak masukan yang tidak masuk akal (validasi form seharusnya sudah menahannya)', () => {
    expect(() => monthlySchedule(5, 10, '2026-10-25')).toThrow();
    expect(() => monthlySchedule(1000, 0, '2026-10-25')).toThrow();
    expect(() => monthlySchedule(1000.5, 2, '2026-10-25')).toThrow();
  });
});

describe('singleSchedule', () => {
  it('satu pembayaran sebesar total', () => {
    expect(singleSchedule(350_000, '2026-10-15')).toEqual([{ dueDate: '2026-10-15', amountIdr: 350_000 }]);
  });
});
