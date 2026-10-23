// Helpers for integration tests against LOCAL Supabase. Keys are read from `supabase status` while the tests run
// (never stored in a file). Refuses any non-local address: these tests create users and write ledger rows
// that cannot be deleted, so they must never touch the real project.
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface LocalStack {
  apiUrl: string;
  publishableKey: string;
  adminKey: string;
  /** Mailpit (catches every email the local stack sends). Empty when `supabase status` does not report it. */
  mailUrl: string;
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
  return { apiUrl, publishableKey, adminKey, mailUrl: env.get('MAILPIT_URL') ?? env.get('INBUCKET_URL') ?? '' };
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

interface MailpitList {
  messages: Array<{ ID: string }>;
}

function mailpitUrl(stack: LocalStack): string {
  const host = stack.mailUrl ? new URL(stack.mailUrl).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Mailpit tidak menyala. Jalankan `supabase start` tanpa mengecualikan mailpit, lalu ulangi.');
  }
  return stack.mailUrl.replace(/\/$/, '');
}

/** Number of emails Mailpit holds for `to`. */
export async function mailCount(stack: LocalStack, to: string): Promise<number> {
  const response = await fetch(`${mailpitUrl(stack)}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return ((await response.json()) as MailpitList).messages.length;
}

/** The Supabase Auth confirmation link (`/auth/v1/verify?...`) of the newest email to `to`; waits up to 10 s. */
export async function confirmationLink(stack: LocalStack, to: string): Promise<string> {
  const base = mailpitUrl(stack);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const list = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()) as MailpitList;
    const newest = list.messages[0];
    if (newest) {
      const message = (await (await fetch(`${base}/api/v1/message/${newest.ID}`)).json()) as { HTML: string };
      const link = [...message.HTML.matchAll(/href="([^"]+)"/g)]
        .map((match) => (match[1] ?? '').replace(/&amp;/g, '&'))
        .find((href) => href.includes('/auth/v1/verify'));
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Tidak ada email konfirmasi untuk ${to}.`);
}

/** Opens an email link like a browser would, without following the redirect; returns where it redirects to. */
export async function openLink(link: string): Promise<URL> {
  const response = await fetch(link, { redirect: 'manual' });
  const location = response.headers.get('location');
  if (!location) throw new Error(`Tautan tidak mengalihkan (status ${response.status}).`);
  return new URL(location);
}
