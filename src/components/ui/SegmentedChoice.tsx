import { useId } from 'react';
import { cx } from '../../lib/cx';

interface Props<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange(value: T): void;
  disabled?: boolean;
}

/**
 * Choice between a few options in a form, drawn like the Utang | Piutang segment (DESIGN.md section 6: 44px segments in
 * an inset track). Real radio inputs underneath, so arrow keys, labels and screen readers work without extra code.
 */
export function SegmentedChoice<T extends string>({ label, value, options, onChange, disabled = false }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-caption font-semibold text-ink-2">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-input bg-surface-inset p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cx(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-input border px-2 text-center text-body font-semibold',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-pressed',
                selected ? 'border-border bg-surface text-ink' : 'border-transparent text-ink-2',
                disabled && 'cursor-not-allowed',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
