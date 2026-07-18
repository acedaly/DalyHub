/**
 * DS-07 — the storage-agnostic saved-view contract.
 *
 * A saved view is a named filter expression the user can return to. The contract
 * here is pure data and storage-agnostic: DS-07 does NOT persist saved views (no
 * D1, no migration). A consumer supplies views and change callbacks; a
 * development fixture may hold them in memory. Real persistence arrives with a
 * later roadmap item (X-02), behind this same shape.
 */

import { expressionsEqual } from "./validate";
import type { FilterExpression } from "./types";

/** A saved, named filter view. */
export interface SavedView {
  readonly id: string;
  readonly name: string;
  readonly expression: FilterExpression;
  readonly description?: string;
  /** Optional metadata; only present where a store finds it useful. */
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * The adapter the shared Filter Bar consumes. Every callback is optional so a
 * read-only host can omit mutation. The bar never persists; it only signals intent.
 *
 * The bar exposes exactly the interactions listed here — select, save-as, update
 * and delete. Renaming has NO Filter Bar interaction yet, so no `onRename` callback
 * is exposed; a saved-view *management* surface (rename, reorder, share) arrives
 * with X-02. This keeps the public contract honest — it never advertises a callback
 * the bar does not drive.
 */
export interface SavedViewAdapter {
  readonly views: readonly SavedView[];
  readonly activeViewId?: string;
  readonly onSelect?: (viewId: string | null) => void;
  readonly onSaveRequested?: (name: string) => void;
  readonly onUpdateRequested?: (viewId: string) => void;
  readonly onDeleteRequested?: (viewId: string) => void;
}

/** Find a saved view by id. */
export function findSavedView(
  views: readonly SavedView[],
  viewId: string | undefined,
): SavedView | undefined {
  if (viewId === undefined) {
    return undefined;
  }
  return views.find((view) => view.id === viewId);
}

/**
 * True when the current expression differs from the active saved view's — i.e. the
 * view has been modified and not yet saved. A missing/obsolete active view is not
 * "modified" (there is nothing to modify against).
 */
export function isViewModified(
  view: SavedView | undefined,
  current: FilterExpression,
): boolean {
  if (view === undefined) {
    return false;
  }
  return !expressionsEqual(view.expression, current);
}
