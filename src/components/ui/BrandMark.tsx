import { cx } from '../../lib/cx';

/** App mark (same glyph as public/favicon.svg) drawn with tokens, so it follows the palette instead of repeating hex. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx('grid size-14 place-items-center rounded-card bg-primary text-canvas', className)}>
      <svg viewBox="0 0 32 32" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M9 9h10a4 4 0 0 1 0 8H9zm0 8h11a4 4 0 0 1 0 8H9z" />
      </svg>
    </span>
  );
}
