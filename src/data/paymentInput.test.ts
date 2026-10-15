import { describe, expect, it } from 'vitest';
import { validatePayment, validateReason, type PaymentFormValues } from './paymentInput';

const ctx = { remaining: 600_000, today: '2026-10-15' };
const form = (over: Partial<PaymentFormValues> = {}): PaymentFormValues => ({
  amount: '250.000',
  paidOn: '2026-10-15',
  reference: '',
  note: '',
  ...over,
});

describe('validatePayment', () => {
  it('nilai valid → nominal bulat, referensi dan catatan kosong menjadi null', () => {
    expect(validatePayment(form(), ctx)).toEqual({
      ok: true,
      value: { amountIdr: 250_000, paidOn: '2026-10-15', reference: null, note: null },
    });
  });

  it('teks di-trim; sisa persis boleh dibayar lunas', () => {
    const result = validatePayment(form({ amount: '600.000', reference: '  MBCA-1  ', note: ' lunas ' }), ctx);
    expect(result).toEqual({
      ok: true,
      value: { amountIdr: 600_000, paidOn: '2026-10-15', reference: 'MBCA-1', note: 'lunas' },
    });
  });

  it('nominal: kosong, nol, desimal, dan melebihi sisa ditolak dengan pesan yang menunjuk perbaikannya', () => {
    const msg = (amount: string) => {
      const r = validatePayment(form({ amount }), ctx);
      return r.ok ? null : r.errors.amount;
    };
    expect(msg('')).toMatch(/Masukkan nominal/);
    expect(msg('abc')).toMatch(/Masukkan nominal/);
    expect(msg('1,5')).toMatch(/Masukkan nominal/);
    expect(msg('0')).toBe('Nominal harus lebih dari Rp0.');
    expect(msg('600.001')).toBe('Nominal melebihi sisa (Rp600.000).');
    expect(msg('9007199254740993')).toMatch(/Masukkan nominal/);
  });

  it('tanggal: tidak boleh setelah hari ini, tidak valid, atau terlalu lama; hari ini dan kemarin boleh', () => {
    const msg = (paidOn: string) => {
      const r = validatePayment(form({ paidOn }), ctx);
      return r.ok ? null : r.errors.paidOn;
    };
    expect(msg('2026-10-15')).toBeNull();
    expect(msg('2026-10-14')).toBeNull();
    expect(msg('2026-10-16')).toBe('Tanggal tidak boleh setelah hari ini.');
    expect(msg('2030-01-01')).toBe('Tanggal tidak boleh setelah hari ini.');
    expect(msg('')).toBe('Pilih tanggal yang valid.');
    expect(msg('2026-02-30')).toBe('Pilih tanggal yang valid.');
    expect(msg('bukan tanggal')).toBe('Pilih tanggal yang valid.');
    expect(msg('1926-10-15')).toBe('Tanggal terlalu lama. Periksa tahunnya.');
    // Tahun 0000-0099 (salah ketik umum pada input tanggal) sudah ditolak parseIso sebagai tanggal yang tidak ada.
    expect(msg('0026-10-15')).toBe('Pilih tanggal yang valid.');
  });

  it('referensi dan catatan dibatasi panjangnya', () => {
    const r = validatePayment(form({ reference: 'x'.repeat(61), note: 'y'.repeat(201) }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.reference).toBe('Maksimal 60 karakter.');
      expect(r.errors.note).toBe('Maksimal 200 karakter.');
    }
    expect(validatePayment(form({ reference: 'x'.repeat(60), note: 'y'.repeat(200) }), ctx).ok).toBe(true);
  });

  it('semua galat dilaporkan sekaligus, bukan satu per satu', () => {
    const r = validatePayment(form({ amount: '', paidOn: '2099-01-01', reference: 'x'.repeat(99) }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['amount', 'paidOn', 'reference']);
  });
});

describe('validateReason', () => {
  it('kosong → null; di-trim; terlalu panjang ditolak', () => {
    expect(validateReason('')).toEqual({ ok: true, value: null });
    expect(validateReason('  salah ketik  ')).toEqual({ ok: true, value: 'salah ketik' });
    expect(validateReason('z'.repeat(201))).toEqual({ ok: false, error: 'Maksimal 200 karakter.' });
  });
});
