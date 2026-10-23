import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { LedgerList } from '../components/DebtRows';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Money } from '../components/ui/Money';
import { SectionTitle } from '../components/ui/SectionTitle';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { StatusChip } from '../components/ui/StatusChip';
import { useBookSettings, useDebts, useInstallmentsBetween, useToday } from '../data/hooks';
import type { DebtRow, InstallmentRow } from '../data/schemas';
import {
  WEEKDAY_HEADERS,
  formatLongDate,
  formatMonth,
  installmentChip,
  isMonthKey,
  monthGrid,
  monthOf,
  monthRange,
  paydayIn,
  shiftMonth,
  tonesByDate,
  type MonthKey,
} from '../lib/calendar';
import { cx } from '../lib/cx';
import { formatDate, relativeDays } from '../lib/dates';
import type { ChipTone } from '../lib/status';

const DOT: Record<ChipTone, string> = {
  overdue: 'bg-status-overdue-mark',
  due: 'bg-status-due-mark',
  neutral: 'bg-muted',
  paid: 'bg-status-paid-mark',
};
const TONE_WORD: Record<ChipTone, string> = {
  overdue: 'terlambat',
  due: 'jatuh tempo ≤ 3 hari',
  neutral: 'belum jatuh tempo',
  paid: 'lunas',
};

const asDue = (i: InstallmentRow) => ({ dueDate: i.due_date, isPaid: i.is_paid });

/** Nearest unpaid debt (utang) due today or later, counted from today (DESIGN.md section 11, item 2). */
function nearestDue(debts: readonly DebtRow[]): DebtRow | null {
  const upcoming = debts.filter((d) => d.direction === 'owe' && d.status !== 'paid' && d.days_to_due !== null && d.days_to_due >= 0);
  return upcoming.reduce<DebtRow | null>((best, d) => (best === null || d.days_to_due! < best.days_to_due! ? d : best), null);
}

