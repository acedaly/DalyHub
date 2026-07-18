import { beforeEach, describe, expect, it } from "vitest";

import { ReservedEntityTypeError } from "~/kernel/entities";
import { EntityLinkReservedTypeError } from "~/kernel/entity-links";

import {
  FakeClock,
  makeContext,
  makeLinkRepository,
  makeRepository,
  makeSpineRepository,
  resetTables,
  sequentialIds,
} from "./support";

const WS = "ws_spine_reserve";

function spineRepo() {
  return makeSpineRepository(makeContext(WS), {
    clock: new FakeClock().now,
    idGenerator: sequentialIds("s"),
  });
}

beforeEach(async () => {
  await resetTables([WS]);
});

describe("generic EntityRepository refuses reserved spine types", () => {
  it("rejects creating every reserved spine type", async () => {
    const entities = makeRepository(makeContext(WS));
    for (const type of ["area", "goal", "project", "task"]) {
      await expect(entities.create({ type, title: "nope" })).rejects.toThrow(
        ReservedEntityTypeError,
      );
    }
  });

  it("rejects updating, soft-deleting and restoring a reserved spine record", async () => {
    const spine = spineRepo();
    const area = await spine.createArea({ title: "A" });
    const entities = makeRepository(makeContext(WS));

    await expect(entities.update(area.id, { title: "x" })).rejects.toThrow(
      ReservedEntityTypeError,
    );
    await expect(entities.softDelete(area.id)).rejects.toThrow(
      ReservedEntityTypeError,
    );
    await expect(entities.restore(area.id)).rejects.toThrow(
      ReservedEntityTypeError,
    );
  });

  it("still allows generic reads to observe spine records", async () => {
    const spine = spineRepo();
    const area = await spine.createArea({ title: "Health" });
    const entities = makeRepository(makeContext(WS));
    const read = await entities.getById(area.id);
    expect(read?.type).toBe("area");
    expect(read?.title).toBe("Health");
    const list = await entities.list({ type: "area" });
    expect(list.items.map((e) => e.id)).toContain(area.id);
  });

  it("leaves non-spine entity operations working", async () => {
    const entities = makeRepository(makeContext(WS));
    const note = await entities.create({ type: "note", title: "A note" });
    expect(note.type).toBe("note");
    const updated = await entities.update(note.id, { title: "Edited" });
    expect(updated.title).toBe("Edited");
    expect((await entities.softDelete(note.id)).outcome).toBe("deleted");
  });
});

describe("generic EntityLinkRepository refuses reserved structural link types", () => {
  it("rejects creating each reserved hierarchy link type", async () => {
    const spine = spineRepo();
    const area = await spine.createArea({ title: "A" });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    const links = makeLinkRepository(makeContext(WS));

    for (const type of [
      "goal.belongs_to_area",
      "project.belongs_to_area",
      "project.advances_goal",
      "task.belongs_to_area",
      "task.belongs_to_project",
    ]) {
      await expect(
        links.create({
          sourceEntityId: task.id,
          targetEntityId: area.id,
          type,
        }),
      ).rejects.toThrow(EntityLinkReservedTypeError);
    }
  });

  it("rejects unlinking and restoring a structural spine link", async () => {
    const spine = spineRepo();
    const area = await spine.createArea({ title: "A" });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    const links = makeLinkRepository(makeContext(WS));

    // Reads still work: the structural link is observable from the child.
    const view = await links.listForEntity(task.id, { direction: "outgoing" });
    const structural = view.items.find(
      (v) => v.link.type === "task.belongs_to_area",
    );
    expect(structural).toBeDefined();

    await expect(links.unlink(structural!.link.id)).rejects.toThrow(
      EntityLinkReservedTypeError,
    );
    await expect(links.restore(structural!.link.id)).rejects.toThrow(
      EntityLinkReservedTypeError,
    );
  });

  it("leaves non-structural links working between spine records", async () => {
    const spine = spineRepo();
    const area = await spine.createArea({ title: "A" });
    const task = await spine.createTask({
      title: "T",
      parent: { kind: "area", id: area.id },
    });
    const links = makeLinkRepository(makeContext(WS));
    const created = await links.create({
      sourceEntityId: task.id,
      targetEntityId: area.id,
      type: "task.relates_to",
    });
    expect(created.outcome).toBe("created");
  });
});
