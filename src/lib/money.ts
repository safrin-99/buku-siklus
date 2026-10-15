// Uang = bilangan bulat Rupiah. Tidak ada float untuk nominal; persen hanya untuk tampilan.

const MINUS = '−'; // tanda minus sebenarnya (U+2212), bukan tanda hubung

export function assertRupiah(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Nominal Rupiah harus bilangan bulat yang aman: ${String(value)}`);
  }
  return value;
}

/** `Rp1.554.329`, negatif `−Rp600.000`. Tanpa spasi, titik pemisah ribuan, tanpa desimal. */
export function formatRupiah(value: number): string {
  assertRupiah(value);
  const digits = Math.abs(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? MINUS : ''}Rp${digits}`;
}

export function sumRupiah(values: readonly number[]): number {
  return values.reduce((total, v) => assertRupiah(total + assertRupiah(v)), 0);
}

/** Persen bulat untuk tampilan (0 bila pembagi tidak positif). */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
