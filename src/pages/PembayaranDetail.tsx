import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Money } from '../components/ui/Money';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { TextField } from '../components/ui/TextField';
import { useDebtDetail, useReversePayment, useToday } from '../data/hooks';
import { PAYMENT_WRITE_MESSAGES, PaymentWriteError, type PaymentWriteFailure } from '../data/paymentErrors';
import { validateReason } from '../data/paymentInput';
import { NotFoundError, type DebtDetail } from '../data/source';
import type { PaymentRow } from '../data/schemas';
import { formatDate, formatDay } from '../lib/dates';
import { canReverse, labelPayments, reversedPaymentIds } from '../lib/derive';
import { newUuid } from '../lib/uuid';

function ReversalPanel({ detail, payment, today }: { detail: DebtDetail; payment: PaymentRow; today: string }) {
  const navigate = useNavigate();
  const reverse = useReversePayment();
  // One id per opened screen, reused on retry (idempotency key, see data/settle.ts).
  const [attemptId] = useState(() => newUuid());
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<PaymentWriteFailure | null>(null);
  // After an "unknown" outcome the entry may already exist: only a resend of the same payload is allowed.
  const locked = failure === 'unknown';
  const busy = reverse.isPending;

  function askConfirmation() {
    const checked = validateReason(reason);
    if (!checked.ok) {
      setReasonError(checked.error);
      return;
    }
    setReasonError(undefined);
    setConfirming(true);
  }

  async function confirm() {
    if (busy) return;
    const checked = validateReason(reason);
    if (!checked.ok) return;
    setFailure(null);
    try {
      await reverse.mutateAsync({
        id: attemptId,
        debtId: detail.debt.debt_id,
        reversesPaymentId: payment.id,
        amountIdr: payment.amount_idr,
        paidOn: today,
        note: checked.value,
      });
      navigate(`/catatan/${detail.debt.debt_id}`, { replace: true });
    } catch (error) {
      setFailure(error instanceof PaymentWriteError ? error.kind : 'unknown');
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
      <TextField
        label="Alasan (opsional)"
        autoComplete="off"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        error={reasonError}
        readOnly={confirming || busy}
      />
      {failure ? <FormAlert>{PAYMENT_WRITE_MESSAGES[failure]}</FormAlert> : null}
      {confirming ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-body">
            Dicatat entri pembalik <Money value={-payment.amount_idr} size="sm" className="text-ink" /> bertanggal{' '}
            {formatDay(today, today)}. Pembayaran asli tetap tampil di riwayat.
          </p>
          <Button variant="destructive" disabled={busy} aria-busy={busy} onClick={() => void confirm()}>
            {busy ? 'Memproses…' : locked ? 'Kirim ulang' : 'Ya, batalkan pembayaran'}
          </Button>
          {locked ? (
            <Link to={`/catatan/${detail.debt.debt_id}`} className={buttonClass('secondary')}>
              Lihat riwayat
            </Link>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Batal
            </Button>
          )}
        </div>
      ) : (
        <Button variant="destructive" onClick={askConfirmation}>
          Batalkan pembayaran
        </Button>
      )}
    </div>
  );
}

function Content({ detail, paymentId, today }: { detail: DebtDetail; paymentId: string; today: string }) {
  const { debt, payments, installments } = detail;
  const payment = payments.find((p) => p.id === paymentId);
  // Decided once, when the screen opens: after a successful reversal the refetched ledger says "already reversed",
  // and the panel must not vanish before the screen navigates back.
  const [reversibleOnOpen] = useState(() => {
    const found = payments.find((p) => p.id === paymentId);
    return found ? canReverse(found, reversedPaymentIds(payments)) : false;
  });

  if (!payment) {
    return (
      <ErrorState title="Pembayaran tidak ditemukan." hint="Tautannya mungkin salah atau catatannya sudah berubah." />
    );
  }

  const owe = debt.direction === 'owe';
  const isReversal = payment.reverses_payment_id !== null;
  const original = isReversal ? payments.find((p) => p.id === payment.reverses_payment_id) : undefined;
  const reversalOfThis = payments.find((p) => p.reverses_payment_id === payment.id);
  const title = labelPayments(payments, installments).get(payment.id)?.title ?? 'Pembayaran';

  return (
    <>
      <section aria-label="Pembayaran" className="rounded-card border border-border bg-surface p-4">
        <p className="text-caption text-ink-2">{debt.name}</p>
        <h2 className="text-title font-bold">{title}</h2>
        <Money value={payment.amount_idr} size="lg" />
        <dl className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-body">
          <div>
            <dt className="text-caption text-ink-2">{owe ? 'Tanggal bayar' : 'Tanggal terima'}</dt>
            <dd className="font-semibold">{formatDate(payment.paid_on, today)}</dd>
          </div>
          {payment.reference ? (
            <div>
              <dt className="text-caption text-ink-2">Referensi</dt>
              <dd className="break-words font-semibold">{payment.reference}</dd>
            </div>
          ) : null}
          {payment.note ? (
            <div>
              <dt className="text-caption text-ink-2">Catatan</dt>
              <dd className="break-words">{payment.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {reversibleOnOpen ? <ReversalPanel detail={detail} payment={payment} today={today} /> : null}

      {!reversibleOnOpen && isReversal ? (
        <p className="text-body text-ink-2">
          Ini entri pembalik
          {original ? (
            <>
              {' '}
              untuk pembayaran {formatDay(original.paid_on, today)} sebesar <Money value={original.amount_idr} size="sm" className="text-ink" />
            </>
          ) : null}
          . Entri pembalik tidak bisa dibatalkan.
        </p>
      ) : null}

      {!reversibleOnOpen && !isReversal && reversalOfThis ? (
        <p className="text-body text-ink-2">
          Pembayaran ini sudah dibatalkan pada {formatDate(reversalOfThis.paid_on, today)}
          {reversalOfThis.note ? `. Alasan: ${reversalOfThis.note}` : ''}.
        </p>
      ) : null}

      {/* With the reversal panel open, the header arrow is the only way back: two "back" buttons next to "Batal" confuse. */}
      {!reversibleOnOpen ? (
        <Link to={`/catatan/${debt.debt_id}`} className={buttonClass('secondary')}>
          Kembali ke catatan
        </Link>
      ) : null}
    </>
  );
}

export function PembayaranDetail() {
  const { debtId = '', paymentId = '' } = useParams();
  const query = useDebtDetail(debtId);
  const today = useToday();

  return (
    <>
      <ScreenHeader title="Pembayaran" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {query.isError ? (
          query.error instanceof NotFoundError ? (
            <ErrorState title="Catatan tidak ditemukan." hint="Tautannya mungkin salah atau catatannya sudah tidak ada." />
          ) : (
            <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={() => void query.refetch()} />
          )
        ) : query.data ? (
          <Content detail={query.data} paymentId={paymentId} today={today} />
        ) : (
          <LoadingRegion>
            <Skeleton className="h-56" />
            <Skeleton className="h-40" />
          </LoadingRegion>
        )}
      </div>
    </>
  );
}
