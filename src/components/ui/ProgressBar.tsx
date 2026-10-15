import { cx } from '../../lib/cx';
import type { ProgressTone } from '../../lib/status';

const fill: Record<ProgressTone, string> = {
  ink: 'bg-ink',
  paid: 'bg-status-paid-mark',
  overdue: 'bg-status-overdue-mark',
};

export function ProgressBar({ percent, tone = 'ink', label }: { percent: number; tone?: ProgressTone; label: string }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-1 w-full overflow-hidden rounded-chip bg-surface-inset"
    >
      <div className={cx('h-full rounded-chip', fill[tone])} style={{ width: `${value}%` }} />
    </div>
  );
}
