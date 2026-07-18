import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { resetTables, seedEntity } from "./support";

// FND-07: the real committed migration 0005 creates the `spine_records` domain
// table, the `entities(workspace_id, id, type)` parent key and the
// `entity_links_one_active_parent_idx` partial unique index in the fully-migrated
// local D1. These run against the actual migrated database (0001 → 0005), never a
// hand-written or mocked schema.

const WS = "ws_spine_schema";
const OTHER = "ws_spine_other";
const AT = "2026-07-18T00:00:00.000Z";

interface TableInfoRow {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface ForeignKeyRow {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_delete: string;
}

async function seedSpine(
  workspaceId: string,
  entityId: string,
  kind: string,
  completedAt: string | null = null,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO spine_records (workspace_id, entity_id, kind, completed_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(workspaceId, entityId, kind, completedAt)
    .run();
}

describe("migration 0005 — spine_records schema", () => {
  beforeEach(async () => {
    await resetTables([WS, OTHER]);
  });

  it("creates the spine_records table", async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'spine_records'",
    ).first<{ name: string }>();
    expect(row?.name).toBe("spine_records");
  });

  it("is declared STRICT", async () => {
    const row = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'spine_records'",
    ).first<{ sql: string }>();
    expect(row?.sql).toMatch(/\bSTRICT\b/);
  });

  it("defines exactly the justified columns", async () => {
    const { results } = await env.DB.prepare(
      "PRAGMA table_info(spine_records)",
    ).all<TableInfoRow>();
    expect(results.map((c) => c.name).sort()).toEqual(
      ["completed_at", "entity_id", "kind", "workspace_id"].sort(),
    );
  });

  it("makes (workspace_id, entity_id) the primary key and only completed_at nullable", async () => {
    const { results } = await env.DB.prepare(
      "PRAGMA table_info(spine_records)",
    ).all<TableInfoRow>();
    const byName = new Map(results.map((c) => [c.name, c]));
    expect(byName.get("workspace_id")?.pk).toBe(1);
    expect(byName.get("entity_id")?.pk).toBe(2);
    expect(byName.get("kind")?.notnull).toBe(1);
    expect(byName.get("completed_at")?.notnull).toBe(0);
  });

  it("declares the composite foreign key to entities(workspace_id, id, type) with ON DELETE RESTRICT", async () => {
    const { results } = await env.DB.prepare(
      "PRAGMA foreign_key_list(spine_records)",
    ).all<ForeignKeyRow>();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.on_delete === "RESTRICT")).toBe(true);
    const mapping = new Map(results.map((r) => [r.from, r.to]));
    expect(mapping.get("workspace_id")).toBe("workspace_id");
    expect(mapping.get("entity_id")).toBe("id");
    expect(mapping.get("kind")).toBe("type");
  });

  it("creates the entities(workspace_id, id, type) unique parent key", async () => {
    const { results: cols } = await env.DB.prepare(
      "PRAGMA index_info(entities_workspace_id_type_key)",
    ).all<{ name: string }>();
    expect(cols.map((c) => c.name)).toEqual(["workspace_id", "id", "type"]);
  });

  it("makes the one-active-parent index a partial UNIQUE index", async () => {
    const row = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'entity_links_one_active_parent_idx'",
    ).first<{ sql: string }>();
    expect(row?.sql).toMatch(/UNIQUE/i);
    expect(row?.sql).toMatch(/WHERE/i);
    expect(row?.sql).toMatch(/deleted_at IS NULL/i);
  });

  it("accepts a spine row whose kind matches its entity type", async () => {
    await seedEntity(WS, "g1", { type: "goal" });
    await expect(seedSpine(WS, "g1", "goal")).resolves.toBeUndefined();
  });

  it("rejects a spine row whose kind disagrees with its entity type (composite FK)", async () => {
    await seedEntity(WS, "n1", { type: "note" });
    // No entities row exists with (WS, n1, 'task'), so the composite FK fails.
    await expect(seedSpine(WS, "n1", "task")).rejects.toThrow();
  });

  it("rejects a spine row referencing an entity in another workspace", async () => {
    await seedEntity(OTHER, "x1", { type: "task" });
    await expect(seedSpine(WS, "x1", "task")).rejects.toThrow();
  });

  it("rejects a duplicate spine row for the same entity (primary key)", async () => {
    await seedEntity(WS, "t1", { type: "task" });
    await seedSpine(WS, "t1", "task");
    await expect(seedSpine(WS, "t1", "task")).rejects.toThrow();
  });

  it("rejects a kind outside the four spine kinds (CHECK)", async () => {
    await seedEntity(WS, "w1", { type: "widget" });
    await expect(seedSpine(WS, "w1", "widget")).rejects.toThrow();
  });

  it("forbids an Area from storing completed_at (CHECK)", async () => {
    await seedEntity(WS, "a1", { type: "area" });
    await expect(seedSpine(WS, "a1", "area", AT)).rejects.toThrow();
  });

  it("allows a goal/project/task to store completed_at", async () => {
    await seedEntity(WS, "p1", { type: "project" });
    await expect(seedSpine(WS, "p1", "project", AT)).resolves.toBeUndefined();
  });
});

describe("entity_links one-active-parent enforcement (FND-07)", () => {
  beforeEach(async () => {
    await resetTables([WS]);
    await seedEntity(WS, "task1", { type: "task" });
    await seedEntity(WS, "areaA", { type: "area" });
    await seedEntity(WS, "areaB", { type: "area" });
    await seedEntity(WS, "projP", { type: "project" });
  });

  async function link(
    id: string,
    source: string,
    target: string,
    type: string,
    deletedAt: string | null = null,
  ): Promise<void> {
    await env.DB.prepare(
      `INSERT INTO entity_links
         (id, workspace_id, source_entity_id, target_entity_id, type,
          created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, WS, source, target, type, AT, AT, deletedAt)
      .run();
  }

  it("forbids a child from having two active structural parents of any type", async () => {
    await link("l1", "task1", "areaA", "task.belongs_to_area");
    await expect(
      link("l2", "task1", "projP", "task.belongs_to_project"),
    ).rejects.toThrow();
  });

  it("permits a new active structural parent once the previous one is unlinked", async () => {
    await link("l1", "task1", "areaA", "task.belongs_to_area", AT); // unlinked
    await expect(
      link("l2", "task1", "areaB", "task.belongs_to_area"),
    ).resolves.toBeUndefined();
  });

  it("leaves non-structural links entirely unconstrained", async () => {
    await link("n1", "task1", "areaA", "task.relates_to");
    await expect(
      link("n2", "task1", "areaB", "task.relates_to"),
    ).resolves.toBeUndefined();
  });
});
