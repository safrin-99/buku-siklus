// Login errors are mapped to a fixed kind + an Indonesian message. The message is deliberately generic for a wrong
// email and a wrong password, so it cannot be used to guess which emails are registered. Nothing is logged here.

export type AuthFailureKind =
  | 'invalid_credentials'
  | 'wrong_password'
  | 'weak_password'
  | 'same_password'
  | 'unconfirmed'
  | 'rate_limited'
  | 'offline'
  | 'readonly'
  | 'unknown';

export const AUTH_MESSAGES: Record<AuthFailureKind, string> = {
  invalid_credentials: 'Email atau kata sandi salah.',
  // Only after signing in: the owner already proved who they are, so naming the wrong field leaks nothing.
  wrong_password: 'Kata sandi saat ini salah.',
  weak_password: 'Server menolak kata sandi baru karena terlalu lemah atau terlalu umum. Pakai kata sandi lain yang lebih panjang.',
  same_password: 'Kata sandi baru sama dengan yang sekarang. Pakai kata sandi lain.',
  unconfirmed: 'Email belum dikonfirmasi. Konfirmasi akun lewat dashboard Supabase, lalu coba lagi.',
  rate_limited: 'Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.',
  offline: 'Tidak tersambung ke server. Periksa koneksi, lalu coba lagi.',
  readonly: 'Mode contoh: tindakan ini tidak tersedia.',
  unknown: 'Tidak bisa menyelesaikan permintaan. Coba lagi sebentar lagi.',
};

export class AuthFailure extends Error {
  readonly kind: AuthFailureKind;
  constructor(kind: AuthFailureKind) {
    super(AUTH_MESSAGES[kind]);
    this.name = 'AuthFailure';
    this.kind = kind;
  }
}

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

/** Accepts an error from supabase-js (AuthError) or any similar object. */
export function classifyAuthError(error: unknown): AuthFailureKind {
  if (error instanceof AuthFailure) return error.kind;
  if (typeof error !== 'object' || error === null) return 'unknown';
  const e = error as ErrorLike;
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : undefined;
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'invalid_credentials';
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'unconfirmed';
  if (code === 'weak_password') return 'weak_password';
  if (code === 'same_password') return 'same_password';
  if (status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return 'rate_limited';
  }
  if (e.name === 'AuthRetryableFetchError' || status === 0 || message.includes('failed to fetch')) return 'offline';
  return 'unknown';
}
