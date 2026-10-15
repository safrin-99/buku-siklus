import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthService, AuthUser } from './authService';

export type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  /** Throws AuthFailure on failure. The data cache is cleared after a successful sign out. */
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

  useEffect(() => {
    return service.onChange((user) => {
      setState(user ? { status: 'signedIn', user } : { status: 'signedOut' });
      // Financial data must not linger in memory after sign out (including a session revoked from another device).
      if (!user) queryClient.clear();
    });
  }, [service, queryClient]);

  const signIn = useCallback((email: string, password: string) => service.signIn(email, password), [service]);

  const signOut = useCallback(
    async (scope: 'local' | 'global') => {
      await service.signOut(scope);
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
