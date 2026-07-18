/**
 * DS-03 — a convenience opener control.
 *
 * Renders an anchor whose href is the deep link that opens `drawerKey` on top of
 * the current stack, so it is shareable, opens in a new tab with a real URL, and
 * even works without JavaScript (the server renders the drawer for that URL). With
 * JavaScript, an ordinary activation is intercepted and turned into an in-app open
 * (pushing one history entry) while modifier/middle clicks fall through to the
 * browser. Any control can instead call `useDrawer().openDrawer` directly; this is
 * sugar for the common case.
 */

import { forwardRef } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

import { useDrawerContext } from "./drawer-context";
import type { DrawerKey } from "./types";

export interface DrawerTriggerProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  /** The record key to open. */
  readonly drawerKey: DrawerKey;
  readonly children: ReactNode;
}

export const DrawerTrigger = forwardRef<HTMLAnchorElement, DrawerTriggerProps>(
  function DrawerTrigger({ drawerKey, children, onClick, ...rest }, ref) {
    const { openDrawer, buildOpenHref } = useDrawerContext();

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      openDrawer(drawerKey);
    };

    return (
      <a
        ref={ref}
        href={buildOpenHref(drawerKey)}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
