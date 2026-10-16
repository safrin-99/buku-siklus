import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Money } from '../components/ui/Money';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { TextAreaField } from '../components/ui/TextAreaField';
import { TextField } from '../components/ui/TextField';
import { DEBT_WRITE_MESSAGES, DebtWriteError, type DebtWriteFailure } from '../data/debtErrors';
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  MEMO_MAX,
  NAME_MAX,
  validateDebtDetails,
  type DebtDetailsField,
  type DebtDetailsFormValues,
} from '../data/debtInput';
import { useDebtDetail, useDeleteDebt, useToday, useUpdateDebtDetails } from '../data/hooks';
import { NotFoundError, type DebtDetail } from '../data/source';
import { formatDate } from '../lib/dates';

function scheduleText(detail: DebtDetail, today: string): string {
  const { installments } = detail;
  if (installments.length === 0) return 'Tanpa jadwal';
  if (installments.length === 1) return `Sekali bayar, jatuh tempo ${formatDate(installments[0]!.due_date, today)}`;
  return `${installments.length} cicilan, ${formatDate(installments[0]!.due_date, today)} sampai ${formatDate(installments.at(-1)!.due_date, today)}`;
}

interface DeleteCallbacks {
  /** Deleting started: the screen freezes on the current data (the detail query will 404 once the row is gone). */
  onDeleteStart(): void;
  /** Deleting failed: back to the live data. */
  onDeleteFail(): void;
}

