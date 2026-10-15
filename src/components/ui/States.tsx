import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/** State memuat: balok netral yang berdenyut (denyut dimatikan bila pengguna meminta gerak dikurangi). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('rounded-card bg-surface-inset motion-safe:animate-pulse', className)} />;
}

export function LoadingRegion({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Memuat…</span>
      {children}
    </div>
  );
}

/** State galat: menyebut apa yang gagal dan apa yang bisa dilakukan. */
export function ErrorState({ title, hint, onRetry }: { title: string; hint?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-border bg-surface p-6 text-center">
      <p className="text-money-md font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-caption text-ink-2">{hint}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-input border border-border-strong bg-surface px-6 text-body font-semibold text-ink active:bg-surface-inset"
        >
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

/** Empty state: satu kalimat faktual + satu aksi, tanpa ilustrasi. */
export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6 text-center">
      <p className="text-body text-ink-2">{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
