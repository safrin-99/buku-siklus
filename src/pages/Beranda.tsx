import { Link } from 'react-router-dom';
import { HomeDebtRow, LedgerGroupLabel, LedgerList } from '../components/DebtRows';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Money } from '../components/ui/Money';
import { SectionTitle } from '../components/ui/SectionTitle';
import { SegmentBar, type Segment } from '../components/ui/SegmentBar';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useCycleSummary, useDebts, useToday } from '../data/hooks';
import type { CycleSummary, DebtRow } from '../data/schemas';
import { formatDate, formatRange, relativeDays } from '../lib/dates';
import { homeLists, segmentPercents } from '../lib/derive';

function CycleCard({ cycle, today }: { cycle: CycleSummary; today: string }) {
  const hasSalary = cycle.base_salary_idr !== null && cycle.free_idr !== null;
  const free = cycle.free_idr ?? 0;
  const [pPaid, pUnpaid, pFree] = segmentPercents(cycle.paid_idr, cycle.unpaid_idr, free);
  const segments: Segment[] = [
    { key: 'paid', label: 'Terbayar', amount: cycle.paid_idr, percent: pPaid, bar: 'bg-status-paid-mark' },
    { key: 'unpaid', label: 'Belum dibayar', amount: cycle.unpaid_idr, percent: pUnpaid, bar: 'bg-status-due-mark' },
  ];
  // Tanpa gaji pokok (mis. buku orang lain) tidak ada "sisa setelah cicilan": hanya kewajiban siklus.
  if (hasSalary) {
    segments.push({ key: 'free', label: 'Bebas', amount: Math.max(0, free), percent: pFree, bar: 'bg-ink' });
  }

  return (
    <section aria-label="Siklus gajian" className="rounded-card border border-border bg-surface p-4">
      <p className="text-caption text-ink-2">Siklus {formatRange(cycle.cycle_start, cycle.cycle_end, today)}</p>
      <p className="mt-3 text-caption text-ink-2">{hasSalary ? 'Sisa kas setelah cicilan' : 'Kewajiban siklus'}</p>
      <Money value={hasSalary ? free : cycle.obligations_idr} size="hero" />
      <div className="mt-4">
        <SegmentBar segments={segments} />
      </div>
      {/* The hero follows DESIGN.md (salary − this cycle's installments). Unpaid installments from earlier cycles are not
          part of that number, so they are stated next to it instead of being left out silently. */}
      {cycle.carryover_overdue_idr > 0 ? (
        <p className="mt-3 text-caption text-ink-2">
          Belum termasuk tunggakan siklus lalu{' '}
          <Money value={cycle.carryover_overdue_idr} size="sm" className="text-ink" />.
        </p>
      ) : null}
      <p className="mt-4 border-t border-border pt-3 text-caption text-ink-2">
        Gajian {formatDate(cycle.next_payday, today)} {'·'} {relativeDays(cycle.days_to_payday)}
      </p>
    </section>
  );
}

function Totals({ cycle }: { cycle: CycleSummary }) {
  return (
    <dl className="grid grid-cols-2 divide-x divide-border rounded-card border border-border bg-surface-inset py-3">
      <div className="px-4">
        <dt className="text-caption text-ink-2">Total utang</dt>
        <dd>
          <Money value={cycle.total_owe_remaining_idr} size="lg" />
        </dd>
      </div>
      <div className="px-4">
        <dt className="text-caption text-ink-2">Total piutang</dt>
        <dd>
          <Money value={cycle.total_owed_remaining_idr} size="lg" />
        </dd>
      </div>
    </dl>
  );
}

function Content({ cycle, debts, today }: { cycle: CycleSummary; debts: DebtRow[]; today: string }) {
  const lists = homeLists(debts, cycle.cycle_end);
  const hasPay = lists.overdue.length + lists.thisCycle.length > 0;
  const hasCollect = lists.toCollect.length > 0;

  return (
    <>
      <CycleCard cycle={cycle} today={today} />

      {hasPay ? (
        <section>
          <SectionTitle>Perlu dibayar</SectionTitle>
          <LedgerList label="Perlu dibayar">
            {lists.overdue.length > 0 ? <LedgerGroupLabel>Terlambat</LedgerGroupLabel> : null}
            {lists.overdue.map((d) => (
              <HomeDebtRow key={d.debt_id} debt={d} />
            ))}
            {lists.thisCycle.length > 0 ? <LedgerGroupLabel>Siklus ini</LedgerGroupLabel> : null}
            {lists.thisCycle.map((d) => (
              <HomeDebtRow key={d.debt_id} debt={d} />
            ))}
          </LedgerList>
        </section>
      ) : null}

      {hasCollect ? (
        <section>
          <SectionTitle>Perlu ditagih</SectionTitle>
          <LedgerList label="Perlu ditagih">
            {lists.toCollect.map((d) => (
              <HomeDebtRow key={d.debt_id} debt={d} />
            ))}
          </LedgerList>
        </section>
      ) : null}

      {!hasPay && !hasCollect ? (
        <EmptyState
          title="Tidak ada tagihan yang perlu dibayar atau ditagih."
          action={
            <Link to="/tambah" className="inline-flex min-h-12 items-center px-4 text-body font-semibold underline">
              Tambah catatan
            </Link>
          }
        />
      ) : null}

      <Totals cycle={cycle} />
    </>
  );
}

function Loading() {
  return (
    <LoadingRegion>
      <Skeleton className="h-56" />
      <Skeleton className="h-60" />
      <Skeleton className="h-20" />
    </LoadingRegion>
  );
}

export function Beranda() {
  const cycle = useCycleSummary();
  const debts = useDebts();
  const today = useToday();
  const retry = () => {
    void cycle.refetch();
    void debts.refetch();
  };

  return (
    <>
      <ScreenHeader title="Beranda" />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {cycle.isError || debts.isError ? (
          <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={retry} />
        ) : cycle.data && debts.data ? (
          <Content cycle={cycle.data} debts={debts.data} today={today} />
        ) : (
          <Loading />
        )}
      </div>
    </>
  );
}
