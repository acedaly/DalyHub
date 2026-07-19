/**
 * DS-06 Shared Forms — the shared field anatomy.
 *
 * Every control in DS-06 renders through `Field`, so a text input, a date input,
 * a tags collection and the entity-link picker all present with the SAME
 * structure: a visible label, an explicit required/optional cue, optional help
 * text, and the current validation message — all wired to the control with stable
 * ids and correct `aria-describedby`, `aria-invalid`/`aria-errormessage`.
 *
 * `Field` owns none of the input's behaviour; it hands the control the ids and
 * ARIA wiring through a render prop, so the control stays a thin, focused input
 * while the anatomy stays consistent and accessible. It never conveys state by
 * colour alone: requiredness is words, and the error is text.
 */

import type { ReactNode } from "react";
import { useId } from "react";

import { composeDescribedBy, deriveFieldIds } from "./field-ids";
import type { FieldInteractivity } from "./types";

/** The ARIA wiring `Field` computes and hands to the control it wraps. */
export interface FieldControlProps {
  /** The control's `id` (matches the label's `for`). */
  readonly id: string;
  /** The composed `aria-describedby`, or undefined when nothing describes it. */
  readonly describedBy: string | undefined;
  /** The id of the error message element, for `aria-errormessage`. Null if valid. */
  readonly errorId: string | null;
  /** Whether the field is currently invalid (`aria-invalid`). */
  readonly invalid: boolean;
  /** Whether a value is required. */
  readonly required: boolean;
  /** Whether the control is disabled. */
  readonly disabled: boolean;
  /** Whether the control is read-only. */
  readonly readOnly: boolean;
}

export interface FieldProps extends FieldInteractivity {
  /**
   * Explicit base id for the control. When a form host binds the field it passes
   * a stable id (so the error summary can link/focus it); otherwise a generated
   * id is used.
   */
  readonly id?: string;
  /** The visible, human-language label. */
  readonly label: string;
  /** Whether a value is required. Drives the visible cue. */
  readonly required?: boolean;
  /** Optional help text shown beneath the label. */
  readonly help?: string;
  /** The current validation message, or null/undefined when valid. */
  readonly error?: string | null;
  /**
   * How the field associates its label:
   *   - `label` (default) — a native `<label for>` wrapping/pointing at ONE
   *     control (text, date, select, checkbox).
   *   - `group` — a `role="group"` labelled by the label element, for COMPOSITE
   *     controls (tags, entity-link picker) that contain several interactive
   *     parts and have no single labelable element.
   */
  readonly association?: "label" | "group";
  /** Whether to show the "Optional" cue on non-required fields. Defaults true. */
  readonly showOptionalCue?: boolean;
  /** Extra class appended to the field root. */
  readonly className?: string;
  /** The control, given its computed ids and ARIA wiring. */
  readonly children: (control: FieldControlProps) => ReactNode;
}

/**
 * Render the shared field anatomy around a control. The control is produced by
 * the `children` render prop, which receives the ids/ARIA it must spread onto its
 * interactive element(s).
 */
export function Field({
  id,
  label,
  required = false,
  help,
  error,
  association = "label",
  showOptionalCue = true,
  disabled = false,
  readOnly = false,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const { helpId, errorId } = deriveFieldIds(baseId);
  const labelId = `${baseId}-label`;
  const invalid = Boolean(error);

  const describedBy = composeDescribedBy({
    helpId: help ? helpId : null,
    errorId: invalid ? errorId : null,
  });

  const control: FieldControlProps = {
    id: baseId,
    describedBy,
    errorId: invalid ? errorId : null,
    invalid,
    required,
    disabled,
    readOnly,
  };

  const rootClassName = ["dh-field", className].filter(Boolean).join(" ");

  const labelContent = (
    <span className="dh-field__label-row">
      <span className="dh-field__label-text">{label}</span>
      <RequiredCue required={required} showOptionalCue={showOptionalCue} />
    </span>
  );

  return (
    <div
      className={rootClassName}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      {...(association === "group"
        ? { role: "group", "aria-labelledby": labelId }
        : {})}
    >
      {association === "label" ? (
        <label id={labelId} className="dh-field__label" htmlFor={baseId}>
          {labelContent}
        </label>
      ) : (
        <span id={labelId} className="dh-field__label">
          {labelContent}
        </span>
      )}

      <div className="dh-field__control">{children(control)}</div>

      <div className="dh-field__messages">
        {help ? (
          <p id={helpId} className="dh-field__help">
            {help}
          </p>
        ) : null}
        {/* Polite live region so a blur/submit error is announced when it
            appears; the same node is referenced by aria-describedby, so it is
            also read when the (now-focused) control gains focus. */}
        <div className="dh-field__error-slot" aria-live="polite">
          {invalid ? (
            <p id={errorId} className="dh-field__error">
              <span className="dh-field__error-icon" aria-hidden="true">
                !
              </span>
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The explicit required/optional cue — words, never colour alone. */
function RequiredCue({
  required,
  showOptionalCue,
}: {
  readonly required: boolean;
  readonly showOptionalCue: boolean;
}) {
  if (required) {
    return (
      <span className="dh-field__required">
        <span aria-hidden="true">*</span>
        <span className="dh-visually-hidden"> (required)</span>
      </span>
    );
  }
  if (showOptionalCue) {
    return <span className="dh-field__optional">Optional</span>;
  }
  return null;
}
