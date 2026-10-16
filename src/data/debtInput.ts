// Validation of the "Tambah catatan" and "Ubah catatan" forms. The same limits are enforced again by the database
// (create_debt and the debts check constraints, migration 20261016000001); these checks only catch mistakes early and
// phrase them in Indonesian.
import { parseIso } from '../lib/dates';
import { parseRupiahInput } from '../lib/money';
import { monthlySchedule, singleSchedule, type ScheduledInstallment } from '../lib/schedule';
import type { Direction } from './schemas';

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 200;
export const CATEGORY_MAX = 40;
export const MEMO_MAX = 2000;
export const INSTALLMENTS_MIN = 2;
export const INSTALLMENTS_MAX = 120;
const EARLIEST = '2000-01-01';
const LATEST = '2100-12-31';

export type ScheduleKind = 'sekali' | 'cicilan';

export interface NewDebtFormValues {
  direction: Direction;
  name: string;
  amount: string;
  schedule: ScheduleKind;
  /** Due date for a single payment, or the first installment's due date. */
  dueDate: string;
  /** Number of monthly installments (only for `cicilan`). */
  count: string;
  description: string;
  category: string;
  memo: string;
}

export type NewDebtField = 'name' | 'amount' | 'dueDate' | 'count' | 'description' | 'category' | 'memo';

export interface ValidNewDebt {
  direction: Direction;
  name: string;
  totalIdr: number;
  installments: ScheduledInstallment[];
  description: string | null;
  category: string | null;
  memo: string | null;
}

export type NewDebtValidation = { ok: true; value: ValidNewDebt } | { ok: false; errors: Partial<Record<NewDebtField, string>> };

function optionalText(raw: string, max: number): { value: string | null; error?: string } {
  const value = raw.trim();
  if (value.length > max) return { value: null, error: `Paling banyak ${max} karakter.` };
  return { value: value === '' ? null : value };
}

function checkName(raw: string): { value: string; error?: string } {
  const value = raw.trim();
  if (value === '') return { value, error: 'Isi nama orang atau pihaknya.' };
  if (value.length > NAME_MAX) return { value, error: `Nama paling banyak ${NAME_MAX} karakter.` };
  return { value };
}

function checkDate(raw: string): string | undefined {
  if (raw.trim() === '') return 'Isi tanggal jatuh tempo.';
  // Range first: a year typo such as 0026 is better explained as out of range than as "invalid".
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && (raw < EARLIEST || raw > LATEST)) return 'Tanggal harus antara tahun 2000 dan 2100.';
  try {
    parseIso(raw);
  } catch {
    return 'Tanggal tidak valid.';
  }
  return undefined;
}

/** Validates the new-record form and builds the installment schedule that will be sent to create_debt. */
export function validateNewDebt(values: NewDebtFormValues): NewDebtValidation {
  const errors: Partial<Record<NewDebtField, string>> = {};

  const name = checkName(values.name);
  if (name.error) errors.name = name.error;

  let totalIdr = 0;
  if (values.amount.trim() === '') errors.amount = 'Isi nominalnya.';
  else {
    const parsed = parseRupiahInput(values.amount);
    if (parsed === null) errors.amount = 'Masukkan nominal dalam Rupiah, mis. 1.500.000.';
    else if (parsed <= 0) errors.amount = 'Nominal harus lebih dari Rp0.';
    else totalIdr = parsed;
  }

  const dateError = checkDate(values.dueDate);
  if (dateError) errors.dueDate = dateError;

  let count = 1;
  if (values.schedule === 'cicilan') {
    const text = values.count.trim();
    count = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(count) || count < INSTALLMENTS_MIN || count > INSTALLMENTS_MAX) {
      errors.count = `Isi jumlah cicilan antara ${INSTALLMENTS_MIN} dan ${INSTALLMENTS_MAX}.`;
    } else if (totalIdr > 0 && totalIdr < count) {
      errors.count = `Nominal terlalu kecil untuk dibagi ${count} cicilan.`;
    }
  }

  const description = optionalText(values.description, DESCRIPTION_MAX);
  if (description.error) errors.description = description.error;
  const category = optionalText(values.category, CATEGORY_MAX);
  if (category.error) errors.category = category.error;
  const memo = optionalText(values.memo, MEMO_MAX);
  if (memo.error) errors.memo = memo.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      direction: values.direction,
      name: name.value,
      totalIdr,
      installments:
        values.schedule === 'cicilan' ? monthlySchedule(totalIdr, count, values.dueDate) : singleSchedule(totalIdr, values.dueDate),
      description: description.value,
      category: category.value,
      memo: memo.value,
    },
  };
}

export interface DebtDetailsFormValues {
  name: string;
  description: string;
  category: string;
  memo: string;
}

export type DebtDetailsField = keyof DebtDetailsFormValues;

export interface ValidDebtDetails {
  name: string;
  description: string | null;
  category: string | null;
  memo: string | null;
}

export type DebtDetailsValidation =
  | { ok: true; value: ValidDebtDetails }
  | { ok: false; errors: Partial<Record<DebtDetailsField, string>> };

/** Validates the edit form. Only text can be edited: amounts and schedule are fixed once the record exists. */
export function validateDebtDetails(values: DebtDetailsFormValues): DebtDetailsValidation {
  const errors: Partial<Record<DebtDetailsField, string>> = {};
  const name = checkName(values.name);
  if (name.error) errors.name = name.error;
  const description = optionalText(values.description, DESCRIPTION_MAX);
  if (description.error) errors.description = description.error;
  const category = optionalText(values.category, CATEGORY_MAX);
  if (category.error) errors.category = category.error;
  const memo = optionalText(values.memo, MEMO_MAX);
  if (memo.error) errors.memo = memo.error;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name: name.value, description: description.value, category: category.value, memo: memo.value } };
}
