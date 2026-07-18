/**
 * FND-07 Spine kernel — the shared, stable domain identifiers.
 *
 * The Area → Goal → Project → Task spine is a first-class kernel concept
 * (AGENTS.md §4, ADR-001, ADR-014). Its identifiers — the four entity types, the
 * five structural EntityLink types and the six completion Activity types — are
 * defined ONCE here and reused everywhere: domain validation, the D1 adapter, the
 * generic-repository reservation checks, the four module manifests, the tests and
 * the documentation. Keeping them in one place is what prevents the four
 * user-facing modules from drifting apart on hierarchy correctness.
 *
 * This module is intentionally dependency-light: it exports plain string
 * constants, readonly sets and precise string-literal unions, and imports no D1,
 * Cloudflare, React or storage types. Nothing here is a database enum — the
 * identifiers remain ordinary validated strings, so the open Entity / EntityLink /
 * Activity contracts are unchanged (ADR-009/011/012). The spine simply RESERVES a
 * small, fixed subset of that open space for its own authoritative repository.
 */

/* -------------------------------------------------------------------------- */
/* Entity types                                                               */
/* -------------------------------------------------------------------------- */

/** The Area entity type: a permanent domain of life. Areas never complete. */
export const AREA = "area";
/** The Goal entity type: an optional, aspirational outcome under an Area. */
export const GOAL = "goal";
/** The Project entity type: finite work under an Area or a Goal. */
export const PROJECT = "project";
/** The Task entity type: an atomic action under an Area or a Project. */
export const TASK = "task";

/**
 * The discriminant of a spine record: exactly the four spine entity types. It is
 * a closed union in TypeScript (so the code is exhaustive) while the underlying
 * `entities.type` column stays an open validated string.
 */
export type SpineKind =
  typeof AREA | typeof GOAL | typeof PROJECT | typeof TASK;

/** The kinds that may be a structural PARENT (an Area, Goal or Project — never a Task). */
export type SpineParentKind = typeof AREA | typeof GOAL | typeof PROJECT;

/** The four spine kinds, in hierarchy order, for iteration and validation. */
export const SPINE_KINDS: readonly SpineKind[] = [AREA, GOAL, PROJECT, TASK];

/**
 * The entity types RESERVED for the SpineRepository. The generic Entity
 * repository must refuse to create, mutate or change the lifecycle of a record of
 * one of these types (ADR-014 §4.7); only the SpineRepository may. Reads are
 * unaffected.
 */
export const RESERVED_SPINE_ENTITY_TYPES: ReadonlySet<string> = new Set(
  SPINE_KINDS,
);

/** True when `type` is one of the four reserved spine entity types. */
export function isReservedSpineEntityType(type: string): boolean {
  return RESERVED_SPINE_ENTITY_TYPES.has(type);
}

/* -------------------------------------------------------------------------- */
/* Structural EntityLink types (direction is always child → parent)           */
/* -------------------------------------------------------------------------- */

/** A Goal's parent link to its Area. Direction: goal → area. */
export const GOAL_BELONGS_TO_AREA = "goal.belongs_to_area";
/** A Project's parent link to an Area (when it sits directly under one). Direction: project → area. */
export const PROJECT_BELONGS_TO_AREA = "project.belongs_to_area";
/** A Project's parent link to a Goal it advances. Direction: project → goal. */
export const PROJECT_ADVANCES_GOAL = "project.advances_goal";
/** A Task's parent link to an Area (when it floats directly in one). Direction: task → area. */
export const TASK_BELONGS_TO_AREA = "task.belongs_to_area";
/** A Task's parent link to its Project. Direction: task → project. */
export const TASK_BELONGS_TO_PROJECT = "task.belongs_to_project";

/**
 * The five structural link types, in a stable order. Every one is directed
 * child → parent: the CHILD is the link's `source`, the PARENT is its `target`.
 */
export const SPINE_LINK_TYPES = [
  GOAL_BELONGS_TO_AREA,
  PROJECT_BELONGS_TO_AREA,
  PROJECT_ADVANCES_GOAL,
  TASK_BELONGS_TO_AREA,
  TASK_BELONGS_TO_PROJECT,
] as const;

