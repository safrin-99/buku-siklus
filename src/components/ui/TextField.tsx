import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
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
  /** Forwarded to the input (React 19 passes `ref` as a prop), e.g. to focus the first invalid field. */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Text field: label on top, 52px tall, radius 12, 1.5px `border-field` border (3:1 against white, DESIGN.md section 6).
 * The input itself spans the whole box (prefix, icon and button sit on top of its padding), so anything the browser
 * paints on the input, such as Chrome's autofill colour, covers the field evenly instead of a strip in the middle.
 */
export function TextField({ label, error, hint, prefix, leading, trailing, id, ...input }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error ? `${inputId}-error` : '', hint ? `${inputId}-hint` : ''].filter(Boolean).join(' ');
  const locked = Boolean(input.readOnly || input.disabled);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={cx('text-caption font-semibold', error ? 'text-ink' : 'text-ink-2')}>
        {label}
      </label>
      <div
        className={cx(
          // States (DESIGN.md section 6, Input). Normal: neutral border. Focus: indigo border + outer ring. Invalid: a
          // heavier ink border (extra 1px drawn inside, so nothing shifts) that STAYS while focused; focus then shows as
          // the outer ring only, so typing into a flagged field never hides the error. Locked (read-only/disabled):
          // inset background. --field-bg is the colour index.css paints over Chrome's autofill background.
          'relative h-13 rounded-input border-[1.5px] focus-within:ring-4 focus-within:ring-focus-ring',
          locked ? 'bg-surface-inset [--field-bg:var(--color-surface-inset)]' : 'bg-surface [--field-bg:var(--color-surface)]',
          error
            ? 'border-ink inset-ring-1 inset-ring-ink'
            : cx(locked ? 'border-border-strong' : 'border-border-field', 'focus-within:border-primary-pressed'),
        )}
      >
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx(
            'size-full rounded-input bg-transparent text-body text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed',
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
