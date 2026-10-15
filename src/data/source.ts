import type { CycleSummary, DebtRow, InstallmentRow, PaymentRow } from './schemas';

export interface DebtDetail {
  debt: DebtRow;
  memo: string | null;
  category: string | null;
  payments: PaymentRow[];
  installments: InstallmentRow[];
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`NOT_FOUND: ${what}`);
    this.name = 'NotFoundError';
  }
}

/**
 * Satu-satunya pintu data untuk UI. Perhitungan (status, siklus, sisa) berasal dari SQL
 * (`debt_list`, `cycle_summary`); implementasi hanya mengambil dan memvalidasi.
 * Saat ini hanya ada sumber fixture (dibangkitkan dari SQL asli). Sumber Supabase menyusul
 * bersama layar login.
 */
export interface DataSource {
  readonly kind: 'fixture';
  /** Tanggal hari ini (ISO) menurut zona waktu buku. */
  getToday(): string;
  cycleSummary(): Promise<CycleSummary>;
  debts(): Promise<DebtRow[]>;
  debtDetail(debtId: string): Promise<DebtDetail>;
  inboxPendingCount(): Promise<number>;
}