function MonthGrid({
  month,
  installments,
  selected,
  today,
  paydayDay,
  onSelect,
}: {
  month: MonthKey;
  installments: readonly InstallmentRow[];
  selected: string;
  today: string;
  paydayDay: number | null;
  onSelect(date: string): void;
}) {
  const tones = tonesByDate(installments.map(asDue), today);
  const counts = new Map<string, number>();
  for (const i of installments) counts.set(i.due_date, (counts.get(i.due_date) ?? 0) + 1);
  const payday = paydayDay === null ? null : paydayIn(month, paydayDay);

  return (
    // -mx-2 and no side padding: seven 48px targets fit even at 360px wide.
    <div className="-mx-2 rounded-card border border-border bg-surface py-2">
      <div aria-hidden className="grid grid-cols-7 pb-1 text-center text-label font-semibold text-ink-2">
        {WEEKDAY_HEADERS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div role="group" aria-label={formatMonth(month)} className="grid grid-cols-7">
        {monthGrid(month).flat().map((date, index) => {
          if (date === null) return <span key={`blank-${index}`} aria-hidden />;
          const dayTones = tones.get(date) ?? [];
          const count = counts.get(date) ?? 0;
          const isToday = date === today;
          const isPayday = date === payday;
          const isSelected = date === selected;
          const parts = [formatLongDate(date)];
          if (isToday) parts.push('hari ini');
          if (isPayday) parts.push('gajian');
          if (count > 0) parts.push(`${count} tagihan: ${dayTones.map((t) => TONE_WORD[t]).join(', ')}`);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={parts.join(', ')}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              className="flex h-14 flex-col items-center justify-center gap-1 focus-visible:outline-offset-[-2px]"
            >
              <span
                className={cx(
                  'grid size-8 place-items-center rounded-chip text-body tabular-nums',
                  isSelected ? 'bg-primary font-bold text-on-ink' : isToday ? 'font-bold text-ink underline underline-offset-4' : 'text-ink',
                  // Payday: indigo ring (DESIGN.md section 7.6); kept visible on the selected day with an offset.
                  isPayday && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
                )}
              >
                {Number(date.slice(8))}
              </span>
              <span aria-hidden className="flex h-1.5 gap-0.5">
                {dayTones.map((t) => (
                  <span key={t} className={cx('size-1.5 rounded-chip', DOT[t])} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<[ChipTone, string]> = [
    ['overdue', 'Terlambat'],
    ['due', '≤ 3 hari'],
    ['neutral', 'Belum jatuh tempo'],
    ['paid', 'Lunas'],
  ];
  return (
    <ul aria-label="Keterangan" className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-2">
      {items.map(([tone, label]) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span aria-hidden className={cx('size-2 rounded-chip', DOT[tone])} />
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-chip ring-2 ring-primary" />
        Gajian
      </li>
    </ul>
  );
}

function Agenda({ date, installments, debts, today }: { date: string; installments: readonly InstallmentRow[]; debts: readonly DebtRow[]; today: string }) {
  const byId = new Map(debts.map((d) => [d.debt_id, d]));
  const rows = installments.filter((i) => i.due_date === date && byId.has(i.debt_id));
  return (
    <section aria-label="Agenda">
      <SectionTitle>{formatLongDate(date)}</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState
          title="Tidak ada tagihan di tanggal ini."
          action={
            <Link to="/tambah" className="inline-flex min-h-12 items-center px-4 text-body font-semibold underline">
              Tambah catatan
            </Link>
          }
        />
      ) : (
        <LedgerList label={`Tagihan ${formatLongDate(date)}`}>
          {rows.map((i) => {
            const debt = byId.get(i.debt_id)!;
            const total = debt.installment_count;
            const chip = installmentChip(asDue(i), today);
            return (
              <li key={i.id}>
                <Link
                  to={`/catatan/${debt.debt_id}`}
                  className="flex min-h-16 items-start justify-between gap-3 px-4 py-3.5 active:bg-surface-inset focus-visible:outline-offset-[-2px]"
                >
                  <span className="min-w-0">
                    <span className="block text-body font-semibold">{debt.name}</span>
                    <span className="block text-caption text-ink-2">
                      {debt.direction === 'owe' ? 'Utang' : 'Piutang'} {'·'} {total > 1 ? `Cicilan ke-${i.seq}/${total}` : 'Pelunasan'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <Money value={i.is_paid ? i.amount_idr : i.due_remaining_idr} />
                    <StatusChip {...chip} />
                  </span>
                </Link>
              </li>
            );
          })}
        </LedgerList>
      )}
    </section>
  );
}

export function Kalender() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const rawMonth = params.get('bulan');
  const month: MonthKey = isMonthKey(rawMonth) ? rawMonth : monthOf(today);
  const { first, last } = monthRange(month);
  const installments = useInstallmentsBetween(first, last);
  const debts = useDebts();
  const settings = useBookSettings();

  // Month and selected day live in the URL, so opening a record and going back returns to the same place.
  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params); // keeps other parameters (e.g. ?fixture=)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };
  const rawDate = params.get('tanggal');
  const firstDueThisMonth = installments.data?.[0]?.due_date ?? null;
  const selected =
    rawDate && rawDate >= first && rawDate <= last
      ? rawDate
      : month === monthOf(today)
        ? today
        : (firstDueThisMonth ?? first);

  const nearest = debts.data ? nearestDue(debts.data) : null;
  const failed = installments.isError || debts.isError;

  return (
    <>
      <ScreenHeader title="Kalender" />
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => update({ bulan: shiftMonth(month, -1), tanggal: null })}
            aria-label="Bulan sebelumnya"
            className="-ml-3 grid size-12 place-items-center rounded-chip text-ink active:bg-surface-inset"
          >
            <ChevronLeft aria-hidden size={24} />
          </button>
          <h2 aria-live="polite" className="text-title font-bold">
            {formatMonth(month)}
          </h2>
          <button
            type="button"
            onClick={() => update({ bulan: shiftMonth(month, 1), tanggal: null })}
            aria-label="Bulan berikutnya"
            className="-mr-3 grid size-12 place-items-center rounded-chip text-ink active:bg-surface-inset"
          >
            <ChevronRight aria-hidden size={24} />
          </button>
        </div>
        {month !== monthOf(today) ? (
          <button
            type="button"
            onClick={() => update({ bulan: null, tanggal: null })}
            className="-mt-2 inline-flex min-h-12 items-center self-center text-body font-semibold underline"
          >
            Kembali ke bulan ini
          </button>
        ) : null}

        {failed ? (
          <ErrorState
            title="Data tidak bisa dimuat."
            hint="Periksa koneksi, lalu coba lagi."
            onRetry={() => {
              void installments.refetch();
              void debts.refetch();
            }}
          />
        ) : installments.data && debts.data ? (
          <>
            <MonthGrid
              month={month}
              installments={installments.data}
              selected={selected}
              today={today}
              paydayDay={settings.data?.paydayDay ?? null}
              onSelect={(date) => update({ bulan: month === monthOf(today) ? null : month, tanggal: date })}
            />
            <Legend />
            {nearest ? (
              <p className="text-caption text-ink-2">
                Jatuh tempo terdekat: <span className="font-semibold text-ink">{nearest.name}</span>,{' '}
                {formatDate(nearest.next_due_date!, today)} {'·'} {relativeDays(nearest.days_to_due!)}
              </p>
            ) : null}
            <Agenda date={selected} installments={installments.data} debts={debts.data} today={today} />
          </>
        ) : (
          <LoadingRegion>
            <Skeleton className="h-80" />
            <Skeleton className="h-28" />
          </LoadingRegion>
        )}
      </div>
    </>
  );
}
