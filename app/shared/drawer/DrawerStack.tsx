/**
 * DS-03 — the drawer stack renderer (internal).
 *
 * Rendered only while at least one drawer is open. It owns the concerns that are
 * per-stack rather than per-panel: body-scroll locking, making the whole
 * background inert, the single restrained backdrop beneath the top panel, and
 * evaluating the top drawer's `preventClose` guard before any close is honoured.
 * Every panel is keyed by its deterministic stack depth, so opening a higher
 * drawer never remounts the ones beneath it — their selected tab, scroll position
 * and local state survive untouched.
 *
 * The stack renders inline (no portal) so it server-renders for direct deep links
 * and degrades coherently without JavaScript; z-index layering uses DS-01 tokens.
 */

import { Fragment, useRef } from "react";
import type { RefObject } from "react";

import { Drawer } from "./Drawer";
import { useBodyScrollLock } from "./use-body-scroll-lock";
import { useInertBackground } from "./use-inert-background";
import type { DrawerEntry, DrawerRenderResult } from "./types";

export interface DrawerStackProps {
  readonly entries: readonly DrawerEntry[];
  readonly renderDrawer: (entry: DrawerEntry) => DrawerRenderResult | null;
  /** Per-depth opener elements captured at open time, for focus restoration. */
  readonly openers: RefObject<(HTMLElement | null)[]>;
  /** Close the top drawer via the controller (Back-aware). */
  readonly onRequestClose: () => void;
}

/** Evaluate a `preventClose` value (boolean or predicate). */
function isCloseBlocked(result: DrawerRenderResult | null): boolean {
  const preventClose = result?.preventClose;
  if (typeof preventClose === "function") {
    return preventClose();
  }
  return preventClose === true;
}

export function DrawerStack({
  entries,
  renderDrawer,
  openers,
  onRequestClose,
}: DrawerStackProps) {
  const stackRef = useRef<HTMLDivElement>(null);

  // Per-stack effects: lock the page and isolate everything behind the stack.
  useBodyScrollLock(true);
  useInertBackground(stackRef, true);

  // Resolve content once so the backdrop guard and the panels agree.
  const rendered = entries.map((entry) => ({
    entry,
    result: renderDrawer(entry),
  }));
  const top = rendered[rendered.length - 1];

  // A guarded close honoured by Escape, the header button and the backdrop.
  const attemptClose = () => {
    if (top && isCloseBlocked(top.result)) {
      return;
    }
    onRequestClose();
  };

  return (
    <div className="drawer-stack" ref={stackRef} data-drawer-stack="true">
      {rendered.map(({ entry, result }) => (
        <Fragment key={entry.depth}>
          {entry.isTop && (
            <div
              className="drawer-backdrop"
              data-drawer-backdrop="true"
              // The backdrop is a convenience click target; keyboard users close
              // via Escape or the labelled close button, so it needs no role.
              aria-hidden="true"
              onClick={attemptClose}
            />
          )}
          <Drawer
            entry={entry}
            result={result}
            opener={openers.current[entry.depth] ?? null}
            onClose={attemptClose}
          />
        </Fragment>
      ))}
    </div>
  );
}
