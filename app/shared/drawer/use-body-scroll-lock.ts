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
 * exactly where it was. The app's path-keyed `ScrollRestoration` keeps drawer
 * transitions on one scroll key (ADR-018); as belt-and-braces this hook also
 * captures the pre-lock offset and reasserts it on release in a
 * `requestAnimationFrame` — which runs after any in-commit scroll a history POP
 * applies, but before the next paint, so the page is restored with no visible jump.
 * Runs as a layout effect so freeze/release happen in the same commit, and every
 * mutated value is captured and restored, so nothing leaks.
 */

import { useEffect, useLayoutEffect } from "react";

// `useLayoutEffect` warns during SSR; fall back to `useEffect` on the server, where
// there is no scrolling to lock anyway.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
      const reassert = () => {
        if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
          window.scrollTo(scrollX, scrollY);
        }
      };
      reassert();
      window.requestAnimationFrame(reassert);
    };
  }, [active]);
}
