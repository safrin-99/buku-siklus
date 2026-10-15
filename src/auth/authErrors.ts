// Login errors are mapped to a fixed kind + an Indonesian message. The message is deliberately generic for a wrong
// email and a wrong password, so it cannot be used to guess which emails are registered. Nothing is logged here.

export type AuthFailureKind =
  | 'invalid_credentials'
  | 'wrong_password'
  | 'weak_password'
  | 'same_password'
  | 'email_taken'
  | 'email_invalid'
  | 'email_not_authorized'
  | 'email_send_failed'
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
  email_taken: 'Email ini sudah dipakai akun lain. Pakai email lain.',
  email_invalid: 'Alamat email ditolak server karena formatnya tidak valid. Periksa penulisannya.',
  email_not_authorized:
    'Pengirim email bawaan Supabase hanya boleh mengirim ke anggota tim proyek. Pasang SMTP sendiri di dashboard Supabase (Authentication > Emails > SMTP Settings), lalu coba lagi.',
  email_send_failed: 'Email konfirmasi gagal dikirim. Periksa pengaturan SMTP proyek Supabase, lalu coba lagi.',
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

/**
 * Errors of the email-change request. Checked before classifyAuthError because a failed send comes back as
 * AuthRetryableFetchError with status 500 ("Error sending email change email"), which would otherwise read "offline".
 */
export function classifyEmailChangeError(error: unknown): AuthFailureKind {
  if (typeof error === 'object' && error !== null && !(error instanceof AuthFailure)) {
    const e = error as ErrorLike;
    const code = typeof e.code === 'string' ? e.code : '';
    const status = typeof e.status === 'number' ? e.status : undefined;
    if (code === 'email_exists') return 'email_taken';
    if (code === 'email_address_invalid' || code === 'validation_failed') return 'email_invalid';
    if (code === 'email_address_not_authorized') return 'email_not_authorized';
    if (status !== undefined && status >= 500) return 'email_send_failed';
  }
  return classifyAuthError(error);
}
