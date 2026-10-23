import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthFailure, classifyAuthError, classifyEmailChangeError } from './authErrors';

export interface AuthUser {
  id: string;
  email: string;
  /** Requested new email that is not confirmed yet (Supabase `new_email`); sign in still uses `email`. */
  pendingEmail: string | null;
}

/**
 * Auth entry point for the UI. `onChange` calls the listener immediately with the current state (stored session or
 * null), then again on every change (sign in, sign out, session revoked).
 */
export interface AuthService {
  readonly kind: 'fixture' | 'supabase';
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /**
   * `local` ends this device's session; it succeeds offline too (the session is removed here, the server is told when
   * reachable). `global` revokes every session of this account first and fails, leaving this device signed in, if that
   * cannot be confirmed. Throws only while this device is still signed in.
   */
  signOut(scope: 'local' | 'global'): Promise<void>;
  /**
   * Checks the current password first, then sets the new one. Supabase Auth then revokes every OTHER session of the
   * account (their refresh tokens); an access token already issued elsewhere stays valid until it expires.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /**
   * Checks the password, then asks Supabase to send confirmation links (to the old and the new address when "Secure
   * email change" is on). The email only changes once the links are opened; `pendingEmail` shows it meanwhile.
   * `redirectTo` must be allowed in the project's Redirect URLs, otherwise links land on the Site URL.
   */
  changeEmail(newEmail: string, password: string, redirectTo: string): Promise<void>;
  /** Fetches the account again (e.g. after a link was opened elsewhere). Never throws; failures are ignored. */
  refreshUser(): Promise<void>;
  /** Revokes the session an email link created (see authLink.ts). Never throws. */
  revokeLinkSession(accessToken: string): Promise<void>;
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  const toUser = (
    user: { id: string; email?: string | undefined; new_email?: string | undefined } | null | undefined,
  ): AuthUser | null => (user ? { id: user.id, email: user.email ?? '', pendingEmail: user.new_email || null } : null);

  // Supabase does not ask for the current password, so a borrowed unlocked phone could change the account. Signing
  // in again proves it (and a failed attempt leaves the current session as it was).
  const verifyPassword = async (password: string): Promise<void> => {
    const { data } = await client.auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new AuthFailure('unknown');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      const kind = classifyAuthError(error);
      throw new AuthFailure(kind === 'invalid_credentials' ? 'wrong_password' : kind);
    }
  };

  return {
    kind: 'supabase',
    onChange(listener) {
      // Do not call supabase APIs inside this callback (can deadlock); the listener only sets state.
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (error) {
        throw new AuthFailure(classifyAuthError(error));
      }
    },
    async signOut(scope) {
      try {
        if (scope === 'global') {
          // supabase-js removes the local session even when /logout fails (e.g. offline), so signOut({ scope: 'global' })
          // could fail while looking like success: this device signed out, every other device still signed in.
          // 'others' never removes the local session; only once it succeeded does this device sign out too.
          const { error } = await client.auth.signOut({ scope: 'others' });
          if (error) throw error;
        }
        const { error } = await client.auth.signOut({ scope: 'local' });
        // A failed /logout still removes the local session; only a session left on this device is a failure.
        if (error && (await client.auth.getSession()).data.session) throw error;
      } catch (error) {
        throw new AuthFailure(classifyAuthError(error));
      }
    },
    async changePassword(currentPassword, newPassword) {
      try {
        await verifyPassword(currentPassword);
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw error;
      } catch (error) {
        throw new AuthFailure(classifyAuthError(error));
      }
    },
    async changeEmail(newEmail, password, redirectTo) {
      try {
        await verifyPassword(password);
        const { error } = await client.auth.updateUser({ email: newEmail }, { emailRedirectTo: redirectTo });
        if (error) throw error;
      } catch (error) {
        throw new AuthFailure(classifyEmailChangeError(error));
      }
    },
    async refreshUser() {
      // A refresh returns the account as stored now (new email, cleared new_email) and notifies onChange. If the
      // session was revoked meanwhile, supabase-js signs out, which is the right outcome too.
      if (!(await client.auth.getSession()).data.session) return;
      await client.auth.refreshSession().catch(() => undefined);
    },
    async revokeLinkSession(accessToken) {
      // POST /logout with that session's own token: needs only the publishable key, touches no other session.
      await client.auth.admin.signOut(accessToken, 'local').catch(() => undefined);
    },
  };
}

/**
 * Fixture mode (`--mode fixture`): "signed in" as a sample user; no account action is real.
 * `?fixture=signedout` starts signed out so the login screen can be inspected.
 */
export function createFixtureAuthService(): AuthService {
  const mode = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('fixture'));
  const startSignedOut = () => mode() === 'signedout';
  // `?fixture=emailpending` shows an email change that waits for confirmation.
  const user = (): AuthUser => ({
    id: 'fixture-user',
    email: 'contoh@buku-siklus.local',
    pendingEmail: mode() === 'emailpending' ? 'baru@buku-siklus.local' : null,
  });
  return {
    kind: 'fixture',
    onChange(listener) {
      listener(startSignedOut() ? null : user());
      return () => undefined;
    },
    // Delayed briefly so the pending state can be inspected, then rejected.
    signIn: () => new Promise((_resolve, reject) => setTimeout(() => reject(new AuthFailure('readonly')), 1200)),
    signOut: () => Promise.reject(new AuthFailure('readonly')),
    changePassword: () => new Promise((_resolve, reject) => setTimeout(() => reject(new AuthFailure('readonly')), 1200)),
    changeEmail: () => new Promise((_resolve, reject) => setTimeout(() => reject(new AuthFailure('readonly')), 1200)),
    refreshUser: () => Promise.resolve(),
    revokeLinkSession: () => Promise.resolve(),
  };
}
