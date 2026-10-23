import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LedgerList } from '../components/DebtRows';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Money } from '../components/ui/Money';
import { MoneyInput } from '../components/ui/MoneyInput';
import { SegmentedChoice } from '../components/ui/SegmentedChoice';
import { TextAreaField } from '../components/ui/TextAreaField';
import { TextField } from '../components/ui/TextField';
import { DEBT_WRITE_MESSAGES, DebtWriteError, type DebtWriteFailure } from '../data/debtErrors';
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  INSTALLMENTS_MAX,
  INSTALLMENTS_MIN,
  MEMO_MAX,
  NAME_MAX,
  validateNewDebt,
  type NewDebtField,
  type NewDebtFormValues,
  type ScheduleKind,
} from '../data/debtInput';
import { useCreateDebt, useToday } from '../data/hooks';
import type { Direction } from '../data/schemas';
import { formatDay } from '../lib/dates';
import { newUuid } from '../lib/uuid';

const DIRECTIONS = [
  { value: 'owe', label: 'Utang' },
  { value: 'owed', label: 'Piutang' },
] as const satisfies ReadonlyArray<{ value: Direction; label: string }>;

const SCHEDULES = [
  { value: 'sekali', label: 'Sekali bayar' },
  { value: 'cicilan', label: 'Cicilan bulanan' },
] as const satisfies ReadonlyArray<{ value: ScheduleKind; label: string }>;

/** The schedule exactly as it will be saved: shown before saving so a wrong count or date is caught early. */
function SchedulePreview({ values, today }: { values: NewDebtFormValues; today: string }) {
  const result = validateNewDebt(values);
  if (!result.ok || values.schedule !== 'cicilan') return null;
  const rows = result.value.installments;
  const shown = rows.length > 4 ? [...rows.slice(0, 3), rows[rows.length - 1]!] : rows;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-caption font-semibold text-ink-2">Jadwal yang akan disimpan</p>
      <LedgerList label="Jadwal cicilan">
        {shown.map((row, index) => {
          const seq = rows.length > 4 && index === 3 ? rows.length : index + 1;
          return (
            <li key={seq}>
              {rows.length > 4 && index === 3 ? (
                <p className="bg-surface-inset px-4 py-2 text-caption text-ink-2">{rows.length - 4} cicilan lain di antaranya</p>
              ) : null}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-body">
                  Cicilan ke-{seq} {'·'} {formatDay(row.dueDate, today)}
                </span>
                <Money value={row.amountIdr} />
              </div>
            </li>
          );
        })}
      </LedgerList>
    </div>
  );
}

