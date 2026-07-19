/**
 * DS-06 Shared Forms — the unsaved-changes confirm surface.
 *
 * Renders nothing until an in-app navigation is held by
 * {@link useUnsavedChangesPrompt} while the form is dirty. When held, it shows a
 * small, accessible confirm dialog so the departure is never silent: the user
 * explicitly chooses to leave (discarding the draft) or stay. The safe choice
 * (Stay) receives initial focus.
 *
 * Page-unload (tab close / reload) is handled by the same hook via the browser's
 * native prompt; this component covers in-app navigation.
 */

import { useEffect, useRef } from "react";

import { useUnsavedChangesPrompt } from "./use-unsaved-changes";

export interface UnsavedChangesGuardProps {
  /** Arm the guard while true (typically `form.isDirty && !form.isSubmitting`). */
  readonly when: boolean;
  /** The dialog heading. */
  readonly title?: string;
  /** The explanatory body. */
  readonly message?: string;
  /** Label for the confirm/leave action. */
  readonly leaveLabel?: string;
  /** Label for the cancel/stay action. */
  readonly stayLabel?: string;
}

export function UnsavedChangesGuard({
  when,
  title = "Leave with unsaved changes?",
  message = "You've made changes that haven't been saved. If you leave now, they'll be lost.",
  leaveLabel = "Leave",
  stayLabel = "Stay",
}: UnsavedChangesGuardProps) {
  const { blocked, proceed, stay } = useUnsavedChangesPrompt(when);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (blocked) stayRef.current?.focus();
  }, [blocked]);

  if (!blocked) return null;

  return (
    <div className="dh-unsaved-guard" role="presentation">
      <div className="dh-unsaved-guard__scrim" />
      {/* A modal alertdialog legitimately handles Escape to cancel; the actions
          are real buttons, so this is not the only interactive path. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="dh-unsaved-guard__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dh-unsaved-guard-title"
        aria-describedby="dh-unsaved-guard-body"
        onKeyDown={(event) => {
          if (event.key === "Escape") stay();
        }}
      >
        <h2 id="dh-unsaved-guard-title" className="dh-unsaved-guard__title">
          {title}
        </h2>
        <p id="dh-unsaved-guard-body" className="dh-unsaved-guard__body">
          {message}
        </p>
        <div className="dh-unsaved-guard__actions">
          <button
            type="button"
            className="dh-btn dh-btn--secondary"
            ref={stayRef}
            onClick={stay}
          >
            {stayLabel}
          </button>
          <button
            type="button"
            className="dh-btn dh-btn--danger"
            onClick={proceed}
          >
            {leaveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
