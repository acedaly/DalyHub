/**
 * DS-06 Shared Forms — a headless combobox/listbox keyboard model.
 *
 * The WAI-ARIA 1.2 combobox interaction is subtle enough to be worth writing once
 * and reusing: the select control and the entity-link picker both drive their
 * listbox through this hook. It owns the open state, the active (visually
 * highlighted) option and the keyboard contract — Arrow/Home/End move the active
 * option, Enter selects it, Escape closes without changing the value, Tab closes
 * and moves on — and hands back the `aria-activedescendant`/`role` wiring. It is
 * presentation-agnostic: it never renders anything, so both controls keep their
 * own markup while sharing correct semantics.
 *
 * Native `<select>` is preferred wherever it suffices; this hook exists for the
 * cases DS-06 genuinely needs (type-to-filter and async search) where a native
 * select cannot.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

/** The minimal shape the hook needs from an option: its value and enabled state. */
export interface ComboboxOptionLike {
  readonly value: string;
  readonly disabled?: boolean;
}

export interface UseComboboxParams {
  /** The currently displayed (filtered) options. */
  readonly options: readonly ComboboxOptionLike[];
  /** Called when the user commits the active option. */
  readonly onSelect: (value: string) => void;
  /** Stable base id used to derive the listbox and option ids. */
  readonly baseId: string;
  /** Whether interaction is suppressed. */
  readonly disabled?: boolean;
}

export interface UseComboboxResult {
  readonly isOpen: boolean;
  readonly activeIndex: number;
  readonly listboxId: string;
  readonly open: () => void;
  readonly close: () => void;
  readonly setActiveIndex: (index: number) => void;
  readonly optionId: (index: number) => string;
  readonly activeDescendant: string | undefined;
  /** Handle an input keydown; returns nothing (mutates open/active as needed). */
  readonly onInputKeyDown: (event: KeyboardEvent) => void;
  /** Combobox ARIA props for the input element. */
  readonly comboboxProps: {
    readonly role: "combobox";
    readonly "aria-expanded": boolean;
    readonly "aria-controls": string;
    readonly "aria-activedescendant": string | undefined;
    readonly "aria-autocomplete": "list";
  };
}

function firstEnabled(options: readonly ComboboxOptionLike[]): number {
  return options.findIndex((option) => !option.disabled);
}

function lastEnabled(options: readonly ComboboxOptionLike[]): number {
  for (let i = options.length - 1; i >= 0; i -= 1) {
    if (!options[i]!.disabled) return i;
  }
  return -1;
}

function nextEnabled(
  options: readonly ComboboxOptionLike[],
  from: number,
  direction: 1 | -1,
): number {
  const count = options.length;
  if (count === 0) return -1;
  let index = from;
  for (let step = 0; step < count; step += 1) {
    index += direction;
    if (index < 0) index = count - 1;
    if (index >= count) index = 0;
    if (!options[index]!.disabled) return index;
  }
  return from;
}

export function useCombobox({
  options,
  onSelect,
  baseId,
  disabled = false,
}: UseComboboxParams): UseComboboxResult {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = `${baseId}-listbox`;

  const optionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  // Keep the active option in range as the option list changes (filtering,
  // async results). Opening does NOT pre-highlight an option (WAI-ARIA combobox
  // with list autocomplete): the first ArrowDown lands on the first option, so
  // no option is silently skipped. An out-of-range active index (after filtering)
  // resets to "none" rather than jumping.
  useEffect(() => {
    setActiveIndex((current) => {
      if (!isOpen) return -1;
      if (
        current >= 0 &&
        current < options.length &&
        !options[current]!.disabled
      ) {
        return current;
      }
      return -1;
    });
  }, [isOpen, options]);

  const open = useCallback(() => {
    if (!disabled) setIsOpen(true);
  }, [disabled]);
  const close = useCallback(() => setIsOpen(false), []);

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            return;
          }
          setActiveIndex((current) =>
            nextEnabled(options, current < 0 ? -1 : current, 1),
          );
          return;
        case "ArrowUp":
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            return;
          }
          setActiveIndex((current) =>
            nextEnabled(options, current < 0 ? 0 : current, -1),
          );
          return;
        case "Home":
          if (isOpen) {
            event.preventDefault();
            setActiveIndex(firstEnabled(options));
          }
          return;
        case "End":
          if (isOpen) {
            event.preventDefault();
            setActiveIndex(lastEnabled(options));
          }
          return;
        case "Enter":
          if (isOpen && activeIndex >= 0 && activeIndex < options.length) {
            const option = options[activeIndex]!;
            if (!option.disabled) {
              event.preventDefault();
              onSelect(option.value);
            }
          }
          return;
        case "Escape":
          if (isOpen) {
            event.preventDefault();
            setIsOpen(false);
          }
          return;
        case "Tab":
          setIsOpen(false);
          return;
        default:
          return;
      }
    },
    [disabled, isOpen, options, activeIndex, onSelect],
  );

  const activeDescendant =
    isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  const comboboxProps = useMemo(
    () => ({
      role: "combobox" as const,
      "aria-expanded": isOpen,
      "aria-controls": listboxId,
      "aria-activedescendant": activeDescendant,
      "aria-autocomplete": "list" as const,
    }),
    [isOpen, listboxId, activeDescendant],
  );

  return {
    isOpen,
    activeIndex,
    listboxId,
    open,
    close,
    setActiveIndex,
    optionId,
    activeDescendant,
    onInputKeyDown,
    comboboxProps,
  };
}
