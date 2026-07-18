/**
 * DS-07 — architectural guard: the pure filter model imports no React.
 *
 * ADR-019 §19.4 and the DS-07 documentation promise the filter model is
 * framework-free so a server-side module can translate a `FilterExpression` into
 * its own query layer without resolving React. This static guard fails if any pure
 * model file (or the `model.ts` entry) imports `react`, `react-dom` or
 * `react-router`. UI-only files (components, the URL-state hook, the value-control
 * seam) are intentionally excluded.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FILTERS_DIR = path.resolve(
  import.meta.dirname,
  "../../../app/shared/filters",
);

// The pure model surface — must stay React-free.
const PURE_FILES = [
  "types.ts",
  "operators.ts",
  "validate.ts",
  "evaluate.ts",
  "url.ts",
  "saved-views.ts",
  "display.ts",
  "model.ts",
];

const REACT_IMPORT =
  /\bfrom\s+["'](react|react-dom|react-router)(\/[^"']*)?["']/;

describe("pure filter model is React-free", () => {
  for (const file of PURE_FILES) {
    it(`${file} imports no React/UI package`, () => {
      const source = readFileSync(path.join(FILTERS_DIR, file), "utf8");
      expect(source).not.toMatch(REACT_IMPORT);
    });
  }

  it("the model entry re-exports the core model API", async () => {
    const model = await import("~/shared/filters/model");
    expect(typeof model.matchesExpression).toBe("function");
    expect(typeof model.readFilterExpression).toBe("function");
    expect(typeof model.validateClause).toBe("function");
    expect(typeof model.filterRecords).toBe("function");
    // The React-coupled value-control seam is NOT part of the pure model entry.
    expect("FilterValueControls" in model).toBe(false);
  });
});
