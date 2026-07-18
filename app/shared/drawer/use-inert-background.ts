/**
 * DS-03 — make everything OUTSIDE the drawer stack inert while a drawer is open.
 *
 * A modal drawer must leave nothing behind it reachable by keyboard or assistive
 * technology (WAI-ARIA modal-dialog expectation). Rather than portal the stack to
 * `document.body` — which would not server-render, breaking the no-JS and
 * direct-deep-link cases — the stack renders inline, and this hook isolates it by
 * walking from the stack node up to `<body>` and marking every sibling along that
 * ancestor path `inert`. That neutralises the underlying page AND the surrounding
 * app shell (header, navigation, theme control) regardless of where the provider
 * is mounted, using the native `inert` attribute (broadly supported; removes the
 * subtree from focus, hit-testing and the accessibility tree).
 *
 * Only elements this hook sets are cleared on cleanup, and any element that was
 * already `inert` is left untouched — so nested drawers and pre-existing inert
 * state compose without clobbering each other.
 */

import { useEffect } from "react";
import type { RefObject } from "react";

export function useInertBackground(
  nodeRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }
    const node = nodeRef.current;
    if (!node) {
      return;
    }

    const inerted: Element[] = [];
    let current: HTMLElement = node;
    while (current !== document.body && current.parentElement !== null) {
      const parent: HTMLElement = current.parentElement;
      const siblings: Element[] = Array.from(parent.children);
      for (const sibling of siblings) {
        if (sibling !== current && !sibling.hasAttribute("inert")) {
          sibling.setAttribute("inert", "");
          inerted.push(sibling);
        }
      }
      current = parent;
    }

    return () => {
      for (const element of inerted) {
        element.removeAttribute("inert");
      }
    };
  }, [nodeRef, active]);
}
