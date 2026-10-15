import { describe, expect, it } from 'vitest';
import { assertRupiah, formatRupiah, percentOf, sumRupiah } from './money';

describe('formatRupiah', () => {
  it('memakai titik ribuan tanpa spasi dan tanpa desimal', () => {
    expect(formatRupiah(1554329)).toBe('Rp1.554.329');
    expect(formatRupiah(600000)).toBe('Rp600.000');
    expect(formatRupiah(7000000)).toBe('Rp7.000.000');
    expect(formatRupiah(999)).toBe('Rp999');
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('negatif memakai tanda minus sebenarnya (U+2212), bukan tanda hubung', () => {
    expect(formatRupiah(-600000)).toBe('−Rp600.000');
    expect(formatRupiah(-600000)).not.toContain('-');
  });

  it('menolak nilai non-bilangan-bulat atau di luar rentang aman', () => {
    expect(() => formatRupiah(1.5)).toThrow();
    expect(() => formatRupiah(Number.NaN)).toThrow();
    expect(() => formatRupiah(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => formatRupiah(2 ** 53)).toThrow();
  });
});

describe('sumRupiah / percentOf', () => {
  it('menjumlah bilangan bulat dan menolak float', () => {
    expect(sumRupiah([600000, 800000, 600000, 500000])).toBe(2500000);
    expect(sumRupiah([])).toBe(0);
    expect(() => sumRupiah([1, 0.5])).toThrow();
    expect(assertRupiah(5)).toBe(5);
  });

  it('persen bulat, 0 bila pembagi tidak positif', () => {
    expect(percentOf(900000, 1500000)).toBe(60);
    expect(percentOf(1800000, 7200000)).toBe(25);
    expect(percentOf(1, 0)).toBe(0);
  });
});
