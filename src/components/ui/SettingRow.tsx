import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  to: string;
  label: string;
  /** Current value, shown at the right ("Tanggal 1", "Belum diisi"). */
  value?: ReactNode;
}

/** Row of a settings list: label on the left, current value and a chevron on the right. Render inside LedgerList. */
export function SettingRow({ to, label, value }: Props) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-surface-inset focus-visible:outline-offset-[-2px]">
        <span className="text-body font-semibold">{label}</span>
        <span className="flex min-w-0 items-center gap-1 text-body text-ink-2">
          {value !== undefined ? <span className="min-w-0 break-words text-right tabular-nums">{value}</span> : null}
          <ChevronRight aria-hidden size={20} className="shrink-0" />
        </span>
      </Link>
    </li>
  );
}
