/**
 * DS-03 — the Drawer URL contract (pure helpers).
 *
 * Proves the deep-link/stack encoding is deterministic and, crucially, that every
 * transform preserves unrelated query parameters — the drawer stack must never
 * discard a page's existing filters or state.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAWER_PARAM,
  readDrawerStack,
  withAllDrawersRemoved,
  withDrawerPushed,
  withTopDrawerRemoved,
  withTopDrawerReplaced,
} from "~/shared/drawer";

const P = DEFAULT_DRAWER_PARAM;

describe("readDrawerStack", () => {
  it("reads the ordered stack, backmost first", () => {
    const params = new URLSearchParams("drawer=a&drawer=b&drawer=c");
    expect(readDrawerStack(params)).toEqual(["a", "b", "c"]);
  });

  it("ignores empty/whitespace-only drawer values", () => {
    const params = new URLSearchParams("drawer=a&drawer=&drawer=%20&drawer=b");
    expect(readDrawerStack(params)).toEqual(["a", "b"]);
  });

  it("returns an empty stack when no drawer param is present", () => {
    expect(readDrawerStack(new URLSearchParams("status=active"))).toEqual([]);
  });
});

describe("withDrawerPushed", () => {
  it("pushes a new key onto the top of the stack", () => {
    const next = withDrawerPushed(new URLSearchParams("drawer=a"), "b");
    expect(readDrawerStack(next)).toEqual(["a", "b"]);
  });

  it("preserves unrelated query parameters and their order", () => {
    const next = withDrawerPushed(
      new URLSearchParams("status=active&drawer=a&tab=tasks"),
      "b",
    );
    expect(next.get("status")).toBe("active");
    expect(next.get("tab")).toBe("tasks");
    expect(readDrawerStack(next)).toEqual(["a", "b"]);
  });

  it("encodes keys containing a colon safely and round-trips them", () => {
    const next = withDrawerPushed(new URLSearchParams(), "project:alpha");
    expect(next.toString()).toContain("project%3Aalpha");
    expect(readDrawerStack(next)).toEqual(["project:alpha"]);
  });
});

describe("withTopDrawerReplaced", () => {
  it("replaces the top key in place", () => {
    const next = withTopDrawerReplaced(
      new URLSearchParams("drawer=a&drawer=b"),
      "c",
    );
    expect(readDrawerStack(next)).toEqual(["a", "c"]);
  });

  it("opens a drawer when the stack is empty", () => {
    const next = withTopDrawerReplaced(new URLSearchParams("q=1"), "a");
    expect(readDrawerStack(next)).toEqual(["a"]);
    expect(next.get("q")).toBe("1");
  });
});

describe("withTopDrawerRemoved", () => {
  it("removes only the top level", () => {
    const next = withTopDrawerRemoved(
      new URLSearchParams("drawer=a&drawer=b&drawer=c"),
    );
    expect(readDrawerStack(next)).toEqual(["a", "b"]);
  });

  it("preserves unrelated parameters when closing the last drawer", () => {
    const next = withTopDrawerRemoved(
      new URLSearchParams("status=active&drawer=a"),
    );
    expect(readDrawerStack(next)).toEqual([]);
    expect(next.get("status")).toBe("active");
  });
});

describe("withAllDrawersRemoved", () => {
  it("removes every drawer but keeps other parameters", () => {
    const next = withAllDrawersRemoved(
      new URLSearchParams("status=active&drawer=a&drawer=b"),
    );
    expect(readDrawerStack(next)).toEqual([]);
    expect(next.get("status")).toBe("active");
  });
});

describe("custom parameter name", () => {
  it("honours a non-default parameter", () => {
    const next = withDrawerPushed(new URLSearchParams(), "a", "panel");
    expect(readDrawerStack(next, "panel")).toEqual(["a"]);
    expect(readDrawerStack(next, P)).toEqual([]);
  });
});
