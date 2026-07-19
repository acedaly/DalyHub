/**
 * DS-06 Shared Forms — the pure autosave coordinator.
 *
 * Autosave is where correctness is easiest to get wrong: overlapping saves,
 * responses arriving out of order, a slow save clobbering a newer edit, a failure
 * silently losing the user's latest input. DS-06 answers all of these in ONE
 * framework-free state machine so the behaviour is deterministic and testable.
 * Timing (debounce, blur) lives in the React hook; WHAT to do on each event lives
 * here.
 *
 * Invariants this machine guarantees:
 *   - Only ONE save is ever in flight; concurrent triggers coalesce to the LATEST
 *     value (saves are sequenced, never parallel).
 *   - A response is honoured only if it matches the in-flight sequence number; a
 *     stale/late response is ignored and can never move the status or overwrite a
 *     newer edit.
 *   - A successful save commits exactly the value that was sent (captured at
 *     dispatch), never the possibly-newer current value.
 *   - A failed save keeps the user's latest input intact and offers retry; it
 *     never auto-discards or auto-retries.
 *   - No save is dispatched while the current value is invalid.
 *
 * The reducer is pure: it returns the next state and, optionally, an EFFECT — a
 * request to the hook to run the persistence callback with a specific value and
 * sequence number. The hook runs the effect and dispatches the result back.
 */

import { valuesEqual, type IsEqual } from "./dirty";
import type { AutosaveStatus } from "./types";

/** The immutable state of one autosaving field. */
export interface AutosaveState<TValue> {
  readonly status: AutosaveStatus;
  /** The last value known to be persisted. */
  readonly committed: TValue;
  /** The latest edited value (what the input currently shows). */
  readonly current: TValue;
  /** Whether the current value passes validation (no save while invalid). */
  readonly valid: boolean;
  /** The sequence number of the in-flight save, or null when none is running. */
  readonly inFlightSeq: number | null;
  /** The value captured for the in-flight save, or null when none is running. */
  readonly inFlightValue: TValue | null;
  /** Monotonic allocator for the next save's sequence number. */
  readonly nextSeq: number;
  /** The message of the latest failed save, or null. */
  readonly error: string | null;
}

/** A request from the reducer to the hook to run the persistence callback. */
export type AutosaveEffect<TValue> = {
  readonly type: "save";
  readonly seq: number;
  readonly value: TValue;
} | null;

/** The reducer's output: the next state and an optional effect to run. */
export interface AutosaveTransition<TValue> {
  readonly state: AutosaveState<TValue>;
  readonly effect: AutosaveEffect<TValue>;
}

/** Actions the hook dispatches into the coordinator. */
export type AutosaveAction<TValue> =
  /** The user edited the value; `valid` reflects the new value's validity. */
  | { readonly type: "edit"; readonly value: TValue; readonly valid: boolean }
  /** A trigger fired (valid blur or debounce elapsed) — attempt a save. */
  | { readonly type: "requestSave" }
  /** The in-flight save with `seq` succeeded. */
  | { readonly type: "resolved"; readonly seq: number }
  /** The in-flight save with `seq` failed with a display message. */
  | {
      readonly type: "rejected";
      readonly seq: number;
      readonly message: string;
    }
  /** The user asked to retry after a failure. */
  | { readonly type: "retry" };

/** Build the initial coordinator state around a committed value. */
export function initAutosave<TValue>(committed: TValue): AutosaveState<TValue> {
  return {
    status: "idle",
    committed,
    current: committed,
    valid: true,
    inFlightSeq: null,
    inFlightValue: null,
    nextSeq: 1,
    error: null,
  };
}

function noEffect<TValue>(
  state: AutosaveState<TValue>,
): AutosaveTransition<TValue> {
  return { state, effect: null };
}

/** Dispatch a save of the current value, allocating a fresh sequence number. */
function dispatchSave<TValue>(
  state: AutosaveState<TValue>,
): AutosaveTransition<TValue> {
  const seq = state.nextSeq;
  return {
    state: {
      ...state,
      status: "saving",
      inFlightSeq: seq,
      inFlightValue: state.current,
      nextSeq: seq + 1,
      error: null,
    },
    effect: { type: "save", seq, value: state.current },
  };
}

/**
 * The pure autosave reducer. `isEqual` compares values for "nothing to save" and
 * "edited during flight" decisions; it defaults to the shared structural
 * equality.
 */
export function reduceAutosave<TValue>(
  state: AutosaveState<TValue>,
  action: AutosaveAction<TValue>,
  isEqual: IsEqual<TValue> = valuesEqual,
): AutosaveTransition<TValue> {
  switch (action.type) {
    case "edit": {
      const matchesCommitted = isEqual(action.value, state.committed);
      // A fresh edit supersedes a prior error; the input is always preserved.
      const status: AutosaveStatus = matchesCommitted
        ? state.inFlightSeq !== null
          ? "saving"
          : "idle"
        : "unsaved";
      return noEffect({
        ...state,
        current: action.value,
        valid: action.valid,
        status,
        error: null,
      });
    }

    case "requestSave": {
      if (!state.valid) return noEffect(state);
      if (isEqual(state.current, state.committed)) {
        // Nothing to persist; keep any in-flight save's status.
        return noEffect({
          ...state,
          status: state.inFlightSeq !== null ? "saving" : "idle",
        });
      }
      // A save already runs — do not start a parallel one. The in-flight
      // completion will coalesce to whatever `current` is by then.
      if (state.inFlightSeq !== null) {
        return noEffect({ ...state, status: "saving" });
      }
      return dispatchSave(state);
    }

    case "resolved": {
      // Ignore a stale/duplicate response that is not the current in-flight save.
      if (action.seq !== state.inFlightSeq) return noEffect(state);
      const committed = state.inFlightValue as TValue;
      const settled: AutosaveState<TValue> = {
        ...state,
        committed,
        inFlightSeq: null,
        inFlightValue: null,
        error: null,
      };
      // Edited during the save? Coalesce to the latest value if it is valid.
      if (!isEqual(settled.current, committed)) {
        if (settled.valid) return dispatchSave(settled);
        return noEffect({ ...settled, status: "unsaved" });
      }
      return noEffect({ ...settled, status: "saved" });
    }

    case "rejected": {
      if (action.seq !== state.inFlightSeq) return noEffect(state);
      // Keep `committed` unchanged and `current` intact; surface the error and
      // offer retry. Never auto-retry, never discard the draft.
      return noEffect({
        ...state,
        status: "error",
        inFlightSeq: null,
        inFlightValue: null,
        error: action.message,
      });
    }

    case "retry": {
      if (!state.valid) return noEffect({ ...state, error: null });
      if (isEqual(state.current, state.committed)) {
        return noEffect({ ...state, status: "saved", error: null });
      }
      if (state.inFlightSeq !== null) {
        return noEffect({ ...state, status: "saving", error: null });
      }
      return dispatchSave({ ...state, error: null });
    }

    default:
      return noEffect(state);
  }
}

/** True when the current value is persisted (idle or saved with no pending edit). */
export function isPersisted<TValue>(
  state: AutosaveState<TValue>,
  isEqual: IsEqual<TValue> = valuesEqual,
): boolean {
  return (
    state.inFlightSeq === null &&
    state.status !== "error" &&
    isEqual(state.current, state.committed)
  );
}
