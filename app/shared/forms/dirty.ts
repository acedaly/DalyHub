/**
 * DS-06 Shared Forms — pure dirty-state comparison.
 *
 * Explicit-save forms and autosaving fields both need to answer "has this value
 * changed from the committed baseline?" deterministically. This module provides a
 * default structural equality good enough for the value shapes DS-06 controls
 * produce — strings, numbers, booleans, null, and flat arrays/objects of those —
 * plus a way for a consumer to supply their own equality when a value has a
 * bespoke shape.
 *
 * It is intentionally NOT a general deep-equal: it does not chase class
 * instances, `Map`/`Set`, cyclic graphs or `Date` identity (dates are compared by
 * value via ISO strings by the date control before they reach here). This keeps
 * the comparison predictable and cheap, and dirty-tracking honest.
 */

/** A user-supplied equality function for a value type. */
export type IsEqual<TValue> = (a: TValue, b: TValue) => boolean;

/**
 * Structural equality for plain form values. Handles primitives, `null`/
 * `undefined`, arrays (order-sensitive) and plain objects (key-set-sensitive),
 * recursing into their entries. Any other object type falls back to reference
 * equality, so a consumer with such a value should pass a custom comparator.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!valuesEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Only compare PLAIN objects structurally; anything more exotic (Map, Set,
  // Date, class instances) is left to reference equality above / a custom
  // comparator, so we never claim a false match on an unsupported shape.
  if (!isPlainObject(a) || !isPlainObject(b)) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!valuesEqual(a[key], b[key])) return false;
  }
  return true;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Is `current` different from `baseline`? Uses {@link valuesEqual} unless a
 * custom `isEqual` is provided. This is the single definition of "dirty" the
 * form host and autosave hook share.
 */
export function isDirty<TValue>(
  current: TValue,
  baseline: TValue,
  isEqual: IsEqual<TValue> = valuesEqual,
): boolean {
  return !isEqual(current, baseline);
}

/**
 * Are ANY fields of a values record different from the baseline record? Compares
 * key by key with {@link valuesEqual}; used by the explicit-save form to derive a
 * single dirty flag from a whole draft.
 */
export function anyFieldDirty<TValues extends Record<string, unknown>>(
  current: TValues,
  baseline: TValues,
): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    if (!valuesEqual(current[key], baseline[key])) return true;
  }
  return false;
}
