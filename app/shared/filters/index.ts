/**
 * DS-07 — public entry for the Shared Filters system.
 *
 * ONE filter system for every collection (DESIGN_SYSTEM.md → Filters): a typed,
 * entity-agnostic model (definitions, expressions, operators), a URL contract, a
 * pure client-side evaluator, a reusable Filter Bar with add/edit/chips/clear and
 * AND/OR, a storage-agnostic saved-view adapter, and the filtered-empty state.
 *
 * Two honestly-separated halves:
 *   - the PURE, React-free MODEL — re-exported from `./model` (types, operators,
 *     validate, evaluate, url, saved-views, display). Non-UI/server code should
 *     import `~/shared/filters/model` directly so it never resolves React.
 *   - the React UI — the components/hook/value-control seam below.
 *
 * This barrel re-exports both for app UI convenience; server code must use
 * `./model` to stay React-free.
 */

// Pure, framework-free model (see ./model).
export * from "./model";

// UI — React components, the URL-state hook, and the custom value-control seam.
export { FilterBar } from "./FilterBar";
export type { FilterBarProps } from "./FilterBar";
export { FilterChip } from "./FilterChip";
export { FilterEditor } from "./FilterEditor";
export { FilterValueInput } from "./FilterValueInput";
export { FilterEmptyState } from "./FilterEmptyState";
export { useFilterUrlState } from "./useFilterUrlState";
export type { FilterUrlState } from "./useFilterUrlState";
export type {
  FilterValueControlProps,
  FilterValueControlRenderer,
  FilterValueControls,
} from "./value-controls";
