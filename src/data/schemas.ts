// Bentuk data yang dikembalikan fungsi SQL (debt_list, cycle_summary) dan tabel terkait.
// Semua nominal divalidasi sebagai bilangan bulat aman sebelum sampai ke UI.
import { z } from 'zod';

const idr = z.number().int();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const debtStatusSchema = z.enum(['overdue', 'due_soon', 'active', 'paid']);
export const directionSchema = z.enum(['owe', 'owed']); // owe = utang saya, owed = piutang ke saya

export const debtRowSchema = z.object({
  debt_id: z.string().min(1),
  direction: directionSchema,
  name: z.string(),
  description: z.string().nullable(),
  total_idr: idr,
  paid_idr: idr,
  remaining_idr: idr,
  next_due_date: isoDate.nullable(),
  next_due_amount_idr: idr.nullable(),
  next_due_seq: z.number().int().nullable(),
  installment_count: z.number().int(),
  days_to_due: z.number().int().nullable(),
  status: debtStatusSchema,
});

export const cycleSummarySchema = z.object({
  cycle_start: isoDate,
  cycle_end: isoDate,
  next_payday: isoDate,
  days_to_payday: z.number().int(),
  base_salary_idr: idr.nullable(),
  obligations_idr: idr,
  paid_idr: idr,
  unpaid_idr: idr,
  free_idr: idr.nullable(),
  carryover_overdue_idr: idr,
  total_owe_remaining_idr: idr,
  total_owed_remaining_idr: idr,
  overdue_count: z.number().int(),
});

export const debtMetaSchema = z.object({
  debt_id: z.string().min(1),
  memo: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
});

export const paymentRowSchema = z.object({
  id: z.string().min(1),
  debt_id: z.string().min(1),
  paid_on: isoDate,
  amount_idr: idr,
  reference: z.string().nullable(),
  reverses_payment_id: z.string().nullable(),
  proof_path: z.string().nullable(),
  note: z.string().nullable(),
});

export const installmentRowSchema = z.object({
  id: z.string().min(1),
  debt_id: z.string().min(1),
  seq: z.number().int(),
  due_date: isoDate,
  amount_idr: idr,
  is_paid: z.boolean(),
  due_remaining_idr: idr,
});

export const bookSettingsRowSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  payday_day: z.number().int(),
  base_salary_idr: idr.nullable(),
});

export const fixtureSchema = z.object({
  today: isoDate,
  book: z.object({ id: z.string(), name: z.string(), timezone: z.string() }),
  inbox_pending: z.number().int(),
  cycle: cycleSummarySchema,
  debts: z.array(debtRowSchema),
  meta: z.array(debtMetaSchema),
  payments: z.array(paymentRowSchema),
  installments: z.array(installmentRowSchema),
});

export type DebtStatus = z.infer<typeof debtStatusSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type DebtRow = z.infer<typeof debtRowSchema>;
export type CycleSummary = z.infer<typeof cycleSummarySchema>;
export type DebtMeta = z.infer<typeof debtMetaSchema>;
export type PaymentRow = z.infer<typeof paymentRowSchema>;
export type InstallmentRow = z.infer<typeof installmentRowSchema>;
export type Fixture = z.infer<typeof fixtureSchema>;
