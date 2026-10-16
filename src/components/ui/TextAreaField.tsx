import { CircleAlert } from 'lucide-react';
import { useId, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

/** Multi-line text (memo). Same label, states and messages as TextField (DESIGN.md section 6, Input). */
export function TextAreaField({ label, error, hint, id, ...area }: Props) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const describedBy = [error ? `${areaId}-error` : '', hint ? `${areaId}-hint` : ''].filter(Boolean).join(' ');
  const locked = Boolean(area.readOnly || area.disabled);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className={cx('text-caption font-semibold', error ? 'text-ink' : 'text-ink-2')}>
        {label}
      </label>
      <textarea
        id={areaId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cx(
          'min-h-26 w-full resize-y rounded-input border-[1.5px] px-4 py-3 text-body text-ink outline-none placeholder:text-muted',
          'focus:ring-4 focus:ring-focus-ring',
          locked ? 'bg-surface-inset' : 'bg-surface',
          error ? 'border-ink inset-ring-1 inset-ring-ink' : cx(locked ? 'border-border-strong' : 'border-border-field', 'focus:border-primary-pressed'),
        )}
        {...area}
      />
      {hint ? (
        <p id={`${areaId}-hint`} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${areaId}-error`} className="flex items-start gap-1.5 text-caption font-semibold text-ink">
          <CircleAlert aria-hidden size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
