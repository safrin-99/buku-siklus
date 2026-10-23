import { CircleCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { useAuth } from '../auth/AuthProvider';
import { PASSWORD_MIN_CHARS, validatePasswordChange, type PasswordChangeField } from '../auth/credentials';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button, buttonClass } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { PasswordField } from '../components/ui/PasswordField';

export function KataSandi() {
  const { state, changePassword } = useAuth();
  const email = state.status === 'signedIn' ? state.user.email : '';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<PasswordChangeField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = validatePasswordChange({ current, next, confirm });
    if (!result.ok) {
      setErrors(result.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    if (!navigator.onLine) {
      setFailure(AUTH_MESSAGES.offline);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await changePassword(result.value.current, result.value.next);
      setDone(true);
    } catch (error) {
      const kind = error instanceof AuthFailure ? error.kind : 'unknown';
      if (kind === 'wrong_password') setErrors({ current: AUTH_MESSAGES.wrong_password });
      else setFailure(AUTH_MESSAGES[kind]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Ganti kata sandi" back settings={false} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {done ? (
          <div role="status" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
            <p className="flex items-start gap-2 text-body font-semibold">
              <CircleCheck aria-hidden size={20} className="mt-0.5 shrink-0" />
              Kata sandi sudah diganti.
            </p>
            <p className="text-body text-ink-2">
              Perangkat ini tetap masuk. Perangkat lain yang masuk dengan akun ini akan diminta masuk lagi, paling lama
              setelah 1 jam.
            </p>
            <Link to="/pengaturan" replace className={buttonClass('secondary')}>
              Kembali ke Pengaturan
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(event) => void onSubmit(event)}
            noValidate
            aria-label="Ganti kata sandi"
            className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
          >
            {/* Lets password managers file the new password under the right account. */}
            <input type="email" autoComplete="username" value={email} readOnly hidden />
            <PasswordField
              label="Kata sandi saat ini"
              autoComplete="current-password"
              enterKeyHint="next"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              error={errors.current}
              readOnly={busy}
            />
            <PasswordField
              label="Kata sandi baru"
              autoComplete="new-password"
              enterKeyHint="next"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              error={errors.next}
              hint={`Minimal ${PASSWORD_MIN_CHARS} karakter. Kalimat pendek lebih mudah diingat dan sulit ditebak.`}
              readOnly={busy}
            />
            <PasswordField
              label="Ulangi kata sandi baru"
              revealName="ulangan kata sandi baru"
              autoComplete="new-password"
              enterKeyHint="go"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={errors.confirm}
              readOnly={busy}
            />
            {failure ? <FormAlert>{failure}</FormAlert> : null}
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Memproses…' : 'Ganti kata sandi'}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
