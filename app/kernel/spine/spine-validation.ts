/**
 * FND-07 Spine kernel — boundary validation.
 *
 * Pure, storage-independent validation of everything that crosses the spine
 * boundary. Every repository entry point validates its inputs here BEFORE
 * touching storage, so invalid input can never write data (AGENTS.md §17).
 * Validators return the normalised value or throw `SpineValidationError`.
 *
 * Title validation intentionally reuses the EXISTING entity title rules
 * (trimmed, non-empty, bounded by `TITLE_MAX_LENGTH`) — the spine does not invent
 * its own title semantics (ADR-014 §13) — but raises a spine-typed error so
 * callers see one consistent error family from the SpineRepository.
 */

import { ID_MAX_LENGTH, TITLE_MAX_LENGTH } from "~/kernel/entities";

import { SpineValidationError } from "./spine-errors";
import {
  SPINE_KINDS,
  type SpineKind,
  type SpineParentKind,
} from "./spine-identifiers";

/** Default number of children returned by `listChildren` when no limit is given. */
export const DEFAULT_SPINE_PAGE_SIZE = 50;

/** Hard upper bound on a single child page — the safe maximum page size. */
export const MAX_SPINE_PAGE_SIZE = 100;

/** Count Unicode code points, so validation matches user-perceived length. */
function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Validate and normalise a `title` using the shared entity title rules: required,
 * non-empty after trimming, within `TITLE_MAX_LENGTH` code points. Returns the
 * trimmed value, which is what gets stored.
 */
export function validateSpineTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new SpineValidationError("title", "must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new SpineValidationError("title", "must not be empty");
  }
  if (codePointLength(trimmed) > TITLE_MAX_LENGTH) {
    throw new SpineValidationError(
      "title",
      `must be at most ${TITLE_MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}

/**
 * Validate a non-empty identifier used verbatim as a lookup key. Not trimmed — a
 * surrounding-whitespace id is a caller bug, not something to silently "fix".
 */
export function validateSpineId(
  value: unknown,
  field: "id" | "parentId" = "id",
): string {
  if (typeof value !== "string") {
    throw new SpineValidationError(field, "must be a string");
  }
  if (value.length === 0) {
    throw new SpineValidationError(field, "must not be empty");
  }
  if (value.length > ID_MAX_LENGTH) {
    throw new SpineValidationError(
      field,
      `must be at most ${ID_MAX_LENGTH} characters`,
    );
  }
  return value;
}

/** True when `value` is one of the four spine kinds. */
export function isSpineKind(value: unknown): value is SpineKind {
  return (
    typeof value === "string" &&
    (SPINE_KINDS as readonly string[]).includes(value)
  );
}

/** Validate a value as a `SpineKind`. */
export function validateSpineKind(value: unknown): SpineKind {
  if (!isSpineKind(value)) {
    throw new SpineValidationError(
      "kind",
      'must be one of "area", "goal", "project" or "task"',
    );
  }
  return value;
}

/** Validate the requested child kind for a listing. */
export function validateChildKind(value: unknown): SpineKind {
  if (!isSpineKind(value)) {
    throw new SpineValidationError(
      "childKind",
      'must be one of "area", "goal", "project" or "task"',
    );
  }
  return value;
}

/** Validate a parent-kind discriminant supplied through a creation/move input. */
export function validateParentKind(value: unknown): SpineParentKind {
  if (value === "area" || value === "goal" || value === "project") {
    return value;
  }
  throw new SpineValidationError(
    "parent",
    'kind must be one of "area", "goal" or "project"',
  );
}

/**
 * Validate and clamp a requested page limit to `[1, MAX_SPINE_PAGE_SIZE]`. A
 * missing limit yields `DEFAULT_SPINE_PAGE_SIZE`. A non-integer or non-positive
 * limit is a caller error and is rejected rather than silently coerced.
 */
export function validateSpineLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_SPINE_PAGE_SIZE;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new SpineValidationError("limit", "must be an integer");
  }
  if (value < 1) {
    throw new SpineValidationError("limit", "must be at least 1");
  }
  return Math.min(value, MAX_SPINE_PAGE_SIZE);
}
