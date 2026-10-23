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

const GROUPED_THOUSANDS = /^\d{1,3}(\.\d{3})+$/;
const MAX_INPUT_DIGITS = 15; // 15 digits always fit in a safe integer

/**
 * Parses what a person types into a Rupiah field: plain digits or digits grouped by dots (`600.000`),
 * with an optional `Rp` prefix. Anything else (decimals, commas, signs, text, empty) returns null.
 */
export function parseRupiahInput(raw: string): number | null {
  const text = raw.trim().replace(/^Rp\s*/i, '');
  if (!text) return null;
  let digits: string | null = null;
  if (/^\d+$/.test(text)) digits = text;
  else if (GROUPED_THOUSANDS.test(text)) digits = text.replace(/\./g, '');
  if (digits === null) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** Live formatting for a Rupiah field: keeps digits only, drops leading zeros, groups by dots, caps the length. */
export function formatRupiahInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_INPUT_DIGITS);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
