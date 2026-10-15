import { describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, AuthFailure, classifyAuthError } from './authErrors';

describe('classifyAuthError', () => {
  it('kredensial salah (kode baru dan pesan lama)', () => {
    expect(classifyAuthError({ name: 'AuthApiError', status: 400, code: 'invalid_credentials' })).toBe('invalid_credentials');
    expect(classifyAuthError({ status: 400, message: 'Invalid login credentials' })).toBe('invalid_credentials');
  });

  it('email belum dikonfirmasi', () => {
    expect(classifyAuthError({ status: 400, code: 'email_not_confirmed' })).toBe('unconfirmed');
    expect(classifyAuthError({ message: 'Email not confirmed' })).toBe('unconfirmed');
  });

  it('dibatasi laju: status 429 atau kode batas', () => {
    expect(classifyAuthError({ status: 429 })).toBe('rate_limited');
    expect(classifyAuthError({ code: 'over_request_rate_limit' })).toBe('rate_limited');
  });

  it('jaringan putus', () => {
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toBe('offline');
    expect(classifyAuthError({ message: 'TypeError: Failed to fetch' })).toBe('offline');
  });

  it('selain itu unknown, termasuk nilai bukan objek', () => {
    expect(classifyAuthError({ status: 500, message: 'boom' })).toBe('unknown');
    expect(classifyAuthError('teks')).toBe('unknown');
    expect(classifyAuthError(null)).toBe('unknown');
    expect(classifyAuthError(undefined)).toBe('unknown');
  });

  it('AuthFailure mempertahankan jenisnya', () => {
    expect(classifyAuthError(new AuthFailure('readonly'))).toBe('readonly');
  });
});

describe('pesan', () => {
  it('email salah dan sandi salah tidak dibedakan', () => {
    expect(AUTH_MESSAGES.invalid_credentials).toBe('Email atau kata sandi salah.');
    expect(AUTH_MESSAGES.invalid_credentials).not.toMatch(/tidak terdaftar|tidak ditemukan|belum terdaftar/i);
  });

  it('semua jenis punya pesan non-kosong tanpa kata "Anda"', () => {
    for (const message of Object.values(AUTH_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/\bAnda\b/);
    }
  });

  it('AuthFailure membawa pesan sesuai jenis', () => {
    expect(new AuthFailure('offline').message).toBe(AUTH_MESSAGES.offline);
  });
});
