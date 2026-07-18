import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

// FND-07: prove the ACTUAL sequential migration 0001 → 0002 → 0003 → 0004 → 0005
// against seeded data on MIGRATION_TEST_DB — a second, deliberately un-migrated
// local D1 (see vitest.workers.config.ts). We apply 0001–0004, seed workspaces,
// entities and a plain EntityLink, then apply 0005 and observe the real result:
// existing rows survive, the spine table + keys exist, and the composite foreign
// key makes a spine kind that disagrees with its entity type impossible. We do
// NOT assume the database is empty when 0005 runs, and there is NO backfill.

const DB = env.MIGRATION_TEST_DB;
const AT = "2026-07-18T00:00:00.000Z";

beforeAll(async () => {
  // 1. Apply migrations 0001–0004 only.
  await applyD1Migrations(DB, env.TEST_MIGRATIONS.slice(0, 4));

  // 2. Seed a workspace with some generic (pre-spine) entities and a plain link.
  await DB.batch([
    DB.prepare(
      `INSERT INTO workspaces (id, created_at, updated_at) VALUES ('ws_m', ?, ?)`,
    ).bind(AT, AT),
    DB.prepare(
      `INSERT INTO entities (id, workspace_id, type, title, created_at, updated_at)
       VALUES ('m1', 'ws_m', 'note', 'M1', ?, ?)`,
    ).bind(AT, AT),
    DB.prepare(
      `INSERT INTO entities (id, workspace_id, type, title, created_at, updated_at)
       VALUES ('m2', 'ws_m', 'note', 'M2', ?, ?)`,
    ).bind(AT, AT),
    DB.prepare(
      `INSERT INTO entity_links
         (id, workspace_id, source_entity_id, target_entity_id, type, created_at, updated_at)
       VALUES ('ml', 'ws_m', 'm1', 'm2', 'note.relates_to', ?, ?)`,
    ).bind(AT, AT),
  ]);

  // 3. Now apply migration 0005 over the seeded data.
  await applyD1Migrations(DB, env.TEST_MIGRATIONS);
});

describe("migration 0004 → 0005 (existing-data preservation & new schema)", () => {
  it("preserves every pre-existing entity, workspace and link row unchanged", async () => {
    const entities = await DB.prepare(
      "SELECT id FROM entities ORDER BY id",
    ).all<{ id: string }>();
    expect(entities.results.map((r) => r.id)).toEqual(["m1", "m2"]);

    const links = await DB.prepare(
      "SELECT id FROM entity_links ORDER BY id",
    ).all<{ id: string }>();
    expect(links.results.map((r) => r.id)).toEqual(["ml"]);
  });

  it("does NOT backfill any spine_records rows for pre-spine entities", async () => {
    const row = await DB.prepare(
      "SELECT COUNT(*) AS n FROM spine_records",
    ).first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("creates the spine_records table as STRICT", async () => {
    const row = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'spine_records'",
    ).first<{ sql: string }>();
    expect(row?.sql).toMatch(/\bSTRICT\b/);
  });

  it("creates the new parent key and the one-active-parent index", async () => {
    const typeKey = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'entities_workspace_id_type_key'",
    ).first<{ name: string }>();
    expect(typeKey?.name).toBe("entities_workspace_id_type_key");

    const parentIdx = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'entity_links_one_active_parent_idx'",
    ).first<{ name: string }>();
    expect(parentIdx?.name).toBe("entity_links_one_active_parent_idx");
  });

  it("lets a matching spine row insert succeed and rejects a mismatched kind", async () => {
    await DB.prepare(
      `INSERT INTO entities (id, workspace_id, type, title, created_at, updated_at)
       VALUES ('a1', 'ws_m', 'area', 'Area', ?, ?)`,
    )
      .bind(AT, AT)
      .run();
    await DB.prepare(
      `INSERT INTO spine_records (workspace_id, entity_id, kind, completed_at)
       VALUES ('ws_m', 'a1', 'area', NULL)`,
    ).run();
    const ok = await DB.prepare(
      "SELECT kind FROM spine_records WHERE entity_id = 'a1'",
    ).first<{ kind: string }>();
    expect(ok?.kind).toBe("area");

    // A spine row whose kind disagrees with the entity type is impossible.
    let threw = false;
    try {
      await DB.prepare(
        `INSERT INTO spine_records (workspace_id, entity_id, kind, completed_at)
         VALUES ('ws_m', 'm1', 'task', NULL)`,
      ).run();
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("leaves foreign keys enabled and no temp table behind", async () => {
    const fk = await DB.prepare("PRAGMA foreign_keys").first<{
      foreign_keys: number;
    }>();
    expect(fk?.foreign_keys).toBe(1);

    const temp = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_new'",
    ).first<{ name: string }>();
    expect(temp).toBeNull();
  });
});
