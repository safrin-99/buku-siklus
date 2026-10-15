import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  /** Error message for this field. Red is reserved for "overdue", so errors use an icon, bold text and a dark border. */
  error?: string | undefined;
  hint?: string;
  /** Locked prefix inside the field (e.g. `Rp`). */
  prefix?: string;
  /** Element at the right end of the field (e.g. a show-password button). Needs its own tap area of at least 48px. */
  trailing?: ReactNode;
}

/** Text field: label on top, 52px tall, radius 12, 1.5px border (DESIGN.md section 6). */
export function TextField({ label, error, hint, prefix, trailing, id, ...input }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error ? `${inputId}-error` : '', hint ? `${inputId}-hint` : ''].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-caption font-semibold text-ink-2">
        {label}
      </label>
      <div
        className={cx(
          'flex h-13 items-center rounded-input border-[1.5px] bg-surface px-4 focus-within:border-primary-pressed focus-within:ring-4 focus-within:ring-focus-ring',
          error ? 'border-ink' : 'border-border-strong',
        )}
      >
        {prefix ? <span className="mr-2 text-body font-semibold text-ink-2">{prefix}</span> : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted"
          {...input}
        />
        {trailing ? <div className="-mr-4 shrink-0">{trailing}</div> : null}
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
