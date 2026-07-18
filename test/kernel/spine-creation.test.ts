import { beforeEach, describe, expect, it } from "vitest";

import { SpineParentUnavailableError, SpineStorageError } from "~/kernel/spine";

import {
  FakeClock,
  countActivities,
  countActivitiesOfType,
  countLinkRows,
  countRows,
  countSpineRows,
  ensureWorkspace,
  makeActivityRepository,
  makeContext,
  makeSpineRepository,
  resetTables,
  sequentialIds,
} from "./support";
import type { D1SpineRepositoryOptions } from "~/platform/storage/d1";

const WS = "ws_spine_create";
const OTHER = "ws_spine_create_other";

function repo(options: D1SpineRepositoryOptions = {}) {
  return makeSpineRepository(makeContext(WS), {
    clock: new FakeClock().now,
    idGenerator: sequentialIds(),
    ...options,
  });
}

beforeEach(async () => {
  await resetTables([WS, OTHER]);
});

describe("spine creation — Area", () => {
  it("creates a first-class Area with no parent and no completion", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "  Health  " });
    expect(area.kind).toBe("area");
    expect(area.title).toBe("Health");
    expect(area.parent).toBeNull();
    expect(area.completedAt).toBeNull();
    expect(area.deletedAt).toBeNull();

    expect(await countRows()).toBe(1);
    expect(await countSpineRows()).toBe(1);
    expect(await countLinkRows()).toBe(0);
    // Exactly one entity.created event; no link event.
    expect(await countActivitiesOfType("entity.created")).toBe(1);
    expect(await countActivities()).toBe(1);
  });

  it("rejects a blank title before any write", async () => {
    const spine = repo();
    await expect(spine.createArea({ title: "   " })).rejects.toThrow();
    expect(await countRows()).toBe(0);
    expect(await countActivities()).toBe(0);
  });
});

describe("spine creation — every valid hierarchy path", () => {
  it("creates a Goal under an Area", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Career" });
    const goal = await spine.createGoal({
      title: "Promotion",
      areaId: area.id,
    });
    expect(goal.kind).toBe("goal");
    expect(goal.parent).toEqual({ kind: "area", id: area.id });
    expect(await countSpineRows()).toBe(2);
    // Goal creation appends entity.created + entity_link.created atomically.
    expect(await countActivitiesOfType("entity.created")).toBe(2);
    expect(await countActivitiesOfType("entity_link.created")).toBe(1);
  });

  it("creates a Project directly under an Area", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Home" });
    const project = await spine.createProject({
      title: "Renovate kitchen",
      parent: { kind: "area", id: area.id },
    });
    expect(project.kind).toBe("project");
    expect(project.parent).toEqual({ kind: "area", id: area.id });
  });

  it("creates a Project under a Goal", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Fitness" });
    const goal = await spine.createGoal({
      title: "Half-marathon",
      areaId: area.id,
    });
    const project = await spine.createProject({
      title: "12-week plan",
      parent: { kind: "goal", id: goal.id },
    });
    expect(project.parent).toEqual({ kind: "goal", id: goal.id });
  });

  it("creates a Task directly under an Area (a one-off)", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Finance" });
    const task = await spine.createTask({
      title: "File taxes",
      parent: { kind: "area", id: area.id },
    });
    expect(task.kind).toBe("task");
    expect(task.parent).toEqual({ kind: "area", id: area.id });
  });

  it("creates a Task under a Project", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Fitness" });
    const project = await spine.createProject({
      title: "12-week plan",
      parent: { kind: "area", id: area.id },
    });
    const task = await spine.createTask({
      title: "Monday: 5km",
      parent: { kind: "project", id: project.id },
    });
    expect(task.parent).toEqual({ kind: "project", id: project.id });
  });

  it("records both endpoints as subjects of the link event", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Fitness" });
    const goal = await spine.createGoal({ title: "Half", areaId: area.id });
    const activity = makeActivityRepository(makeContext(WS));
    // The goal's Timeline includes entity.created and the link event.
    const timeline = await activity.listForEntity(goal.id);
    const types = timeline.items.map((e) => e.type).sort();
    expect(types).toEqual(["entity.created", "entity_link.created"]);
    // The Area also sees the link event (it is the link's target subject).
    const areaTimeline = await activity.listForEntity(area.id);
    expect(
      areaTimeline.items.some((e) => e.type === "entity_link.created"),
    ).toBe(true);
  });
});

