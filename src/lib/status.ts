import type { DebtStatus } from '../data/schemas';

export type ChipTone = 'overdue' | 'due' | 'paid' | 'neutral';

export interface ChipSpec {
  tone: ChipTone;
  label: string;
}

/**
 * Status dihitung di SQL (`debt_list.status`); di sini hanya dipetakan ke tampilan chip.
 * Aturan warna (DESIGN.md bagian 2): merah = terlambat, amber = jatuh tempo ≤ 3 hari, hijau = lunas.
 */
export function chipFor(status: DebtStatus, daysToDue: number | null): ChipSpec {
  switch (status) {
    case 'paid':
      return { tone: 'paid', label: 'Lunas' };
    case 'overdue':
      return { tone: 'overdue', label: `Terlambat ${Math.abs(daysToDue ?? 0)} hari` };
    case 'due_soon':
      return { tone: 'due', label: daysToDue === 0 ? 'Hari ini' : `${daysToDue ?? 0} hari lagi` };
    case 'active':
      return { tone: 'neutral', label: daysToDue === null ? 'Aktif' : `${daysToDue} hari lagi` };
  }
}

export type ProgressTone = 'ink' | 'paid' | 'overdue';

export function progressToneFor(status: DebtStatus): ProgressTone {
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'overdue';
  return 'ink';
}
