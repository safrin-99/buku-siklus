import { describe, expect, it } from 'vitest';
import raw from '../data/fixtures.generated.json';
import { fixtureSchema, type InstallmentRow, type PaymentRow } from '../data/schemas';
import {
  debtCaption,
  directionSummary,
  filterDebts,
  homeLists,
  installmentProgress,
  labelPayments,
  segmentPercents,
} from './derive';

const fx = fixtureSchema.parse(raw);
const byName = (name: string) => {
  const d = fx.debts.find((x) => x.name === name);
  if (!d) throw new Error(`fixture tidak punya ${name}`);
  return d;
};

describe('homeLists (Beranda)', () => {
  const lists = homeLists(fx.debts, fx.cycle.cycle_end);
  it('Perlu dibayar: Hendra terlambat; laptop dan koperasi masuk siklus ini, urut jatuh tempo', () => {
    expect(lists.overdue.map((d) => d.name)).toEqual(['dr. Hendra']);
    expect(lists.thisCycle.map((d) => d.name)).toEqual(['Cicilan Laptop', 'Pinjaman Koperasi']);
  });
  it('Perlu ditagih: hanya piutang jatuh tempo hari ini/lewat (Reza), bukan Budi (1 Nov)', () => {
    expect(lists.toCollect.map((d) => d.name)).toEqual(['Reza Firdaus']);
  });
  it('arisan yang lunas tidak muncul', () => {
    const all = [...lists.overdue, ...lists.thisCycle, ...lists.toCollect].map((d) => d.name);
    expect(all).not.toContain('Arisan Bulanan RT 04');
  });
});

describe('segmentPercents', () => {
  it('data kanonik: 5% / 21% / 74%', () => {
    expect(segmentPercents(500000, 2000000, 7000000)).toEqual([5, 21, 74]);
  });
  it('selalu berjumlah 100', () => {
    for (let i = 0; i < 300; i++) {
      const [a, b, c] = [Math.floor(Math.random() * 5e6), Math.floor(Math.random() * 5e6), Math.floor(Math.random() * 5e6)];
      if (a + b + c === 0) continue;
      const p = segmentPercents(a, b, c);
      expect(p[0] + p[1] + p[2]).toBe(100);
    }
  });
  it('nol semua → nol; sisa bebas negatif dianggap 0', () => {
    expect(segmentPercents(0, 0, 0)).toEqual([0, 0, 0]);
    expect(segmentPercents(1000, 3000, -500)).toEqual([25, 75, 0]);
  });
});

describe('debtCaption', () => {
  it('menambahkan "cicilan ke-n/m" hanya bila cicilan lebih dari satu', () => {
    expect(debtCaption(byName('Cicilan Laptop'))).toBe('Home Credit · cicilan ke-4/12');
    expect(debtCaption(byName('Pinjaman Koperasi'))).toBe('Potong gaji · cicilan ke-2/3');
    expect(debtCaption(byName('Reza Firdaus'))).toBe('Tiket kereta');
    expect(debtCaption(byName('Arisan Bulanan RT 04'))).toBe('Siklus Oktober');
  });
});

describe('filterDebts / directionSummary (Catatan)', () => {
  it('tab Utang: 3 aktif, 1 terlambat, 1 lunas', () => {
    const base = { direction: 'owe' as const, query: '' };
    expect(filterDebts(fx.debts, { ...base, filter: 'semua' })).toHaveLength(4);
    expect(filterDebts(fx.debts, { ...base, filter: 'aktif' })).toHaveLength(3);
    expect(filterDebts(fx.debts, { ...base, filter: 'terlambat' }).map((d) => d.name)).toEqual(['dr. Hendra']);
    expect(filterDebts(fx.debts, { ...base, filter: 'lunas' }).map((d) => d.name)).toEqual(['Arisan Bulanan RT 04']);
  });
  it('pencarian mencakup nama dan keterangan, tanpa peduli huruf besar/kecil', () => {
    const base = { direction: 'owe' as const, filter: 'semua' as const };
    expect(filterDebts(fx.debts, { ...base, query: 'LAPTOP' })).toHaveLength(1);
    expect(filterDebts(fx.debts, { ...base, query: 'home credit' })).toHaveLength(1);
    expect(filterDebts(fx.debts, { ...base, query: 'zzz' })).toHaveLength(0);
  });
  it('ringkasan: sisa utang Rp7.600.000 (3 aktif), piutang Rp850.000 (2 aktif)', () => {
    expect(directionSummary(fx.debts, 'owe')).toEqual({ remaining: 7600000, active: 3 });
    expect(directionSummary(fx.debts, 'owed')).toEqual({ remaining: 850000, active: 2 });
  });
});

const inst = (seq: number, amount: number): InstallmentRow => ({
  id: `i${seq}`, debt_id: 'd', seq, due_date: '2026-10-01', amount_idr: amount, is_paid: false, due_remaining_idr: amount,
});
const pay = (id: string, amount: number, extra: Partial<PaymentRow> = {}): PaymentRow => ({
  id, debt_id: 'd', paid_on: '2026-10-01', amount_idr: amount, reference: null, reverses_payment_id: null,
  proof_path: null, note: null, ...extra,
});

describe('labelPayments', () => {
  it('Hendra (data kanonik): Cicilan ke-1 dan ke-2', () => {
    const d = byName('dr. Hendra');
    const labels = labelPayments(
      fx.payments.filter((p) => p.debt_id === d.debt_id),
      fx.installments.filter((i) => i.debt_id === d.debt_id),
    );
    expect([...labels.values()].map((l) => l.title)).toEqual(['Cicilan ke-1', 'Cicilan ke-2']);
  });
  it('cicilan tunggal: lunas penuh = Pelunasan, kurang = Pembayaran sebagian', () => {
    expect(labelPayments([pay('a', 350000)], [inst(1, 350000)]).get('a')?.title).toBe('Pelunasan');
    expect(labelPayments([pay('a', 300000)], [inst(1, 350000)]).get('a')?.title).toBe('Pembayaran sebagian');
  });
  it('satu pembayaran menutup beberapa cicilan = rentang', () => {
    const labels = labelPayments([pay('a', 1200000)], [inst(1, 600000), inst(2, 600000), inst(3, 600000)]);
    expect(labels.get('a')?.title).toBe('Cicilan ke-1–2');
  });
  it('dua pembayaran sebagian lalu menutup cicilan', () => {
    const labels = labelPayments([pay('a', 200000), pay('b', 400000)], [inst(1, 600000), inst(2, 600000)]);
    expect(labels.get('a')?.title).toBe('Pembayaran sebagian');
    expect(labels.get('b')?.title).toBe('Cicilan ke-1');
  });
  it('entri pembalik berlabel Pembalikan dan menggeser hitungan', () => {
    const labels = labelPayments(
      [pay('a', 600000), pay('r', -600000, { reverses_payment_id: 'a' }), pay('b', 600000)],
      [inst(1, 600000), inst(2, 600000)],
    );
    expect(labels.get('r')?.kind).toBe('reversal');
    expect(labels.get('b')?.title).toBe('Cicilan ke-1');
  });
});

describe('installmentProgress', () => {
  it('Hendra: 2 dari 3 cicilan', () => {
    const d = byName('dr. Hendra');
    expect(installmentProgress(fx.installments.filter((i) => i.debt_id === d.debt_id))).toEqual({ paid: 2, total: 3 });
  });
});
