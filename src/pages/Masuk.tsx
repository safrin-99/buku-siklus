import { LockKeyhole, Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { useAuth } from '../auth/AuthProvider';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { PasswordField } from '../components/ui/PasswordField';
import { TextField } from '../components/ui/TextField';

/** Destination after sign in: internal app paths only (never an external address). */
function targetAfterLogin(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/masuk')
    ? from
    : '/';
}

/** The app glyph (same drawing as public/favicon.svg), without its tile: the ink band is the tile here. */
function Glyph() {
  return (
    <svg aria-hidden viewBox="7 7 19 20" className="h-6 w-auto" fill="none">
      <path
        d="M9 9h10a4 4 0 0 1 0 8H9zm0 8h11a4 4 0 0 1 0 8H9z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** While this screen is open, the browser bar takes the ink colour of the band (read from the token, no hex here). */
function useInkBrowserBar() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    if (ink) meta.content = ink;
    return () => {
      meta.content = previous;
    };
  }, []);
}

export function Masuk() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useInkBrowserBar();

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
    <div className="flex min-h-dvh flex-col bg-primary">
      <OfflineBanner />
      {/* Ink band like the cover of a ledger book; the form sits on the white page below it. */}
      <header className="mx-auto w-full max-w-app px-4 pb-12 pt-[calc(1.5rem+env(safe-area-inset-top))] text-on-ink sm:pt-16">
        <p className="flex items-center gap-2.5 text-body font-semibold">
          <Glyph />
          Buku Siklus
        </p>
        <h1 className="mt-14 text-display font-bold">Masuk</h1>
      </header>

      <main className="flex-1 rounded-t-sheet bg-surface">
        <form
          onSubmit={(event) => void onSubmit(event)}
          noValidate
          aria-label="Masuk"
          className="mx-auto flex max-w-app flex-col gap-5 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8"
        >
          <TextField
            label="Email"
            variant="filled"
            leading={<Mail size={20} />}
            type="email"
            inputMode="email"
            enterKeyHint="next"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordField
            label="Kata sandi"
            variant="filled"
            leading={<LockKeyhole size={20} />}
            enterKeyHint="go"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <FormAlert>{error}</FormAlert> : null}
          {/* Directly under the fields, not pinned to the bottom: Chrome on Android does not shrink the layout when the
              keyboard opens, so a bottom-pinned button would sit behind the keyboard. */}
          <div className="pt-1">
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? 'Memproses…' : 'Masuk'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
