/**
 * DS-06 Shared Forms — the framework-free model entry point.
 *
 * Import this (`~/shared/forms/model`) from non-UI code — a server loader/action,
 * a validation utility, a test — that needs the forms VOCABULARY without the
 * React controls. It re-exports ONLY the pure model: types, validation
 * combinators, the dirty-state comparison, the tags rules, the deterministic date
 * model, field-id derivation, the explicit-save reducer, the autosave coordinator
 * and the entity-link picker filtering. It pulls in NO React and no UI component.
 *
 * An import-guard test (`test/unit/forms/react-free.test.ts`) asserts every file
 * re-exported here imports no React/React-DOM/React-Router, mirroring the filters
 * and activity-feed model boundaries. Keep that test's file list in sync when you
 * add a pure module.
 */

export type {
  ValidationOutcome,
  Validator,
  AsyncValidator,
  SaveMode,
  SubmitStatus,
  AutosaveStatus,
  FieldInteractivity,
  FieldAnatomy,
  RequiredIndicator,
  DateFieldKind,
  SelectOption,
  TagConstraints,
} from "./types";

export {
  VALID,
  invalid,
  composeValidators,
  isEmptyValue,
  required,
  minLength,
  maxLength,
  pattern,
  satisfies,
  runValidator,
} from "./validation";

export { valuesEqual, isDirty, anyFieldDirty, type IsEqual } from "./dirty";

export {
  DEFAULT_MAX_TAGS,
  DEFAULT_MAX_TAG_LENGTH,
  normaliseTag,
  resolveTagConstraints,
  addTag,
  removeTagAt,
  normaliseTagList,
  type TagRejectionReason,
  type AddTagResult,
} from "./tags";

export {
  parseDateOnly,
  isValidDateOnly,
  compareDateOnly,
  validateDateOnly,
  dateTimeLocalToUtcIso,
  utcIsoToDateTimeLocal,
  isValidDateTimeLocal,
  validateDateTimeLocal,
  type CalendarDate,
} from "./dates";

export {
  deriveFieldIds,
  composeDescribedBy,
  type FieldDescriptionIds,
} from "./field-ids";

export {
  INITIAL_SUBMIT_STATE,
  beginSubmit,
  submitSucceeded,
  submitFailed,
  withFieldErrors,
  firstInvalidField,
  hasErrors,
  type SubmitState,
} from "./save-state";

export {
  initAutosave,
  reduceAutosave,
  isPersisted,
  type AutosaveState,
  type AutosaveAction,
  type AutosaveEffect,
  type AutosaveTransition,
} from "./autosave";

export {
  DEFAULT_MAX_LINK_RESULTS,
  excludeAnchor,
  dedupeTargets,
  linkIdentityKey,
  excludeAlreadyLinked,
  selectableTargets,
  linkTypeLabel,
  type EntityLinkTargetOption,
  type EntityLinkTypeDescriptor,
  type EntityLinkPickerDirection,
  type EntityLinkSelection,
} from "./entity-link-model";
