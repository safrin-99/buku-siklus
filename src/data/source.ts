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
 * Dua implementasi: fixture (dibangkitkan dari SQL asli; hanya mode `--mode fixture`) dan Supabase.
 */
export interface DataSource {
  readonly kind: 'fixture' | 'supabase';
  /** The active book. Every number on one screen comes from a single book. */
  readonly bookId: string;
  /** Tanggal hari ini (ISO) menurut zona waktu buku. */
  getToday(): string;
  cycleSummary(): Promise<CycleSummary>;
  debts(): Promise<DebtRow[]>;
  debtDetail(debtId: string): Promise<DebtDetail>;
  inboxPendingCount(): Promise<number>;
}
