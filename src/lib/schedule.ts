// Installment schedules for a new record. Integer Rupiah only (no float): the total is split with floor division and
// the remainder goes to the LAST installment, so the parts always add up to the total exactly.
import { parseIso } from './dates';
import { assertRupiah } from './money';

export interface ScheduledInstallment {
  dueDate: string;
  amountIdr: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of the next month = last day of month m
}

/**
 * Same day of the month, `months` later. Days that do not exist are clamped to the month's last day, always counted
 * from the first date (31 Jan → 28/29 Feb → 31 Mar, not 28 Mar).
 */
export function addMonthsClamped(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso);
  const index = y * 12 + (m - 1) + months;
  const ty = Math.floor(index / 12);
  const tm = (index % 12) + 1;
  return `${ty}-${pad(tm)}-${pad(Math.min(d, daysInMonth(ty, tm)))}`;
}

/** One payment for the whole total. */
export function singleSchedule(totalIdr: number, dueDate: string): ScheduledInstallment[] {
  assertRupiah(totalIdr);
  return [{ dueDate, amountIdr: totalIdr }];
}

/** `count` monthly installments starting on `firstDue`; equal parts, remainder on the last one. */
export function monthlySchedule(totalIdr: number, count: number, firstDue: string): ScheduledInstallment[] {
  assertRupiah(totalIdr);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Jumlah cicilan tidak valid: ${count}`);
  if (totalIdr < count) throw new Error('Total terlalu kecil untuk dibagi');
  const base = Math.floor(totalIdr / count);
  const last = totalIdr - base * (count - 1);
  return Array.from({ length: count }, (_, i) => ({
    dueDate: addMonthsClamped(firstDue, i),
    amountIdr: i === count - 1 ? last : base,
  }));
}
