import { describe, expect, it } from 'vitest';
import { assertRupiah, formatRupiah, formatRupiahInput, parseRupiahInput, percentOf, sumRupiah } from './money';

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

describe('parseRupiahInput', () => {
  it('menerima angka polos, titik ribuan, dan awalan Rp', () => {
    expect(parseRupiahInput('600000')).toBe(600000);
    expect(parseRupiahInput('600.000')).toBe(600000);
    expect(parseRupiahInput('1.554.329')).toBe(1554329);
    expect(parseRupiahInput('  450.000  ')).toBe(450000);
    expect(parseRupiahInput('Rp600.000')).toBe(600000);
    expect(parseRupiahInput('rp 600.000')).toBe(600000);
    expect(parseRupiahInput('0')).toBe(0);
  });

  it('menolak kosong, desimal, koma, tanda, teks, dan pengelompokan yang salah', () => {
    for (const bad of ['', '   ', 'Rp', '1,5', '1.5', '600.00', '6.00.000', '.500', '500.', '-5', '+5', '5e3', 'abc', '12 000', '1.000,50']) {
      expect(parseRupiahInput(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('menolak di luar rentang bilangan bulat aman', () => {
    expect(parseRupiahInput('9007199254740991')).toBe(9007199254740991);
    expect(parseRupiahInput('9007199254740992')).toBeNull();
    expect(parseRupiahInput('99999999999999999999')).toBeNull();
  });
});

describe('formatRupiahInput', () => {
  it('mengelompokkan ribuan saat mengetik dan membuang karakter selain angka', () => {
    expect(formatRupiahInput('')).toBe('');
    expect(formatRupiahInput('6')).toBe('6');
    expect(formatRupiahInput('600')).toBe('600');
    expect(formatRupiahInput('6000')).toBe('6.000');
    expect(formatRupiahInput('1554329')).toBe('1.554.329');
    expect(formatRupiahInput('1.554.329')).toBe('1.554.329');
    expect(formatRupiahInput('Rp 12abc34')).toBe('1.234');
    expect(formatRupiahInput('-500')).toBe('500');
  });

  it('membuang nol di depan dan membatasi panjang agar selalu aman', () => {
    expect(formatRupiahInput('0')).toBe('');
    expect(formatRupiahInput('007')).toBe('7');
    const long = formatRupiahInput('9'.repeat(30));
    expect(long.replace(/\./g, '')).toHaveLength(15);
    expect(Number.isSafeInteger(parseRupiahInput(long))).toBe(true);
  });

  it('hasil format selalu bisa dibaca kembali oleh parse', () => {
    for (const n of [1, 999, 1000, 450000, 1554329, 123456789012345]) {
      expect(parseRupiahInput(formatRupiahInput(String(n)))).toBe(n);
    }
  });
});
