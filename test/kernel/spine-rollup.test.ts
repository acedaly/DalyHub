import { beforeEach, describe, expect, it } from "vitest";

import type { SpineRepository, SpineRollup } from "~/kernel/spine";

import {
  FakeClock,
  makeContext,
  makeSpineRepository,
  resetTables,
  sequentialIds,
} from "./support";

const WS = "ws_spine_rollup";

function repo() {
  return makeSpineRepository(makeContext(WS), {
    clock: new FakeClock().now,
    idGenerator: sequentialIds(),
  });
}

/** Narrow a rollup to a specific kind for typed access to its per-level counts. */
function asKind<K extends SpineRollup["kind"]>(
  rollup: SpineRollup,
  kind: K,
): Extract<SpineRollup, { kind: K }> {
  if (rollup.kind !== kind) {
    throw new Error(`expected a ${kind} rollup, got ${rollup.kind}`);
  }
  return rollup as Extract<SpineRollup, { kind: K }>;
}

/**
 * A mixed hierarchy exercising every rollup location, with completed, incomplete
 * and soft-deleted descendants:
 *
 *   Area A
 *   ├── Task at1 (incomplete)         [direct area task]
 *   ├── Task at2 (completed)          [direct area task]
 *   ├── Project P1 (incomplete)       [direct area project]
 *   │   ├── Task pt1 (completed)
 *   │   ├── Task pt2 (incomplete)
 *   │   └── Task pt3 (soft-deleted)   [excluded from every rollup]
 *   └── Goal G1 (incomplete)
 *       ├── Project P2 (incomplete)
 *       │   ├── Task gt1 (completed)
 *       │   └── Task gt2 (incomplete)
 *       └── Project P3 (completed)    [no tasks]
 */
async function buildHierarchy(spine: SpineRepository) {
  const A = await spine.createArea({ title: "A" });
  const at1 = await spine.createTask({
    title: "at1",
    parent: { kind: "area", id: A.id },
  });
  const at2 = await spine.createTask({
    title: "at2",
    parent: { kind: "area", id: A.id },
  });
  const P1 = await spine.createProject({
    title: "P1",
    parent: { kind: "area", id: A.id },
  });
  const pt1 = await spine.createTask({
    title: "pt1",
    parent: { kind: "project", id: P1.id },
  });
  const pt2 = await spine.createTask({
    title: "pt2",
    parent: { kind: "project", id: P1.id },
  });
  const pt3 = await spine.createTask({
    title: "pt3",
    parent: { kind: "project", id: P1.id },
  });
  const G1 = await spine.createGoal({ title: "G1", areaId: A.id });
  const P2 = await spine.createProject({
    title: "P2",
    parent: { kind: "goal", id: G1.id },
  });
  const gt1 = await spine.createTask({
    title: "gt1",
    parent: { kind: "project", id: P2.id },
  });
  const gt2 = await spine.createTask({
    title: "gt2",
    parent: { kind: "project", id: P2.id },
  });
  const P3 = await spine.createProject({
    title: "P3",
    parent: { kind: "goal", id: G1.id },
  });

  await spine.complete(at2.id);
  await spine.complete(pt1.id);
  await spine.complete(gt1.id);
  await spine.complete(P3.id);
  await spine.softDelete(pt3.id);

  return { A, at1, at2, P1, pt1, pt2, pt3, G1, P2, gt1, gt2, P3 };
}

beforeEach(async () => {
  await resetTables([WS]);
});

describe("derived rollups", () => {
  it("computes Project, Goal and Area rollups exactly", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);

    // Project P1: active direct tasks pt1(done) + pt2 (pt3 soft-deleted, excluded).
    expect(await spine.getRollup(h.P1.id)).toEqual({
      kind: "project",
      tasks: { total: 2, completed: 1, ratio: 0.5 },
    });

    // Goal G1: direct projects P2 + P3(done); tasks gt1(done) + gt2.
    expect(await spine.getRollup(h.G1.id)).toEqual({
      kind: "goal",
      projects: { total: 2, completed: 1, ratio: 0.5 },
      tasks: { total: 2, completed: 1, ratio: 0.5 },
    });

    // Area A: goal G1; projects P1 + P2 + P3(done); tasks at1, at2(done), pt1(done),
    // pt2, gt1(done), gt2.
    expect(await spine.getRollup(h.A.id)).toEqual({
      kind: "area",
      goals: { total: 1, completed: 0, ratio: 0 },
      projects: { total: 3, completed: 1, ratio: 1 / 3 },
      tasks: { total: 6, completed: 3, ratio: 0.5 },
    });
  });

  it("returns ratio null for an empty container (never NaN, never 100%)", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);
    // P3 has no tasks.
    expect(await spine.getRollup(h.P3.id)).toEqual({
      kind: "project",
      tasks: { total: 0, completed: 0, ratio: null },
    });
  });

  it("updates after completing and reopening a Task", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);
    await spine.complete(h.at1.id);
    expect((await spine.getRollup(h.A.id)).tasks).toEqual({
      total: 6,
      completed: 4,
      ratio: 4 / 6,
    });
    await spine.reopen(h.at1.id);
    expect((await spine.getRollup(h.A.id)).tasks).toEqual({
      total: 6,
      completed: 3,
      ratio: 0.5,
    });
  });

  it("updates after moving a Project, following the derived hierarchy", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);
    // Move P1 from directly-under-Area to advancing Goal G1.
    await spine.move(h.P1.id, { kind: "goal", id: h.G1.id });
    // Goal G1 now owns P1 too (3 projects) and P1's tasks roll up under it.
    const goal = asKind(await spine.getRollup(h.G1.id), "goal");
    expect(goal.projects).toEqual({ total: 3, completed: 1, ratio: 1 / 3 });
    expect(goal.tasks).toEqual({ total: 4, completed: 2, ratio: 0.5 });
    // Area totals are unchanged: P1 is still within the Area's scope, via G1.
    expect(asKind(await spine.getRollup(h.A.id), "area").projects).toEqual({
      total: 3,
      completed: 1,
      ratio: 1 / 3,
    });
  });

  it("updates after moving a Task", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);
    // Move pt2 out of P1 to be a direct Area task.
    await spine.move(h.pt2.id, { kind: "area", id: h.A.id });
    expect((await spine.getRollup(h.P1.id)).tasks).toEqual({
      total: 1,
      completed: 1,
      ratio: 1,
    });
    // Area task total unchanged (pt2 is still an active area task).
    expect((await spine.getRollup(h.A.id)).tasks).toEqual({
      total: 6,
      completed: 3,
      ratio: 0.5,
    });
  });

  it("updates after soft-deleting and restoring a Task", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);
    await spine.softDelete(h.pt1.id);
    expect((await spine.getRollup(h.P1.id)).tasks).toEqual({
      total: 1,
      completed: 0,
      ratio: 0,
    });
    await spine.restore(h.pt1.id);
    expect((await spine.getRollup(h.P1.id)).tasks).toEqual({
      total: 2,
      completed: 1,
      ratio: 0.5,
    });
  });

  it("rejects a rollup on a Task", async () => {
    const spine = repo();
    const h = await buildHierarchy(spine);
    await expect(spine.getRollup(h.at1.id)).rejects.toThrow();
  });
});
