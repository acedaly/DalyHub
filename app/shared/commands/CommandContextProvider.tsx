/**
 * DS-09 Command Palette — the contextual-actions provider (React-owned).
 *
 * Registered commands live in the IMMUTABLE module registry; CONTEXTUAL actions
 * are transient and belong to the currently rendered surface, Drawer or selection.
 * They must never mutate the registry (ADR-024 §24.6). This provider is the scoped,
 * React-owned home for them: mounted once at the AppShell boundary, it holds a
 * small registry of contextual `AppAction`s that surfaces add via a hook and that
 * is removed automatically on unmount — so a stale action can never survive a route
 * or Drawer change, and there is no module-level mutable singleton or global event
 * bus outside React's ownership.
 *
 * Ordering is deterministic (registration order, then declared order); duplicate
 * ids are resolved explicitly (first registration wins); the set is bounded. A
 * contextual action may close over a record or selection the current UI knows — but
 * the client context is never treated as server authority (ADR-024 §24.6).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MAX_CONTEXTUAL_ACTIONS, MAX_RECENT_COMMANDS } from "./limits";
import type { AppAction } from "./action";

/**
 * The registry (register/unregister) is a SEPARATE context from the actions list.
 * The registry object is stable for the provider's lifetime, so a registration
 * effect that depends on it never re-runs when the list changes — avoiding a
 * register→list-change→re-register loop. The list context carries the changing
 * value that only readers subscribe to.
 */
type ContextualRegistry = {
  readonly register: (id: string, actions: readonly AppAction[]) => void;
  readonly unregister: (id: string) => void;
};

const ContextualRegistryContext = createContext<ContextualRegistry | null>(
  null,
);
const ContextualActionsListContext = createContext<readonly AppAction[]>(
  Object.freeze([]),
);

/**
 * Recent-command ordering is session UI state that must OUTLIVE the palette:
 * AppShell unmounts `CommandPalette` (and its controller) on every close, so a
 * controller-owned recents ref would reset before the next open, and the
 * documented recent/suggested ordering (ADR-024 §24.10) would never be seen. This
 * store lives on the provider (mounted once at AppShell) instead. It is a ref with
 * STABLE accessors — recording a recent must not re-render the whole app subtree —
 * and the palette reads the current list fresh each time it opens.
 */
type CommandRecents = {
  readonly getRecentIds: () => readonly string[];
  readonly remember: (commandId: string) => void;
};

const CommandRecentsContext = createContext<CommandRecents | null>(null);

const EMPTY_ACTIONS: readonly AppAction[] = Object.freeze([]);
const EMPTY_ACTIONS_IDS: readonly string[] = Object.freeze([]);

/** Flatten registrations deterministically, deduping ids and bounding the total. */
function flatten(
  registrations: ReadonlyMap<string, readonly AppAction[]>,
): readonly AppAction[] {
  const seen = new Set<string>();
  const out: AppAction[] = [];
  for (const actions of registrations.values()) {
    for (const action of actions) {
      if (out.length >= MAX_CONTEXTUAL_ACTIONS) {
        return out;
      }
      if (!seen.has(action.id)) {
        seen.add(action.id);
        out.push(action);
      }
    }
  }
  return out;
}

/** Mount ONCE at the AppShell boundary. Owns all contextual actions. */
export function CommandContextProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [registrations, setRegistrations] = useState<
    ReadonlyMap<string, readonly AppAction[]>
  >(() => new Map());

  const register = useCallback((id: string, actions: readonly AppAction[]) => {
    setRegistrations((prev) => {
      const next = new Map(prev);
      next.set(id, actions);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setRegistrations((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const actions = useMemo(() => flatten(registrations), [registrations]);
  // Stable for the provider's lifetime — register/unregister never change.
  const registry = useMemo<ContextualRegistry>(
    () => ({ register, unregister }),
    [register, unregister],
  );

  // Session-scoped recents, held on the provider so they survive palette
  // open/close. Ref-backed with stable accessors — recording a recent never
  // re-renders the app; the palette reads the current list when it next opens.
  const recentsRef = useRef<readonly string[]>(EMPTY_ACTIONS_IDS);
  const recents = useMemo<CommandRecents>(
    () => ({
      getRecentIds: () => recentsRef.current,
      remember: (commandId: string) => {
        recentsRef.current = [
          commandId,
          ...recentsRef.current.filter((id) => id !== commandId),
        ].slice(0, MAX_RECENT_COMMANDS);
      },
    }),
    [],
  );

  return (
    <ContextualRegistryContext.Provider value={registry}>
      <CommandRecentsContext.Provider value={recents}>
        <ContextualActionsListContext.Provider value={actions}>
          {children}
        </ContextualActionsListContext.Provider>
      </CommandRecentsContext.Provider>
    </ContextualRegistryContext.Provider>
  );
}

/**
 * Register a bounded set of contextual actions for the lifetime of the calling
 * component. Automatically removed on unmount, so a route/Drawer change cannot
 * leave a stale action behind.
 */
export function useRegisterContextualActions(
  actions: readonly AppAction[],
): void {
  const registry = useContext(ContextualRegistryContext);
  const registrationId = useId();

  // Re-register whenever the `actions` array REFERENCE changes, so the registry
  // always holds the latest action objects — including closures (`target` / `run`)
  // that close over the current selection or record, even when the visible
  // presentation fields (id/title/subtitle/kind/disabled) are unchanged. This does
  // not loop: registration writes provider state, which only re-renders subscribers
  // of the LIST context (the palette). The registering surface subscribes to the
  // stable REGISTRY context only, and the provider's `children` element is
  // referentially stable across the provider's own state updates, so its subtree is
  // not re-rendered by a registration — the array reference changes only when the
  // caller itself re-renders for its own reasons. Callers that rebuild an array with
  // unchanged content each render should memoise it (as Today does) to avoid churn.
  useEffect(() => {
    if (registry === null) {
      return;
    }
    registry.register(registrationId, actions);
    return () => registry.unregister(registrationId);
  }, [registry, registrationId, actions]);
}

/** Read the current, deterministically-ordered contextual actions. */
export function useContextualActions(): readonly AppAction[] {
  return useContext(ContextualActionsListContext) ?? EMPTY_ACTIONS;
}

/**
 * The session-scoped recent-command store (or null with no provider). It survives
 * the palette unmounting on close, so recent/suggested ordering is visible across
 * openings.
 */
export function useCommandRecents(): CommandRecents | null {
  return useContext(CommandRecentsContext);
}

export type { CommandRecents };
