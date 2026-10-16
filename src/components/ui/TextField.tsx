import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'prefix'> {
  label: string;
  /** Error message for this field. Red is reserved for "overdue", so errors use an icon, bold text and a dark border. */
  error?: string | undefined;
  hint?: string;
  /** Locked prefix inside the field (e.g. `Rp`). */
  prefix?: string;
  /** Decorative icon at the left end of the field (e.g. an envelope for email). Hidden from screen readers. */
  leading?: ReactNode;
  /** Element at the right end of the field (e.g. a show-password button). Needs its own tap area of at least 48px. */
  trailing?: ReactNode;
  /** `outline` (default, forms in the app): white with a border. `filled`: inset background, border only on focus. */
  variant?: 'outline' | 'filled';
}

const box: Record<NonNullable<TextFieldProps['variant']>, string> = {
  outline: 'bg-surface [--field-bg:var(--color-surface)]',
  filled: 'bg-surface-inset [--field-bg:var(--color-surface-inset)]',
};

/**
 * Text field: label on top, 52px tall, radius 12, 1.5px border (DESIGN.md section 6).
 * The input itself spans the whole box (prefix, icon and button sit on top of its padding), so anything the browser
 * paints on the input, such as Chrome's autofill colour, covers the field evenly instead of a strip in the middle.
 */
export function TextField({ label, error, hint, prefix, leading, trailing, variant = 'outline', id, ...input }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error ? `${inputId}-error` : '', hint ? `${inputId}-hint` : ''].filter(Boolean).join(' ');
  const quietBorder = variant === 'filled' ? 'border-transparent' : 'border-border-strong';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-caption font-semibold text-ink-2">
        {label}
      </label>
      <div
        className={cx(
          'relative h-13 rounded-input border-[1.5px] focus-within:border-primary-pressed focus-within:ring-4 focus-within:ring-focus-ring',
          box[variant],
          error ? 'border-ink' : quietBorder,
        )}
      >
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx(
            'size-full rounded-input bg-transparent text-body text-ink outline-none placeholder:text-muted',
            leading || prefix ? 'pl-12' : 'pl-4',
            trailing ? 'pr-12' : 'pr-4',
          )}
          {...input}
        />
        {leading ? (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-2">
            {leading}
          </span>
        ) : prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-body font-semibold text-ink-2">
            {prefix}
          </span>
        ) : null}
        {trailing ? <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div> : null}
      </div>
      {hint ? (
        <p id={`${inputId}-hint`} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="flex items-start gap-1.5 text-caption font-semibold text-ink">
          <CircleAlert aria-hidden size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
