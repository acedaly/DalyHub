/**
 * DS-06 — pure field id derivation and aria-describedby composition.
 */

import { describe, expect, it } from "vitest";

import { composeDescribedBy, deriveFieldIds } from "~/shared/forms/model";

describe("deriveFieldIds", () => {
  it("derives help and error ids from a base id", () => {
    expect(deriveFieldIds("f1")).toEqual({
      helpId: "f1-help",
      errorId: "f1-error",
    });
  });
});

describe("composeDescribedBy", () => {
  it("orders help before error and omits absent parts", () => {
    expect(composeDescribedBy({ helpId: "h", errorId: "e" })).toBe("h e");
    expect(composeDescribedBy({ helpId: "h", errorId: null })).toBe("h");
    expect(composeDescribedBy({ helpId: null, errorId: null })).toBeUndefined();
  });
  it("includes extra ids between help and error", () => {
    expect(
      composeDescribedBy({ helpId: "h", errorId: "e", extraIds: ["x"] }),
    ).toBe("h x e");
  });
});
