/**
 * DS-03 — a convenience close control for drawer content.
 *
 * Closes the top drawer (Back-aware, so Forward can restore it). The Drawer always
 * renders its own labelled close button in the header; this is for an extra
 * in-content close affordance (e.g. a "Done" button at the end of a record). It
 * closes directly — a caller that needs unsaved-state guarding should gate its own
 * handler, since `preventClose` on the render result guards only the built-in
 * affordances (Escape, header button, backdrop).
 */

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

import { useDrawerContext } from "./drawer-context";

export interface DrawerCloseProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  readonly children: ReactNode;
}

export const DrawerClose = forwardRef<HTMLButtonElement, DrawerCloseProps>(
  function DrawerClose({ children, onClick, ...rest }, ref) {
    const { closeDrawer } = useDrawerContext();

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      closeDrawer();
    };

    return (
      <button ref={ref} type="button" onClick={handleClick} {...rest}>
        {children}
      </button>
    );
  },
);
