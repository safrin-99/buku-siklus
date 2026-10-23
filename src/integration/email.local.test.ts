// Email change against a real local GoTrue + Mailpit (every email is caught there). Needs `supabase start` WITH
// mailpit; run with `pnpm test:local`. config.toml has enable_confirmations = true like a hosted project, which is
// what makes GoTrue ask for both links (old and new address).
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthFailure } from '../auth/authErrors';
import { parseAuthLink } from '../auth/authLink';
import { createSupabaseAuthService, type AuthService, type AuthUser } from '../auth/authService';
import {
  TEST_PASSWORD,
  adminClient,
  appClient,
  appClientWithFetch,
  confirmationLink,
  createOwner,
  mailCount,
  openLink,
  readLocalStack,
  uniqueEmail,
  type LocalStack,
} from './stack';

const REDIRECT = 'http://127.0.0.1:4174/pengaturan/email';

let stack: LocalStack;
let admin: SupabaseClient;

beforeAll(() => {
  stack = readLocalStack();
  admin = adminClient(stack);
});

async function failureOf(promise: Promise<unknown>): Promise<AuthFailure> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AuthFailure) return error;
    throw error;
  }
  throw new Error('Seharusnya gagal, tetapi berhasil.');
}

async function canSignIn(email: string): Promise<boolean> {
  const { error } = await appClient(stack).auth.signInWithPassword({ email, password: TEST_PASSWORD });
  return error === null;
}

/** A signed-in owner whose auth state changes are recorded, like AuthProvider receives them. */
async function owner(client: SupabaseClient = appClient(stack)) {
  const email = uniqueEmail('lama');
  await createOwner(admin, email);
  const service: AuthService = createSupabaseAuthService(client);
  const seen: Array<AuthUser | null> = [];
  service.onChange((user) => seen.push(user));
  await service.signIn(email, TEST_PASSWORD);
  await expect.poll(() => seen.at(-1)?.email).toBe(email);
  return { email, client, service, last: () => seen.at(-1) };
}

describe('ganti email', () => {
  it('alur lengkap: dua tautan, email baru berlaku, sesi dari tautan dicabut, sesi perangkat ini bertahan', async () => {
    const { email, client, service, last } = await owner();
    const newEmail = uniqueEmail('baru');

    await service.changeEmail(newEmail, TEST_PASSWORD, REDIRECT);
    await expect.poll(() => last()?.pendingEmail).toBe(newEmail);
    expect(last()?.email).toBe(email);

    // First link (old address): accepted, but the change still waits for the other one.
    const first = await openLink(await confirmationLink(stack, email));
    expect(`${first.origin}${first.pathname}`).toBe(REDIRECT);
    expect(parseAuthLink(first.hash)).toEqual({ notice: 'sebagian', accessToken: null });
    await service.refreshUser();
    expect(last()).toMatchObject({ email, pendingEmail: newEmail });
    expect(await canSignIn(email)).toBe(true);

    // Second link (new address): done. The redirect carries a brand-new session in the fragment.
    const second = await openLink(await confirmationLink(stack, newEmail));
    const link = parseAuthLink(second.hash);
    expect(link?.notice).toBe('selesai');
    expect(link?.accessToken).toBeTruthy();
    const linkRefreshToken = new URLSearchParams(second.hash.slice(1)).get('refresh_token');
    expect(linkRefreshToken).toBeTruthy();

    // This device learns about it on the next refresh.
    await service.refreshUser();
    await expect.poll(() => last()?.email).toBe(newEmail);
    expect(last()?.pendingEmail).toBeNull();
    expect(await canSignIn(newEmail)).toBe(true);
    expect(await canSignIn(email)).toBe(false);

    // The app never uses the link's session: it revokes it, and only it.
    await service.revokeLinkSession(link!.accessToken!);
    const reuse = await appClient(stack).auth.refreshSession({ refresh_token: linkRefreshToken! });
    expect(reuse.error?.code).toBe('refresh_token_not_found');
    expect((await client.auth.getUser()).data.user?.email).toBe(newEmail);
  });

  it('kata sandi salah: tidak ada email terkirim, tidak ada yang menunggu', async () => {
    const { service, last } = await owner();
    const newEmail = uniqueEmail('baru');
    expect((await failureOf(service.changeEmail(newEmail, 'bukan-sandinya', REDIRECT))).kind).toBe('wrong_password');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await mailCount(stack, newEmail)).toBe(0);
    expect(last()?.pendingEmail).toBeNull();
  });

  it('email sudah dipakai akun lain: email_taken', async () => {
    const taken = uniqueEmail('terpakai');
    await createOwner(admin, taken);
    const { service, last } = await owner();
    expect((await failureOf(service.changeEmail(taken, TEST_PASSWORD, REDIRECT))).kind).toBe('email_taken');
    expect(last()?.pendingEmail).toBeNull();
  });

  it('format ditolak server: email_invalid', async () => {
    const { service } = await owner();
    expect((await failureOf(service.changeEmail('bukan-email', TEST_PASSWORD, REDIRECT))).kind).toBe('email_invalid');
  });

  it('pengiriman email gagal (respons GoTrue saat SMTP mati, disuntikkan): email_send_failed, bukan offline', async () => {
    // Body and status as local GoTrue answers when its SMTP server is down (observed with Mailpit stopped).
    const client = appClientWithFetch(stack, (real) => async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      // The request carries ?redirect_to=…, so compare the path only.
      if (new URL(url).pathname === '/auth/v1/user' && init?.method === 'PUT') {
        const body = JSON.stringify({ code: 500, error_code: 'unexpected_failure', msg: 'Error sending email change email' });
        return new Response(body, { status: 500, headers: { 'content-type': 'application/json' } });
      }
      return real(input, init);
    });
    const { service } = await owner(client);
    expect((await failureOf(service.changeEmail(uniqueEmail('baru'), TEST_PASSWORD, REDIRECT))).kind).toBe('email_send_failed');
  });

  it('server tidak terjangkau: offline', async () => {
    let online = true;
    const client = appClientWithFetch(stack, (real) => (input, init) =>
      online ? real(input, init) : Promise.reject(new TypeError('Failed to fetch')),
    );
    const { service } = await owner(client);
    online = false;
    expect((await failureOf(service.changeEmail(uniqueEmail('baru'), TEST_PASSWORD, REDIRECT))).kind).toBe('offline');
  });
});
