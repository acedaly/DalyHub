import { beforeEach, describe, expect, it } from "vitest";

import { SpineAreaCompletionError, SpineNotFoundError } from "~/kernel/spine";

import {
  FakeClock,
  countActivitiesOfType,
  ensureWorkspace,
  makeActivityRepository,
  makeContext,
  makeSpineRepository,
  resetTables,
  sequentialIds,
} from "./support";

const WS = "ws_spine_complete";
const OTHER = "ws_spine_complete_other";

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

async function seedTask() {
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
  return { spine, area, project, task };
}

describe("completion & reopening", () => {
  it("completes and reopens a Task with the exact Activity type and subject", async () => {
    const { spine, task } = await seedTask();
    clock.advance(5000);

    const done = await spine.complete(task.id);
    expect(done.outcome).toBe("completed");
    expect(done.changed).toBe(true);
    expect(done.record.completedAt).not.toBeNull();
    expect(await countActivitiesOfType("task.completed")).toBe(1);

    const activity = makeActivityRepository(makeContext(WS));
    const timeline = await activity.listForEntity(task.id);
    const completedEvent = timeline.items.find(
      (e) => e.type === "task.completed",
    );
    expect(completedEvent?.subjects.map((s) => s.entityId)).toEqual([task.id]);

    clock.advance(5000);
    const reopened = await spine.reopen(task.id);
    expect(reopened.outcome).toBe("reopened");
    expect(reopened.record.completedAt).toBeNull();
    expect(await countActivitiesOfType("task.reopened")).toBe(1);
  });

  it("uses one clock value for completedAt, updatedAt and the Activity event", async () => {
    const { spine, task } = await seedTask();
    clock.advance(9000);
    const done = await spine.complete(task.id);
    expect(done.record.completedAt?.getTime()).toBe(
      done.record.updatedAt.getTime(),
    );

    const activity = makeActivityRepository(makeContext(WS));
    const event = (await activity.listForEntity(task.id)).items.find(
      (e) => e.type === "task.completed",
    );
    expect(event?.occurredAt.getTime()).toBe(
      done.record.completedAt?.getTime(),
    );
    expect(event?.payload).toEqual({
      completedAt: done.record.completedAt?.toISOString(),
    });
  });

  it("completes and reopens Goals and Projects too", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    const goal = await spine.createGoal({ title: "G", areaId: area.id });
    const project = await spine.createProject({
      title: "P",
      parent: { kind: "goal", id: goal.id },
    });

    expect((await spine.complete(goal.id)).outcome).toBe("completed");
    expect((await spine.complete(project.id)).outcome).toBe("completed");
    expect(await countActivitiesOfType("goal.completed")).toBe(1);
    expect(await countActivitiesOfType("project.completed")).toBe(1);

    expect((await spine.reopen(goal.id)).outcome).toBe("reopened");
    expect((await spine.reopen(project.id)).outcome).toBe("reopened");
  });

  it("is idempotent — repeated complete / reopen changes nothing and appends nothing", async () => {
    const { spine, task } = await seedTask();
    await spine.complete(task.id);
    const again = await spine.complete(task.id);
    expect(again.outcome).toBe("already_completed");
    expect(again.changed).toBe(false);
    expect(await countActivitiesOfType("task.completed")).toBe(1);

    await spine.reopen(task.id);
    const reopenAgain = await spine.reopen(task.id);
    expect(reopenAgain.outcome).toBe("already_open");
    expect(reopenAgain.changed).toBe(false);
    expect(await countActivitiesOfType("task.reopened")).toBe(1);
  });

  it("refuses to complete an Area", async () => {
    const spine = repo();
    const area = await spine.createArea({ title: "A" });
    await expect(spine.complete(area.id)).rejects.toThrow(
      SpineAreaCompletionError,
    );
    expect(await countActivitiesOfType("area.completed")).toBe(0);
  });

  it("cannot complete a soft-deleted record", async () => {
    const { spine, task } = await seedTask();
    await spine.softDelete(task.id);
    await expect(spine.complete(task.id)).rejects.toThrow(SpineNotFoundError);
  });

  it("reveals nothing for a cross-workspace or nonexistent id", async () => {
    await ensureWorkspace(OTHER);
    const other = makeSpineRepository(makeContext(OTHER), {
      clock: new FakeClock().now,
      idGenerator: sequentialIds("o"),
    });
    const area = await other.createArea({ title: "Foreign" });
    const foreignTask = await other.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    const spine = repo();
    await expect(spine.complete(foreignTask.id)).rejects.toThrow(
      SpineNotFoundError,
    );
  });
});
