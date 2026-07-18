/**
 * DS-03 — the Drawer provider (mount once).
 *
 * The single component a surface mounts to gain drawers. It:
 *   - derives the open stack purely from the URL (a repeated `drawer` search
 *     param), so the rendered stack is a deterministic function of the address —
 *     deep-linkable, shareable, refresh-proof and Back/Forward-correct;
 *   - exposes an imperative controller (`useDrawer`) whose every mutation is a real
 *     navigation (open pushes a history entry; close is Back-aware);
 *   - renders the underlying page (`children`) and, when open, the drawer stack as
 *     a sibling so the stack can make the page — and the whole app shell — inert.
 *
 * It stays strictly entity-agnostic: the only thing it knows about a record is the
 * opaque key in the URL, which it hands to the caller-supplied `renderDrawer`.
 * Callers manage no focus traps, portals, history entries or z-index.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import type { ReactNode } from "react";

import { DrawerContext } from "./drawer-context";
import type { DrawerContextValue } from "./drawer-context";
import { DrawerStack } from "./DrawerStack";
import {
  DEFAULT_DRAWER_PARAM,
  MAX_DRAWER_DEPTH,
  readDrawerStack,
  withAllDrawersRemoved,
  withDrawerPushed,
  withTopDrawerRemoved,
  withTopDrawerReplaced,
} from "./drawer-url";
import type { DrawerController, DrawerEntry, DrawerKey } from "./types";
import type { DrawerRenderResult } from "./types";

export interface DrawerProviderProps {
  /** The underlying page content the drawers open over. */
  readonly children: ReactNode;
  /**
   * Map an open stack entry to its presentation. Called for every level on every
   * render, including on a fresh deep-link load, so content must be derivable from
   * the key alone. Return `null` for an unknown key to get the graceful not-found
   * panel.
   */
  readonly renderDrawer: (entry: DrawerEntry) => DrawerRenderResult | null;
  /** The URL search-parameter name carrying the stack. Defaults to `drawer`. */
  readonly param?: string;
  /** Stack-depth ceiling guarding pathological loops. Defaults to 12. */
  readonly maxDepth?: number;
}

/** True when the browser has an in-app history entry to return to. */
function canNavigateBack(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const state = window.history.state as { idx?: number } | null;
  return (state?.idx ?? 0) > 0;
}

export function DrawerProvider({
  children,
  renderDrawer,
  param = DEFAULT_DRAWER_PARAM,
  maxDepth = MAX_DRAWER_DEPTH,
}: DrawerProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // The opener control per depth, captured synchronously at open time so focus
  // can return to it on close.
  const openers = useRef<(HTMLElement | null)[]>([]);

  const stack = useMemo(
    () => readDrawerStack(searchParams, param),
    [searchParams, param],
  );

  const entries = useMemo<DrawerEntry[]>(
    () =>
      stack.map((key, index) => ({
        key,
        depth: index,
        isTop: index === stack.length - 1,
      })),
    [stack],
  );

  const captureOpener = useCallback((depth: number) => {
    if (typeof document !== "undefined") {
      openers.current[depth] =
        (document.activeElement as HTMLElement | null) ?? null;
    }
  }, []);

  const openDrawer = useCallback(
    (key: DrawerKey) => {
      const current = readDrawerStack(searchParams, param);
      if (current[current.length - 1] === key) {
        // Re-opening the current top is a no-op — never duplicate a level.
        return;
      }
      if (current.length >= maxDepth) {
        if (import.meta.env.DEV) {
          console.warn(
            `[drawer] maximum stack depth (${maxDepth}) reached; replacing the top level instead of stacking further.`,
          );
        }
        captureOpener(current.length - 1);
        setSearchParams((prev) => withTopDrawerReplaced(prev, key, param), {
          replace: true,
          preventScrollReset: true,
        });
        return;
      }
      captureOpener(current.length);
      setSearchParams((prev) => withDrawerPushed(prev, key, param), {
        preventScrollReset: true,
      });
    },
    [searchParams, setSearchParams, param, maxDepth, captureOpener],
  );

  const replaceDrawer = useCallback(
    (key: DrawerKey) => {
      setSearchParams((prev) => withTopDrawerReplaced(prev, key, param), {
        replace: true,
        preventScrollReset: true,
      });
    },
    [setSearchParams, param],
  );

  const closeDrawer = useCallback(() => {
    const current = readDrawerStack(searchParams, param);
    if (current.length === 0) {
      return;
    }
    // Prefer real Back so Forward can restore the drawer; but a direct deep link
    // has no in-app history to return to, so fall back to dropping the top param
    // in place (a replace, to avoid stranding a forward entry).
    if (canNavigateBack()) {
      navigate(-1);
    } else {
      setSearchParams((prev) => withTopDrawerRemoved(prev, param), {
        replace: true,
        preventScrollReset: true,
      });
    }
  }, [searchParams, setSearchParams, navigate, param]);

  const closeAll = useCallback(() => {
    setSearchParams((prev) => withAllDrawersRemoved(prev, param), {
      preventScrollReset: true,
    });
  }, [setSearchParams, param]);

  const buildHref = useCallback(
    (nextParams: URLSearchParams) => {
      const query = nextParams.toString();
      return query ? `${location.pathname}?${query}` : location.pathname;
    },
    [location.pathname],
  );

  const buildOpenHref = useCallback(
    (key: DrawerKey) => buildHref(withDrawerPushed(searchParams, key, param)),
    [buildHref, searchParams, param],
  );

  const buildCloseHref = useCallback(
    () => buildHref(withTopDrawerRemoved(searchParams, param)),
    [buildHref, searchParams, param],
  );

  const controller = useMemo<DrawerController>(
    () => ({
      entries,
      depth: entries.length,
      isOpen: entries.length > 0,
      topKey: entries[entries.length - 1]?.key,
      openDrawer,
      replaceDrawer,
      closeDrawer,
      closeAll,
    }),
    [entries, openDrawer, replaceDrawer, closeDrawer, closeAll],
  );

  const contextValue = useMemo<DrawerContextValue>(
    () => ({ ...controller, param, buildOpenHref, buildCloseHref }),
    [controller, param, buildOpenHref, buildCloseHref],
  );

  // Focus safety net on close. A closing drawer restores focus to its opener when
  // it has one; a directly deep-linked drawer has none, so focus can fall to
  // `<body>`. When a close leaves focus there, place it sensibly: into the newly
  // revealed top drawer if the stack still has one (so a lower modal is never left
  // without focus), else the page's main region. The opener path is always
  // preferred — this only acts when focus was actually lost.
  const previousDepthRef = useRef(controller.depth);
  useEffect(() => {
    const previousDepth = previousDepthRef.current;
    previousDepthRef.current = controller.depth;
    if (controller.depth >= previousDepth || typeof document === "undefined") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active !== null && active !== document.body) {
        return;
      }
      const topClose = document.querySelector<HTMLElement>(
        '[data-drawer-stack] .drawer[data-top="true"] .drawer__close',
      );
      if (topClose !== null) {
        topClose.focus();
        return;
      }
      document.getElementById("main-content")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [controller.depth]);

  return (
    <DrawerContext.Provider value={contextValue}>
      <div className="drawer-background">{children}</div>
      {controller.isOpen && (
        <DrawerStack
          entries={controller.entries}
          renderDrawer={renderDrawer}
          openers={openers}
          onRequestClose={closeDrawer}
        />
      )}
    </DrawerContext.Provider>
  );
}
