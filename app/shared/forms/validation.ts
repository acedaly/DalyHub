/**
 * DS-06 Shared Forms — the pure validation model.
 *
 * A small, predictable, framework-free validation vocabulary. Validators are
 * pure functions from a value to a {@link ValidationOutcome}; combinators compose
 * them so the FIRST failure wins (one message at a time keeps recovery clear).
 * The form host layers this with async/server validation and decides WHEN to run
 * (blur, submit) — this module only decides WHETHER a value is acceptable and
 * WHAT to say when it is not.
 *
 * Every message is written for a person: it names what is wrong and, where it
 * helps, how to fix it. No message here contains a raw exception, a database
 * error, a stack trace or an opaque code (AGENTS.md §17). Server validation is
 * authoritative even when these client validators exist (see the form host).
 */

import type { Validator, ValidationOutcome } from "./types";

/** The single acceptable outcome, shared so callers need not reconstruct it. */
export const VALID: ValidationOutcome = { ok: true };

/** Build an invalid outcome carrying a specific, human-readable message. */
export function invalid(message: string): ValidationOutcome {
  return { ok: false, message };
}

/**
 * Compose validators into one that returns the FIRST failure, or {@link VALID}
 * when all pass. Order matters: put the most fundamental check (e.g. required)
 * first so the user sees the most relevant message.
 */
export function composeValidators<TValue>(
  ...validators: ReadonlyArray<Validator<TValue> | undefined>
): Validator<TValue> {
  return (value: TValue): ValidationOutcome => {
    for (const validator of validators) {
      if (!validator) continue;
      const outcome = validator(value);
      if (!outcome.ok) return outcome;
    }
    return VALID;
  };
}

/**
 * Treat a string/array/collection as "empty" for requiredness. A string is empty
 * when it trims to nothing; an array is empty when it has no items; `null` and
 * `undefined` are empty. Booleans are never "empty" (a `false` checkbox is a real
 * answer), so callers validating a boolean should not use `required`.
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Require a non-empty value. `label` is woven into the message for specificity. */
export function required<TValue>(message: string): Validator<TValue> {
  return (value: TValue): ValidationOutcome =>
    isEmptyValue(value) ? invalid(message) : VALID;
}

/**
 * Enforce a minimum length on a string value, measured in characters. Empty
 * values pass (compose with {@link required} to also require presence), so
 * "optional but at least N when present" is expressible.
 */
export function minLength(min: number, message: string): Validator<string> {
  return (value: string): ValidationOutcome =>
    value.length > 0 && value.length < min ? invalid(message) : VALID;
}

/** Enforce a maximum length on a string value, measured in characters. */
export function maxLength(max: number, message: string): Validator<string> {
  return (value: string): ValidationOutcome =>
    value.length > max ? invalid(message) : VALID;
}

/**
 * Require a string to match a pattern. Empty values pass (compose with
 * {@link required}). The pattern is a caller-provided `RegExp`; it is applied
 * with `.test`, so callers should avoid stateful `/g` flags.
 */
export function pattern(regex: RegExp, message: string): Validator<string> {
  return (value: string): ValidationOutcome =>
    value.length > 0 && !regex.test(value) ? invalid(message) : VALID;
}

/**
 * Wrap an arbitrary predicate as a validator. Returns the message when the
 * predicate is false. Keeps custom, field-specific rules in the same shape as
 * the built-ins so they compose uniformly.
 */
export function satisfies<TValue>(
  predicate: (value: TValue) => boolean,
  message: string,
): Validator<TValue> {
  return (value: TValue): ValidationOutcome =>
    predicate(value) ? VALID : invalid(message);
}

/** Run a validator, defaulting to {@link VALID} when none is provided. */
export function runValidator<TValue>(
  validator: Validator<TValue> | undefined,
  value: TValue,
): ValidationOutcome {
  return validator ? validator(value) : VALID;
}
