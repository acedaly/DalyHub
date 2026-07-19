/**
 * DS-06 Shared Forms — pure tags model.
 *
 * A tags value is a CONTROLLED string collection owned by the consumer. This
 * module holds the framework-free rules the Tags control applies: normalisation,
 * duplicate prevention and bounded limits. It is deliberately NOT a tags
 * database, a suggestions service or any product-specific persistence — it only
 * transforms an in-memory string array predictably.
 *
 * Every operation returns a NEW array (the input is never mutated) and reports
 * enough for the control to explain what happened (e.g. a rejected duplicate or a
 * hit limit), so the UI can stay calm and specific.
 */

import type { TagConstraints } from "./types";

/** Safe defaults so an untrusted paste can never create an unbounded collection. */
export const DEFAULT_MAX_TAGS = 50;
export const DEFAULT_MAX_TAG_LENGTH = 64;

/** Why an attempt to add a tag did not add a new entry. */
export type TagRejectionReason = "empty" | "duplicate" | "limit" | "too-long";

/** The result of attempting to add one tag to a collection. */
export type AddTagResult = {
  /** The resulting collection (unchanged when `added` is false). */
  readonly tags: readonly string[];
  /** Whether a new tag was actually appended. */
  readonly added: boolean;
  /** When `added` is false, why — so the control can show a specific message. */
  readonly reason: TagRejectionReason | null;
};

/**
 * Normalise raw tag input: trim surrounding whitespace and collapse internal runs
 * of whitespace to a single space. Case is preserved (display fidelity); case
 * folding for duplicate detection is a separate, opt-in comparison so the stored
 * tag keeps the casing the user typed.
 */
export function normaliseTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** The comparison key for duplicate detection, honouring case sensitivity. */
function comparisonKey(tag: string, caseInsensitive: boolean): string {
  return caseInsensitive ? tag.toLocaleLowerCase() : tag;
}

/**
 * Resolve constraints against the safe defaults, clamping caller values to
 * sensible floors so a zero/negative limit cannot disable the collection or a
 * single tag.
 */
export function resolveTagConstraints(
  constraints: TagConstraints | undefined,
): Required<TagConstraints> {
  return {
    maxTags: Math.max(1, constraints?.maxTags ?? DEFAULT_MAX_TAGS),
    maxTagLength: Math.max(
      1,
      constraints?.maxTagLength ?? DEFAULT_MAX_TAG_LENGTH,
    ),
    caseInsensitive: constraints?.caseInsensitive ?? false,
  };
}

/**
 * Attempt to add one raw tag to `tags`, applying normalisation, the length limit,
 * duplicate prevention and the count limit — in that order. Returns the resulting
 * collection and whether/why the add was refused. Never mutates the input.
 */
export function addTag(
  tags: readonly string[],
  raw: string,
  constraints?: TagConstraints,
): AddTagResult {
  const resolved = resolveTagConstraints(constraints);
  const normalised = normaliseTag(raw);

  if (normalised.length === 0) {
    return { tags, added: false, reason: "empty" };
  }
  if (normalised.length > resolved.maxTagLength) {
    return { tags, added: false, reason: "too-long" };
  }

  const key = comparisonKey(normalised, resolved.caseInsensitive);
  const exists = tags.some(
    (tag) => comparisonKey(tag, resolved.caseInsensitive) === key,
  );
  if (exists) {
    return { tags, added: false, reason: "duplicate" };
  }
  if (tags.length >= resolved.maxTags) {
    return { tags, added: false, reason: "limit" };
  }

  return { tags: [...tags, normalised], added: true, reason: null };
}

/**
 * Remove the tag at `index`, returning a new collection. An out-of-range index
 * returns the collection unchanged, so a stale keyboard/paste event cannot throw.
 */
export function removeTagAt(
  tags: readonly string[],
  index: number,
): readonly string[] {
  if (index < 0 || index >= tags.length) return tags;
  return [...tags.slice(0, index), ...tags.slice(index + 1)];
}

/**
 * Normalise and de-duplicate an incoming collection (e.g. an initial value or a
 * multi-token paste), applying the same rules `addTag` would, and enforcing the
 * count limit by dropping the overflow. Deterministic: earlier entries win.
 */
export function normaliseTagList(
  raw: readonly string[],
  constraints?: TagConstraints,
): readonly string[] {
  let result: readonly string[] = [];
  for (const candidate of raw) {
    const outcome = addTag(result, candidate, constraints);
    if (outcome.added) result = outcome.tags;
  }
  return result;
}
