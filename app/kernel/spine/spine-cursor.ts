/**
 * FND-07 Spine kernel — the child-listing cursor, bound to its query scope.
 *
 * `listChildren` is paginated with an opaque, stable cursor rather than an
 * unbounded offset. A cursor captures two things (mirrors the entity and
 * EntityLink cursors, ADR-014 §11):
 *
 *   1. the ordering POSITION — the `(createdAt, id)` tuple of the last child
 *      returned, so the next page resumes exactly after it. `id` is the
 *      tiebreaker that makes ordering total and therefore deterministic.
 *   2. the query SCOPE — the workspace, the parent id, the requested child kind
 *      and whether soft-deleted children were included.
 *
 * Binding the scope into the cursor is a security and correctness requirement: a
 * cursor issued for parent A must be rejected under parent B, a cursor for one
 * child kind must be rejected under another, and a cursor issued across workspaces
 * or with a different deleted-mode must be rejected. Mismatches — like malformed
 * cursors — are rejected as `InvalidSpineCursorError`.
 *
 * The encoding is base64url over a small, versioned JSON array, decoded with a
 * FATAL UTF-8 pass so a tampered/malformed cursor is rejected, never repaired.
 * Cursor CONTENTS are untrusted: every field is validated on decode and every
 * value reaching SQL is still bound, never interpolated.
 */

import { InvalidSpineCursorError } from "./spine-errors";
import type { SpineKind } from "./spine-identifiers";
import { isSpineKind } from "./spine-validation";

/** The current spine cursor format version. Bump when the encoded shape changes. */
export const SPINE_CURSOR_VERSION = 1;

/** The ordering position a cursor points just after. */
export type SpineCursorPosition = {
  /** ISO-8601 UTC timestamp of the last returned child's `createdAt`. */
  readonly createdAt: string;
  /** Id of the last returned child (the tiebreaker). */
  readonly id: string;
};

/** The query scope a cursor is bound to. */
export type SpineCursorScope = {
  readonly workspaceId: string;
  readonly parentId: string;
  readonly childKind: SpineKind;
  readonly includeDeleted: boolean;
};

const textEncoder = new TextEncoder();
/** A FATAL decoder: malformed UTF-8 throws rather than yielding replacement chars. */
const fatalTextDecoder = new TextDecoder("utf-8", { fatal: true });

/** Encode bytes as unpadded base64url. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decode unpadded base64url back into bytes, or throw for a malformed string. */
function fromBase64Url(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(
    normalised.length + ((4 - (normalised.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode a scope + ordering position into an opaque, versioned cursor string. */
export function encodeSpineCursor(
  scope: SpineCursorScope,
  position: SpineCursorPosition,
): string {
  const json = JSON.stringify([
    SPINE_CURSOR_VERSION,
    scope.workspaceId,
    scope.parentId,
    scope.childKind,
    scope.includeDeleted ? 1 : 0,
    position.createdAt,
    position.id,
  ]);
  return toBase64Url(textEncoder.encode(json));
}

/** A decoded cursor: the scope it was issued for and the position it points to. */
export type DecodedSpineCursor = {
  readonly scope: SpineCursorScope;
  readonly position: SpineCursorPosition;
};

/**
 * Decode an opaque cursor back into its scope and position, validating version
 * and shape. Throws `InvalidSpineCursorError` for anything not produced by
 * {@link encodeSpineCursor} at the current version.
 */
export function decodeSpineCursor(cursor: string): DecodedSpineCursor {
  if (typeof cursor !== "string" || cursor.length === 0) {
    throw new InvalidSpineCursorError();
  }

  let decoded: string;
  try {
    decoded = fatalTextDecoder.decode(fromBase64Url(cursor));
  } catch {
    throw new InvalidSpineCursorError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new InvalidSpineCursorError();
  }

  if (!Array.isArray(parsed) || parsed.length !== 7) {
    throw new InvalidSpineCursorError();
  }

  const [
    version,
    workspaceId,
    parentId,
    childKind,
    includeDeleted,
    createdAt,
    id,
  ] = parsed;

  if (
    version !== SPINE_CURSOR_VERSION ||
    typeof workspaceId !== "string" ||
    workspaceId.length === 0 ||
    typeof parentId !== "string" ||
    parentId.length === 0 ||
    !isSpineKind(childKind) ||
    !(includeDeleted === 0 || includeDeleted === 1) ||
    typeof createdAt !== "string" ||
    createdAt.length === 0 ||
    typeof id !== "string" ||
    id.length === 0
  ) {
    throw new InvalidSpineCursorError();
  }

  return {
    scope: {
      workspaceId,
      parentId,
      childKind,
      includeDeleted: includeDeleted === 1,
    },
    position: { createdAt, id },
  };
}

/** True when two scopes are identical in workspace, parent, child kind and mode. */
export function spineCursorScopeMatches(
  a: SpineCursorScope,
  b: SpineCursorScope,
): boolean {
  return (
    a.workspaceId === b.workspaceId &&
    a.parentId === b.parentId &&
    a.childKind === b.childKind &&
    a.includeDeleted === b.includeDeleted
  );
}

/**
 * Decode a cursor and assert it was issued for `expectedScope`, returning just
 * the ordering position. A cursor from another workspace, parent, child kind or
 * deleted-mode is rejected — it is never silently reinterpreted.
 */
export function decodeSpineCursorForScope(
  cursor: string,
  expectedScope: SpineCursorScope,
): SpineCursorPosition {
  const { scope, position } = decodeSpineCursor(cursor);
  if (!spineCursorScopeMatches(scope, expectedScope)) {
    throw new InvalidSpineCursorError();
  }
  return position;
}
