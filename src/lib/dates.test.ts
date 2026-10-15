import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatDate,
  formatDay,
  formatRange,
  parseIso,
  relativeDays,
  todayInZone,
  weekdayShort,
} from './dates';

describe('tanggal Indonesia', () => {
  it('hari dalam seminggu cocok dengan kalender (15 Okt 2026 = Kamis, 1 Nov 2026 = Minggu)', () => {
    expect(weekdayShort('2026-10-15')).toBe('Kam');
    expect(weekdayShort('2026-11-01')).toBe('Min');
    expect(weekdayShort('2026-10-11')).toBe('Min');
    expect(weekdayShort('2026-10-28')).toBe('Rab');
    expect(weekdayShort('2026-10-12')).toBe('Sen');
  });

  it('format tanggal; tahun hanya muncul bila berbeda dari tahun acuan', () => {
    expect(formatDate('2026-10-11', '2026-10-15')).toBe('Min, 11 Okt');
    expect(formatDay('2026-10-11', '2026-10-15')).toBe('11 Okt');
    expect(formatDay('2027-01-05', '2026-10-15')).toBe('5 Jan 2027');
    expect(formatDay('2026-10-11')).toBe('11 Okt');
  });

  it('rentang memakai en dash', () => {
    expect(formatRange('2026-10-01', '2026-10-31')).toBe('1 Okt – 31 Okt');
  });

  it('selisih hari kalender', () => {
    expect(daysBetween('2026-10-15', '2026-11-01')).toBe(17);
    expect(daysBetween('2026-10-15', '2026-10-11')).toBe(-4);
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2); // tahun kabisat
  });

  it('label relatif', () => {
    expect(relativeDays(0)).toBe('Hari ini');
    expect(relativeDays(10)).toBe('10 hari lagi');
    expect(relativeDays(-4)).toBe('lewat 4 hari');
  });

  it('menolak tanggal yang tidak valid', () => {
    expect(() => parseIso('abc')).toThrow();
    expect(() => parseIso('2026-02-30')).toThrow();
    expect(() => parseIso('2026-13-01')).toThrow();
  });

  it('hari ini menurut zona waktu WITA (UTC+8), bukan UTC', () => {
    expect(todayInZone('Asia/Makassar', new Date('2026-10-14T17:00:00Z'))).toBe('2026-10-15');
    expect(todayInZone('Asia/Makassar', new Date('2026-10-14T15:59:00Z'))).toBe('2026-10-14');
    expect(todayInZone('UTC', new Date('2026-10-14T17:00:00Z'))).toBe('2026-10-14');
  });
});
