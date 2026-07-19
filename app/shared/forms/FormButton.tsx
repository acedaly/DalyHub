/**
 * DS-06 Shared Forms — the shared form button.
 *
 * One button for form actions (Save, Cancel, and the like), so pending and
 * disabled behaviour is consistent and duplicate submits are prevented uniformly:
 * a `pending` button is disabled and announces its busy state, and a Save button
 * bound to a submitting form cannot be double-fired. Styling is tokens-only and
 * meets the 44px touch target.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type FormButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface FormButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> {
  readonly variant?: FormButtonVariant;
  /** When true, the button is disabled and shows a busy state. */
  readonly pending?: boolean;
  /** Text shown while pending (defaults to the children). */
  readonly pendingLabel?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function FormButton({
  variant = "secondary",
  pending = false,
  pendingLabel,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: FormButtonProps) {
  const rootClassName = [
    "dh-btn",
    `dh-btn--${variant}`,
    pending ? "dh-btn--pending" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={rootClassName}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? <span className="dh-btn__spinner" aria-hidden="true" /> : null}
      <span className="dh-btn__label">
        {pending && pendingLabel ? pendingLabel : children}
      </span>
    </button>
  );
}
