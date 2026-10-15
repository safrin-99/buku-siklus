import { cx } from '../../lib/cx';
import { Money } from './Money';

export interface Segment {
  key: string;
  label: string;
  amount: number;
  percent: number;
  bar: string; // kelas warna bilah
}

/** Bilah segmen 8px + legenda berkunci warna. Persen berjumlah 100 (lihat segmentPercents). */
export function SegmentBar({ segments }: { segments: Segment[] }) {
  const summary = segments.map((s) => `${s.label} ${s.percent}%`).join(', ');
  return (
    <div>
      <div role="img" aria-label={summary} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-chip">
        {segments
          .filter((s) => s.percent > 0)
          .map((s) => (
            <div key={s.key} className={cx('h-full', s.bar)} style={{ flexBasis: `${s.percent}%` }} />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-caption text-ink-2">
            <span aria-hidden className={cx('size-2 rounded-chip', s.bar)} />
            <span>{s.label}</span>
            <Money value={s.amount} size="sm" className="text-ink" />
          </li>
        ))}
      </ul>
    </div>
  );
}
