/**
 * DS-06 — explicit-save state reducer + first-invalid focus helper.
 */

import { describe, expect, it } from "vitest";

import {
  INITIAL_SUBMIT_STATE,
  beginSubmit,
  firstInvalidField,
  hasErrors,
  submitFailed,
  submitSucceeded,
  withFieldErrors,
} from "~/shared/forms/model";

describe("submit lifecycle", () => {
  it("begins submitting and clears prior errors", () => {
    const state = beginSubmit();
    expect(state.status).toBe("submitting");
    expect(state.formError).toBeNull();
    expect(state.fieldErrors).toEqual({});
  });

  it("success returns to the clean state", () => {
    expect(submitSucceeded()).toEqual(INITIAL_SUBMIT_STATE);
  });

  it("failure records form and field errors", () => {
    const state = submitFailed({
      formError: "Server said no.",
      fieldErrors: { title: "Required." },
    });
    expect(state.status).toBe("error");
    expect(state.formError).toBe("Server said no.");
    expect(state.fieldErrors.title).toBe("Required.");
    expect(hasErrors(state)).toBe(true);
  });

  it("withFieldErrors replaces the field error map", () => {
    const next = withFieldErrors(INITIAL_SUBMIT_STATE, { a: "x" });
    expect(next.fieldErrors).toEqual({ a: "x" });
  });
});

describe("firstInvalidField", () => {
  it("returns the first errored field in declared order", () => {
    expect(firstInvalidField(["a", "b", "c"], { b: "e1", c: "e2" })).toBe("b");
  });
  it("returns null when there are no errors", () => {
    expect(firstInvalidField(["a", "b"], {})).toBeNull();
  });
  it("falls back to an errored field not in the order", () => {
    expect(firstInvalidField(["a"], { z: "e" })).toBe("z");
  });
});