describe("spine creation — invalid parents leave no trace", () => {
  it("rejects a missing parent and writes nothing", async () => {
    const spine = repo();
    await expect(
      spine.createGoal({ title: "Orphan", areaId: "nonexistent" }),
    ).rejects.toThrow(SpineParentUnavailableError);
    expect(await countRows()).toBe(0);
    expect(await countSpineRows()).toBe(0);
    expect(await countLinkRows()).toBe(0);
    expect(await countActivities()).toBe(0);
  });

  it("rejects a soft-deleted parent", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "Gone" });
    await spine.softDelete(area.id);
    await expect(
      spine.createGoal({ title: "Under deleted", areaId: area.id }),
    ).rejects.toThrow(SpineParentUnavailableError);
  });

  it("rejects a parent of the wrong actual kind", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const project = await spine.createProject({
      title: "P",
      parent: { kind: "area", id: area.id },
    });
    // A Goal's areaId must reference an Area; a Project id does not resolve.
    await expect(
      spine.createGoal({ title: "Bad", areaId: project.id }),
    ).rejects.toThrow(SpineParentUnavailableError);
    // A Task under a "project" that is actually an Area id also does not resolve.
    await expect(
      spine.createTask({
        title: "Bad",
        parent: { kind: "project", id: area.id },
      }),
    ).rejects.toThrow(SpineParentUnavailableError);
  });

  it("rejects a cross-workspace parent indistinguishably from a missing one", async () => {
    await ensureWorkspace(OTHER);
    const otherSpine = makeSpineRepository(makeContext(OTHER), {
      clock: new FakeClock().now,
      idGenerator: sequentialIds("other"),
    });
    const foreignArea = await otherSpine.createArea({ title: "Foreign" });

    const spine = repo();
    await expect(
      spine.createGoal({ title: "Cross", areaId: foreignArea.id }),
    ).rejects.toThrow(SpineParentUnavailableError);
    // Nothing was written into WS; only the single foreign Area's spine row exists.
    expect(await countSpineRows()).toBe(1);
  });
});

describe("spine creation — atomic rollback on any failure", () => {
  async function baselineWithArea(): Promise<{ areaId: string }> {
    const spine = repo();
    const area = await spine.createArea({ title: "Base" });
    return { areaId: area.id };
  }

  const faults: Array<{
    name: string;
    fault: NonNullable<D1SpineRepositoryOptions["createFault"]>;
  }> = [
    { name: "entity Activity", fault: "entity-activity" },
    { name: "spine-state insert", fault: "spine-insert" },
    { name: "link Activity", fault: "link-activity" },
  ];

  for (const { name, fault } of faults) {
    it(`rolls the whole creation back when the ${name} step fails`, async () => {
      const { areaId } = await baselineWithArea();
      const before = {
        entities: await countRows(),
        spine: await countSpineRows(),
        links: await countLinkRows(),
        activities: await countActivities(),
      };

      const faulted = repo({
        idGenerator: sequentialIds("x"),
        createFault: fault,
      });
      await expect(
        faulted.createGoal({ title: "Doomed", areaId }),
      ).rejects.toThrow(SpineStorageError);

      // No partial rows or events survive.
      expect(await countRows()).toBe(before.entities);
      expect(await countSpineRows()).toBe(before.spine);
      expect(await countLinkRows()).toBe(before.links);
      expect(await countActivities()).toBe(before.activities);
    });
  }
});
