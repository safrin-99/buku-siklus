import { useState } from 'react';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { useAuth } from '../auth/AuthProvider';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { SectionTitle } from '../components/ui/SectionTitle';

/** Only the Account section is built so far (DESIGN.md section 7.7); the rest is stated honestly below. */
export function Pengaturan() {
  const { state, signOut } = useAuth();
  const [confirmGlobal, setConfirmGlobal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = state.status === 'signedIn' ? state.user.email : '';

  async function run(scope: 'local' | 'global') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signOut(scope);
    } catch (failure) {
      setError(failure instanceof AuthFailure ? failure.message : AUTH_MESSAGES.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Pengaturan" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        <section aria-label="Akun">
          <SectionTitle>Akun</SectionTitle>
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
            <div>
              <p className="text-caption text-ink-2">Masuk sebagai</p>
              <p className="break-all text-body font-semibold">{email}</p>
            </div>
            {error ? <FormAlert>{error}</FormAlert> : null}
            <Button variant="secondary" disabled={busy} onClick={() => void run('local')}>
              Keluar
            </Button>
            {confirmGlobal ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-body">
                  Semua perangkat yang masuk dengan akun ini akan keluar, termasuk perangkat ini. Kamu perlu masuk lagi di
                  tiap perangkat.
                </p>
                <Button variant="destructive" disabled={busy} onClick={() => void run('global')}>
                  Keluar dari semua perangkat
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmGlobal(false)}>
                  Batal
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmGlobal(true)}>
                Keluar dari semua perangkat
              </Button>
            )}
          </div>
        </section>
        <p className="text-caption text-ink-2">Pengaturan lain belum dibangun.</p>
      </div>
    </>
  );
}
