import { describe, expect, it } from 'vitest';
import raw from './fixtures.generated.json';
import { daysBetween } from '../lib/dates';
import { fixtureSchema } from './schemas';

const fx = fixtureSchema.parse(raw);

describe('fixture dari SQL asli = data kanonik DESIGN.md bagian 9', () => {
  it('ringkasan siklus', () => {
    expect(fx.today).toBe('2026-10-15');
    expect(fx.cycle).toMatchObject({
      cycle_start: '2026-10-01',
      cycle_end: '2026-10-31',
      next_payday: '2026-11-01',
      days_to_payday: 17,
      base_salary_idr: 9_500_000,
      obligations_idr: 2_500_000,
      paid_idr: 500_000,
      unpaid_idr: 2_000_000,
      free_idr: 7_000_000,
      total_owe_remaining_idr: 7_600_000,
      total_owed_remaining_idr: 850_000,
      overdue_count: 1,
    });
    expect(fx.inbox_pending).toBe(3);
  });

  it('sisa = total − terbayar untuk semua catatan', () => {
    for (const d of fx.debts) expect(d.remaining_idr).toBe(d.total_idr - d.paid_idr);
  });

  it('jumlah cicilan = total, dan pembayaran di ledger = terbayar', () => {
    for (const d of fx.debts) {
      const instSum = fx.installments.filter((i) => i.debt_id === d.debt_id).reduce((s, i) => s + i.amount_idr, 0);
      const paySum = fx.payments.filter((p) => p.debt_id === d.debt_id).reduce((s, p) => s + p.amount_idr, 0);
      expect(instSum).toBe(d.total_idr);
      expect(paySum).toBe(d.paid_idr);
    }
  });

  it('days_to_due dari SQL konsisten dengan hitungan tanggal di TypeScript', () => {
    for (const d of fx.debts) {
      if (d.next_due_date === null) expect(d.days_to_due).toBeNull();
      else expect(d.days_to_due).toBe(daysBetween(fx.today, d.next_due_date));
    }
  });

  it('status konsisten dengan aturan: terlambat < 0, dekat 0..3, lunas bila sisa 0', () => {
    for (const d of fx.debts) {
      if (d.remaining_idr === 0) expect(d.status).toBe('paid');
      else if ((d.days_to_due ?? 99) < 0) expect(d.status).toBe('overdue');
      else if ((d.days_to_due ?? 99) <= 3) expect(d.status).toBe('due_soon');
      else expect(d.status).toBe('active');
    }
  });
});
