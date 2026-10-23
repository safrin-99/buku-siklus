// Month grid and per-day status for the Kalender screen. Dates are ISO strings in the book's time zone (no Date
// objects for business dates, see dates.ts). Status rules are the ones debt_list uses in SQL, applied per installment.
import type { ChipTone } from './status';
import { daysBetween, parseIso } from './dates';

const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;
const DAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
/** Indonesian calendars start on Sunday (CLDR first day of week for ID). */
export const WEEKDAY_HEADERS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10` */
export type MonthKey = string;

export function monthOf(iso: string): MonthKey {
  return iso.slice(0, 7);
}

export function isMonthKey(value: string | null): value is MonthKey {
  if (value === null || !/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5));
  const y = Number(value.slice(0, 4));
  return m >= 1 && m <= 12 && y >= 2000 && y <= 2100;
}

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5));
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function monthRange(month: MonthKey): { first: string; last: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${pad(lastDay)}` };
}

/** `Oktober 2026` */
export function formatMonth(month: MonthKey): string {
  return `${MONTHS_LONG[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

/** `Kamis, 15 Oktober 2026` */
export function formatLongDate(iso: string): string {
  const { y, m, d } = parseIso(iso);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS_LONG[weekday]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** Weeks of the month, Sunday first; days outside the month are null (rendered as blanks). */
export function monthGrid(month: MonthKey): Array<Array<string | null>> {
  const { first, last } = monthRange(month);
  const { y, m } = parseIso(first);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = Number(last.slice(8));
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Payday in this month (payday_day is 1–28, so it always exists). */
export function paydayIn(month: MonthKey, paydayDay: number): string {
  return `${month}-${pad(paydayDay)}`;
}

export interface DueInstallment {
  dueDate: string;
  isPaid: boolean;
}

/** Per-installment status, same rules as debt_list: paid, overdue (< today), due within 0–3 days, otherwise active. */
export function installmentTone(installment: DueInstallment, today: string): ChipTone {
  if (installment.isPaid) return 'paid';
  const days = daysBetween(today, installment.dueDate);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due';
  return 'neutral';
}

const TONE_ORDER: ChipTone[] = ['overdue', 'due', 'neutral', 'paid'];

/** Distinct tones per date, most urgent first (one dot per tone in the grid). */
export function tonesByDate(installments: readonly DueInstallment[], today: string): Map<string, ChipTone[]> {
  const sets = new Map<string, Set<ChipTone>>();
  for (const i of installments) {
    const set = sets.get(i.dueDate) ?? new Set<ChipTone>();
    set.add(installmentTone(i, today));
    sets.set(i.dueDate, set);
  }
  return new Map([...sets].map(([date, set]) => [date, TONE_ORDER.filter((t) => set.has(t))]));
}

/** Chip for one installment in the agenda, with the same wording as the record chips (status.ts). */
export function installmentChip(installment: DueInstallment, today: string): { tone: ChipTone; label: string } {
  const tone = installmentTone(installment, today);
  const days = daysBetween(today, installment.dueDate);
  if (tone === 'paid') return { tone, label: 'Lunas' };
  if (tone === 'overdue') return { tone, label: `Terlambat ${-days} hari` };
  return { tone, label: days === 0 ? 'Hari ini' : `${days} hari lagi` };
}
