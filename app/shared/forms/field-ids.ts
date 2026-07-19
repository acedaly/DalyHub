/**
 * DS-06 Shared Forms — pure field id derivation.
 *
 * Every field needs STABLE, unique ids to wire a control to its label, help text
 * and error message via `id`/`for`/`aria-describedby`/`aria-errormessage`. The
 * component layer mints the base id (React `useId`); this module derives the
 * description ids from it and composes the `aria-describedby` token list, so the
 * wiring is one deterministic, testable function rather than string-building
 * scattered across components.
 */

/** The derived description ids for a field, from its base control id. */
export interface FieldDescriptionIds {
  /** id of the help-text element (present only when help text is shown). */
  readonly helpId: string;
  /** id of the error/validation-message element (present only when invalid). */
  readonly errorId: string;
}

/** Derive the help and error element ids from a field's base control id. */
export function deriveFieldIds(baseId: string): FieldDescriptionIds {
  return { helpId: `${baseId}-help`, errorId: `${baseId}-error` };
}

/**
 * Compose the `aria-describedby` value for a control from the ids that are
 * actually present. Returns `undefined` when there is nothing to describe, so the
 * attribute is omitted rather than pointing at a non-existent node. Order is
 * help-before-error so assistive tech reads guidance, then the current problem.
 */
export function composeDescribedBy(parts: {
  readonly helpId?: string | null;
  readonly errorId?: string | null;
  readonly extraIds?: readonly string[];
}): string | undefined {
  const ids = [
    parts.helpId ?? null,
    ...(parts.extraIds ?? []),
    parts.errorId ?? null,
  ].filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
