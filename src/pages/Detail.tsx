import { ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LedgerList } from '../components/DebtRows';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { buttonClass } from '../components/ui/Button';
import { Money } from '../components/ui/Money';
import { ProgressBar } from '../components/ui/ProgressBar';
import { SectionTitle } from '../components/ui/SectionTitle';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { StatusChip } from '../components/ui/StatusChip';
import { useDebtDetail, useToday } from '../data/hooks';
import { NotFoundError, type DebtDetail } from '../data/source';
import { formatDate, formatDay } from '../lib/dates';
import { installmentProgress, labelPayments, reversedPaymentIds } from '../lib/derive';
import { percentOf } from '../lib/money';
import { chipFor, progressToneFor } from '../lib/status';

function Content({ detail, today }: { detail: DebtDetail; today: string }) {
  const { debt, memo, payments, installments } = detail;
  const owe = debt.direction === 'owe';
  const chip = chipFor(debt.status, debt.days_to_due);
  const percent = percentOf(debt.paid_idr, debt.total_idr);
  const labels = labelPayments(payments, installments);
  const reversedIds = reversedPaymentIds(payments);
  const progress = installmentProgress(installments);
  const next = installments.find((i) => !i.is_paid);
  const isLast = next !== undefined && next.seq === installments.length;
  const paidWord = owe ? 'terbayar' : 'diterima';

  return (
    <>
      <section aria-label="Ringkasan" className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title font-bold">{debt.name}</h2>
            {debt.description ? <p className="text-caption text-ink-2">{debt.description}</p> : null}
          </div>
          <StatusChip {...chip} />
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-section font-bold uppercase text-ink-2">{owe ? 'Sisa kewajiban' : 'Sisa tagihan'}</p>
          <Money value={debt.remaining_idr} size="hero" />
          <p className="mt-1 text-caption text-ink-2">
            dari total <Money value={debt.total_idr} size="sm" className="text-ink" />
            {debt.next_due_date ? ` · jatuh tempo ${formatDate(debt.next_due_date, today)}` : ''}
          </p>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-caption">
            <span className="text-ink-2">Progres pelunasan</span>
            <span className="font-semibold">
              <Money value={debt.paid_idr} size="sm" /> {paidWord} ({percent}%)
            </span>
          </div>
          <ProgressBar percent={percent} tone={progressToneFor(debt.status)} label={`${percent}% ${paidWord}`} />
        </div>
      </section>

      <section>
        <SectionTitle aside={progress.total > 1 ? `${progress.paid} dari ${progress.total} cicilan` : undefined}>
          Riwayat pembayaran
        </SectionTitle>
        {payments.length === 0 && !next ? (
          <p className="rounded-card border border-border bg-surface p-4 text-body text-ink-2">Belum ada pembayaran.</p>
        ) : (
          <LedgerList label="Riwayat pembayaran">
            {payments.map((p) => {
              const label = labels.get(p.id);
              const reversal = p.amount_idr < 0;
              const cancelled = reversedIds.has(p.id);
              const neutral = reversal || cancelled;
              return (
                <li key={p.id}>
                  <Link
                    to={`/catatan/${debt.debt_id}/pembayaran/${p.id}`}
                    className="flex min-h-16 items-center gap-3 px-4 py-3.5 active:bg-surface-inset focus-visible:outline-offset-[-2px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold">
                        {label?.title ?? 'Pembayaran'} {'·'} {formatDay(p.paid_on, today)}
                      </p>
                      {p.reference || p.note ? (
                        <p className="text-caption text-ink-2">{p.reference ? `Ref: ${p.reference}` : p.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className={neutral ? 'text-ink' : 'text-status-paid-text'}>
                        <span className="tabular-nums text-money-md font-semibold">{neutral ? '' : '+'}</span>
                        <Money value={p.amount_idr} />
                      </span>
                      <span className={`text-caption font-semibold ${neutral ? 'text-ink-2' : 'text-status-paid-text'}`}>
                        {reversal ? 'Dikoreksi' : cancelled ? 'Dibatalkan' : owe ? 'Dibayar' : 'Diterima'}
                      </span>
                    </div>
                    <ChevronRight aria-hidden size={20} className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
            {next ? (
              <li className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-body font-semibold">
                    {installments.length === 1 ? 'Pelunasan' : `Cicilan ke-${next.seq}`} {'·'} jatuh tempo{' '}
                    {formatDay(next.due_date, today)}
                  </p>
                  {installments.length > 1 && isLast ? <p className="text-caption text-ink-2">Cicilan terakhir</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Money value={next.due_remaining_idr} />
                  <StatusChip {...chip} />
                </div>
              </li>
            ) : null}
          </LedgerList>
        )}
      </section>

      <section>
        <SectionTitle>Memo</SectionTitle>
        <div className="rounded-card border border-border bg-surface p-4">
          {memo ? <p className="text-body">{memo}</p> : <p className="text-body text-ink-2">Belum ada catatan.</p>}
        </div>
      </section>

      {debt.remaining_idr > 0 ? (
        <Link to={`/catatan/${debt.debt_id}/bayar`} className={buttonClass('primary')}>
          Catat pembayaran
        </Link>
      ) : null}
    </>
  );
}

export function Detail() {
  const { debtId = '' } = useParams();
  const query = useDebtDetail(debtId);
  const today = useToday();

  return (
    <>
      <ScreenHeader title="Detail catatan" back />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {query.isError ? (
          query.error instanceof NotFoundError ? (
            <ErrorState
              title="Catatan tidak ditemukan."
              hint="Tautannya mungkin salah atau catatannya sudah tidak ada."
              onRetry={undefined}
            />
          ) : (
            <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={() => void query.refetch()} />
          )
        ) : query.data ? (
          <Content detail={query.data} today={today} />
        ) : (
          <LoadingRegion>
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
            <Skeleton className="h-24" />
          </LoadingRegion>
        )}
        {query.isError && query.error instanceof NotFoundError ? (
          <Link to="/catatan" className="inline-flex min-h-12 items-center justify-center text-body font-semibold underline">
            Kembali ke Catatan
          </Link>
        ) : null}
      </div>
    </>
  );
}
