import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import {
  SpineInvalidParentKindError,
  SpineNotFoundError,
} from "~/kernel/spine";
import { createSpineRepository } from "~/platform/storage/d1";

import {
  FakeClock,
  countingDb,
  ensureWorkspace,
  makeContext,
  makeSpineRepository,
  resetTables,
  sequentialIds,
} from "./support";

const WS = "ws_spine_read";
const OTHER = "ws_spine_read_other";

let clock: FakeClock;

function repo() {
  clock = new FakeClock();
  return makeSpineRepository(makeContext(WS), {
    clock: clock.now,
    idGenerator: sequentialIds(),
  });
}

beforeEach(async () => {
  await resetTables([WS, OTHER]);
});

describe("getById & getParent", () => {
  it("reads a record with its resolved parent", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const project = await spine.createProject({
      title: "P",
      parent: { kind: "area", id: area.id },
    });
    const read = await spine.getById(project.id);
    expect(read?.kind).toBe("project");
    expect(read?.parent).toEqual({ kind: "area", id: area.id });
  });

  it("resolves the parent chain", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const goal = await spine.createGoal({ title: "G", areaId: area.id });
    const project = await spine.createProject({
      title: "P",
      parent: { kind: "goal", id: goal.id },
    });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "project", id: project.id },
    });
    expect((await spine.getParent(task.id))?.id).toBe(project.id);
    expect((await spine.getParent(project.id))?.id).toBe(goal.id);
    expect((await spine.getParent(goal.id))?.id).toBe(area.id);
    expect(await spine.getParent(area.id)).toBeNull();
  });

  it("does not disclose cross-workspace existence", async () => {
    await ensureWorkspace(OTHER);
    const other = makeSpineRepository(makeContext(OTHER), {
      clock: new FakeClock().now,
      idGenerator: sequentialIds("o"),
    });
    const foreign = await other.createArea({ title: "Foreign" });
    const spine = repo();
    expect(await spine.getById(foreign.id)).toBeNull();
    expect(await spine.getParent(foreign.id)).toBeNull();
  });

  it("hides a soft-deleted record by default but retains its parent when included", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    await spine.softDelete(task.id);
    expect(await spine.getById(task.id)).toBeNull();
    const withDeleted = await spine.getById(task.id, { includeDeleted: true });
    expect(withDeleted?.deletedAt).not.toBeNull();
    // The retained structural parent survives soft-deletion for a faithful restore.
    expect(withDeleted?.parent).toEqual({ kind: "area", id: area.id });
  });
});

describe("listChildren — each valid edge, bounded and deterministic", () => {
  it("lists the right child kind for every permitted edge", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    clock.advance(1000);
    const goal = await spine.createGoal({ title: "G", areaId: area.id });
    clock.advance(1000);
    const directProject = await spine.createProject({
      title: "DP",
      parent: { kind: "area", id: area.id },
    });
    clock.advance(1000);
    const goalProject = await spine.createProject({
      title: "GP",
      parent: { kind: "goal", id: goal.id },
    });
    clock.advance(1000);
    const areaTask = await spine.createTask({
      title: "AT",
      parent: { kind: "area", id: area.id },
    });
    clock.advance(1000);
    const projTask = await spine.createTask({
      title: "PT",
      parent: { kind: "project", id: directProject.id },
    });

    const ids = async (
      parentId: string,
      childKind: "goal" | "project" | "task",
    ) =>
      (await spine.listChildren({ parentId, childKind })).items.map(
        (r) => r.id,
      );

    expect(await ids(area.id, "goal")).toEqual([goal.id]);
    expect(await ids(area.id, "project")).toEqual([directProject.id]);
    expect(await ids(area.id, "task")).toEqual([areaTask.id]);
    expect(await ids(goal.id, "project")).toEqual([goalProject.id]);
    expect(await ids(directProject.id, "task")).toEqual([projTask.id]);
  });

  it("paginates deterministically by (createdAt, id) with a bounded page", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const created: string[] = [];
    for (let i = 0; i < 5; i++) {
      clock.advance(1000);
      const t = await spine.createTask({
        title: `T${i}`,
        parent: { kind: "area", id: area.id },
      });
      created.push(t.id);
    }
    const page1 = await spine.listChildren({
      parentId: area.id,
      childKind: "task",
      limit: 2,
    });
    expect(page1.items.map((r) => r.id)).toEqual(created.slice(0, 2));
    expect(page1.hasMore).toBe(true);

    const page2 = await spine.listChildren({
      parentId: area.id,
      childKind: "task",
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.map((r) => r.id)).toEqual(created.slice(2, 4));

    const page3 = await spine.listChildren({
      parentId: area.id,
      childKind: "task",
      limit: 2,
      cursor: page2.nextCursor!,
    });
    expect(page3.items.map((r) => r.id)).toEqual(created.slice(4));
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();
  });

  it("excludes soft-deleted children by default and includes them on request", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    clock.advance(1000);
    const t1 = await spine.createTask({
      title: "T1",
      parent: { kind: "area", id: area.id },
    });
    clock.advance(1000);
    const t2 = await spine.createTask({
      title: "T2",
      parent: { kind: "area", id: area.id },
    });
    await spine.softDelete(t2.id);

    const active = await spine.listChildren({
      parentId: area.id,
      childKind: "task",
    });
    expect(active.items.map((r) => r.id)).toEqual([t1.id]);

    const all = await spine.listChildren({
      parentId: area.id,
      childKind: "task",
      includeDeleted: true,
    });
    expect(all.items.map((r) => r.id).sort()).toEqual([t1.id, t2.id].sort());
  });

  it("issues a bounded number of queries regardless of child count (no N+1)", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    for (let i = 0; i < 8; i++) {
      clock.advance(1000);
      await spine.createTask({
        title: `T${i}`,
        parent: { kind: "area", id: area.id },
      });
    }
    const counting = countingDb(env.DB);
    const countingRepo = createSpineRepository(counting.db, makeContext(WS), {
      clock: clock.now,
      idGenerator: sequentialIds("c"),
    });
    counting.reset();
    const page = await countingRepo.listChildren({
      parentId: area.id,
      childKind: "task",
      limit: 100,
    });
    expect(page.items).toHaveLength(8);
    // One parent read + one child query — never one query per child.
    expect(counting.prepareCount()).toBeLessThanOrEqual(3);
  });

  it("rejects a cross-workspace parent as not found, and an illegal edge as invalid", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    await expect(
      spine.listChildren({ parentId: "nope", childKind: "task" }),
    ).rejects.toThrow(SpineNotFoundError);
    // Area → Area is not a permitted edge.
    await expect(
      spine.listChildren({ parentId: area.id, childKind: "area" }),
    ).rejects.toThrow(SpineInvalidParentKindError);
  });
});
