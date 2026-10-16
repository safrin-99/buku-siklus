import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

// Hover styles only apply on devices with a real pointer (Tailwind v4 wraps `hover:` in @media (hover: hover)), so a tap
// on a phone does not leave the button stuck in its hover colour.
const base =
  'inline-flex h-13 w-full items-center justify-center gap-2 rounded-input px-6 text-body font-semibold ' +
  'transition-[transform,background-color] duration-150 motion-safe:active:scale-98 ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-busy:cursor-progress';

const variants: Record<ButtonVariant, string> = {
  // Disabled (not busy): inset background with ink-2 text (7:1, still readable). A busy button keeps its colour and
  // shows a spinner instead, so the moment it is pressed does not look like an error.
  primary:
    'bg-primary text-on-ink hover:bg-primary-pressed active:bg-primary-pressed ' +
    'disabled:not-aria-busy:bg-surface-inset disabled:not-aria-busy:text-ink-2',
  secondary:
    'border border-border-strong bg-surface text-ink hover:bg-surface-inset active:bg-surface-inset ' +
    'disabled:not-aria-busy:text-ink-2',
  destructive: 'bg-status-overdue-bg text-status-overdue-text',
};

/** Button classes (DESIGN.md section 6), also usable for links that look like buttons. */
export function buttonClass(variant: ButtonVariant = 'primary', className?: string): string {
  return cx(base, variants[variant], className);
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className, type = 'button', ...rest }: Props) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}
