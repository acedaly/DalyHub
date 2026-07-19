/**
 * DS-06 Shared Forms — the pure explicit-save state model.
 *
 * The explicit-save form host tracks a small amount of state: where the current
 * submission is in its lifecycle, a form-level error, and any field-level errors
 * the client or the server produced. This module is the framework-free reducer
 * for that state plus the helpers the host needs to focus the first invalid field
 * — kept out of the component so the transitions are directly testable and can
 * never accidentally lose the user's draft.
 */

import type { SubmitStatus } from "./types";

/**
 * The complete submission state of an explicit form. Values themselves live in
 * the host (they are the user's draft and are NEVER discarded by this reducer);
 * this tracks only the submission lifecycle and the errors to display.
 */
export interface SubmitState {
  readonly status: SubmitStatus;
  /** A form-level error (e.g. a whole-operation failure). Null when none. */
  readonly formError: string | null;
  /** Field-level errors keyed by field name (client validation or server). */
  readonly fieldErrors: Readonly<Record<string, string>>;
}

/** The initial, clean submission state. */
export const INITIAL_SUBMIT_STATE: SubmitState = {
  status: "idle",
  formError: null,
  fieldErrors: {},
};

/**
 * Enter the submitting state, clearing prior errors so stale messages do not
 * linger over a fresh attempt. The host guards against calling this while already
 * submitting (duplicate-submit prevention), but doing so is also a safe no-op
 * transition here.
 */
export function beginSubmit(): SubmitState {
  return { status: "submitting", formError: null, fieldErrors: {} };
}

/** A successful submission returns to idle with no errors. */
export function submitSucceeded(): SubmitState {
  return INITIAL_SUBMIT_STATE;
}

/**
 * Record a failed submission. Both a form-level message and field-level errors
 * are optional; whatever is provided is shown, and the host keeps every entered
 * value intact. Server validation results are recorded here exactly like client
 * ones, so the SERVER remains authoritative (AGENTS.md §17).
 */
export function submitFailed(
  errors: {
    readonly formError?: string | null;
    readonly fieldErrors?: Readonly<Record<string, string>>;
  } = {},
): SubmitState {
  return {
    status: "error",
    formError: errors.formError ?? null,
    fieldErrors: errors.fieldErrors ?? {},
  };
}

/** Replace the field-level errors (e.g. after a re-validation on blur). */
export function withFieldErrors(
  state: SubmitState,
  fieldErrors: Readonly<Record<string, string>>,
): SubmitState {
  return { ...state, fieldErrors };
}

/**
 * The name of the first field, in declared `order`, that currently has an error —
 * or null when there are none. Used to move focus to the first invalid field
 * after a failed explicit submit, which is both an accessibility requirement and
 * the calm, non-punitive recovery DalyHub wants.
 */
export function firstInvalidField(
  order: readonly string[],
  fieldErrors: Readonly<Record<string, string>>,
): string | null {
  for (const name of order) {
    if (fieldErrors[name]) return name;
  }
  // Fall back to any errored field not in the declared order (defensive).
  const remaining = Object.keys(fieldErrors);
  return remaining.length > 0 ? remaining[0]! : null;
}

/** True when any field-level or form-level error is present. */
export function hasErrors(state: SubmitState): boolean {
  return state.formError !== null || Object.keys(state.fieldErrors).length > 0;
}
