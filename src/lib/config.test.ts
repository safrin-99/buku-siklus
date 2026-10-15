import { describe, expect, it } from 'vitest';
import { checkPublicKey, checkSupabaseUrl, resolveConfig } from './config';

// Fake JWT for tests only: header.payload.signature with a base64url payload.
function jwt(payload: object): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

const URL_OK = 'https://abcdefgh.supabase.co';
const KEY_OK = 'sb_publishable_contoh';

describe('checkPublicKey', () => {
  it('menerima kunci publishable dan JWT anon', () => {
    expect(checkPublicKey(KEY_OK)).toBeNull();
    expect(checkPublicKey(jwt({ role: 'anon' }))).toBeNull();
  });

  it('menolak kunci rahasia, tanpa menyebut nilainya', () => {
    for (const secret of ['sb_secret_rahasiasekali', jwt({ role: 'service_role' })]) {
      const problem = checkPublicKey(secret);
      expect(problem).toMatch(/rahasia|service_role/i);
      expect(problem).not.toContain(secret);
    }
  });

  it('menolak kosong dan format tak dikenal', () => {
    expect(checkPublicKey(undefined)).not.toBeNull();
    expect(checkPublicKey('   ')).not.toBeNull();
    expect(checkPublicKey('abc')).not.toBeNull();
    expect(checkPublicKey(jwt({ role: 'authenticated' }))).not.toBeNull();
    expect(checkPublicKey('a.b.c')).not.toBeNull();
  });
});

describe('checkSupabaseUrl', () => {
  it('menerima https dan http hanya untuk alamat lokal', () => {
    expect(checkSupabaseUrl(URL_OK)).toBeNull();
    expect(checkSupabaseUrl('http://127.0.0.1:54321')).toBeNull();
    expect(checkSupabaseUrl('http://localhost:54321')).toBeNull();
  });

  it('menolak kosong, bukan URL, dan http ke host lain', () => {
    expect(checkSupabaseUrl('')).not.toBeNull();
    expect(checkSupabaseUrl('bukan url')).not.toBeNull();
    expect(checkSupabaseUrl('http://abcdefgh.supabase.co')).not.toBeNull();
  });
});

describe('resolveConfig', () => {
  it('mode contoh hanya bila dipilih eksplisit', () => {
    expect(resolveConfig({ MODE: 'fixture' })).toEqual({ kind: 'fixture' });
  });

  it('build produksi tanpa env gagal keras, bukan jatuh ke data contoh', () => {
    for (const mode of ['production', 'development', undefined]) {
      const cfg = resolveConfig({ MODE: mode });
      expect(cfg.kind).toBe('invalid');
    }
  });

  it('env lengkap menghasilkan konfigurasi Supabase dengan origin bersih', () => {
    expect(
      resolveConfig({
        MODE: 'production',
        VITE_SUPABASE_URL: `${URL_OK}/`,
        VITE_SUPABASE_PUBLISHABLE_KEY: KEY_OK,
      }),
    ).toEqual({ kind: 'supabase', url: URL_OK, publishableKey: KEY_OK });
  });

  it('kunci rahasia di env menghasilkan invalid, bukan dipakai', () => {
    const cfg = resolveConfig({
      MODE: 'production',
      VITE_SUPABASE_URL: URL_OK,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x',
    });
    expect(cfg.kind).toBe('invalid');
  });
});
