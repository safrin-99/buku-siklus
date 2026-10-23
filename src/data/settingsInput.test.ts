import { describe, expect, it } from 'vitest';
import { validateGajian } from './settingsInput';

describe('validateGajian', () => {
  it('nilai valid → angka bulat; gaji kosong = tidak dipakai (null)', () => {
    expect(validateGajian({ payday: '1', salary: '9.500.000' })).toEqual({ ok: true, value: { paydayDay: 1, baseSalaryIdr: 9_500_000 } });
    expect(validateGajian({ payday: '25', salary: '' })).toEqual({ ok: true, value: { paydayDay: 25, baseSalaryIdr: null } });
    expect(validateGajian({ payday: ' 28 ', salary: '  ' })).toEqual({ ok: true, value: { paydayDay: 28, baseSalaryIdr: null } });
  });

  it('tanggal gajian di luar 1–28 atau bukan angka bulat ditolak (batas sama dengan constraint database)', () => {
    for (const bad of ['', '0', '29', '31', '-1', '1.5', 'abc', '100', '01x']) {
      const r = validateGajian({ payday: bad, salary: '' });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      if (!r.ok) expect(r.errors.payday).toBe('Isi tanggal antara 1 dan 28.');
    }
    expect(validateGajian({ payday: '01', salary: '' }).ok).toBe(true);
  });

  it('gaji pokok: format salah, nol, dan di luar rentang aman ditolak', () => {
    const msg = (salary: string) => {
      const r = validateGajian({ payday: '1', salary });
      return r.ok ? null : r.errors.salary;
    };
    expect(msg('abc')).toMatch(/Masukkan gaji pokok/);
    expect(msg('9,5')).toMatch(/Masukkan gaji pokok/);
    expect(msg('-100')).toMatch(/Masukkan gaji pokok/);
    expect(msg('0')).toMatch(/lebih dari Rp0/);
    expect(msg('9007199254740993')).toMatch(/Masukkan gaji pokok/);
  });

  it('kedua galat dilaporkan sekaligus', () => {
    const r = validateGajian({ payday: '40', salary: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['payday', 'salary']);
  });
});
