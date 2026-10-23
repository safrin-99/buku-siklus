import { parseIso } from '../lib/dates';
import { formatRupiah, parseRupiahInput } from '../lib/money';

export interface PaymentFormValues {
  amount: string;
  paidOn: string;
  reference: string;
  note: string;
}

export interface PaymentContext {
  /** Remaining balance of the debt, from SQL. Used only to catch obvious mistakes early; the database is the final guard. */
  remaining: number;
  /** Today's date (ISO) in the book's time zone. */
  today: string;
}

export type PaymentField = 'amount' | 'paidOn' | 'reference' | 'note';

export interface ValidPayment {
  amountIdr: number;
  paidOn: string;
  reference: string | null;
  note: string | null;
}

export type PaymentValidation = { ok: true; value: ValidPayment } | { ok: false; errors: Partial<Record<PaymentField, string>> };

export const REFERENCE_MAX = 60;
export const NOTE_MAX = 200;
// The date input lets a typo like year 0026 through; the database accepts any date. Nothing real is older than this.
const EARLIEST_DATE = '2000-01-01';

function optionalText(raw: string, max: number): { value: string | null; error?: string } {
  const value = raw.trim();
  if (value.length > max) return { value: null, error: `Maksimal ${max} karakter.` };
  return { value: value === '' ? null : value };
}

/** Validates the payment form. The date limit (not after today) is enforced here, not in the database. */
export function validatePayment(values: PaymentFormValues, context: PaymentContext): PaymentValidation {
  const errors: Partial<Record<PaymentField, string>> = {};

  const amount = parseRupiahInput(values.amount);
  if (amount === null) errors.amount = 'Masukkan nominal dalam Rupiah, mis. 600.000.';
  else if (amount <= 0) errors.amount = 'Nominal harus lebih dari Rp0.';
  else if (amount > context.remaining) errors.amount = `Nominal melebihi sisa (${formatRupiah(context.remaining)}).`;

  try {
    parseIso(values.paidOn);
    if (values.paidOn > context.today) errors.paidOn = 'Tanggal tidak boleh setelah hari ini.';
    else if (values.paidOn < EARLIEST_DATE) errors.paidOn = 'Tanggal terlalu lama. Periksa tahunnya.';
  } catch {
    errors.paidOn = 'Pilih tanggal yang valid.';
  }

  const reference = optionalText(values.reference, REFERENCE_MAX);
  if (reference.error) errors.reference = reference.error;
  const note = optionalText(values.note, NOTE_MAX);
  if (note.error) errors.note = note.error;

  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };
  return { ok: true, value: { amountIdr: amount, paidOn: values.paidOn, reference: reference.value, note: note.value } };
}

/** Validates the optional reason typed when cancelling a payment. */
export function validateReason(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const reason = optionalText(raw, NOTE_MAX);
  return reason.error ? { ok: false, error: reason.error } : { ok: true, value: reason.value };
}
