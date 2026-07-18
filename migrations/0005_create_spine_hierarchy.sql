-- Migration number: 0005 	 2026-07-18
--
-- FND-07 Spine hierarchy: the Area -> Goal -> Project -> Task backbone as a
-- first-class kernel domain (AGENTS.md §4, ADR-001, ADR-014).
--
-- This migration runs AFTER 0001 (entities), 0002 (workspaces + enforced
-- entities.workspace_id FK), 0003 (entity_links + parent entities(workspace_id,
-- id) key) and 0004 (activities). It is purely ADDITIVE: it CREATES one domain
-- table plus two indexes and does NOT alter `entities`, `entity_links`,
-- `activities` or their data.
--
-- No backfill (ADR-014 §9). DalyHub V2 has not entered production and there are
-- no generic pre-spine rows to interpret. An Area/Goal/Project/Task record only
-- exists once the SpineRepository creates it; existing generic entities are never
-- silently guessed into a hierarchy.
--
-- Conventions (identical to the existing tables): timestamps are ISO-8601 UTC
-- TEXT written by the application; STRICT enforces column typing so a schema
-- mistake fails loudly; identifiers are validated by the kernel, not database
-- enums — except the four fixed spine kinds, which ARE a closed CHECK set because
-- the spine is a closed, first-class domain, not an open module contract.

-- 1. Parent key for the spine table's COMPOSITE foreign key. `spine_records`
--    references the TRIPLE (workspace_id, entity_id, kind) -> entities
--    (workspace_id, id, type) so the database GUARANTEES a spine record's `kind`
--    agrees with its entity's `type` (and that both live in the same workspace):
--    a Task spine row can only reference a `task` entity, never a `note`. A
--    composite foreign key must reference columns carrying a UNIQUE index; the
--    entities primary key indexes only `id`, so that exact triple needs its own.
CREATE UNIQUE INDEX entities_workspace_id_type_key
  ON entities (workspace_id, id, type);

-- 2. The additive spine domain state. It holds ONLY what the spine justifies
--    beyond the shared entity header: the kind discriminant and the single
--    completion timestamp. Identity, title and soft-delete stay on `entities`;
--    structural parentage stays in `entity_links` (ADR-014 §4.2, §4.3). There is
--    deliberately NO status, priority, due date, description, ordering, weight,
--    percent-complete or cached rollup column (ADR-014 §4.5, §4.6).
CREATE TABLE spine_records (
  workspace_id  TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  kind          TEXT NOT NULL,
  completed_at  TEXT,
  CONSTRAINT spine_records_workspace_id_not_empty CHECK (length(workspace_id) > 0),
  CONSTRAINT spine_records_entity_id_not_empty CHECK (length(entity_id) > 0),
  -- The four spine kinds are a closed set (the spine is a first-class domain).
  CONSTRAINT spine_records_kind_valid
    CHECK (kind IN ('area', 'goal', 'project', 'task')),
  -- completed_at is nullable (incomplete / never-completes), but never empty.
  CONSTRAINT spine_records_completed_at_not_empty
    CHECK (completed_at IS NULL OR length(completed_at) > 0),
  -- Areas never complete (ADR-014 §4.5) — enforced at the database, not only in
  -- application code.
  CONSTRAINT spine_records_area_never_completed
    CHECK (kind <> 'area' OR completed_at IS NULL),
  -- One spine row per entity: (workspace_id, entity_id) is the identity. Scoped
  -- by workspace_id so it aligns with the composite foreign key below.
  CONSTRAINT spine_records_pk PRIMARY KEY (workspace_id, entity_id),
  -- The spine row's entity must exist IN THE SAME WORKSPACE and carry the MATCHING
  -- type. ON DELETE RESTRICT: a spine entity cannot be HARD-deleted while its
  -- spine row points at it (soft-delete leaves this row intact — soft-deletion is
  -- a query-time state, not a row removal, and is independent of completion).
  CONSTRAINT spine_records_entity_fk
    FOREIGN KEY (workspace_id, entity_id, kind)
    REFERENCES entities (workspace_id, id, type) ON DELETE RESTRICT
) STRICT;

-- 3. Exactly one active structural parent per child (ADR-014 §4.4), enforced at
--    the database over the existing `entity_links` table. A structural link is
--    directed child -> parent, so the CHILD is `source_entity_id`. This partial
--    unique index forbids a child from having two ACTIVE structural parent links
--    of ANY of the five hierarchy types at once — while leaving unlinked
--    (soft-deleted) links and every non-structural link type completely
--    unconstrained (so a record can be moved by unlinking one parent and linking
--    another in the same transaction, and ordinary EntityLinks are unaffected).
CREATE UNIQUE INDEX entity_links_one_active_parent_idx
  ON entity_links (workspace_id, source_entity_id)
  WHERE deleted_at IS NULL
    AND type IN (
      'goal.belongs_to_area',
      'project.belongs_to_area',
      'project.advances_goal',
      'task.belongs_to_area',
      'task.belongs_to_project'
    );
