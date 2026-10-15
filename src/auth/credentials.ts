// Client-side checks for changing the password. The server has its own minimum (Supabase dashboard, default 6);
// this one is stricter on purpose. Passwords are never trimmed: spaces are valid characters.

export const PASSWORD_MIN_CHARS = 10;
/** bcrypt (used by Supabase Auth) only reads the first 72 bytes; longer passwords are refused instead of cut. */
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordChangeValues {
  current: string;
  next: string;
  confirm: string;
}

export type PasswordChangeField = keyof PasswordChangeValues;

export type PasswordChangeValidation =
  | { ok: true; value: { current: string; next: string } }
  | { ok: false; errors: Partial<Record<PasswordChangeField, string>> };

export function validatePasswordChange(values: PasswordChangeValues): PasswordChangeValidation {
  const errors: Partial<Record<PasswordChangeField, string>> = {};
  const { current, next, confirm } = values;

  if (current === '') errors.current = 'Isi kata sandi saat ini.';

  if ([...next].length < PASSWORD_MIN_CHARS) errors.next = `Kata sandi baru minimal ${PASSWORD_MIN_CHARS} karakter.`;
  else if (new TextEncoder().encode(next).length > PASSWORD_MAX_BYTES) {
    errors.next = 'Kata sandi baru terlalu panjang. Pakai paling banyak 72 karakter.';
  } else if (next === current) errors.next = 'Kata sandi baru harus berbeda dari kata sandi saat ini.';

  if (!errors.next && confirm !== next) errors.confirm = 'Tidak sama dengan kata sandi baru. Ketik ulang dengan persis sama.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { current, next } };
}
