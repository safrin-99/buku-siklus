import { describe, expect, it } from 'vitest';
import { validateEmailChange, validatePasswordChange } from './credentials';

const ok = { current: 'sandi-lama-123', next: 'sandi-baru-456', confirm: 'sandi-baru-456' };

describe('validatePasswordChange', () => {
  it('lolos: mengembalikan sandi lama dan baru apa adanya (tanpa trim)', () => {
    expect(validatePasswordChange(ok)).toEqual({ ok: true, value: { current: ok.current, next: ok.next } });
    const spaced = { current: ' lama ', next: '  baru dengan spasi  ', confirm: '  baru dengan spasi  ' };
    expect(validatePasswordChange(spaced)).toEqual({ ok: true, value: { current: ' lama ', next: '  baru dengan spasi  ' } });
  });

  it('kosong semua: sandi lama dan sandi baru ditandai; ulangan tidak ikut ditandai selama sandi baru salah', () => {
    const result = validatePasswordChange({ current: '', next: '', confirm: '' });
    expect(result).toEqual({
      ok: false,
      errors: { current: 'Isi kata sandi saat ini.', next: 'Kata sandi baru minimal 10 karakter.' },
    });
  });

  it('minimal 10 karakter dihitung per karakter, bukan per byte', () => {
    expect(validatePasswordChange({ ...ok, next: '123456789', confirm: '123456789' }).ok).toBe(false);
    expect(validatePasswordChange({ ...ok, next: '1234567890', confirm: '1234567890' }).ok).toBe(true);
    // 10 accented characters = 20 bytes: still exactly 10 characters.
    expect(validatePasswordChange({ ...ok, next: 'éééééééééé', confirm: 'éééééééééé' }).ok).toBe(true);
  });

  it('lebih dari 72 byte ditolak (batas bcrypt), 72 byte masih boleh', () => {
    const max = 'a'.repeat(72);
    expect(validatePasswordChange({ ...ok, next: max, confirm: max }).ok).toBe(true);
    const tooLong = 'a'.repeat(73);
    expect(validatePasswordChange({ ...ok, next: tooLong, confirm: tooLong })).toMatchObject({
      ok: false,
      errors: { next: 'Kata sandi baru terlalu panjang. Pakai paling banyak 72 karakter.' },
    });
    const accented = 'é'.repeat(37); // 37 characters, 74 bytes
    expect(validatePasswordChange({ ...ok, next: accented, confirm: accented }).ok).toBe(false);
  });

  it('sandi baru sama dengan sandi lama ditolak', () => {
    expect(validatePasswordChange({ current: ok.next, next: ok.next, confirm: ok.next })).toMatchObject({
      ok: false,
      errors: { next: 'Kata sandi baru harus berbeda dari kata sandi saat ini.' },
    });
  });

  it('ulangan berbeda (termasuk beda spasi di ujung) ditolak', () => {
    expect(validatePasswordChange({ ...ok, confirm: 'sandi-baru-457' })).toMatchObject({
      ok: false,
      errors: { confirm: 'Tidak sama dengan kata sandi baru. Ketik ulang dengan persis sama.' },
    });
    expect(validatePasswordChange({ ...ok, confirm: `${ok.next} ` }).ok).toBe(false);
  });
});

describe('validateEmailChange', () => {
  const current = 'pemilik@contoh.id';

  it('lolos: email baru dirapikan (spasi, huruf kecil), sandi apa adanya', () => {
    expect(validateEmailChange({ newEmail: '  Baru@Contoh.ID ', password: ' sandi ' }, current)).toEqual({
      ok: true,
      value: { newEmail: 'baru@contoh.id', password: ' sandi ' },
    });
  });

  it('kosong semua', () => {
    expect(validateEmailChange({ newEmail: ' ', password: '' }, current)).toEqual({
      ok: false,
      errors: { newEmail: 'Isi email baru.', password: 'Isi kata sandi untuk memastikan ini kamu.' },
    });
  });

  it('bentuk jelas salah ditolak sebelum email dikirim', () => {
    for (const bad of ['bukan-email', 'a@b', 'a b@c.id', '@contoh.id', 'nama@']) {
      expect(validateEmailChange({ newEmail: bad, password: 'x' }, current)).toMatchObject({
        ok: false,
        errors: { newEmail: 'Alamat email tidak valid. Contoh: nama@gmail.com.' },
      });
    }
  });

  it('sama dengan email sekarang (beda huruf besar pun) ditolak', () => {
    expect(validateEmailChange({ newEmail: 'PEMILIK@contoh.id', password: 'x' }, current)).toMatchObject({
      ok: false,
      errors: { newEmail: 'Ini email yang sedang dipakai.' },
    });
  });
});
