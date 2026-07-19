/**
 * DS-06 Shared Forms — the pure entity-link picker model.
 *
 * The entity-link picker is entity-agnostic: it speaks in opaque target OPTIONS
 * (a kernel entity id + type slug + user-language title) and link-type
 * DESCRIPTORS (a kernel dotted-slug identifier + a user-language label). It never
 * mentions a specific product entity, never imports a repository, and never knows
 * how targets are searched or how links are persisted — the consumer supplies
 * those as callbacks.
 *
 * This module holds the framework-free rules the picker applies to candidate
 * results: exclude the anchor from its own results, drop already-linked targets,
 * de-duplicate, and bound the result size. Server-side the FND-04 repository is
 * the authority (idempotent create, workspace scope); these rules are the calm
 * client-side reflection of that authority so the user is not offered an action
 * that would be a no-op or a duplicate.
 */

/**
 * A candidate or selected link target. Carries the KERNEL identity verbatim (the
 * `id` and open `type` slug are never rewritten) alongside the user-language
 * `title`, so labels stay human while the stored identifiers stay typed.
 */
export interface EntityLinkTargetOption {
  /** The kernel entity id of the target. */
  readonly id: string;
  /** The kernel entity type slug (open string; may be an unknown type). */
  readonly type: string;
  /** The user-language title to display. */
  readonly title: string;
}

/** A link-type descriptor: the typed kernel slug plus its user-language label. */
export interface EntityLinkTypeDescriptor {
  /** The validated, dotted kernel link-type slug (e.g. `project.supporting_note`). */
  readonly type: string;
  /** The user-language label (e.g. "Supporting note"). */
  readonly label: string;
}

/** Which end of a link the anchor sits on, from the anchor's point of view. */
export type EntityLinkPickerDirection = "outgoing" | "incoming";

/**
 * An existing, active link shown in the picker. `linkId` is the FND-04 EntityLink
 * id (used to unlink); `target` is the counterpart; `linkType`/`direction` locate
 * the relationship so duplicate detection is exact.
 */
export interface EntityLinkSelection {
  readonly linkId: string;
  readonly target: EntityLinkTargetOption;
  readonly linkType: string;
  readonly direction: EntityLinkPickerDirection;
}

/** Default ceiling on async result size, so a large search cannot flood the UI. */
export const DEFAULT_MAX_LINK_RESULTS = 25;

/** Remove the anchor entity from its own candidate results. */
export function excludeAnchor(
  options: readonly EntityLinkTargetOption[],
  anchorId: string,
): readonly EntityLinkTargetOption[] {
  return options.filter((option) => option.id !== anchorId);
}

/** De-duplicate candidates by kernel id, keeping the first occurrence. */
export function dedupeTargets(
  options: readonly EntityLinkTargetOption[],
): readonly EntityLinkTargetOption[] {
  const seen = new Set<string>();
  const result: EntityLinkTargetOption[] = [];
  for (const option of options) {
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    result.push(option);
  }
  return result;
}

/**
 * The identity key for an active link, matching the FND-04 uniqueness contract as
 * seen from the anchor: the target, the link type and the direction together
 * define one relationship. Used to detect an already-linked target so the picker
 * does not offer a duplicate the server would reject or coalesce.
 */
export function linkIdentityKey(
  targetId: string,
  linkType: string,
  direction: EntityLinkPickerDirection,
): string {
  return `${direction}:${linkType}:${targetId}`;
}

/**
 * Drop candidates that are already actively linked with the given type and
 * direction. Prevents offering a duplicate active link; the server still enforces
 * this authoritatively.
 */
export function excludeAlreadyLinked(
  options: readonly EntityLinkTargetOption[],
  existing: readonly EntityLinkSelection[],
  linkType: string,
  direction: EntityLinkPickerDirection,
): readonly EntityLinkTargetOption[] {
  const linked = new Set(
    existing
      .filter((sel) => sel.linkType === linkType && sel.direction === direction)
      .map((sel) => sel.target.id),
  );
  return options.filter((option) => !linked.has(option.id));
}

/**
 * The full candidate-filtering pipeline the picker applies to raw search results:
 * de-duplicate, exclude the anchor, drop already-linked targets, and bound the
 * size. Deterministic and order-preserving (earlier results win).
 */
export function selectableTargets(
  options: readonly EntityLinkTargetOption[],
  params: {
    readonly anchorId: string;
    readonly existing: readonly EntityLinkSelection[];
    readonly linkType: string;
    readonly direction: EntityLinkPickerDirection;
    readonly max?: number;
  },
): readonly EntityLinkTargetOption[] {
  const deduped = dedupeTargets(options);
  const withoutAnchor = excludeAnchor(deduped, params.anchorId);
  const selectable = excludeAlreadyLinked(
    withoutAnchor,
    params.existing,
    params.linkType,
    params.direction,
  );
  const max = Math.max(1, params.max ?? DEFAULT_MAX_LINK_RESULTS);
  return selectable.slice(0, max);
}

/** Look up a link-type descriptor's user-language label, falling back to the slug. */
export function linkTypeLabel(
  descriptors: readonly EntityLinkTypeDescriptor[],
  type: string,
): string {
  return descriptors.find((d) => d.type === type)?.label ?? type;
}
