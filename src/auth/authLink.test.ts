import { describe, expect, it } from 'vitest';
import { addressWithoutAuthLink, isEmailLinkNotice, parseAuthLink } from './authLink';

// Fragments copied from real local GoTrue redirects (tokens shortened).
const PARTIAL = '#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email&sb=';
const DONE =
  '#access_token=eyJ.a.b&expires_at=1792059246&expires_in=3600&refresh_token=r3fr35h&sb=&token_type=bearer&type=email_change';
const EXPIRED = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';

describe('parseAuthLink', () => {
  it('tautan pertama dari dua: sebagian, tanpa token', () => {
    expect(parseAuthLink(PARTIAL)).toEqual({ notice: 'sebagian', accessToken: null });
  });

  it('tautan terakhir: selesai, token sesi diambil hanya untuk dicabut', () => {
    expect(parseAuthLink(DONE)).toEqual({ notice: 'selesai', accessToken: 'eyJ.a.b' });
  });

  it('tautan kedaluwarsa atau tidak berlaku: gagal', () => {
    expect(parseAuthLink(EXPIRED)).toEqual({ notice: 'gagal', accessToken: null });
  });

  it('token dari alur lain (bukan email_change): tetap dibuang dan dicabut, tanpa pemberitahuan', () => {
    expect(parseAuthLink('#access_token=x&refresh_token=y&type=magiclink')).toEqual({ notice: null, accessToken: 'x' });
    expect(parseAuthLink('#refresh_token=y')).toEqual({ notice: null, accessToken: null });
  });

  it('fragmen biasa atau kosong bukan urusan auth', () => {
    expect(parseAuthLink('')).toBeNull();
    expect(parseAuthLink('#')).toBeNull();
    expect(parseAuthLink('#riwayat')).toBeNull();
  });
});

describe('addressWithoutAuthLink', () => {
  it('membuang fragmen beserta token, menyisakan ?konfirmasi=', () => {
    const href = `http://localhost:5173/pengaturan/email${DONE}`;
    const address = addressWithoutAuthLink(href, parseAuthLink(DONE)!);
    expect(address).toBe('/pengaturan/email?konfirmasi=selesai');
    expect(address).not.toMatch(/token/);
  });

  it('mempertahankan query lain; tanpa pemberitahuan tidak menambah apa pun', () => {
    expect(addressWithoutAuthLink('http://x.test/a?b=1#refresh_token=y', { notice: null, accessToken: null })).toBe('/a?b=1');
  });
});

describe('isEmailLinkNotice', () => {
  it('hanya tiga nilai yang dikenal', () => {
    expect(isEmailLinkNotice('selesai')).toBe(true);
    expect(isEmailLinkNotice('apa-saja')).toBe(false);
    expect(isEmailLinkNotice(null)).toBe(false);
  });
});
