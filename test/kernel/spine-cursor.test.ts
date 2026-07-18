import { describe, expect, it } from "vitest";

import {
  InvalidSpineCursorError,
  SPINE_CURSOR_VERSION,
  decodeSpineCursor,
  decodeSpineCursorForScope,
  encodeSpineCursor,
  type SpineCursorScope,
} from "~/kernel/spine";

// FND-07: the child-listing cursor is opaque, versioned and bound to its scope
// (workspace, parent, child kind, deleted-mode). A cursor replayed under any other
// scope — or a malformed one — is rejected, never silently reinterpreted.

const scope: SpineCursorScope = {
  workspaceId: "ws1",
  parentId: "area1",
  childKind: "task",
  includeDeleted: false,
};

const position = { createdAt: "2026-07-18T00:00:00.000Z", id: "t1" };

describe("spine cursor", () => {
  it("round-trips scope and position", () => {
    const cursor = encodeSpineCursor(scope, position);
    const decoded = decodeSpineCursor(cursor);
    expect(decoded.scope).toEqual(scope);
    expect(decoded.position).toEqual(position);
  });

  it("accepts a cursor replayed under the same scope", () => {
    const cursor = encodeSpineCursor(scope, position);
    expect(decodeSpineCursorForScope(cursor, scope)).toEqual(position);
  });

  it("rejects a cursor replayed under a different parent", () => {
    const cursor = encodeSpineCursor(scope, position);
    expect(() =>
      decodeSpineCursorForScope(cursor, { ...scope, parentId: "area2" }),
    ).toThrow(InvalidSpineCursorError);
  });

  it("rejects a cursor replayed under a different child kind", () => {
    const cursor = encodeSpineCursor(scope, position);
    expect(() =>
      decodeSpineCursorForScope(cursor, { ...scope, childKind: "project" }),
    ).toThrow(InvalidSpineCursorError);
  });

  it("rejects a cursor replayed under a different workspace", () => {
    const cursor = encodeSpineCursor(scope, position);
    expect(() =>
      decodeSpineCursorForScope(cursor, { ...scope, workspaceId: "ws2" }),
    ).toThrow(InvalidSpineCursorError);
  });

  it("rejects a cursor replayed under a different deleted-mode", () => {
    const cursor = encodeSpineCursor(scope, position);
    expect(() =>
      decodeSpineCursorForScope(cursor, { ...scope, includeDeleted: true }),
    ).toThrow(InvalidSpineCursorError);
  });

  it("rejects malformed, empty and wrong-version cursors", () => {
    expect(() => decodeSpineCursor("")).toThrow(InvalidSpineCursorError);
    expect(() => decodeSpineCursor("!!!not-base64!!!")).toThrow(
      InvalidSpineCursorError,
    );
    const wrongVersion = btoa(
      JSON.stringify([
        SPINE_CURSOR_VERSION + 1,
        "ws1",
        "area1",
        "task",
        0,
        "t",
        "i",
      ]),
    );
    expect(() => decodeSpineCursor(wrongVersion)).toThrow(
      InvalidSpineCursorError,
    );
    const badKind = btoa(
      JSON.stringify([
        SPINE_CURSOR_VERSION,
        "ws1",
        "area1",
        "nope",
        0,
        "t",
        "i",
      ]),
    );
    expect(() => decodeSpineCursor(badKind)).toThrow(InvalidSpineCursorError);
  });
});
