import { describe, expect, it } from 'vitest';
import {
  formatLongDate,
  formatMonth,
  installmentTone,
  isMonthKey,
  monthGrid,
  monthRange,
  paydayIn,
  shiftMonth,
  tonesByDate,
} from './calendar';

describe('bulan', () => {
  it('geser bulan lintas tahun', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });

  it('rentang bulan termasuk Februari kabisat', () => {
    expect(monthRange('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthRange('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
  });

  it('format dan validasi kunci bulan dari URL', () => {
    expect(formatMonth('2026-10')).toBe('Oktober 2026');
    expect(formatLongDate('2026-10-15')).toBe('Kamis, 15 Oktober 2026');
    expect(isMonthKey('2026-10')).toBe(true);
    for (const bad of [null, '2026-13', '2026-1', 'oktober', '1999-12', '2026-00']) expect(isMonthKey(bad)).toBe(false);
  });
});

describe('monthGrid', () => {
  it('Oktober 2026 mulai Kamis: 4 sel kosong di depan (Minggu pertama), 5 minggu', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks.at(-1)?.slice(0, 7)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('Februari 2026 mulai Minggu dan pas 4 minggu; Agustus 2026 butuh 6 minggu', () => {
    expect(monthGrid('2026-02')).toHaveLength(4);
    expect(monthGrid('2026-02')[0]?.[0]).toBe('2026-02-01');
    expect(monthGrid('2026-08')).toHaveLength(6);
  });

  it('tanggal gajian di bulan itu', () => {
    expect(paydayIn('2026-11', 1)).toBe('2026-11-01');
    expect(paydayIn('2026-02', 28)).toBe('2026-02-28');
  });
});

describe('status per cicilan (aturan debt_list)', () => {
  const today = '2026-10-15';
  it('lunas, terlambat, dekat (0–3 hari), aktif', () => {
    expect(installmentTone({ dueDate: '2026-10-11', isPaid: true }, today)).toBe('paid');
    expect(installmentTone({ dueDate: '2026-10-11', isPaid: false }, today)).toBe('overdue');
    expect(installmentTone({ dueDate: '2026-10-15', isPaid: false }, today)).toBe('due');
    expect(installmentTone({ dueDate: '2026-10-18', isPaid: false }, today)).toBe('due');
    expect(installmentTone({ dueDate: '2026-10-19', isPaid: false }, today)).toBe('neutral');
  });

  it('beberapa cicilan di tanggal yang sama: satu titik per status, paling mendesak dulu', () => {
    const tones = tonesByDate(
      [
        { dueDate: '2026-10-25', isPaid: false },
        { dueDate: '2026-10-25', isPaid: true },
        { dueDate: '2026-10-11', isPaid: false },
        { dueDate: '2026-10-25', isPaid: false },
      ],
      today,
    );
    expect(tones.get('2026-10-25')).toEqual(['neutral', 'paid']);
    expect(tones.get('2026-10-11')).toEqual(['overdue']);
    expect(tones.has('2026-10-12')).toBe(false);
  });
});

describe('chip agenda', () => {
  it('kata-katanya sama dengan chip catatan', async () => {
    const { installmentChip } = await import('./calendar');
    expect(installmentChip({ dueDate: '2026-10-11', isPaid: false }, '2026-10-15')).toEqual({ tone: 'overdue', label: 'Terlambat 4 hari' });
    expect(installmentChip({ dueDate: '2026-10-15', isPaid: false }, '2026-10-15')).toEqual({ tone: 'due', label: 'Hari ini' });
    expect(installmentChip({ dueDate: '2026-10-25', isPaid: false }, '2026-10-15')).toEqual({ tone: 'neutral', label: '10 hari lagi' });
    expect(installmentChip({ dueDate: '2026-10-12', isPaid: true }, '2026-10-15')).toEqual({ tone: 'paid', label: 'Lunas' });
  });
});
