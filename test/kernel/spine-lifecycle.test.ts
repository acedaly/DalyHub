import { beforeEach, describe, expect, it } from "vitest";

import {
  SpineHasActiveChildrenError,
  SpineParentUnavailableError,
} from "~/kernel/spine";

import {
  FakeClock,
  countActivitiesOfType,
  makeContext,
  makeSpineRepository,
  resetTables,
  sequentialIds,
} from "./support";

const WS = "ws_spine_lifecycle";

function repo() {
  return makeSpineRepository(makeContext(WS), {
    clock: new FakeClock().now,
    idGenerator: sequentialIds(),
  });
}

beforeEach(async () => {
  await resetTables([WS]);
});

describe("soft-delete restrictions (no active orphans)", () => {
  it("blocks deleting a container with an active direct child, at every level", async () => {
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

    await expect(spine.softDelete(area.id)).rejects.toThrow(
      SpineHasActiveChildrenError,
    );
    await expect(spine.softDelete(goal.id)).rejects.toThrow(
      SpineHasActiveChildrenError,
    );
    await expect(spine.softDelete(project.id)).rejects.toThrow(
      SpineHasActiveChildrenError,
    );
    // A Task has no children and deletes directly.
    expect((await spine.softDelete(task.id)).outcome).toBe("deleted");
  });

  it("permits deletion once the children are soft-deleted (no cascade)", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const project = await spine.createProject({
      title: "P",
      parent: { kind: "area", id: area.id },
    });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "project", id: project.id },
    });

    await spine.softDelete(task.id);
    // The soft-deleted child no longer blocks the parent.
    expect((await spine.softDelete(project.id)).outcome).toBe("deleted");
    // Deletion did NOT cascade: the task row is still its own soft-deleted record.
    const t = await spine.getById(task.id, { includeDeleted: true });
    expect(t?.deletedAt).not.toBeNull();
    expect(t?.parent).toEqual({ kind: "project", id: project.id });
  });

  it("appends entity.deleted and is idempotent", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    await spine.softDelete(task.id);
    expect(await countActivitiesOfType("entity.deleted")).toBe(1);
    const again = await spine.softDelete(task.id);
    expect(again.outcome).toBe("already_deleted");
    expect(again.changed).toBe(false);
    expect(await countActivitiesOfType("entity.deleted")).toBe(1);
  });
});

describe("restore (retained parent must be active)", () => {
  it("restores a child under an active parent and appends entity.restored", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    await spine.softDelete(task.id);
    const restored = await spine.restore(task.id);
    expect(restored.outcome).toBe("restored");
    expect(restored.record.deletedAt).toBeNull();
    expect(restored.record.parent).toEqual({ kind: "area", id: area.id });
    expect(await countActivitiesOfType("entity.restored")).toBe(1);

    const again = await spine.restore(task.id);
    expect(again.outcome).toBe("already_active");
    expect(await countActivitiesOfType("entity.restored")).toBe(1);
  });

  it("refuses to restore a child while its parent is still deleted, then succeeds once the parent returns", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const project = await spine.createProject({
      title: "P",
      parent: { kind: "area", id: area.id },
    });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "project", id: project.id },
    });

    // Delete leaf-first so the parent becomes childless and deletable.
    await spine.softDelete(task.id);
    await spine.softDelete(project.id);

    // The retained parent (project) is deleted → restoring the task must fail.
    await expect(spine.restore(task.id)).rejects.toThrow(
      SpineParentUnavailableError,
    );

    // Restore the parent, then the child restores under the same retained hierarchy.
    await spine.restore(project.id);
    const restored = await spine.restore(task.id);
    expect(restored.outcome).toBe("restored");
    expect(restored.record.parent).toEqual({ kind: "project", id: project.id });
  });

  it("restores an Area with no parent requirement", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    await spine.softDelete(area.id);
    expect((await spine.restore(area.id)).outcome).toBe("restored");
  });
});
