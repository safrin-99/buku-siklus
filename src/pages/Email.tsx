import { CircleCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { isEmailLinkNotice, type EmailLinkNotice } from '../auth/authLink';
import { useAuth } from '../auth/AuthProvider';
import { validateEmailChange, type EmailChangeField } from '../auth/credentials';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { PasswordField } from '../components/ui/PasswordField';
import { TextField } from '../components/ui/TextField';

/** Result of an email link that brought the owner here (set by main.tsx, see auth/authLink.ts). */
function LinkNotice({ notice }: { notice: EmailLinkNotice }) {
  if (notice === 'gagal') {
    return <FormAlert>Tautan itu tidak berlaku atau sudah kedaluwarsa. Kirim tautan baru lewat formulir di bawah.</FormAlert>;
  }
  return (
    <div role="status" className="flex items-start gap-2 rounded-input bg-surface-inset p-3 text-body text-ink">
      <CircleCheck aria-hidden size={20} className="mt-0.5 shrink-0" />
      <p className="min-w-0 break-words">
        {notice === 'selesai'
          ? // No address here: until the account is fetched again, the session still holds the old one.
            'Email sudah diganti. Masuk berikutnya memakai email baru.'
          : 'Tautan pertama diterima. Buka juga tautan yang dikirim ke alamat satunya.'}
      </p>
    </div>
  );
}

export function Email() {
  const { state, changeEmail, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const raw = params.get('konfirmasi');
  const notice = isEmailLinkNotice(raw) ? raw : null;
  const user = state.status === 'signedIn' ? state.user : null;
  const email = user?.email ?? '';
  const pending = user?.pendingEmail ?? null;

  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<EmailChangeField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A link may have been opened in another tab or on another device: fetch the account again when this screen
  // opens and whenever it comes back into view, as long as there is something to wait for.
  const waiting = pending !== null || notice !== null;
  useEffect(() => {
    if (!waiting) return;
    void refreshUser();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshUser();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [waiting, refreshUser]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = validateEmailChange({ newEmail, password }, email);
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
      await changeEmail(result.value.newEmail, result.value.password);
      // Success shows up as `pendingEmail` (Supabase reports the updated account).
      setNewEmail('');
      setPassword('');
    } catch (error) {
      const kind = error instanceof AuthFailure ? error.kind : 'unknown';
      if (kind === 'wrong_password') setErrors({ password: AUTH_MESSAGES.wrong_password });
      else if (kind === 'email_taken' || kind === 'email_invalid') setErrors({ newEmail: AUTH_MESSAGES[kind] });
      else setFailure(AUTH_MESSAGES[kind]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Ganti email" back settings={false} />
      <div className="flex flex-col gap-4 px-4 pb-6">
        {notice ? <LinkNotice notice={notice} /> : null}

        <section aria-label="Email saat ini" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <div>
            <p className="text-caption text-ink-2">Email saat ini (dipakai untuk masuk)</p>
            <p className="break-all text-body font-semibold">{email}</p>
          </div>
          {pending ? (
            <div role="status" className="flex flex-col gap-1 border-t border-border pt-3">
              <p className="text-caption text-ink-2">Menunggu konfirmasi</p>
              <p className="break-all text-body font-semibold">{pending}</p>
              <p className="text-caption text-ink-2">
                Buka tautan yang dikirim ke kedua alamat. Email baru berlaku setelah keduanya dibuka; sampai saat itu, masuk
                tetap memakai email saat ini. Tidak ada di kotak masuk? Periksa folder spam, atau kirim ulang lewat formulir di
                bawah.
              </p>
            </div>
          ) : null}
        </section>

        <form
          onSubmit={(event) => void onSubmit(event)}
          noValidate
          aria-label="Ganti email"
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
        >
          <TextField
            label="Email baru"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            error={errors.newEmail}
            readOnly={busy}
          />
          <PasswordField
            label="Kata sandi"
            autoComplete="current-password"
            enterKeyHint="go"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint="Untuk memastikan ini kamu."
            readOnly={busy}
          />
          {failure ? <FormAlert>{failure}</FormAlert> : null}
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Mengirim…' : 'Kirim tautan konfirmasi'}
          </Button>
        </form>
      </div>
    </>
  );
}
