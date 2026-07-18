/**
 * DS-03 — lock page scrolling while a modal drawer is open, preserving position.
 *
 * When `active`, the page behind the drawer must not scroll (the drawer's own
 * content scrolls independently) AND must not lose the user's place. We disable
 * scrolling with `overflow: hidden` on the root scroll container, which freezes the
 * page WITHOUT changing its offset, and compensate the scrollbar width so the
 * viewport-fixed drawer does not shift when the page scrollbar disappears.
 *
 * A drawer open/close is a same-document overlay, so the page must return to
 * exactly where it was. Closing dismisses the drawer with a history POP, and React
 * Router's `ScrollRestoration` applies a scroll on that POP — sometimes on a later
 * tick than a single rAF, which is why we **reassert** the captured offset across
 * the next several frames until it stays put (bounded, and released early once
 * stable). Combined with the app's path-keyed `ScrollRestoration` (ADR-018 §18.6),
 * this makes scroll preservation deterministic. Runs as a layout effect so the
 * freeze/release happen in the same commit, and every mutated value is restored, so
 * nothing leaks.
 */

import { useEffect, useLayoutEffect } from "react";

// `useLayoutEffect` warns during SSR; fall back to `useEffect` on the server, where
// there is no scrolling to lock anyway.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Reassert scroll until it has held for this many consecutive frames, capped so a
// misbehaving restore never traps scrolling for long. Fast path (~4 frames) when
// nothing fights us; up to ~24 frames if a late POP restore needs correcting.
const STABLE_FRAMES = 4;
const MAX_FRAMES = 24;

export function useBodyScrollLock(active: boolean): void {
  useIsomorphicLayoutEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const { body } = document;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const previousRootOverflow = root.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;

    root.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.paddingRight = previousBodyPaddingRight;

      let frame = 0;
      let stable = 0;
      const reassert = () => {
        if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
          window.scrollTo(scrollX, scrollY);
          stable = 0;
        } else {
          stable += 1;
        }
        frame += 1;
        if (stable < STABLE_FRAMES && frame < MAX_FRAMES) {
          window.requestAnimationFrame(reassert);
        }
      };
      reassert();
    };
  }, [active]);
}
