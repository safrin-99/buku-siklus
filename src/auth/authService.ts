import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthFailure, classifyAuthError } from './authErrors';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Auth entry point for the UI. `onChange` calls the listener immediately with the current state (stored session or
 * null), then again on every change (sign in, sign out, session revoked).
 */
export interface AuthService {
  readonly kind: 'fixture' | 'supabase';
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** `global` revokes every session of this account on every device. */
  signOut(scope: 'local' | 'global'): Promise<void>;
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  const toUser = (user: { id: string; email?: string | undefined } | null | undefined): AuthUser | null =>
    user ? { id: user.id, email: user.email ?? '' } : null;

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
        const { error } = await client.auth.signOut({ scope });
        if (error) throw error;
      } catch (error) {
        throw new AuthFailure(classifyAuthError(error));
      }
    },
  };
}

/**
 * Fixture mode (`--mode fixture`): "signed in" as a sample user; no account action is real.
 * `?fixture=signedout` starts signed out so the login screen can be inspected.
 */
export function createFixtureAuthService(): AuthService {
  const user: AuthUser = { id: 'fixture-user', email: 'contoh@buku-siklus.local' };
  const startSignedOut = () =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fixture') === 'signedout';
  return {
    kind: 'fixture',
    onChange(listener) {
      listener(startSignedOut() ? null : user);
      return () => undefined;
    },
    // Delayed briefly so the pending state can be inspected, then rejected.
    signIn: () => new Promise((_resolve, reject) => setTimeout(() => reject(new AuthFailure('readonly')), 1200)),
    signOut: () => Promise.reject(new AuthFailure('readonly')),
  };
}
