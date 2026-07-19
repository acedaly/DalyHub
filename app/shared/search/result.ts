/**
 * DS-08 Shared Search — result validation, identity and deduplication (pure).
 *
 * Provider output is untrusted: a provider could return an empty title, an
 * oversized field, a malformed id, an invalid entity type, an unsafe target, a
 * non-finite score, or a duplicate. This module turns a raw {@link SearchResultItem}
 * into a validated {@link TaggedResult} or drops it — Search never renders an
 * unvalidated result. React-free.
 */

import {
  MAX_ENTITY_TYPE_LENGTH,
  MAX_RESULT_ID_LENGTH,
  MAX_SUBTITLE_LENGTH,
  MAX_TITLE_LENGTH,
} from "./limits";
import { validateTarget } from "./target";
import type { SearchResultItem, TaggedResult } from "./types";

/** Truncate to a maximum number of code points (never splits a surrogate pair). */
function clampCodePoints(value: string, max: number): string {
  const points = Array.from(value);
  return points.length <= max ? value : points.slice(0, max).join("");
}

/**
 * A well-formed entity-type slug (the open FND-02 shape): a lowercase letter
 * followed by lowercase letters, digits or hyphens. Mirrors the kernel's entity
 * type contract without importing the React entity-identity module.
 */
const ENTITY_TYPE_SLUG = /^[a-z][a-z0-9-]*$/u;

function normaliseEntityType(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.length === 0 || value.length > MAX_ENTITY_TYPE_LENGTH) {
    return undefined;
  }
  return ENTITY_TYPE_SLUG.test(value) ? value : undefined;
}

function normaliseScore(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Validate one provider result and tag it with its owner. Returns null when the
 * result must be dropped (empty title, malformed id, unsafe target). An invalid
 * entity type or non-finite score degrades (dropped field) rather than dropping
 * the whole result.
 */
export function validateResultItem(
  item: SearchResultItem,
  moduleId: string,
  providerId: string,
): TaggedResult | null {
  if (item === null || typeof item !== "object") {
    return null;
  }

  const { id, title, subtitle } = item;
  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    id.length > MAX_RESULT_ID_LENGTH
  ) {
    return null;
  }
  if (typeof title !== "string") {
    return null;
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) {
    return null;
  }

  const target = validateTarget(item.target);
  if (target === null) {
    return null;
  }

  let cleanSubtitle: string | undefined;
  if (typeof subtitle === "string") {
    const trimmed = subtitle.trim();
    if (trimmed.length > 0) {
      cleanSubtitle = clampCodePoints(trimmed, MAX_SUBTITLE_LENGTH);
    }
  }

  const entityType = normaliseEntityType(item.entityType);
  const providerScore = normaliseScore(item.score);

  return {
    itemId: id,
    providerId,
    moduleId,
    title: clampCodePoints(trimmedTitle, MAX_TITLE_LENGTH),
    ...(cleanSubtitle === undefined ? {} : { subtitle: cleanSubtitle }),
    ...(entityType === undefined ? {} : { entityType }),
    target,
    ...(providerScore === undefined ? {} : { providerScore }),
  };
}

/** The stable global identity of a result: `${moduleId}::${itemId}`. */
export function resultIdentity(result: {
  readonly moduleId: string;
  readonly itemId: string;
}): string {
  return `${result.moduleId}::${result.itemId}`;
}

/**
 * Drop duplicate identities, keeping the first occurrence (deterministic given the
 * deterministic registry provider order). Two different modules never collide
 * because identity is namespaced by module.
 */
export function dedupeTagged(results: readonly TaggedResult[]): TaggedResult[] {
  const seen = new Set<string>();
  const unique: TaggedResult[] = [];
  for (const result of results) {
    const identity = resultIdentity(result);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    unique.push(result);
  }
  return unique;
}
