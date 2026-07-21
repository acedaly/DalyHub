import { ProjectStorageError } from "./project-errors";

export const PROJECT_CURSOR_VERSION = 1;
export type ProjectCursorScope = {
  readonly workspaceId: string;
  readonly state: "open" | "completed" | "all";
  readonly orderBy: "created" | "recent";
};
export type ProjectCursorPosition = {
  readonly timestamp: string;
  readonly id: string;
};
const encode = (value: unknown) =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (value: string): unknown => {
  try {
    const padded = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    throw new ProjectStorageError("Invalid project cursor.");
  }
};
export function encodeProjectCursor(
  scope: ProjectCursorScope,
  position: ProjectCursorPosition,
): string {
  return encode([
    PROJECT_CURSOR_VERSION,
    scope.workspaceId,
    scope.state,
    scope.orderBy,
    position.timestamp,
    position.id,
  ]);
}
export function decodeProjectCursorForScope(
  cursor: string,
  scope: ProjectCursorScope,
): ProjectCursorPosition {
  const parsed = decode(cursor);
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 6 ||
    parsed[0] !== PROJECT_CURSOR_VERSION ||
    parsed[1] !== scope.workspaceId ||
    parsed[2] !== scope.state ||
    parsed[3] !== scope.orderBy ||
    typeof parsed[4] !== "string" ||
    !parsed[4] ||
    typeof parsed[5] !== "string" ||
    !parsed[5]
  )
    throw new ProjectStorageError("Invalid project cursor.");
  return { timestamp: parsed[4], id: parsed[5] };
}
