import type { ReactNode } from 'react';

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-section font-bold uppercase text-ink-2">{children}</h2>
      {aside ? <span className="text-caption text-ink-2">{aside}</span> : null}
    </div>
  );
}
