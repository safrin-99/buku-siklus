import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Money } from '../components/ui/Money';
import { MoneyInput } from '../components/ui/MoneyInput';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { TextField } from '../components/ui/TextField';
import { useDebtDetail, useRecordPayment, useToday } from '../data/hooks';
import { PAYMENT_WRITE_MESSAGES, PaymentWriteError, type PaymentWriteFailure } from '../data/paymentErrors';
import { validatePayment, type PaymentField, type PaymentFormValues } from '../data/paymentInput';
import { NotFoundError, type DebtDetail } from '../data/source';
import { formatRupiah, formatRupiahInput } from '../lib/money';
import { newUuid } from '../lib/uuid';

function PaymentForm({ detail, today }: { detail: DebtDetail; today: string }) {
  const { debt } = detail;
  const owe = debt.direction === 'owe';
  const navigate = useNavigate();
  const record = useRecordPayment();
  // One id per opened form, reused on every retry: it is the idempotency key (see data/settle.ts).
  const [attemptId] = useState(() => newUuid());
  const [values, setValues] = useState<PaymentFormValues>(() => ({
    amount: formatRupiahInput(String(debt.next_due_amount_idr ?? debt.remaining_idr)),
    paidOn: today,
    reference: '',
    note: '',
  }));
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>({});
  const [failure, setFailure] = useState<PaymentWriteFailure | null>(null);

  // After an "unknown" outcome the row may already be saved: freeze the input so a retry can only resend the same
  // payload under the same id (an edited amount would be silently dropped if the first attempt had succeeded).
  const locked = failure === 'unknown';
  const busy = record.isPending;
  const set = (field: keyof PaymentFormValues) => (value: string) => setValues((v) => ({ ...v, [field]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = validatePayment(values, { remaining: debt.remaining_idr, today });
    if (!result.ok) {
      setErrors(result.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    try {
      await record.mutateAsync({ id: attemptId, debtId: debt.debt_id, ...result.value });
      navigate(`/catatan/${debt.debt_id}`, { replace: true });
    } catch (error) {
      setFailure(error instanceof PaymentWriteError ? error.kind : 'unknown');
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Catat pembayaran"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
    >
      <div>
        <p className="text-body font-semibold">{debt.name}</p>
        <p className="text-caption text-ink-2">
          Sisa <Money value={debt.remaining_idr} size="sm" className="text-ink" />
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <MoneyInput
          label={owe ? 'Nominal dibayar' : 'Nominal diterima'}
          value={values.amount}
          onValueChange={set('amount')}
          error={errors.amount}
          readOnly={locked || busy}
        />
        {/* Paying off the whole rest is the common last step; no need to type the exact remaining amount. */}
        {values.amount !== formatRupiahInput(String(debt.remaining_idr)) && !locked && !busy ? (
          <button
            type="button"
            onClick={() => set('amount')(formatRupiahInput(String(debt.remaining_idr)))}
            className="inline-flex min-h-12 items-center self-start text-body font-semibold underline"
          >
            <span className="tabular-nums">Isi sisa penuh ({formatRupiah(debt.remaining_idr)})</span>
          </button>
        ) : null}
      </div>
      <TextField
        label={owe ? 'Tanggal bayar' : 'Tanggal terima'}
        type="date"
        max={today}
        value={values.paidOn}
        onChange={(event) => set('paidOn')(event.target.value)}
        error={errors.paidOn}
        readOnly={locked || busy}
      />
      <TextField
        label="Referensi (opsional)"
        autoComplete="off"
        value={values.reference}
        onChange={(event) => set('reference')(event.target.value)}
        error={errors.reference}
        readOnly={locked || busy}
      />
      <TextField
        label="Catatan (opsional)"
        autoComplete="off"
        value={values.note}
        onChange={(event) => set('note')(event.target.value)}
        error={errors.note}
        readOnly={locked || busy}
      />
      {failure ? <FormAlert>{PAYMENT_WRITE_MESSAGES[failure]}</FormAlert> : null}
      <Button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? 'Menyimpan…' : locked ? 'Kirim ulang' : 'Simpan'}
      </Button>
      {locked ? (
        <Link to={`/catatan/${debt.debt_id}`} className={buttonClass('secondary')}>
          Lihat riwayat
        </Link>
      ) : null}
    </form>
  );
}

function Loaded({ detail, today }: { detail: DebtDetail; today: string }) {
  // Decided once, when the screen opens: right after a successful save the refetched balance is 0, and the
  // screen must not flip to "already paid" during the moment before it navigates back.
  const [paidOnOpen] = useState(() => detail.debt.remaining_idr <= 0);
  if (paidOnOpen) {
    return (
      <EmptyState
        title="Catatan ini sudah lunas."
        action={
          <Link to={`/catatan/${detail.debt.debt_id}`} className="inline-flex min-h-12 items-center px-4 text-body font-semibold underline">
            Kembali ke catatan
          </Link>
        }
      />
    );
  }
  return <PaymentForm detail={detail} today={today} />;
}

export function CatatPembayaran() {
  const { debtId = '' } = useParams();
  const query = useDebtDetail(debtId);
  const today = useToday();

  return (
    <>
      <ScreenHeader title="Catat pembayaran" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {query.isError ? (
          query.error instanceof NotFoundError ? (
            <ErrorState title="Catatan tidak ditemukan." hint="Tautannya mungkin salah atau catatannya sudah tidak ada." />
          ) : (
            <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={() => void query.refetch()} />
          )
        ) : query.data ? (
          <Loaded detail={query.data} today={today} />
        ) : (
          <LoadingRegion>
            <Skeleton className="h-96" />
          </LoadingRegion>
        )}
      </div>
    </>
  );
}
