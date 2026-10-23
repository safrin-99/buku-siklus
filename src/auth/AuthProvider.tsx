import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthService, AuthUser } from './authService';
import { signOutMark } from './signOutMark';

/**
 * `byUser`: the user chose to sign out in this tab (Keluar). Then no screen from before is a destination after the next
 * sign in. Otherwise (no session yet, expired, revoked from another device) the screen asked for is kept.
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; byUser: boolean }
  | { status: 'signedIn'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  /**
   * Throws AuthFailure only while this device is still signed in. The data cache is cleared after a successful sign out.
   * The next sign in in this tab starts at Beranda, not at the screen the user signed out from.
   */
  signOut(scope: 'local' | 'global'): Promise<void>;
  /** Throws AuthFailure (wrong_password, weak_password, same_password, …). */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Throws AuthFailure (wrong_password, email_taken, email_send_failed, …). Links come back to /pengaturan/email. */
  changeEmail(newEmail: string, password: string): Promise<void>;
  refreshUser(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // True only while signOut runs: supabase-js reports SIGNED_OUT before its signOut call resolves.
  const signingOut = useRef(false);

  useEffect(() => {
    return service.onChange((user) => {
      if (user) signOutMark.clear();
      setState(user ? { status: 'signedIn', user } : { status: 'signedOut', byUser: signingOut.current || signOutMark.has() });
      // Financial data must not linger in memory after sign out (including a session revoked from another device).
      if (!user) queryClient.clear();
    });
  }, [service, queryClient]);

  const signIn = useCallback((email: string, password: string) => service.signIn(email, password), [service]);

  const signOut = useCallback(
    async (scope: 'local' | 'global') => {
      signingOut.current = true;
      // Stored before the call, so it survives the reload below (and a reload of /masuk afterwards).
      signOutMark.set();
      try {
        await service.signOut(scope);
      } catch (error) {
        // The service only fails while this device is still signed in: nothing to remember.
        signOutMark.clear();
        throw error;
      } finally {
        signingOut.current = false;
      }
      queryClient.clear();
      // Full reload so no app state is left in memory after revoking every session.
      if (scope === 'global') window.location.replace('/masuk');
    },
    [service, queryClient],
  );

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) => service.changePassword(currentPassword, newPassword),
    [service],
  );

  const changeEmail = useCallback(
    (newEmail: string, password: string) =>
      service.changeEmail(newEmail, password, `${window.location.origin}/pengaturan/email`),
    [service],
  );

  const refreshUser = useCallback(() => service.refreshUser(), [service]);

  const value = useMemo(
    () => ({ state, signIn, signOut, changePassword, changeEmail, refreshUser }),
    [state, signIn, signOut, changePassword, changeEmail, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return value;
}
