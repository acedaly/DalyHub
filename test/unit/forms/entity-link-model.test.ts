/**
 * DS-06 — entity-link picker option filtering and deduplication.
 */

import { describe, expect, it } from "vitest";

import {
  dedupeTargets,
  excludeAlreadyLinked,
  excludeAnchor,
  linkTypeLabel,
  selectableTargets,
  type EntityLinkSelection,
  type EntityLinkTargetOption,
} from "~/shared/forms/model";

const t = (id: string, title = id): EntityLinkTargetOption => ({
  id,
  type: "note",
  title,
});

describe("excludeAnchor", () => {
  it("removes the anchor from its own results", () => {
    expect(excludeAnchor([t("a"), t("b")], "a").map((o) => o.id)).toEqual([
      "b",
    ]);
  });
});

describe("dedupeTargets", () => {
  it("removes duplicate ids, keeping the first", () => {
    expect(
      dedupeTargets([t("a", "first"), t("a", "second"), t("b")]).map(
        (o) => o.title,
      ),
    ).toEqual(["first", "b"]);
  });
});

describe("excludeAlreadyLinked", () => {
  const existing: EntityLinkSelection[] = [
    {
      linkId: "l1",
      target: t("b"),
      linkType: "project.supporting_note",
      direction: "outgoing",
    },
  ];
  it("drops a target already linked with the same type + direction", () => {
    expect(
      excludeAlreadyLinked(
        [t("a"), t("b")],
        existing,
        "project.supporting_note",
        "outgoing",
      ).map((o) => o.id),
    ).toEqual(["a"]);
  });
  it("keeps a target linked under a different type or direction", () => {
    expect(
      excludeAlreadyLinked(
        [t("b")],
        existing,
        "project.involves_person",
        "outgoing",
      ).map((o) => o.id),
    ).toEqual(["b"]);
    expect(
      excludeAlreadyLinked(
        [t("b")],
        existing,
        "project.supporting_note",
        "incoming",
      ).map((o) => o.id),
    ).toEqual(["b"]);
  });
});

describe("selectableTargets", () => {
  it("applies dedupe, anchor exclusion, already-linked and the size bound", () => {
    const result = selectableTargets(
      [t("anchor"), t("a"), t("a"), t("b"), t("c")],
      {
        anchorId: "anchor",
        existing: [
          {
            linkId: "l1",
            target: t("b"),
            linkType: "x.y",
            direction: "outgoing",
          },
        ],
        linkType: "x.y",
        direction: "outgoing",
        max: 1,
      },
    );
    // anchor removed, dup 'a' collapsed, 'b' already linked, bound to 1 → ['a'].
    expect(result.map((o) => o.id)).toEqual(["a"]);
  });
});

describe("linkTypeLabel", () => {
  it("resolves a label, falling back to the slug", () => {
    const descriptors = [{ type: "x.y", label: "Nice label" }];
    expect(linkTypeLabel(descriptors, "x.y")).toBe("Nice label");
    expect(linkTypeLabel(descriptors, "z.w")).toBe("z.w");
  });
});
