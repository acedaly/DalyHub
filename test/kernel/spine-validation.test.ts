import { describe, expect, it } from "vitest";

import {
  MAX_SPINE_PAGE_SIZE,
  SpineValidationError,
  childLinkTypesOf,
  parentKindOfLinkType,
  spineLinkTypeFor,
  validateChildKind,
  validateParentKind,
  validateSpineId,
  validateSpineLimit,
  validateSpineTitle,
  validateSpineKind,
  isSpineKind,
  type SpineKind,
} from "~/kernel/spine";

// FND-07: pure, storage-independent validation and the hierarchy truth table.

describe("spine kind validation", () => {
  it("accepts the four spine kinds", () => {
    for (const kind of ["area", "goal", "project", "task"]) {
      expect(validateSpineKind(kind)).toBe(kind);
      expect(isSpineKind(kind)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const bad of ["note", "AREA", "", 1, null, undefined]) {
      expect(isSpineKind(bad)).toBe(false);
      expect(() => validateSpineKind(bad)).toThrow(SpineValidationError);
    }
  });
});

describe("title validation (shared entity rules)", () => {
  it("trims and returns a valid title", () => {
    expect(validateSpineTitle("  Run a half-marathon  ")).toBe(
      "Run a half-marathon",
    );
  });

  it("rejects an empty, blank or non-string title", () => {
    for (const bad of ["", "   ", 42, null, undefined]) {
      expect(() => validateSpineTitle(bad)).toThrow(SpineValidationError);
    }
  });

  it("rejects a title beyond the maximum length", () => {
    expect(() => validateSpineTitle("x".repeat(513))).toThrow(
      SpineValidationError,
    );
  });
});

describe("id validation", () => {
  it("returns a non-empty id verbatim (no trimming)", () => {
    expect(validateSpineId("abc")).toBe("abc");
    expect(validateSpineId(" spaced ")).toBe(" spaced ");
  });

  it("rejects an empty or non-string id", () => {
    for (const bad of ["", 1, null, undefined, {}]) {
      expect(() => validateSpineId(bad)).toThrow(SpineValidationError);
    }
  });
});

describe("parent / child kind validation", () => {
  it("accepts area/goal/project as parent kinds and rejects task", () => {
    expect(validateParentKind("area")).toBe("area");
    expect(validateParentKind("goal")).toBe("goal");
    expect(validateParentKind("project")).toBe("project");
    expect(() => validateParentKind("task")).toThrow(SpineValidationError);
  });

  it("accepts the four kinds as child kinds", () => {
    for (const kind of ["area", "goal", "project", "task"]) {
      expect(validateChildKind(kind)).toBe(kind);
    }
  });
});

describe("limit validation", () => {
  it("defaults and clamps", () => {
    expect(validateSpineLimit(undefined)).toBe(50);
    expect(validateSpineLimit(10)).toBe(10);
    expect(validateSpineLimit(9999)).toBe(MAX_SPINE_PAGE_SIZE);
  });

  it("rejects non-integer or non-positive limits", () => {
    for (const bad of [0, -1, 1.5, "5"]) {
      expect(() => validateSpineLimit(bad)).toThrow(SpineValidationError);
    }
  });
});

describe("the hierarchy truth table (spineLinkTypeFor)", () => {
  const valid: Array<[SpineKind, "area" | "goal" | "project", string]> = [
    ["goal", "area", "goal.belongs_to_area"],
    ["project", "area", "project.belongs_to_area"],
    ["project", "goal", "project.advances_goal"],
    ["task", "area", "task.belongs_to_area"],
    ["task", "project", "task.belongs_to_project"],
  ];

  it("maps every permitted (child, parent) edge to its link type", () => {
    for (const [child, parent, type] of valid) {
      expect(spineLinkTypeFor(child, parent)).toBe(type);
    }
  });

  it("returns null for every forbidden edge", () => {
    // Tasks never sit directly under Goals; Projects never nest; Goals never
    // nest; Areas never have parents.
    expect(spineLinkTypeFor("task", "goal")).toBeNull();
    expect(spineLinkTypeFor("project", "project")).toBeNull();
    expect(spineLinkTypeFor("goal", "goal")).toBeNull();
    expect(spineLinkTypeFor("goal", "project")).toBeNull();
    expect(spineLinkTypeFor("area", "area")).toBeNull();
    expect(spineLinkTypeFor("area", "goal")).toBeNull();
  });

  it("inverts link type → parent kind consistently", () => {
    for (const [, parent, type] of valid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(parentKindOfLinkType(type as any)).toBe(parent);
    }
  });

  it("lists the child link types a container holds", () => {
    expect(childLinkTypesOf("area")).toEqual([
      "goal.belongs_to_area",
      "project.belongs_to_area",
      "task.belongs_to_area",
    ]);
    expect(childLinkTypesOf("goal")).toEqual(["project.advances_goal"]);
    expect(childLinkTypesOf("project")).toEqual(["task.belongs_to_project"]);
    expect(childLinkTypesOf("task")).toEqual([]);
  });
});
