import { formatRupiahInput } from '../../lib/money';
import { TextField, type TextFieldProps } from './TextField';

type Props = Omit<TextFieldProps, 'prefix' | 'value' | 'onChange' | 'inputMode' | 'type'> & {
  /** Display value, already formatted (`1.500.000`). Parse it with parseRupiahInput on submit. */
  value: string;
  onValueChange(value: string): void;
};

/**
 * Rupiah field (DESIGN.md section 6): locked `Rp` prefix, thousand dots as you type, numeric keyboard.
 * Known limit: reformatting moves the caret to the end when editing in the middle of the number.
 */
export function MoneyInput({ value, onValueChange, ...rest }: Props) {
  return (
    <TextField
      {...rest}
      prefix="Rp"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={value}
      onChange={(event) => onValueChange(formatRupiahInput(event.target.value))}
    />
  );
}
