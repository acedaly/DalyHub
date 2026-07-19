/**
 * DS-06 — the entity-link picker server service.
 *
 * The entity-agnostic SERVER glue between the DS-06 entity-link picker UI and the
 * FND-04 EntityLink kernel. It receives kernel repositories by injection (the
 * storage-independent `EntityRepository` and `EntityLinkRepository` contracts) and
 * translates the picker's operations — search targets, list active links, create a
 * link, remove a link — into repository calls. It imports NO D1, no Worker
 * bindings and no adapter: a loader/action constructs the workspace-scoped
 * repositories (via `resolveWorkspaceScope`) and passes them here, so workspace
 * scope and Activity actor stay trusted and server-side.
 *
 * It creates and removes links through the EXISTING FND-04 repository contract
 * only — no second relationship table, no alternative link model. Direction is
 * honoured exactly: an `outgoing` link stores the anchor as the source, an
 * `incoming` link stores it as the target; the kernel never reorders endpoints.
 * Only accessible entities in the bound workspace are ever returned, so an
 * inaccessible entity's title cannot leak.
 */

import type { EntityRecord, EntityRepository } from "~/kernel/entities";
import type {
  CreateEntityLinkResult,
  EntityLinkLifecycleResult,
  EntityLinkRepository,
} from "~/kernel/entity-links";
import type {
  EntityLinkPickerDirection,
  EntityLinkSelection,
  EntityLinkTargetOption,
} from "~/shared/forms/model";

/** The narrow repository dependencies the service needs (injected). */
export interface EntityLinkPickerDeps {
  readonly entities: Pick<EntityRepository, "list">;
  readonly entityLinks: Pick<
    EntityLinkRepository,
    "create" | "listForEntity" | "unlink"
  >;
}

/** Default and hard ceilings on how many search targets are returned. */
export const DEFAULT_TARGET_LIMIT = 25;
export const MAX_TARGET_LIMIT = 50;
/** How many candidate entities to scan per search before filtering by query. */
const SCAN_PAGE_SIZE = 100;

/** Map a kernel entity to the picker's opaque target option. */
export function entityToTargetOption(
  entity: EntityRecord,
): EntityLinkTargetOption {
  return { id: entity.id, type: entity.type, title: entity.title };
}

export interface SearchLinkTargetsParams {
  /** The anchor entity id, excluded from its own results. */
  readonly anchorId: string;
  /** Free-text query (matched case-insensitively against the title). */
  readonly query: string;
  /** Restrict to these entity type slugs (empty/undefined = any type). */
  readonly targetTypes?: readonly string[];
  /** Max results to return (clamped to `MAX_TARGET_LIMIT`). */
  readonly limit?: number;
}

/**
 * Search active entities in the bound workspace for link targets. Filters by an
 * optional type set and a case-insensitive title query, excludes the anchor, and
 * bounds the result. Returns only entities the workspace-scoped repository yields
 * (active, in-scope), so inaccessible titles never leak. This is the target-loader
 * contract DS-08 can later satisfy with real search without changing the picker.
 */
export async function searchLinkTargets(
  deps: EntityLinkPickerDeps,
  params: SearchLinkTargetsParams,
): Promise<readonly EntityLinkTargetOption[]> {
  const limit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_TARGET_LIMIT),
    MAX_TARGET_LIMIT,
  );
  const needle = params.query.trim().toLocaleLowerCase();
  const allowTypes =
    params.targetTypes && params.targetTypes.length > 0
      ? new Set(params.targetTypes)
      : null;

  const results: EntityLinkTargetOption[] = [];
  let cursor: string | undefined;

  // Scan bounded pages until we have enough matches (no unbounded work).
  // Without kernel full-text search (DS-08), matching is a title substring over
  // a bounded scan; the picker's contract lets DS-08 replace this later.
  for (let page = 0; page < 5 && results.length < limit; page += 1) {
    const listed = await deps.entities.list({ limit: SCAN_PAGE_SIZE, cursor });
    for (const entity of listed.items) {
      if (entity.id === params.anchorId) continue;
      if (allowTypes && !allowTypes.has(entity.type)) continue;
      if (
        needle.length > 0 &&
        !entity.title.toLocaleLowerCase().includes(needle)
      ) {
        continue;
      }
      results.push(entityToTargetOption(entity));
      if (results.length >= limit) break;
    }
    if (!listed.nextCursor) break;
    cursor = listed.nextCursor;
  }

  return results;
}

export interface ListActiveLinksParams {
  readonly anchorId: string;
  /** Filter by direction from the anchor. Defaults to `both`. */
  readonly direction?: "outgoing" | "incoming" | "both";
  /** Restrict to these link-type slugs (empty/undefined = any type). */
  readonly linkTypes?: readonly string[];
  /** Max links to return. */
  readonly limit?: number;
}

/**
 * List the anchor's active links as picker selections, mapping each FND-04
 * `EntityLinkView` to `{ linkId, target, linkType, direction }`. The counterpart
 * entity (title/type) comes from the joined view — no N+1 — and is always an
 * accessible, active entity.
 */
export async function listActiveLinks(
  deps: EntityLinkPickerDeps,
  params: ListActiveLinksParams,
): Promise<readonly EntityLinkSelection[]> {
  const allowTypes =
    params.linkTypes && params.linkTypes.length > 0
      ? new Set(params.linkTypes)
      : null;
  const page = await deps.entityLinks.listForEntity(params.anchorId, {
    direction: params.direction ?? "both",
    limit: params.limit,
  });
  const selections: EntityLinkSelection[] = [];
  for (const view of page.items) {
    if (allowTypes && !allowTypes.has(view.link.type)) continue;
    selections.push({
      linkId: view.link.id,
      target: entityToTargetOption(view.counterpart),
      linkType: view.link.type,
      direction: view.direction,
    });
  }
  return selections;
}

export interface CreateLinkParams {
  readonly anchorId: string;
  readonly targetId: string;
  readonly linkType: string;
  /** Which end the anchor is on. `outgoing` = anchor is the source. */
  readonly direction: EntityLinkPickerDirection;
}

/**
 * Create a link through the FND-04 repository, honouring direction: for
 * `outgoing` the anchor is the source and the target the target; for `incoming`
 * the endpoints are reversed. The kernel enforces workspace scope, endpoint
 * existence, self-link rejection, reserved-type refusal and idempotent
 * create/restore — this only maps the anchor/target to the correct endpoints.
 */
export function createLink(
  deps: EntityLinkPickerDeps,
  params: CreateLinkParams,
): Promise<CreateEntityLinkResult> {
  const [sourceEntityId, targetEntityId] =
    params.direction === "outgoing"
      ? [params.anchorId, params.targetId]
      : [params.targetId, params.anchorId];
  return deps.entityLinks.create({
    sourceEntityId,
    targetEntityId,
    type: params.linkType,
  });
}

/** Remove (soft-delete) a link by id through the FND-04 repository. */
export function unlinkLink(
  deps: EntityLinkPickerDeps,
  linkId: string,
): Promise<EntityLinkLifecycleResult> {
  return deps.entityLinks.unlink(linkId);
}
