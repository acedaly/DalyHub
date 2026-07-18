/**
 * DS-03 — the public, typed Drawer hook.
 *
 * Returns the imperative {@link DrawerController} for the nearest `DrawerProvider`.
 * Any control can open or close drawers with it; the URL/history, focus and
 * inertness plumbing stays behind the provider. Must be called inside a
 * `DrawerProvider` (throws otherwise, to fail loudly rather than silently no-op).
 */

import { useDrawerContext } from "./drawer-context";
import type { DrawerController } from "./types";

export function useDrawer(): DrawerController {
  const {
    entries,
    depth,
    isOpen,
    topKey,
    openDrawer,
    replaceDrawer,
    closeDrawer,
    closeAll,
  } = useDrawerContext();
  return {
    entries,
    depth,
    isOpen,
    topKey,
    openDrawer,
    replaceDrawer,
    closeDrawer,
    closeAll,
  };
}
