// Helpers for integration tests against LOCAL Supabase. Keys are read from `supabase status` while the tests run
// (never stored in a file). Refuses any non-local address: these tests create users and write ledger rows
// that cannot be deleted, so they must never touch the real project.
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface LocalStack {
  apiUrl: string;
  publishableKey: string;
  adminKey: string;
}

export function readLocalStack(): LocalStack {
  let raw: string;
  try {
    raw = execFileSync('npx', ['--yes', 'supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('Supabase lokal tidak menyala. Jalankan `supabase start` dulu, lalu ulangi `pnpm test:local`.');
  }
  const env = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) env.set(match[1], match[2]);
  }
  const apiUrl = env.get('API_URL') ?? '';
  const publishableKey = env.get('PUBLISHABLE_KEY') ?? env.get('ANON_KEY') ?? '';
  const adminKey = env.get('SERVICE_ROLE_KEY') ?? env.get('SECRET_KEY') ?? '';
  const host = apiUrl ? new URL(apiUrl).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Uji integrasi hanya boleh berjalan terhadap Supabase lokal (127.0.0.1).');
  }
  if (!publishableKey || !adminKey) throw new Error('Kunci Supabase lokal tidak ditemukan di `supabase status`.');
  return { apiUrl, publishableKey, adminKey };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

/** Client as the app uses it: publishable key, no session storage (Node has no localStorage). */
export function appClient(stack: LocalStack, url: string = stack.apiUrl): SupabaseClient {
  return createClient(url, stack.publishableKey, noSession);
}

/** App client whose HTTP layer is wrapped, to inject faults such as a lost response (see payments.local.test.ts). */
export function appClientWithFetch(stack: LocalStack, wrap: (real: typeof fetch) => typeof fetch): SupabaseClient {
  return createClient(stack.apiUrl, stack.publishableKey, { ...noSession, global: { fetch: wrap(fetch) } });
}

/** Admin client (only for preparing test accounts; never present in the app). */
export function adminClient(stack: LocalStack): SupabaseClient {
  return createClient(stack.apiUrl, stack.adminKey, noSession);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@uji.local`;
}

export const TEST_PASSWORD = 'kata-sandi-uji-1234';

/** Creates a new (confirmed) owner via admin, because public sign-up is deliberately off. */
export async function createOwner(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`Gagal membuat pengguna uji: ${error?.message ?? 'tanpa data'}`);
  return data.user;
}
