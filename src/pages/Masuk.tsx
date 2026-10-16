import { LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { useAuth } from '../auth/AuthProvider';
import { validateSignIn, type SignInField } from '../auth/credentials';
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

/** The app glyph (same drawing as public/favicon.svg), without its tile: the ink cover is the tile here. */
function Glyph() {
  return (
    // self-start: in the column-flex cover an SVG would otherwise stretch to full width and centre its drawing.
    <svg aria-hidden viewBox="7 7 19 20" className="h-9 w-auto shrink-0 self-start" fill="none">
      <path
        d="M9 9h10a4 4 0 0 1 0 8H9zm0 8h11a4 4 0 0 1 0 8H9z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** While this screen is open, the browser bar takes the ink colour of the cover (read from the token, no hex here). */
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

/**
 * Sign-in screen (DESIGN.md section 11, item 16). Phone: an ink "cover" at least 40% of the small viewport height
 * (grows only if its content needs more), then the white page with the form at its top. Space left over sits under
 * the form, so a message that appears there pushes nothing above it. From 768px: cover on the left, form on the right.
 */
export function Masuk() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<SignInField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const [pending, setPending] = useState(false);
  // Set synchronously, so a second tap or Enter is ignored even before React re-renders with pending = true.
  const inFlight = useRef(false);
  useInkBrowserBar();

  if (state.status === 'signedIn') return <Navigate to={targetAfterLogin(location.state)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const result = validateSignIn({ email, password });
    if (!result.ok) {
      setErrors(result.errors);
      setFailure(null);
      (result.errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setErrors({});
    if (!navigator.onLine) {
      setFailure(AUTH_MESSAGES.offline);
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      await signIn(result.value.email, result.value.password);
      // Success: the session change triggers the redirect above.
    } catch (error) {
      setFailure(error instanceof AuthFailure ? error.message : AUTH_MESSAGES.unknown);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'));
  // Typing in a field clears that field's message (the other one stays until it is fixed).
  const clearError = (field: SignInField) =>
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  return (
    <div className="flex min-h-dvh flex-col bg-primary">
      <OfflineBanner />
      <div className="flex flex-1 flex-col md:flex-row">
        {/* The cover of the ledger book: glyph at the top, the name set large at the bottom. Its height follows the
            viewport (svh: the URL bar showing or hiding does not resize it), never the leftover space. */}
        <header className="flex min-h-[40svh] flex-none flex-col justify-between gap-8 px-6 pb-10 pt-[calc(1.75rem+env(safe-area-inset-top))] text-on-ink md:min-h-0 md:basis-5/12 md:p-12 lg:p-16">
          <Glyph />
          {/* Larger on tall phones, where the cover is tall too; same size from 768px. */}
          <p className="text-brand font-bold [@media(min-height:760px)]:text-brand-lg md:text-brand-lg">
            Buku
            <br />
            Siklus
          </p>
        </header>

        {/* The page: rounded top edge over the cover on phones, a plain white half from 768px. The form is aligned to a
            fixed offset from the top (slightly above centre) rather than centred, so a message appearing below it does
            not re-centre and move the whole block. */}
        <main className="flex-1 rounded-t-sheet bg-surface px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 md:flex md:justify-center md:rounded-none md:px-12 md:pb-12 md:pt-[max(3rem,18svh)]">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-title font-bold md:text-display">Masuk</h1>
            <p className="mt-1 text-body text-ink-2">Gunakan email dan kata sandi akun kamu.</p>

            <form onSubmit={(event) => void onSubmit(event)} noValidate aria-label="Masuk" className="mt-7 flex flex-col gap-5">
              <TextField
                ref={emailRef}
                label="Email"
                leading={<Mail size={20} />}
                type="email"
                inputMode="email"
                enterKeyHint="next"
                // "username" (not "email") tells password managers this is the login identifier paired with
                // current-password; the field still takes an email address.
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearError('email');
                }}
                error={errors.email}
                readOnly={pending}
              />
              <PasswordField
                ref={passwordRef}
                label="Kata sandi"
                leading={<LockKeyhole size={20} />}
                enterKeyHint="go"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError('password');
                }}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
                onBlur={() => setCapsLock(false)}
                error={errors.password}
                hint={capsLock ? 'Caps Lock aktif.' : undefined}
                readOnly={pending}
              />
              {/* Directly under the fields, not pinned to the bottom: Chrome on Android does not shrink the layout
                  when the keyboard opens, so a bottom-pinned button would sit behind the keyboard. While signing in it
                  stays focusable (aria-disabled, not disabled) so keyboard focus is not dropped; onSubmit ignores
                  presses while pending, so a second tap or Enter sends nothing. */}
              <div className="pt-1">
                <Button type="submit" aria-disabled={pending} aria-busy={pending}>
                  {pending ? (
                    <>
                      <LoaderCircle aria-hidden size={20} className="motion-safe:animate-spin" />
                      Memproses…
                    </>
                  ) : (
                    'Masuk'
                  )}
                </Button>
              </div>
              {/* Under the button, where the eye already is after tapping it; nothing above moves when it appears. */}
              {failure ? <FormAlert>{failure}</FormAlert> : null}
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
