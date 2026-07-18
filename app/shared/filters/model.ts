/**
 * DS-07 — the PURE, React-free filter model entry.
 *
 * Import this (`~/shared/filters/model`) from non-UI code — including a future
 * server-side module that translates a `FilterExpression` into its own query
 * layer. It re-exports ONLY the framework-free model (types, operators,
 * validation, evaluation, URL codec, saved-view data and display formatting); it
 * pulls in NO React and no UI component. An import guard test
 * (`test/unit/filters/react-free.test.ts`) asserts these files import no React.
 *
 * The React UI (Filter Bar, editor, chips, value controls, the URL-state hook) is
 * exported separately from `./index` — `~/shared/filters`.
 */

export type {
  FilterClause,
  FilterExpression,
  FilterFieldDefinition,
  FilterFieldRegistry,
  FilterMode,
  FilterOperator,
  FilterOption,
  FilterRange,
  FilterValue,
  FilterValueType,
} from "./types";
export {
  OPERATORS_BY_TYPE,
  getOperatorDefinition,
  operatorArity,
  operatorTakesNoValue,
} from "./operators";
export type { OperatorArity, OperatorDefinition } from "./operators";
export {
  EMPTY_EXPRESSION,
  MAX_CLAUSES,
  expressionsEqual,
  findField,
  isStrictCalendarDate,
  isValidValueForOperator,
  operatorsForField,
  sanitiseExpression,
  validateClause,
  valueMatchesFieldType,
} from "./validate";
export type { ClauseRejectReason, ClauseValidation } from "./validate";
export { filterRecords, matchesExpression } from "./evaluate";
export {
  FILTER_MODE_PARAM,
  FILTER_PARAM,
  FILTER_VERSION,
  FILTER_VERSION_PARAM,
  MAX_ENCODED_CLAUSE_LENGTH,
  decodeClause,
  encodeClause,
  readFilterExpression,
  writeFilterExpression,
} from "./url";
export {
  clauseAccessibleName,
  defaultOperatorForField,
  defaultValueForOperator,
  describeClause,
} from "./display";
export type { ClauseDescription } from "./display";
export { findSavedView, isViewModified } from "./saved-views";
export type { SavedView, SavedViewAdapter } from "./saved-views";
