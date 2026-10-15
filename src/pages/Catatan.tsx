import { useState } from 'react';
import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { LedgerList, ListDebtRow } from '../components/DebtRows';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Money } from '../components/ui/Money';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useDebts } from '../data/hooks';
import type { Direction } from '../data/schemas';
import { cx } from '../lib/cx';
import { directionSummary, filterDebts, type DebtFilter } from '../lib/derive';

type Tab = 'utang' | 'piutang';
const FILTERS: Array<{ id: DebtFilter; label: string }> = [
  { id: 'semua', label: 'Semua' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'terlambat', label: 'Terlambat' },
  { id: 'lunas', label: 'Lunas' },
];

const TABS: Array<{ id: Tab; label: string; direction: Direction; noun: string }> = [
  { id: 'utang', label: 'Utang', direction: 'owe', noun: 'utang' },
  { id: 'piutang', label: 'Piutang', direction: 'owed', noun: 'piutang' },
];

export function Catatan() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const debts = useDebts();

  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0]!;
  const filter = FILTERS.find((f) => f.id === params.get('f'))?.id ?? 'semua';

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params); // mempertahankan parameter lain (mis. ?fixture=)
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <ScreenHeader title="Catatan" />
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div role="tablist" aria-label="Jenis catatan" className="grid grid-cols-2 gap-1 rounded-input bg-surface-inset p-1">
          {TABS.map((t) => {
            const selected = t.id === tab.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setParam('tab', t.id === 'utang' ? null : t.id)}
                className={cx(
                  'min-h-11 rounded-input text-body font-semibold',
                  selected ? 'border border-border bg-surface text-ink' : 'border border-transparent text-ink-2',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <label className="relative block">
          <span className="sr-only">Cari nama atau catatan</span>
          <Search aria-hidden size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau catatan"
            className="h-12 w-full rounded-input border border-border-strong bg-surface pr-4 pl-11 text-body text-ink placeholder:text-muted"
          />
        </label>

        <div role="group" aria-label="Filter status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => {
            const selected = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setParam('f', f.id === 'semua' ? null : f.id)}
                className={cx(
                  'min-h-11 shrink-0 rounded-chip border px-4 text-body font-semibold',
                  selected ? 'border-primary bg-primary text-on-ink' : 'border-border-strong bg-surface text-ink',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" aria-label={tab.label} className="flex flex-col gap-3">
          {debts.isError ? (
            <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={() => void debts.refetch()} />
          ) : !debts.data ? (
            <LoadingRegion>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-72" />
            </LoadingRegion>
          ) : (
            <Rows debts={debts.data} tab={tab} filter={filter} query={query} />
          )}
        </div>
      </div>
    </>
  );
}

function Rows({
  debts,
  tab,
  filter,
  query,
}: {
  debts: NonNullable<ReturnType<typeof useDebts>['data']>;
  tab: (typeof TABS)[number];
  filter: DebtFilter;
  query: string;
}) {
  const summary = directionSummary(debts, tab.direction);
  const rows = filterDebts(debts, { direction: tab.direction, filter, query });
  const noneAtAll = debts.every((d) => d.direction !== tab.direction);

  return (
    <>
      <p className="text-caption text-ink-2">
        Sisa {tab.noun} <Money value={summary.remaining} size="sm" className="text-ink" /> {'·'} {summary.active} aktif
      </p>
      {rows.length > 0 ? (
        <LedgerList label={`Daftar ${tab.noun}`}>
          {rows.map((d) => (
            <ListDebtRow key={d.debt_id} debt={d} />
          ))}
        </LedgerList>
      ) : noneAtAll ? (
        <EmptyState
          title={`Belum ada catatan ${tab.noun}.`}
          action={
            <Link to="/tambah" className="inline-flex min-h-12 items-center px-4 text-body font-semibold underline">
              Tambah {tab.noun}
            </Link>
          }
        />
      ) : (
        <EmptyState title="Tidak ada catatan yang cocok." />
      )}
    </>
  );
}
