/**
 * DS-06 — pure tags model: normalisation, dedupe, limits.
 */

import { describe, expect, it } from "vitest";

import {
  addTag,
  normaliseTag,
  normaliseTagList,
  removeTagAt,
} from "~/shared/forms/model";

describe("normaliseTag", () => {
  it("trims and collapses internal whitespace, preserving case", () => {
    expect(normaliseTag("  Hello   World  ")).toBe("Hello World");
    expect(normaliseTag("\tTag\n")).toBe("Tag");
  });
});

describe("addTag", () => {
  it("adds a normalised tag and reports it", () => {
    const result = addTag([], "  design ");
    expect(result).toEqual({ tags: ["design"], added: true, reason: null });
  });

  it("rejects empty input", () => {
    expect(addTag(["a"], "   ")).toEqual({
      tags: ["a"],
      added: false,
      reason: "empty",
    });
  });

  it("rejects duplicates (case-sensitive by default)", () => {
    expect(addTag(["design"], "design").reason).toBe("duplicate");
    expect(addTag(["design"], "Design").added).toBe(true);
  });

  it("treats duplicates case-insensitively when configured", () => {
    expect(addTag(["design"], "DESIGN", { caseInsensitive: true }).reason).toBe(
      "duplicate",
    );
  });

  it("enforces the max tag count", () => {
    expect(addTag(["a", "b"], "c", { maxTags: 2 }).reason).toBe("limit");
  });

  it("enforces the max tag length", () => {
    expect(addTag([], "abcd", { maxTagLength: 3 }).reason).toBe("too-long");
  });
});

describe("removeTagAt", () => {
  it("removes by index and ignores out-of-range", () => {
    expect(removeTagAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeTagAt(["a"], 5)).toEqual(["a"]);
    expect(removeTagAt(["a"], -1)).toEqual(["a"]);
  });
});

describe("normaliseTagList", () => {
  it("dedupes and bounds an incoming list deterministically", () => {
    expect(
      normaliseTagList(["a", " a ", "b", "a"], { caseInsensitive: false }),
    ).toEqual(["a", "b"]);
    expect(normaliseTagList(["a", "b", "c"], { maxTags: 2 })).toEqual([
      "a",
      "b",
    ]);
  });
});