function DeleteSection({ detail, onDeleteStart, onDeleteFail }: { detail: DebtDetail } & DeleteCallbacks) {
  const navigate = useNavigate();
  const remove = useDeleteDebt(detail.debt.debt_id);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<DebtWriteFailure | null>(null);
  const busy = remove.isPending;

  // The ledger is never deleted, so a record with payments cannot be either (also enforced by the database).
  if (detail.payments.length > 0) {
    return (
      <section aria-label="Hapus catatan" className="rounded-card border border-border bg-surface p-4">
        <p className="text-body text-ink-2">{DEBT_WRITE_MESSAGES.has_payments}</p>
      </section>
    );
  }

  async function onDelete() {
    if (busy) return;
    setFailure(null);
    onDeleteStart();
    try {
      await remove.mutateAsync();
      navigate('/catatan', { replace: true });
    } catch (error) {
      onDeleteFail();
      setFailure(error instanceof DebtWriteError ? error.kind : 'unknown');
    }
  }

  return (
    <section aria-label="Hapus catatan" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      {confirming ? (
        <>
          <p className="text-body">
            Catatan <span className="font-semibold">{detail.debt.name}</span> dan jadwal cicilannya akan dihapus permanen. Belum
            ada pembayaran yang tercatat, jadi tidak ada riwayat yang hilang.
          </p>
          {failure ? <FormAlert>{DEBT_WRITE_MESSAGES[failure]}</FormAlert> : null}
          <Button variant="destructive" aria-disabled={busy} aria-busy={busy} onClick={() => void onDelete()}>
            {busy ? 'Menghapus…' : 'Ya, hapus catatan'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Batal
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-ink-2">Salah nominal atau jadwal? Hapus catatan ini lalu buat ulang.</p>
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Hapus catatan
          </Button>
        </>
      )}
    </section>
  );
}

function EditForm({ detail, today, ...deleteCallbacks }: { detail: DebtDetail; today: string } & DeleteCallbacks) {
  const { debt } = detail;
  const navigate = useNavigate();
  const update = useUpdateDebtDetails(debt.debt_id);
  const inFlight = useRef(false);
  const [values, setValues] = useState<DebtDetailsFormValues>(() => ({
    name: debt.name,
    description: debt.description ?? '',
    category: detail.category ?? '',
    memo: detail.memo ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<DebtDetailsField, string>>>({});
  const [failure, setFailure] = useState<DebtWriteFailure | null>(null);
  const busy = update.isPending;
  const set = (field: DebtDetailsField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const result = validateDebtDetails(values);
    if (!result.ok) {
      setErrors(result.errors);
      setFailure(null);
      const first = (['name', 'description', 'category', 'memo'] as const).find((f) => result.errors[f]);
      if (first) document.getElementById(`ubah-${first}`)?.focus();
      return;
    }
    setErrors({});
    setFailure(null);
    inFlight.current = true;
    try {
      // Setting values is idempotent, so any failure is safe to retry as is.
      await update.mutateAsync(result.value);
      navigate(`/catatan/${debt.debt_id}`, { replace: true });
    } catch (error) {
      setFailure(error instanceof DebtWriteError ? error.kind : 'network');
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <>
      <section aria-label="Nominal dan jadwal" className="rounded-card border border-border bg-surface p-4">
        <p className="text-caption text-ink-2">{debt.direction === 'owe' ? 'Utang' : 'Piutang'}</p>
        <Money value={debt.total_idr} size="lg" />
        <p className="text-caption text-ink-2">{scheduleText(detail, today)}</p>
        <p className="mt-3 border-t border-border pt-3 text-caption text-ink-2">
          Nominal dan jadwal tidak bisa diubah setelah catatan dibuat, supaya sisa dan riwayat pembayaran tetap cocok.
        </p>
      </section>

      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        aria-label="Ubah catatan"
        className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4"
      >
        <TextField
          id="ubah-name"
          label="Nama"
          autoComplete="off"
          maxLength={NAME_MAX + 20}
          value={values.name}
          onChange={(event) => set('name')(event.target.value)}
          error={errors.name}
          readOnly={busy}
        />
        <TextField
          id="ubah-description"
          label="Keterangan (opsional)"
          autoComplete="off"
          maxLength={DESCRIPTION_MAX + 20}
          value={values.description}
          onChange={(event) => set('description')(event.target.value)}
          error={errors.description}
          readOnly={busy}
        />
        <TextField
          id="ubah-category"
          label="Kategori (opsional)"
          autoComplete="off"
          maxLength={CATEGORY_MAX + 10}
          value={values.category}
          onChange={(event) => set('category')(event.target.value)}
          error={errors.category}
          readOnly={busy}
        />
        <TextAreaField
          id="ubah-memo"
          label="Memo (opsional)"
          maxLength={MEMO_MAX + 50}
          value={values.memo}
          onChange={(event) => set('memo')(event.target.value)}
          error={errors.memo}
          readOnly={busy}
        />
        {failure ? <FormAlert>{DEBT_WRITE_MESSAGES[failure]}</FormAlert> : null}
        <Button type="submit" aria-disabled={busy} aria-busy={busy}>
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </form>

      <DeleteSection detail={detail} {...deleteCallbacks} />
    </>
  );
}

export function UbahCatatan() {
  const { debtId = '' } = useParams();
  const query = useDebtDetail(debtId);
  const today = useToday();
  // While deleting, the detail query is refetched and 404s before the screen navigates away: show the frozen copy.
  const [frozen, setFrozen] = useState<DebtDetail | null>(null);
  const detail = frozen ?? query.data;

  return (
    <>
      <ScreenHeader title="Ubah catatan" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {detail && (frozen || !query.isError) ? (
          <EditForm
            detail={detail}
            today={today}
            onDeleteStart={() => setFrozen(query.data ?? null)}
            onDeleteFail={() => setFrozen(null)}
          />
        ) : query.isError ? (
          query.error instanceof NotFoundError ? (
            <>
              <ErrorState title="Catatan tidak ditemukan." hint="Tautannya mungkin salah atau catatannya sudah tidak ada." />
              <Link to="/catatan" className="inline-flex min-h-12 items-center justify-center text-body font-semibold underline">
                Kembali ke Catatan
              </Link>
            </>
          ) : (
            <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={() => void query.refetch()} />
          )
        ) : (
          <LoadingRegion>
            <Skeleton className="h-28" />
            <Skeleton className="h-96" />
          </LoadingRegion>
        )}
      </div>
    </>
  );
}
