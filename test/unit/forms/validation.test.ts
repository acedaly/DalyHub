/**
 * DS-06 — pure validation model.
 */

import { describe, expect, it } from "vitest";

import {
  VALID,
  composeValidators,
  invalid,
  isEmptyValue,
  maxLength,
  minLength,
  pattern,
  required,
  runValidator,
  satisfies,
} from "~/shared/forms/model";

describe("isEmptyValue", () => {
  it("treats blank strings, empty arrays and nullish as empty", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue("   ")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
  });

  it("treats a false boolean as NOT empty (a real answer)", () => {
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
  });
});

describe("required", () => {
  const v = required<string>("Needed.");
  it("fails on empty and passes on content", () => {
    expect(v("")).toEqual({ ok: false, message: "Needed." });
    expect(v("x")).toEqual(VALID);
  });
});

describe("length validators", () => {
  it("minLength ignores empty and enforces the floor", () => {
    expect(minLength(3, "too short")("")).toEqual(VALID);
    expect(minLength(3, "too short")("ab").ok).toBe(false);
    expect(minLength(3, "too short")("abc")).toEqual(VALID);
  });
  it("maxLength enforces the ceiling", () => {
    expect(maxLength(3, "too long")("abcd").ok).toBe(false);
    expect(maxLength(3, "too long")("abc")).toEqual(VALID);
  });
});

describe("pattern", () => {
  const v = pattern(/^[a-z]+$/, "letters only");
  it("ignores empty, passes matches, fails non-matches", () => {
    expect(v("")).toEqual(VALID);
    expect(v("abc")).toEqual(VALID);
    expect(v("a1").ok).toBe(false);
  });
});

describe("satisfies", () => {
  it("wraps a predicate", () => {
    const even = satisfies<number>((n) => n % 2 === 0, "must be even");
    expect(even(2)).toEqual(VALID);
    expect(even(3)).toEqual({ ok: false, message: "must be even" });
  });
});

describe("composeValidators", () => {
  it("returns the FIRST failure and skips undefined validators", () => {
    const v = composeValidators<string>(
      required("required"),
      undefined,
      minLength(3, "min"),
    );
    expect(v("")).toEqual({ ok: false, message: "required" });
    expect(v("ab")).toEqual({ ok: false, message: "min" });
    expect(v("abc")).toEqual(VALID);
  });
});

describe("runValidator", () => {
  it("defaults to VALID when no validator is given", () => {
    expect(runValidator(undefined, "anything")).toEqual(VALID);
    expect(runValidator(required("x"), "")).toEqual(invalid("x"));
  });
});
