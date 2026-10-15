// Turunan tampilan dari baris yang sudah dihitung SQL. Tidak ada perhitungan saldo/status di sini.
import type { DebtRow, Direction, InstallmentRow, PaymentRow } from '../data/schemas';

export type DebtFilter = 'semua' | 'aktif' | 'terlambat' | 'lunas';

export function filterDebts(
  debts: readonly DebtRow[],
  opts: { direction: Direction; filter: DebtFilter; query: string },
): DebtRow[] {
  const q = opts.query.trim().toLowerCase();
  return debts.filter((d) => {
    if (d.direction !== opts.direction) return false;
    if (opts.filter === 'aktif' && d.status === 'paid') return false;
    if (opts.filter === 'terlambat' && d.status !== 'overdue') return false;
    if (opts.filter === 'lunas' && d.status !== 'paid') return false;
    if (q && !`${d.name} ${d.description ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function directionSummary(debts: readonly DebtRow[], direction: Direction) {
  const rows = debts.filter((d) => d.direction === direction);
  return {
    remaining: rows.reduce((sum, d) => sum + d.remaining_idr, 0),
    active: rows.filter((d) => d.status !== 'paid').length,
  };
}

/**
 * Beranda: "Perlu dibayar" (utang terlambat + utang yang jatuh tempo dalam siklus berjalan)
 * dan "Perlu ditagih" (piutang yang jatuh tempo hari ini atau sudah lewat; DESIGN.md bagian 11.5).
 */
export function homeLists(debts: readonly DebtRow[], cycleEnd: string) {
  const owe = debts.filter((d) => d.direction === 'owe' && d.status !== 'paid');
  return {
    overdue: owe.filter((d) => d.status === 'overdue'),
    thisCycle: owe.filter(
      (d) => d.status !== 'overdue' && d.next_due_date !== null && d.next_due_date <= cycleEnd,
    ),
    toCollect: debts.filter(
      (d) => d.direction === 'owed' && d.status !== 'paid' && d.days_to_due !== null && d.days_to_due <= 0,
    ),
  };
}

/** Persen bulat untuk bilah segmen, dijamin berjumlah 100 (metode sisa terbesar). */
export function segmentPercents(paid: number, unpaid: number, free: number): [number, number, number] {
  const parts = [paid, unpaid, Math.max(0, free)];
  const total = parts[0]! + parts[1]! + parts[2]!;
  if (total <= 0) return [0, 0, 0];
  const exact = parts.map((p) => (p / total) * 100);
  const floors = exact.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - floors[i]! })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = floors[i]! + 1;
    rest -= 1;
  }
  return [floors[0]!, floors[1]!, floors[2]!];
}

export function debtCaption(d: DebtRow): string {
  const parts: string[] = [];
  if (d.description) parts.push(d.description);
  if (d.installment_count > 1 && d.next_due_seq !== null) {
    parts.push(`cicilan ke-${d.next_due_seq}/${d.installment_count}`);
  }
  return parts.join(' · ');
}

export function installmentProgress(installments: readonly InstallmentRow[]) {
  return { paid: installments.filter((i) => i.is_paid).length, total: installments.length };
}

export interface PaymentLabel {
  title: string;
  kind: 'installment' | 'partial' | 'settlement' | 'reversal';
}

/**
 * Pembayaran tidak ditautkan ke cicilan di skema; label diturunkan dari jumlah kumulatif:
 * cicilan yang baru tertutup oleh pembayaran ini. `payments` harus berurutan kronologis.
 */
export function labelPayments(
  payments: readonly PaymentRow[],
  installments: readonly InstallmentRow[],
): Map<string, PaymentLabel> {
  const sorted = [...installments].sort((a, b) => a.seq - b.seq);
  const cumulative: number[] = [];
  sorted.reduce((sum, i) => {
    const next = sum + i.amount_idr;
    cumulative.push(next);
    return next;
  }, 0);
  const covered = (paid: number) => cumulative.filter((c) => c <= paid).length;

  const labels = new Map<string, PaymentLabel>();
  let paidSoFar = 0;
  for (const p of payments) {
    if (p.amount_idr < 0 || p.reverses_payment_id) {
      paidSoFar += p.amount_idr;
      labels.set(p.id, { title: 'Pembalikan', kind: 'reversal' });
      continue;
    }
    const before = covered(paidSoFar);
    paidSoFar += p.amount_idr;
    const after = covered(paidSoFar);
    if (sorted.length === 1) {
      labels.set(
        p.id,
        after === 1 ? { title: 'Pelunasan', kind: 'settlement' } : { title: 'Pembayaran sebagian', kind: 'partial' },
      );
    } else if (after - before === 1) {
      labels.set(p.id, { title: `Cicilan ke-${after}`, kind: 'installment' });
    } else if (after - before > 1) {
      labels.set(p.id, { title: `Cicilan ke-${before + 1}–${after}`, kind: 'installment' });
    } else {
      labels.set(p.id, { title: 'Pembayaran sebagian', kind: 'partial' });
    }
  }
  return labels;
}

/** Ids of payments that another ledger entry reverses. */
export function reversedPaymentIds(payments: readonly PaymentRow[]): Set<string> {
  return new Set(payments.flatMap((p) => (p.reverses_payment_id ? [p.reverses_payment_id] : [])));
}

/** Only a positive entry that has not been reversed yet can be cancelled; a reversal entry itself never can. */
export function canReverse(payment: PaymentRow, reversed: ReadonlySet<string>): boolean {
  return payment.amount_idr > 0 && payment.reverses_payment_id === null && !reversed.has(payment.id);
}
