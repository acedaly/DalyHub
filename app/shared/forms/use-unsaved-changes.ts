/**
 * DS-06 Shared Forms — unsaved-changes navigation protection.
 *
 * A draft the user has not committed must never be discarded silently. This hook
 * intercepts BOTH kinds of departure while a form is dirty:
 *   - in-app navigation (a link, a Back button) via React Router's `useBlocker`,
 *     surfaced as a `blocked` state the UI turns into an explicit confirm;
 *   - a full-page unload (tab close, reload) via `beforeunload`, which shows the
 *     browser's native "leave site?" prompt.
 *
 * The interception is only ARMED while `when` is true (i.e. the form is dirty and
 * not mid-save), so a clean form never nags. It lives in a dedicated hook so the
 * router dependency stays out of the pure model and the individual controls.
 */

import { useEffect } from "react";
import { useBeforeUnload, useBlocker } from "react-router";

export interface UnsavedChangesPrompt {
  /** True when an in-app navigation is currently held pending confirmation. */
  readonly blocked: boolean;
  /** Allow the held navigation to continue (discard the draft). */
  readonly proceed: () => void;
  /** Cancel the held navigation and stay on the form. */
  readonly stay: () => void;
}

/**
 * Arm unsaved-changes protection while `when` is true. Returns the current
 * blocked state and the two resolutions (proceed / stay) for the confirm UI.
 */
export function useUnsavedChangesPrompt(when: boolean): UnsavedChangesPrompt {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useBeforeUnload(
    (event) => {
      if (!when) return;
      event.preventDefault();
      // Legacy browsers require a returnValue to trigger the native prompt.
      event.returnValue = "";
    },
    { capture: true },
  );

  // If the guard disarms (e.g. after a successful save) while a navigation is
  // held, release it so the user is not stranded.
  useEffect(() => {
    if (!when && blocker.state === "blocked") {
      blocker.proceed();
    }
  }, [when, blocker]);

  return {
    blocked: blocker.state === "blocked",
    proceed: () => {
      if (blocker.state === "blocked") blocker.proceed();
    },
    stay: () => {
      if (blocker.state === "blocked") blocker.reset();
    },
  };
}
