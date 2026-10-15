import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

/** Form-level error (e.g. login rejected, save failed). Neutral, not red: red is reserved for "overdue". */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-input bg-surface-inset p-3 text-body text-ink">
      <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
