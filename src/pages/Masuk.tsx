import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { useAuth } from '../auth/AuthProvider';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { TextField } from '../components/ui/TextField';

/** Destination after sign in: internal app paths only (never an external address). */
function targetAfterLogin(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/masuk')
    ? from
    : '/';
}

export function Masuk() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'signedIn') return <Navigate to={targetAfterLogin(location.state)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim() || !password) {
      setError('Isi email dan kata sandi.');
      return;
    }
    if (!navigator.onLine) {
      setError(AUTH_MESSAGES.offline);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // Success: the session change triggers the redirect above.
    } catch (failure) {
      setError(failure instanceof AuthFailure ? failure.message : AUTH_MESSAGES.unknown);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Masuk" settings={false} />
      <div className="px-4 pb-6">
        <form
          onSubmit={(event) => void onSubmit(event)}
          noValidate
          aria-label="Masuk"
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
        >
          <p className="text-body text-ink-2">Masuk dengan akun pemilik buku.</p>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Kata sandi"
            type={reveal ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            trailing={
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                aria-label={reveal ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={reveal}
                className="grid size-12 place-items-center text-ink-2"
              >
                {reveal ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
              </button>
            }
          />
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </>
  );
}