/** The union of the five structural spine link types. */
export type SpineLinkType = (typeof SPINE_LINK_TYPES)[number];

/**
 * The structural link types RESERVED for the SpineRepository. The generic
 * EntityLink repository must refuse to create, unlink or restore a link of one of
 * these types (ADR-014 §4.7); only the SpineRepository may.
 */
export const RESERVED_SPINE_LINK_TYPES: ReadonlySet<string> = new Set(
  SPINE_LINK_TYPES,
);

/** True when `type` is one of the five reserved structural spine link types. */
export function isReservedSpineLinkType(type: string): boolean {
  return RESERVED_SPINE_LINK_TYPES.has(type);
}

/**
 * The structural link type that connects a child of `childKind` to a parent of
 * `parentKind`, or null when that pairing is not a permitted hierarchy edge. This
 * is the single source of truth for the legal spine shape:
 *
 *   goal    → area                 (goal.belongs_to_area)
 *   project → area | goal          (project.belongs_to_area | project.advances_goal)
 *   task    → area | project       (task.belongs_to_area | task.belongs_to_project)
 */
export function spineLinkTypeFor(
  childKind: SpineKind,
  parentKind: SpineParentKind,
): SpineLinkType | null {
  if (childKind === GOAL && parentKind === AREA) return GOAL_BELONGS_TO_AREA;
  if (childKind === PROJECT && parentKind === AREA)
    return PROJECT_BELONGS_TO_AREA;
  if (childKind === PROJECT && parentKind === GOAL)
    return PROJECT_ADVANCES_GOAL;
  if (childKind === TASK && parentKind === AREA) return TASK_BELONGS_TO_AREA;
  if (childKind === TASK && parentKind === PROJECT)
    return TASK_BELONGS_TO_PROJECT;
  return null;
}

/** The parent kind a structural link type points at (its `target`'s kind). */
export function parentKindOfLinkType(type: SpineLinkType): SpineParentKind {
  switch (type) {
    case GOAL_BELONGS_TO_AREA:
    case PROJECT_BELONGS_TO_AREA:
    case TASK_BELONGS_TO_AREA:
      return AREA;
    case PROJECT_ADVANCES_GOAL:
      return GOAL;
    case TASK_BELONGS_TO_PROJECT:
      return PROJECT;
  }
}

/** The structural link types by which a parent of `parentKind` holds children. */
export function childLinkTypesOf(
  parentKind: SpineKind,
): readonly SpineLinkType[] {
  switch (parentKind) {
    case AREA:
      return [
        GOAL_BELONGS_TO_AREA,
        PROJECT_BELONGS_TO_AREA,
        TASK_BELONGS_TO_AREA,
      ];
    case GOAL:
      return [PROJECT_ADVANCES_GOAL];
    case PROJECT:
      return [TASK_BELONGS_TO_PROJECT];
    case TASK:
      return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Completion Activity types                                                  */
/* -------------------------------------------------------------------------- */

/** Activity event appended when a Goal is completed. */
export const GOAL_COMPLETED = "goal.completed";
/** Activity event appended when a Goal is reopened. */
export const GOAL_REOPENED = "goal.reopened";
/** Activity event appended when a Project is completed. */
export const PROJECT_COMPLETED = "project.completed";
/** Activity event appended when a Project is reopened. */
export const PROJECT_REOPENED = "project.reopened";
/** Activity event appended when a Task is completed. */
export const TASK_COMPLETED = "task.completed";
/** Activity event appended when a Task is reopened. */
export const TASK_REOPENED = "task.reopened";

/** The completion event type for a completable kind (goal, project, task). */
export function completedActivityTypeFor(kind: SpineKind): string | null {
  switch (kind) {
    case GOAL:
      return GOAL_COMPLETED;
    case PROJECT:
      return PROJECT_COMPLETED;
    case TASK:
      return TASK_COMPLETED;
    case AREA:
      return null;
  }
}

/** The reopen event type for a completable kind (goal, project, task). */
export function reopenedActivityTypeFor(kind: SpineKind): string | null {
  switch (kind) {
    case GOAL:
      return GOAL_REOPENED;
    case PROJECT:
      return PROJECT_REOPENED;
    case TASK:
      return TASK_REOPENED;
    case AREA:
      return null;
  }
}
