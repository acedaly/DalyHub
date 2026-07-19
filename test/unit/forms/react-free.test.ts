/**
 * DS-06 — architectural guard: the shared forms model imports no React.
 *
 * The DS-06 documentation and ADR-022 promise a framework-free model boundary
 * (`~/shared/forms/model`) so a server loader/action or a non-React consumer can
 * share the validation, save-state, autosave and entity-link filtering vocabulary
 * without resolving React. This static guard fails if any pure model file (or the
 * `model.ts` entry) imports `react`, `react-dom` or `react-router`. UI files
 * (controls, hosts, hooks) are intentionally excluded.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FORMS_DIR = path.resolve(
  import.meta.dirname,
  "../../../app/shared/forms",
);

// The pure model surface — must stay React-free.
const PURE_FILES = [
  "types.ts",
  "validation.ts",
  "dirty.ts",
  "tags.ts",
  "dates.ts",
  "field-ids.ts",
  "save-state.ts",
  "autosave.ts",
  "entity-link-model.ts",
  "model.ts",
];

const REACT_IMPORT =
  /\bfrom\s+["'](react|react-dom|react-router)(\/[^"']*)?["']/;

describe("pure forms model is React-free", () => {
  for (const file of PURE_FILES) {
    it(`${file} imports no React/UI package`, () => {
      const source = readFileSync(path.join(FORMS_DIR, file), "utf8");
      expect(source).not.toMatch(REACT_IMPORT);
    });
  }

  it("the model entry re-exports the core model API", async () => {
    const model = await import("~/shared/forms/model");
    expect(typeof model.composeValidators).toBe("function");
    expect(typeof model.required).toBe("function");
    expect(typeof model.valuesEqual).toBe("function");
    expect(typeof model.addTag).toBe("function");
    expect(typeof model.validateDateOnly).toBe("function");
    expect(typeof model.reduceAutosave).toBe("function");
    expect(typeof model.firstInvalidField).toBe("function");
    expect(typeof model.selectableTargets).toBe("function");
  });

  it("does not leak React controls or hooks into the pure entry", async () => {
    const model = await import("~/shared/forms/model");
    expect("TextField" in model).toBe(false);
    expect("useForm" in model).toBe(false);
    expect("EntityLinkPicker" in model).toBe(false);
  });
});
