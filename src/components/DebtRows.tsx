import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DebtRow } from '../data/schemas';
import { debtCaption } from '../lib/derive';
import { percentOf } from '../lib/money';
import { chipFor, progressToneFor } from '../lib/status';
import { Money } from './ui/Money';
import { ProgressBar } from './ui/ProgressBar';
import { StatusChip } from './ui/StatusChip';

/** Satu permukaan putih, baris dipisah garis 1px (bukan tumpukan kartu). */
export function LedgerList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {children}
    </ul>
  );
}

export function LedgerGroupLabel({ children }: { children: ReactNode }) {
  return (
    <li role="presentation" className="bg-surface-inset px-4 py-2 text-section font-bold uppercase text-ink-2">
      {children}
    </li>
  );
}

const rowLink =
  'block min-h-16 px-4 py-3.5 active:bg-surface-inset focus-visible:outline-offset-[-2px]';

/** Baris Beranda: nama + keterangan di kiri; nominal tagihan berikutnya + chip status di kanan. */
export function HomeDebtRow({ debt }: { debt: DebtRow }) {
  const chip = chipFor(debt.status, debt.days_to_due);
  return (
    <li>
      <Link to={`/catatan/${debt.debt_id}`} className={`${rowLink} flex items-start justify-between gap-3`}>
        <span className="min-w-0">
          <span className="block text-body font-semibold">{debt.name}</span>
          <span className="block text-caption text-ink-2">{debtCaption(debt)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Money value={debt.next_due_amount_idr ?? debt.remaining_idr} />
          <StatusChip {...chip} />
        </span>
      </Link>
    </li>
  );
}

/** Baris Catatan: sisa + "dari total", chip, persen terbayar, dan bilah progres tipis. */
export function ListDebtRow({ debt }: { debt: DebtRow }) {
  const chip = chipFor(debt.status, debt.days_to_due);
  const percent = percentOf(debt.paid_idr, debt.total_idr);
  return (
    <li>
      <Link to={`/catatan/${debt.debt_id}`} className={`${rowLink} flex flex-col gap-2.5`}>
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-body font-semibold">{debt.name}</span>
            <span className="block text-caption text-ink-2">{debtCaption(debt)}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <Money value={debt.remaining_idr} />
            <span className="text-caption text-ink-2">
              dari <Money value={debt.total_idr} size="caption" />
            </span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-3">
          <StatusChip {...chip} />
          <span className="text-caption text-ink-2">{percent}% terbayar</span>
        </span>
        <ProgressBar percent={percent} tone={progressToneFor(debt.status)} label={`${debt.name}: ${percent}% terbayar`} />
      </Link>
    </li>
  );
}
