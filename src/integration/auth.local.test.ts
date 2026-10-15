// Auth against a real local GoTrue. Needs `supabase start`; run with `pnpm test:local`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, AuthFailure } from '../auth/authErrors';
import { createSupabaseAuthService, type AuthUser } from '../auth/authService';
import {
  TEST_PASSWORD,
  adminClient,
  appClient,
  createOwner,
  readLocalStack,
  uniqueEmail,
  type LocalStack,
} from './stack';

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

describe('pendaftaran publik', () => {
  it('ditolak: orang asing tidak bisa membuat akun sendiri', async () => {
    const { data, error } = await appClient(stack).auth.signUp({ email: uniqueEmail('asing'), password: TEST_PASSWORD });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
    expect(data.session).toBeNull();
  });

  it('masuk anonim juga ditolak', async () => {
    const { data, error } = await appClient(stack).auth.signInAnonymously();
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});

describe('masuk', () => {
  it('berhasil dengan akun yang dibuat admin, dan listener menerima pengguna', async () => {
    const email = uniqueEmail('pemilik');
    await createOwner(admin, email);
    const service = createSupabaseAuthService(appClient(stack));
    const seen: Array<AuthUser | null> = [];
    const stop = service.onChange((user) => seen.push(user));

    await service.signIn(email, TEST_PASSWORD);
    await expect.poll(() => seen.at(-1)?.email).toBe(email);
    stop();
  });

  it('sandi salah dan email tidak terdaftar menghasilkan pesan yang sama (tanpa membocorkan email)', async () => {
    const email = uniqueEmail('pemilik');
    await createOwner(admin, email);
    const service = createSupabaseAuthService(appClient(stack));

    const wrongPassword = await failureOf(service.signIn(email, 'sandi-yang-salah'));
    const unknownEmail = await failureOf(service.signIn(uniqueEmail('tidak-ada'), TEST_PASSWORD));
    expect(wrongPassword.kind).toBe('invalid_credentials');
    expect(unknownEmail.kind).toBe('invalid_credentials');
    expect(wrongPassword.message).toBe(unknownEmail.message);
    expect(wrongPassword.message).toBe(AUTH_MESSAGES.invalid_credentials);
  });

  it('server tidak terjangkau dipetakan ke offline', async () => {
    const service = createSupabaseAuthService(appClient(stack, 'http://127.0.0.1:1'));
    const failure = await failureOf(service.signIn('x@uji.local', TEST_PASSWORD));
    expect(failure.kind).toBe('offline');
  });
});

describe('keluar', () => {
  it('local: listener menerima null', async () => {
    const email = uniqueEmail('pemilik');
    await createOwner(admin, email);
    const service = createSupabaseAuthService(appClient(stack));
    const seen: Array<AuthUser | null> = [];
    const stop = service.onChange((user) => seen.push(user));
    await service.signIn(email, TEST_PASSWORD);
    await expect.poll(() => seen.at(-1)?.email).toBe(email);

    await service.signOut('local');
    await expect.poll(() => seen.at(-1)).toBeNull();
    stop();
  });

  it('global: mencabut sesi di perangkat lain (refresh token tidak berlaku lagi)', async () => {
    const email = uniqueEmail('pemilik');
    await createOwner(admin, email);
    const phone = appClient(stack);
    const laptop = appClient(stack);
    await createSupabaseAuthService(phone).signIn(email, TEST_PASSWORD);
    await createSupabaseAuthService(laptop).signIn(email, TEST_PASSWORD);
    expect((await laptop.auth.getSession()).data.session).not.toBeNull();

    await createSupabaseAuthService(phone).signOut('global');

    const refreshed = await laptop.auth.refreshSession();
    expect(refreshed.error).not.toBeNull();
    expect(refreshed.data.session).toBeNull();
  });

  it('batasan JWT: setelah sesi dicabut, GoTrue menolak token lama tetapi REST masih menerimanya sampai kedaluwarsa', async () => {
    const email = uniqueEmail('pemilik');
    await createOwner(admin, email);
    const phone = appClient(stack);
    await createSupabaseAuthService(phone).signIn(email, TEST_PASSWORD);
    const stolen = (await phone.auth.getSession()).data.session;
    expect(stolen).not.toBeNull();
    const token = stolen!.access_token;
    const asThief = (path: string) =>
      fetch(`${stack.apiUrl}${path}`, { headers: { apikey: stack.publishableKey, Authorization: `Bearer ${token}` } });

    // Before revocation: the token is accepted as an authenticated user.
    expect((await asThief('/rest/v1/books?select=id&limit=1')).status).toBe(200);

    await createSupabaseAuthService(phone).signOut('global');

    // GoTrue checks the session, so the old token is rejected there...
    expect((await asThief('/auth/v1/user')).status).toBeGreaterThanOrEqual(400);
    // ...but PostgREST only checks the signature and expiry. This is why the JWT expiry should be shortened
    // in the dashboard: the theft window equals the token's remaining lifetime.
    expect((await asThief('/rest/v1/books?select=id&limit=1')).status).toBe(200);
  });
});
