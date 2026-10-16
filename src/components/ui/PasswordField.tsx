import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { TextField, type TextFieldProps } from './TextField';

type Props = Omit<TextFieldProps, 'type' | 'trailing' | 'prefix'> & {
  /** What the show/hide button names, when the label alone would read oddly ("Tampilkan …"). Default: the label. */
  revealName?: string;
};

/** Password field with a show/hide button (48px tap area). Each field on a screen toggles on its own. */
export function PasswordField({ label, revealName, ...rest }: Props) {
  const [reveal, setReveal] = useState(false);
  const name = revealName ?? label.charAt(0).toLowerCase() + label.slice(1);
  return (
    <TextField
      {...rest}
      label={label}
      type={reveal ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setReveal((value) => !value)}
          // A toggle keeps one name and reports its state through aria-pressed ("Tampilkan kata sandi, ditekan");
          // changing the name as well would announce the state twice and contradict itself.
          aria-label={`Tampilkan ${name}`}
          aria-pressed={reveal}
          className="grid size-12 place-items-center text-ink-2"
        >
          {reveal ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
        </button>
      }
    />
  );
}
