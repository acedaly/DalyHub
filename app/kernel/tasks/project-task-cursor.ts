import { TaskValidationError } from "./task-errors";
export const PROJECT_TASK_CURSOR_VERSION = 1;
type Scope = {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly state: "open" | "completed" | "all";
};
export type ProjectTaskCursorPosition = {
  readonly completed: number;
  readonly due: string | null;
  readonly createdAt: string;
  readonly id: string;
};
const fail = () => {
  throw new TaskValidationError("id", "Invalid project task cursor.");
};
export function encodeProjectTaskCursor(
  scope: Scope,
  p: ProjectTaskCursorPosition,
) {
  return btoa(
    JSON.stringify([
      PROJECT_TASK_CURSOR_VERSION,
      scope.workspaceId,
      scope.projectId,
      scope.state,
      p.completed,
      p.due,
      p.createdAt,
      p.id,
    ]),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decodeProjectTaskCursorForScope(
  cursor: string,
  scope: Scope,
): ProjectTaskCursorPosition {
  try {
    const v = JSON.parse(
      atob(
        cursor
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(cursor.length + ((4 - (cursor.length % 4)) % 4), "="),
      ),
    );
    if (
      !Array.isArray(v) ||
      v.length !== 8 ||
      v[0] !== 1 ||
      v[1] !== scope.workspaceId ||
      v[2] !== scope.projectId ||
      v[3] !== scope.state ||
      !(v[4] === 0 || v[4] === 1) ||
      !(v[5] === null || typeof v[5] === "string") ||
      typeof v[6] !== "string" ||
      typeof v[7] !== "string"
    )
      return fail();
    return { completed: v[4], due: v[5], createdAt: v[6], id: v[7] };
  } catch {
    return fail();
  }
}
