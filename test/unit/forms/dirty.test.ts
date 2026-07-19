/**
 * DS-06 — pure dirty-state comparison.
 */

import { describe, expect, it } from "vitest";

import { anyFieldDirty, isDirty, valuesEqual } from "~/shared/forms/model";

describe("valuesEqual", () => {
  it("compares primitives and nullish", () => {
    expect(valuesEqual(1, 1)).toBe(true);
    expect(valuesEqual("a", "a")).toBe(true);
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, undefined)).toBe(false);
    expect(valuesEqual(1, 2)).toBe(false);
  });

  it("compares arrays order-sensitively", () => {
    expect(valuesEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(valuesEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(valuesEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("compares plain objects by key set and value", () => {
    expect(valuesEqual({ a: 1, b: [2] }, { a: 1, b: [2] })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("isDirty", () => {
  it("is false for equal values and true otherwise", () => {
    expect(isDirty("a", "a")).toBe(false);
    expect(isDirty(["a"], ["a"])).toBe(false);
    expect(isDirty("a", "b")).toBe(true);
  });
  it("honours a custom comparator", () => {
    const caseInsensitive = (a: string, b: string) =>
      a.toLowerCase() === b.toLowerCase();
    expect(isDirty("ABC", "abc", caseInsensitive)).toBe(false);
  });
});

describe("anyFieldDirty", () => {
  it("detects any changed field", () => {
    const base = { title: "x", tags: ["a"], done: false };
    expect(anyFieldDirty({ ...base }, base)).toBe(false);
    expect(anyFieldDirty({ ...base, title: "y" }, base)).toBe(true);
    expect(anyFieldDirty({ ...base, tags: ["a", "b"] }, base)).toBe(true);
    expect(anyFieldDirty({ ...base, done: true }, base)).toBe(true);
  });
});
