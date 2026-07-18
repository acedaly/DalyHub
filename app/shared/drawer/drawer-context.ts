/**
 * DS-03 — the internal Drawer context.
 *
 * Carries the public {@link DrawerController} plus the small internal surface the
 * built-in `DrawerTrigger`/`DrawerClose` need (the parameter name and the
 * progressive-enhancement href builders). Consumers use the `useDrawer` hook and
 * never see this context directly; the implementation details (portalling —
 * there is none —, focus, history) are not exposed.
 */

import { createContext, useContext } from "react";

import type { DrawerController, DrawerKey } from "./types";

export interface DrawerContextValue extends DrawerController {
  /** The URL search-parameter name carrying the stack. */
  readonly param: string;
  /** Build the URL that would open `key` on top (for enhancement links). */
  buildOpenHref(key: DrawerKey): string;
  /** Build the URL that would close the top drawer (for enhancement links). */
  buildCloseHref(): string;
}

export const DrawerContext = createContext<DrawerContextValue | null>(null);

/** Internal accessor: throws when used outside a `DrawerProvider`. */
export function useDrawerContext(): DrawerContextValue {
  const value = useContext(DrawerContext);
  if (value === null) {
    throw new Error(
      "Drawer components must be rendered inside a <DrawerProvider>.",
    );
  }
  return value;
}
