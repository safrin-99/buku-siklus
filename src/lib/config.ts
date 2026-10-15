// Environment configuration. Pure functions: env is an argument so this is testable and usable from vite.config.ts.
//
// Rules:
// - Fixture mode is active ONLY when chosen explicitly (`vite --mode fixture`). A normal build without Supabase
//   keys must fail loudly instead of silently showing sample data as if it were real.
// - Only public keys (publishable / anon) may reach the bundle. Secret keys (secret / service_role) are rejected,
//   because VITE_* variables are inlined into the JavaScript served to every visitor.

export interface EnvLike {
  MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export type AppConfig =
  | { kind: 'fixture' }
  | { kind: 'supabase'; url: string; publishableKey: string }
  | { kind: 'invalid'; problems: string[] };

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Returns a problem description (never the key value itself) or null when the key is safe for the client. */
export function checkPublicKey(key: string | undefined): string | null {
  const value = (key ?? '').trim();
  if (!value) return 'VITE_SUPABASE_PUBLISHABLE_KEY kosong.';
  if (value.startsWith('sb_secret_')) {
    return 'VITE_SUPABASE_PUBLISHABLE_KEY berisi kunci RAHASIA (sb_secret_). Pakai kunci publishable.';
  }
  if (value.startsWith('sb_publishable_')) return null;
  const payload = decodeJwtPayload(value);
  if (payload) {
    if (payload.role === 'service_role') {
      return 'VITE_SUPABASE_PUBLISHABLE_KEY berisi kunci service_role. Pakai kunci publishable atau anon.';
    }
    if (payload.role === 'anon') return null;
  }
  return 'VITE_SUPABASE_PUBLISHABLE_KEY tidak dikenali. Pakai kunci publishable (sb_publishable_…) atau kunci anon.';
}

/** Returns a problem description or null. https only, except local addresses for `supabase start`. */
export function checkSupabaseUrl(url: string | undefined): string | null {
  const value = (url ?? '').trim();
  if (!value) return 'VITE_SUPABASE_URL kosong.';
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'VITE_SUPABASE_URL bukan alamat yang valid.';
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local)) return null;
  return 'VITE_SUPABASE_URL harus https (http hanya untuk localhost).';
}

export function resolveConfig(env: EnvLike): AppConfig {
  if (env.MODE === 'fixture') return { kind: 'fixture' };

  const problems = [checkSupabaseUrl(env.VITE_SUPABASE_URL), checkPublicKey(env.VITE_SUPABASE_PUBLISHABLE_KEY)].filter(
    (p): p is string => p !== null,
  );
  if (problems.length > 0) return { kind: 'invalid', problems };

  return {
    kind: 'supabase',
    url: new URL((env.VITE_SUPABASE_URL ?? '').trim()).origin,
    publishableKey: (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim(),
  };
}
