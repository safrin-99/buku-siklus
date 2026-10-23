import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { MoneyInput } from '../components/ui/MoneyInput';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { TextField } from '../components/ui/TextField';
import { useBookSettings, useUpdateBookSettings } from '../data/hooks';
import { SETTINGS_WRITE_MESSAGES, SettingsWriteError, type SettingsWriteFailure } from '../data/settingsErrors';
import { PAYDAY_MAX, PAYDAY_MIN, validateGajian, type GajianField } from '../data/settingsInput';
import type { BookSettings } from '../data/source';
import { formatRupiahInput } from '../lib/money';

function GajianForm({ settings }: { settings: BookSettings }) {
  const navigate = useNavigate();
  const update = useUpdateBookSettings();
  const [payday, setPayday] = useState(String(settings.paydayDay));
  const [salary, setSalary] = useState(settings.baseSalaryIdr === null ? '' : formatRupiahInput(String(settings.baseSalaryIdr)));
  const [errors, setErrors] = useState<Partial<Record<GajianField, string>>>({});
  const [failure, setFailure] = useState<SettingsWriteFailure | null>(null);
  const busy = update.isPending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = validateGajian({ payday, salary });
    if (!result.ok) {
      setErrors(result.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    try {
      await update.mutateAsync(result.value);
      navigate('/pengaturan', { replace: true });
    } catch (error) {
      // Saving settings sets values (idempotent), so any failure is safe to retry as is.
      setFailure(error instanceof SettingsWriteError ? error.kind : 'network');
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Gajian"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
    >
      <TextField
        label="Tanggal gajian"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        value={payday}
        onChange={(event) => setPayday(event.target.value.replace(/\D/g, ''))}
        error={errors.payday}
        hint={`Isi ${PAYDAY_MIN} sampai ${PAYDAY_MAX}. Siklus berjalan dari tanggal ini sampai sehari sebelum tanggal ini bulan berikutnya.`}
        readOnly={busy}
      />
      <MoneyInput
        label="Gaji pokok bulanan (opsional)"
        value={salary}
        onValueChange={setSalary}
        error={errors.salary}
        hint="Dipakai untuk “Sisa kas setelah cicilan” di Beranda. Kosongkan bila tidak mau dipakai."
        readOnly={busy}
      />
      {failure ? <FormAlert>{SETTINGS_WRITE_MESSAGES[failure]}</FormAlert> : null}
      <Button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  );
}

export function Gajian() {
  const query = useBookSettings();

  return (
    <>
      <ScreenHeader title="Gajian" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {query.isError ? (
          <ErrorState title="Data tidak bisa dimuat." hint="Periksa koneksi, lalu coba lagi." onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <GajianForm settings={query.data} />
        ) : (
          <LoadingRegion>
            <Skeleton className="h-72" />
          </LoadingRegion>
        )}
      </div>
    </>
  );
}