export function TambahCatatan() {
  const [params] = useSearchParams();
  const today = useToday();
  const navigate = useNavigate();
  const create = useCreateDebt();
  // One id per opened form, reused on every retry: create_debt treats it as the idempotency key.
  const [attemptId] = useState(() => newUuid());
  const [values, setValues] = useState<NewDebtFormValues>(() => ({
    direction: params.get('jenis') === 'piutang' ? 'owed' : 'owe',
    name: '',
    amount: '',
    schedule: 'sekali',
    dueDate: '',
    count: '',
    description: '',
    category: '',
    memo: '',
  }));
  const [errors, setErrors] = useState<Partial<Record<NewDebtField, string>>>({});
  const [failure, setFailure] = useState<DebtWriteFailure | null>(null);

  // After an "unknown" outcome the record may already exist: freeze the input so a retry resends the same payload under
  // the same id (an edited value would be silently ignored if the first attempt had been saved).
  const locked = failure === 'unknown';
  const busy = create.isPending;
  // Set synchronously, so a second tap is ignored even before React re-renders (create_debt is idempotent anyway).
  const inFlight = useRef(false);
  const set = <K extends keyof NewDebtFormValues>(field: K) => (value: NewDebtFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Editing a field clears its message (the others stay until fixed).
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field as NewDebtField];
      return next;
    });
  };
  const owe = values.direction === 'owe';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const result = validateNewDebt(values);
    if (!result.ok) {
      setErrors(result.errors);
      setFailure(null);
      // Focus the first invalid field, in screen order.
      const first = (['name', 'amount', 'count', 'dueDate', 'description', 'category', 'memo'] as const).find((f) => result.errors[f]);
      if (first) document.getElementById(`tambah-${first}`)?.focus();
      return;
    }
    setErrors({});
    setFailure(null);
    inFlight.current = true;
    try {
      await create.mutateAsync({ id: attemptId, ...result.value });
      navigate(`/catatan/${attemptId}`, { replace: true });
    } catch (error) {
      setFailure(error instanceof DebtWriteError ? error.kind : 'unknown');
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <>
      <ScreenHeader title="Tambah catatan" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        <form
          onSubmit={(event) => void onSubmit(event)}
          noValidate
          aria-label="Tambah catatan"
          className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4"
        >
          <SegmentedChoice
            label="Jenis"
            value={values.direction}
            options={DIRECTIONS}
            onChange={set('direction')}
            disabled={locked || busy}
          />
          <TextField
            id="tambah-name"
            label={owe ? 'Berutang kepada' : 'Yang berutang kepadamu'}
            hint="Nama orang atau pihak, mis. dr. Hendra atau Home Credit."
            autoComplete="off"
            maxLength={NAME_MAX + 20}
            value={values.name}
            onChange={(event) => set('name')(event.target.value)}
            error={errors.name}
            readOnly={locked || busy}
          />
          <MoneyInput
            id="tambah-amount"
            label="Nominal total"
            value={values.amount}
            onValueChange={set('amount')}
            error={errors.amount}
            readOnly={locked || busy}
          />
          <SegmentedChoice
            label="Pembayaran"
            value={values.schedule}
            options={SCHEDULES}
            onChange={set('schedule')}
            disabled={locked || busy}
          />
          {values.schedule === 'cicilan' ? (
            <TextField
              id="tambah-count"
              label="Jumlah cicilan"
              hint={`${INSTALLMENTS_MIN} sampai ${INSTALLMENTS_MAX} kali, sebulan sekali. Nominal dibagi rata; sisa pembagian masuk cicilan terakhir.`}
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              value={values.count}
              onChange={(event) => set('count')(event.target.value.replace(/\D/g, ''))}
              error={errors.count}
              readOnly={locked || busy}
            />
          ) : null}
          <TextField
            id="tambah-dueDate"
            label={values.schedule === 'cicilan' ? 'Jatuh tempo cicilan pertama' : 'Jatuh tempo'}
            type="date"
            value={values.dueDate}
            onChange={(event) => set('dueDate')(event.target.value)}
            error={errors.dueDate}
            readOnly={locked || busy}
          />
          <SchedulePreview values={values} today={today} />
          <TextField
            id="tambah-description"
            label="Keterangan (opsional)"
            hint="Tampil di bawah nama, mis. Talangan rawat inap."
            autoComplete="off"
            maxLength={DESCRIPTION_MAX + 20}
            value={values.description}
            onChange={(event) => set('description')(event.target.value)}
            error={errors.description}
            readOnly={locked || busy}
          />
          <TextField
            id="tambah-category"
            label="Kategori (opsional)"
            autoComplete="off"
            maxLength={CATEGORY_MAX + 10}
            value={values.category}
            onChange={(event) => set('category')(event.target.value)}
            error={errors.category}
            readOnly={locked || busy}
          />
          <TextAreaField
            id="tambah-memo"
            label="Memo (opsional)"
            maxLength={MEMO_MAX + 50}
            value={values.memo}
            onChange={(event) => set('memo')(event.target.value)}
            error={errors.memo}
            readOnly={locked || busy}
          />
          {failure ? <FormAlert>{DEBT_WRITE_MESSAGES[failure]}</FormAlert> : null}
          <Button type="submit" aria-disabled={busy} aria-busy={busy}>
            {busy ? 'Menyimpan…' : locked ? 'Kirim ulang' : 'Simpan'}
          </Button>
          {locked ? (
            <Link to="/catatan" className={buttonClass('secondary')}>
              Lihat daftar catatan
            </Link>
          ) : null}
        </form>
      </div>
    </>
  );
}
