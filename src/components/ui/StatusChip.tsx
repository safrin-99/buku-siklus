import { cx } from '../../lib/cx';
import type { ChipSpec, ChipTone } from '../../lib/status';

// Satu penanda status per item: titik + teks berwarna di dalam pil bertint. Warna teks selalu varian `-text` (kontras ≥ 4,5:1).
const tones: Record<ChipTone, { box: string; dot: string }> = {
  overdue: { box: 'bg-status-overdue-bg text-status-overdue-text', dot: 'bg-status-overdue-mark' },
  due: { box: 'bg-status-due-bg text-status-due-text', dot: 'bg-status-due-mark' },
  paid: { box: 'bg-status-paid-bg text-status-paid-text', dot: 'bg-status-paid-mark' },
  neutral: { box: 'bg-status-neutral-bg text-status-neutral-text', dot: 'bg-muted' },
};

export function StatusChip({ tone, label }: ChipSpec) {
  const t = tones[tone];
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-chip px-2.5 text-label font-semibold whitespace-nowrap', t.box)}>
      <span aria-hidden className={cx('size-1.5 rounded-chip', t.dot)} />
      {label}
    </span>
  );
}
