import { describe, expect, it } from 'vitest';
import { validateDebtDetails, validateNewDebt, type NewDebtFormValues } from './debtInput';

const base: NewDebtFormValues = {
  direction: 'owe',
  name: 'Motor',
  amount: '3.000.000',
  schedule: 'sekali',
  dueDate: '2026-11-25',
  count: '',
  description: '',
  category: '',
  memo: '',
};

describe('validateNewDebt', () => {
  it('utang sekali bayar: satu cicilan sebesar total, teks opsional kosong = null', () => {
    expect(validateNewDebt(base)).toEqual({
      ok: true,
      value: {
        direction: 'owe',
        name: 'Motor',
        totalIdr: 3_000_000,
        installments: [{ dueDate: '2026-11-25', amountIdr: 3_000_000 }],
        description: null,
        category: null,
        memo: null,
      },
    });
  });

  it('piutang dengan cicilan bulanan: jadwal dibangun dari tanggal pertama, nama dirapikan', () => {
    const result = validateNewDebt({ ...base, direction: 'owed', name: '  Budi  ', amount: '1000000', schedule: 'cicilan', count: '3', description: ' Modal ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.direction).toBe('owed');
    expect(result.value.name).toBe('Budi');
    expect(result.value.description).toBe('Modal');
    expect(result.value.installments.map((i) => i.amountIdr)).toEqual([333_333, 333_333, 333_334]);
    expect(result.value.installments.map((i) => i.dueDate)).toEqual(['2026-11-25', '2026-12-25', '2027-01-25']);
  });

  it('kolom wajib kosong: tiap kolom punya pesannya sendiri', () => {
    expect(validateNewDebt({ ...base, name: ' ', amount: '', dueDate: '' })).toEqual({
      ok: false,
      errors: { name: 'Isi nama orang atau pihaknya.', amount: 'Isi nominalnya.', dueDate: 'Isi tanggal jatuh tempo.' },
    });
  });

  it('nominal: bukan angka, nol, dan desimal ditolak', () => {
    expect(validateNewDebt({ ...base, amount: 'seribu' })).toMatchObject({ ok: false, errors: { amount: 'Masukkan nominal dalam Rupiah, mis. 1.500.000.' } });
    expect(validateNewDebt({ ...base, amount: '0' })).toMatchObject({ ok: false, errors: { amount: 'Nominal harus lebih dari Rp0.' } });
    expect(validateNewDebt({ ...base, amount: '1.500,50' }).ok).toBe(false);
  });

  it('tanggal: tidak ada di kalender atau di luar 2000–2100 ditolak; tanggal lampau boleh (utang lama yang dicatat belakangan)', () => {
    expect(validateNewDebt({ ...base, dueDate: '2026-02-30' })).toMatchObject({ ok: false, errors: { dueDate: 'Tanggal tidak valid.' } });
    expect(validateNewDebt({ ...base, dueDate: '0026-11-25' })).toMatchObject({ ok: false, errors: { dueDate: 'Tanggal harus antara tahun 2000 dan 2100.' } });
    expect(validateNewDebt({ ...base, dueDate: '2025-01-10' }).ok).toBe(true);
  });

  it('jumlah cicilan: 2–120, bilangan bulat, dan tidak lebih dari nominal', () => {
    for (const count of ['', '1', '121', '2.5', 'dua']) {
      expect(validateNewDebt({ ...base, schedule: 'cicilan', count })).toMatchObject({ ok: false, errors: { count: 'Isi jumlah cicilan antara 2 dan 120.' } });
    }
    expect(validateNewDebt({ ...base, schedule: 'cicilan', amount: '5', count: '10' })).toMatchObject({
      ok: false,
      errors: { count: 'Nominal terlalu kecil untuk dibagi 10 cicilan.' },
    });
    // Jumlah cicilan diabaikan untuk sekali bayar.
    expect(validateNewDebt({ ...base, schedule: 'sekali', count: 'apa saja' }).ok).toBe(true);
  });

  it('batas panjang teks sama dengan batas database', () => {
    expect(validateNewDebt({ ...base, name: 'x'.repeat(81) })).toMatchObject({ ok: false, errors: { name: 'Nama paling banyak 80 karakter.' } });
    expect(validateNewDebt({ ...base, description: 'x'.repeat(201) })).toMatchObject({ ok: false, errors: { description: 'Paling banyak 200 karakter.' } });
    expect(validateNewDebt({ ...base, category: 'x'.repeat(41) })).toMatchObject({ ok: false, errors: { category: 'Paling banyak 40 karakter.' } });
    expect(validateNewDebt({ ...base, memo: 'x'.repeat(2001) })).toMatchObject({ ok: false, errors: { memo: 'Paling banyak 2000 karakter.' } });
    expect(validateNewDebt({ ...base, name: 'x'.repeat(80), memo: 'x'.repeat(2000) }).ok).toBe(true);
  });
});

describe('validateDebtDetails', () => {
  it('hanya teks; kosong menjadi null kecuali nama yang wajib', () => {
    expect(validateDebtDetails({ name: ' dr. Hendra ', description: '', category: ' Pribadi ', memo: '' })).toEqual({
      ok: true,
      value: { name: 'dr. Hendra', description: null, category: 'Pribadi', memo: null },
    });
    expect(validateDebtDetails({ name: '', description: '', category: '', memo: 'x'.repeat(2001) })).toEqual({
      ok: false,
      errors: { name: 'Isi nama orang atau pihaknya.', memo: 'Paling banyak 2000 karakter.' },
    });
  });
});
