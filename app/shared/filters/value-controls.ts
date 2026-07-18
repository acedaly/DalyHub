/**
 * DS-07 — the UI-only custom value-control seam.
 *
 * This is the ONE React-coupled part of the filter *field* story, kept OUT of the
 * pure model (`types.ts`/`model.ts`) so a server-side module can import the model
 * without resolving React. A consumer that wants a bespoke value control for a
 * field supplies a `FilterValueControls` registry (field id → renderer) to the
 * `FilterBar`; `FilterValueInput` consumes it and falls back to restrained native
 * controls otherwise. This is the seam DS-06 shared form controls will plug into —
 * no change to the model is needed to adopt them.
 */

import type { ReactNode } from "react";

import type {
  FilterFieldDefinition,
  FilterOperator,
  FilterValue,
} from "./types";

/** Props a custom (e.g. future DS-06) value control receives. */
export interface FilterValueControlProps {
  readonly definition: FilterFieldDefinition;
  readonly operator: FilterOperator;
  readonly value: FilterValue;
  readonly onChange: (value: FilterValue) => void;
  readonly inputId: string;
}

/** A render function for a field's value control. */
export type FilterValueControlRenderer = (
  props: FilterValueControlProps,
) => ReactNode;

/**
 * A UI-only registry mapping a field id to a custom value control. Optional and
 * additive: any field without an entry uses the built-in native control.
 */
export type FilterValueControls = Readonly<
  Record<string, FilterValueControlRenderer>
>;
