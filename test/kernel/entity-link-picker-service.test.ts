/**
 * DS-06 — the entity-link picker server service against real D1 (FND-04).
 *
 * Proves the integration path the picker uses: selecting a target creates a REAL
 * EntityLink through the existing FND-04 repository, and that link is queryable
 * through the kernel contract from BOTH directions. Also proves workspace
 * isolation, invalid/inaccessible-target rejection, duplicate-link idempotency,
 * reserved-type refusal, and that NO alternative relationship persistence is
 * introduced (only the `entity_links` table changes).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  EntityLinkEndpointNotFoundError,
  EntityLinkReservedTypeError,
} from "~/kernel/entity-links";
import {
  createLink,
  listActiveLinks,
  searchLinkTargets,
  unlinkLink,
  type EntityLinkPickerDeps,
} from "~/platform/entity-links";

import {
  countLinkRows,
  makeContext,
  makeLinkRepository,
  makeRepository,
  resetTables,
  seedEntity,
  sequentialIds,
} from "./support";

const WS_A = "ws-forms-a";
const WS_B = "ws-forms-b";
const CTX_A = makeContext(WS_A);
const CTX_B = makeContext(WS_B);

describe("DS-06 entity-link picker service (FND-04 integration)", () => {
  let depsA: EntityLinkPickerDeps;
  let depsB: EntityLinkPickerDeps;

  beforeEach(async () => {
    await resetTables([WS_A, WS_B]);
    depsA = {
      entities: makeRepository(CTX_A, { idGenerator: sequentialIds("a") }),
      entityLinks: makeLinkRepository(CTX_A, {
        idGenerator: sequentialIds("la"),
      }),
    };
    depsB = {
      entities: makeRepository(CTX_B, { idGenerator: sequentialIds("b") }),
      entityLinks: makeLinkRepository(CTX_B, {
        idGenerator: sequentialIds("lb"),
      }),
    };
  });

  // Spine entity types (area/goal/project/task) are reserved on the entity
  // repository, so seed endpoints directly — the picker only ever READS entities
  // (via `entities.list`) and never creates them, matching the FND-04 link tests.
  async function seedAnchorAndTargets() {
    const anchor = {
      id: await seedEntity(WS_A, "p-anchor", {
        type: "project",
        title: "Website relaunch",
      }),
    };
    const note = {
      id: await seedEntity(WS_A, "n-brief", {
        type: "note",
        title: "Creative brief",
      }),
    };
    const person = {
      id: await seedEntity(WS_A, "pe-mel", {
        type: "person",
        title: "Mel Okoye",
      }),
    };
    return { anchor, note, person };
  }

  it("creates a real EntityLink and it is queryable from both directions", async () => {
    const { anchor, note } = await seedAnchorAndTargets();

    const result = await createLink(depsA, {
      anchorId: anchor.id,
      targetId: note.id,
      linkType: "project.supporting_note",
      direction: "outgoing",
    });
    expect(result.created).toBe(true);
    expect(result.link.sourceEntityId).toBe(anchor.id);
    expect(result.link.targetEntityId).toBe(note.id);

    // From the anchor: an outgoing link whose counterpart is the note.
    const fromAnchor = await listActiveLinks(depsA, { anchorId: anchor.id });
    expect(fromAnchor).toHaveLength(1);
    expect(fromAnchor[0]!.direction).toBe("outgoing");
    expect(fromAnchor[0]!.target.id).toBe(note.id);
    expect(fromAnchor[0]!.target.title).toBe("Creative brief");
    expect(fromAnchor[0]!.linkType).toBe("project.supporting_note");

    // From the note: the SAME link, presenting as incoming, counterpart anchor.
    const fromNote = await listActiveLinks(depsA, { anchorId: note.id });
    expect(fromNote).toHaveLength(1);
    expect(fromNote[0]!.direction).toBe("incoming");
    expect(fromNote[0]!.target.id).toBe(anchor.id);
    expect(fromNote[0]!.linkId).toBe(fromAnchor[0]!.linkId);
  });

  it("honours incoming direction by reversing the endpoints", async () => {
    const { anchor, person } = await seedAnchorAndTargets();
    const result = await createLink(depsA, {
      anchorId: anchor.id,
      targetId: person.id,
      linkType: "project.involves_person",
      direction: "incoming",
    });
    // Incoming from the anchor → the anchor is the TARGET endpoint.
    expect(result.link.sourceEntityId).toBe(person.id);
    expect(result.link.targetEntityId).toBe(anchor.id);
  });

  it("searches accessible targets by title and excludes the anchor", async () => {
    const { anchor } = await seedAnchorAndTargets();
    const all = await searchLinkTargets(depsA, {
      anchorId: anchor.id,
      query: "",
    });
    expect(all.map((t) => t.id)).not.toContain(anchor.id);

    const byTitle = await searchLinkTargets(depsA, {
      anchorId: anchor.id,
      query: "brief",
    });
    expect(byTitle.map((t) => t.title)).toEqual(["Creative brief"]);
  });

  it("is idempotent — creating the same link twice makes no duplicate", async () => {
    const { anchor, note } = await seedAnchorAndTargets();
    const first = await createLink(depsA, {
      anchorId: anchor.id,
      targetId: note.id,
      linkType: "project.supporting_note",
      direction: "outgoing",
    });
    const second = await createLink(depsA, {
      anchorId: anchor.id,
      targetId: note.id,
      linkType: "project.supporting_note",
      direction: "outgoing",
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.outcome).toBe("already_exists");
    const links = await listActiveLinks(depsA, { anchorId: anchor.id });
    expect(links).toHaveLength(1);
  });

  it("rejects a non-existent target (inaccessible cannot be linked)", async () => {
    const { anchor } = await seedAnchorAndTargets();
    await expect(
      createLink(depsA, {
        anchorId: anchor.id,
        targetId: "does-not-exist",
        linkType: "project.supporting_note",
        direction: "outgoing",
      }),
    ).rejects.toBeInstanceOf(EntityLinkEndpointNotFoundError);
  });

  it("enforces workspace isolation — a cross-workspace anchor is invisible", async () => {
    const { anchor, note } = await seedAnchorAndTargets();
    await createLink(depsA, {
      anchorId: anchor.id,
      targetId: note.id,
      linkType: "project.supporting_note",
      direction: "outgoing",
    });
    // Workspace B cannot see A's anchor: listing it fails as a missing endpoint.
    await expect(
      listActiveLinks(depsB, { anchorId: anchor.id }),
    ).rejects.toBeInstanceOf(EntityLinkEndpointNotFoundError);
    // Nor does B's search surface A's entities.
    const bResults = await searchLinkTargets(depsB, {
      anchorId: "whatever",
      query: "brief",
    });
    expect(bResults).toHaveLength(0);
  });

  it("refuses reserved structural (spine) link types", async () => {
    const { anchor, note } = await seedAnchorAndTargets();
    await expect(
      createLink(depsA, {
        anchorId: anchor.id,
        targetId: note.id,
        linkType: "project.belongs_to_area",
        direction: "outgoing",
      }),
    ).rejects.toBeInstanceOf(EntityLinkReservedTypeError);
  });

  it("unlinks through the FND-04 repository and touches only entity_links", async () => {
    const { anchor, note } = await seedAnchorAndTargets();
    const created = await createLink(depsA, {
      anchorId: anchor.id,
      targetId: note.id,
      linkType: "project.supporting_note",
      direction: "outgoing",
    });
    const result = await unlinkLink(depsA, created.link.id);
    expect(result.changed).toBe(true);
    expect(await listActiveLinks(depsA, { anchorId: anchor.id })).toHaveLength(
      0,
    );
    // The row is soft-deleted, not a new relationship model: exactly one row
    // remains in the single entity_links table.
    expect(await countLinkRows()).toBe(1);
  });
});
