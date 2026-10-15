import { parseRupiahInput } from '../lib/money';

export interface GajianFormValues {
  payday: string;
  salary: string;
}

export type GajianField = 'payday' | 'salary';

export interface ValidGajian {
  paydayDay: number;
  baseSalaryIdr: number | null;
}

export type GajianValidation = { ok: true; value: ValidGajian } | { ok: false; errors: Partial<Record<GajianField, string>> };

export const PAYDAY_MIN = 1;
export const PAYDAY_MAX = 28; // books.payday_day check constraint: every month has a day 28

/** Validates the payday settings form. An empty salary means "not used" (null). */
export function validateGajian(values: GajianFormValues): GajianValidation {
  const errors: Partial<Record<GajianField, string>> = {};

  const paydayText = values.payday.trim();
  const paydayDay = /^\d{1,2}$/.test(paydayText) ? Number(paydayText) : NaN;
  if (!Number.isInteger(paydayDay) || paydayDay < PAYDAY_MIN || paydayDay > PAYDAY_MAX) {
    errors.payday = `Isi tanggal antara ${PAYDAY_MIN} dan ${PAYDAY_MAX}.`;
  }

  let baseSalaryIdr: number | null = null;
  if (values.salary.trim() !== '') {
    const parsed = parseRupiahInput(values.salary);
    if (parsed === null) errors.salary = 'Masukkan gaji pokok dalam Rupiah, mis. 9.500.000. Kosongkan bila tidak dipakai.';
    else if (parsed <= 0) errors.salary = 'Gaji pokok harus lebih dari Rp0. Kosongkan bila tidak dipakai.';
    else baseSalaryIdr = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { paydayDay, baseSalaryIdr } };
}
