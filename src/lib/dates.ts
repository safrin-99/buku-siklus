// Tanggal bisnis = string ISO `YYYY-MM-DD` (tipe `date` di Postgres), tanpa zona waktu.
// Jangan memakai `new Date('YYYY-MM-DD')` untuk tampilan: hasilnya bergeser menurut zona waktu perangkat.

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface YMD {
  y: number;
  m: number;
  d: number;
}

export function parseIso(iso: string): YMD {
  const match = ISO.exec(iso);
  if (!match) throw new Error(`Tanggal ISO tidak valid: ${iso}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Tanggal tidak ada di kalender: ${iso}`);
  }
  return { y, m, d };
}

function utcMs(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return Date.UTC(y, m - 1, d);
}

export function weekdayShort(iso: string): string {
  return DAYS[new Date(utcMs(iso)).getUTCDay()] ?? '';
}

/** `11 Okt`; tahun ditambahkan hanya bila berbeda dari tahun acuan (`today`). */
export function formatDay(iso: string, today?: string): string {
  const { y, m, d } = parseIso(iso);
  const base = `${d} ${MONTHS[m - 1]}`;
  return today && parseIso(today).y !== y ? `${base} ${y}` : base;
}

/** `Min, 11 Okt`. */
export function formatDate(iso: string, today?: string): string {
  return `${weekdayShort(iso)}, ${formatDay(iso, today)}`;
}

/** `1 Okt – 31 Okt` (en dash). */
export function formatRange(startIso: string, endIso: string, today?: string): string {
  return `${formatDay(startIso, today)} – ${formatDay(endIso, today)}`;
}

/** Selisih hari kalender `to − from` (positif bila `to` setelah `from`). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcMs(toIso) - utcMs(fromIso)) / 86_400_000);
}

/** `Hari ini`, `10 hari lagi`, `lewat 4 hari`. */
export function relativeDays(days: number): string {
  if (days === 0) return 'Hari ini';
  return days > 0 ? `${days} hari lagi` : `lewat ${-days} hari`;
}

/** Tanggal hari ini menurut zona waktu tertentu (mis. `Asia/Makassar`), format ISO. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
