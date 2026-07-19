/**
 * DS-08 Shared Search — the incremental search controller (React).
 *
 * Deterministic incremental search with no arbitrary timeouts:
 *
 *   - a restrained debounce coalesces keystrokes into at most one in-flight
 *     request per pause;
 *   - each new request aborts the previous one and carries a monotonic sequence
 *     number, so a slower earlier response can NEVER replace a newer one (the
 *     sequence guard is authoritative; the abort is best-effort cleanup);
 *   - an empty/invalid query returns to idle and executes no provider;
 *   - loading keeps valid prior results visible rather than flashing empty;
 *   - a partial provider failure still shows healthy results;
 *   - clearing the query cancels pending work; nothing updates state after unmount;
 *   - no raw error text is ever surfaced.
 *
 * The `search` function is injected (default: the server transport), so the demo
 * route and component tests drive the exact same controller with a local function.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { fetchSearch, type SearchFn } from "./client";
import { flattenGroups } from "./grouping";
import { firstIndex, lastIndex, nextIndex, previousIndex } from "./selection";
import { isExecutableQuery, normaliseQuery } from "./query";
import type {
  RankedSearchResult,
  SearchOutcome,
  SearchResultGroup,
} from "./types";

/** The restrained debounce before a query is dispatched (ms). */
export const SEARCH_DEBOUNCE_MS = 160;

export type SearchPhase = "idle" | "loading" | "ready" | "error";

type State = {
  readonly query: string;
  readonly phase: SearchPhase;
  readonly outcome: SearchOutcome | null;
  readonly activeIndex: number;
};

type Action =
  | { readonly type: "setQuery"; readonly query: string }
  | { readonly type: "idle" }
  | { readonly type: "loading" }
  | { readonly type: "resolved"; readonly outcome: SearchOutcome }
  | { readonly type: "error" }
  | { readonly type: "move"; readonly index: number };

const INITIAL: State = {
  query: "",
  phase: "idle",
  outcome: null,
  activeIndex: -1,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setQuery":
      return { ...state, query: action.query };
    case "idle":
      return { ...state, phase: "idle", outcome: null, activeIndex: -1 };
    case "loading":
      // Keep the previous outcome visible while loading.
      return { ...state, phase: "loading" };
    case "resolved":
      return {
        ...state,
        phase: action.outcome.status === "error" ? "error" : "ready",
        outcome: action.outcome,
        activeIndex: -1,
      };
    case "error":
      return { ...state, phase: "error" };
    case "move":
      return { ...state, activeIndex: action.index };
    default:
      return state;
  }
}

export type SearchController = {
  readonly query: string;
  readonly phase: SearchPhase;
  readonly outcome: SearchOutcome | null;
  readonly groups: readonly SearchResultGroup[];
  readonly flatResults: readonly RankedSearchResult[];
  readonly activeIndex: number;
  readonly activeResult: RankedSearchResult | null;
  readonly isEmpty: boolean;
  readonly isPartial: boolean;
  readonly hasResults: boolean;
  setQuery(next: string): void;
  clear(): void;
  retry(): void;
  moveDown(): void;
  moveUp(): void;
  moveHome(): void;
  moveEnd(): void;
  setActiveIndex(index: number): void;
};

export type UseSearchControllerOptions = {
  /** The search function (default: the server transport). */
  readonly search?: SearchFn;
  /** Debounce in ms (default {@link SEARCH_DEBOUNCE_MS}). */
  readonly debounceMs?: number;
};

export function useSearchController(
  options: UseSearchControllerOptions = {},
): SearchController {
  const { search = fetchSearch, debounceMs = SEARCH_DEBOUNCE_MS } = options;

  const [state, dispatch] = useReducer(reducer, INITIAL);

  const mountedRef = useRef(true);
  const seqRef = useRef(0);
  const latestSeqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchRef = useRef<SearchFn>(search);
  searchRef.current = search;

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current !== null) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const run = useCallback(
    (rawQuery: string) => {
      const normalised = normaliseQuery(rawQuery);
      if (!isExecutableQuery(normalised)) {
        cancelPending();
        latestSeqRef.current = seqRef.current + 1;
        seqRef.current = latestSeqRef.current;
        dispatch({ type: "idle" });
        return;
      }

      if (abortRef.current !== null) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      seqRef.current += 1;
      const seq = seqRef.current;
      latestSeqRef.current = seq;

      dispatch({ type: "loading" });

      searchRef.current(normalised, controller.signal).then(
        (outcome) => {
          if (!mountedRef.current || seq !== latestSeqRef.current) {
            return; // stale or unmounted — never replace newer results
          }
          dispatch({ type: "resolved", outcome });
        },
        () => {
          if (controller.signal.aborted) {
            return; // superseded/cleared — not an error
          }
          if (!mountedRef.current || seq !== latestSeqRef.current) {
            return;
          }
          dispatch({ type: "error" });
        },
      );
    },
    [cancelPending],
  );

  const setQuery = useCallback(
    (next: string) => {
      dispatch({ type: "setQuery", query: next });
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      const normalised = normaliseQuery(next);
      if (!isExecutableQuery(normalised)) {
        // Empty/invalid: cancel any pending work and return to idle immediately.
        cancelPending();
        latestSeqRef.current = seqRef.current + 1;
        seqRef.current = latestSeqRef.current;
        dispatch({ type: "idle" });
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        run(next);
      }, debounceMs);
    },
    [cancelPending, debounceMs, run],
  );

  const clear = useCallback(() => {
    cancelPending();
    latestSeqRef.current = seqRef.current + 1;
    seqRef.current = latestSeqRef.current;
    dispatch({ type: "setQuery", query: "" });
    dispatch({ type: "idle" });
  }, [cancelPending]);

  const retry = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    run(state.query);
  }, [run, state.query]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelPending();
    };
  }, [cancelPending]);

  const outcome = state.outcome;
  const groups = useMemo(() => outcome?.groups ?? [], [outcome]);
  const flatResults = useMemo(() => flattenGroups(groups), [groups]);
  const count = flatResults.length;

  const move = useCallback(
    (index: number) => dispatch({ type: "move", index }),
    [],
  );

  const activeResult =
    state.activeIndex >= 0 && state.activeIndex < count
      ? flatResults[state.activeIndex]
      : null;

  return {
    query: state.query,
    phase: state.phase,
    outcome,
    groups,
    flatResults,
    activeIndex: state.activeIndex,
    activeResult,
    isEmpty: state.phase === "ready" && count === 0,
    isPartial: outcome?.status === "partial",
    hasResults: count > 0,
    setQuery,
    clear,
    retry,
    moveDown: () => move(nextIndex(state.activeIndex, count)),
    moveUp: () => move(previousIndex(state.activeIndex, count)),
    moveHome: () => move(firstIndex(count)),
    moveEnd: () => move(lastIndex(count)),
    setActiveIndex: (index: number) => move(index),
  };
}
