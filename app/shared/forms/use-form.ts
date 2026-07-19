/**
 * DS-06 Shared Forms — the explicit-save form host hook.
 *
 * `useForm` owns the state of an explicit-save form: the typed values, the
 * committed baseline, per-field validation (sync and async), the submission
 * lifecycle and the focus of the first invalid field. It is entity-agnostic — it
 * knows nothing of the domain being edited; the consumer supplies typed initial
 * values, per-field validators and one `onSubmit` persistence callback.
 *
 * Guarantees it upholds (the DEBT-03 "predictable save" contract):
 *   - Validation runs on blur and on submit; the first failing sync rule wins.
 *   - A submit is blocked while any value is invalid (no save while invalid).
 *   - On a failed submit, focus moves to the first invalid field.
 *   - EVERY entered value is preserved when validation or persistence fails.
 *   - Server validation is authoritative: server field/form errors are shown even
 *     when client validation passed.
 *   - A successful save resets the dirty baseline; Cancel restores it.
 *   - Duplicate submits are prevented while one is in flight.
 *   - Stale async validation responses are ignored.
 */

import { useCallback, useId, useMemo, useRef, useState } from "react";

import { anyFieldDirty, valuesEqual, type IsEqual } from "./dirty";
import {
  INITIAL_SUBMIT_STATE,
  beginSubmit,
  firstInvalidField,
  submitFailed,
  submitSucceeded,
  type SubmitState,
} from "./save-state";
import type { AsyncValidator, Validator } from "./types";
import { runValidator } from "./validation";

/** Per-field configuration a form declares. All parts are optional. */
export interface FormFieldConfig<TValue> {
  /** Synchronous validation, run on blur, on change-after-error and on submit. */
  readonly validate?: Validator<TValue>;
  /** Asynchronous validation (e.g. a server check), run on blur and on submit. */
  readonly validateAsync?: AsyncValidator<TValue>;
  /** Custom equality for dirty comparison (defaults to structural equality). */
  readonly isEqual?: IsEqual<TValue>;
}

/** The result a consumer's `onSubmit` returns, making success/failure explicit. */
export type SubmitOutcome<TValues> =
  | { readonly status: "success" }
  | {
      readonly status: "error";
      readonly formError?: string;
      readonly fieldErrors?: Partial<Record<keyof TValues & string, string>>;
    };

export interface UseFormOptions<TValues extends Record<string, unknown>> {
  /** The initial (committed) values; also the baseline for dirty/reset. */
  readonly initialValues: TValues;
  /** Per-field validation/equality configuration. */
  readonly fields?: {
    readonly [K in keyof TValues]?: FormFieldConfig<TValues[K]>;
  };
  /**
   * Persist the values. Return `{status:"success"}` on success or
   * `{status:"error", …}` with server errors on failure. An unexpected throw is
   * caught and shown as a generic, safe form-level error — never a raw exception.
   */
  readonly onSubmit: (
    values: TValues,
  ) => Promise<SubmitOutcome<TValues> | void>;
  /** Field order for first-invalid focus and the error summary. */
  readonly fieldOrder?: ReadonlyArray<keyof TValues & string>;
  /** Message shown when persistence throws unexpectedly. */
  readonly unexpectedErrorMessage?: string;
}

/** Anything the form can call `.focus()` on to move to an invalid field. */
export interface FocusableControl {
  focus(): void;
}

/** The props a control spreads to bind to a form field. */
export interface FieldBinding<TValue> {
  readonly id: string;
  readonly value: TValue;
  readonly error: string | null;
  readonly onChange: (value: TValue) => void;
  readonly onBlur: () => void;
  readonly controlRef: (node: FocusableControl | null) => void;
}

export interface UseFormResult<TValues extends Record<string, unknown>> {
  readonly values: TValues;
  readonly submit: SubmitState;
  readonly isDirty: boolean;
  readonly isSubmitting: boolean;
  /** Bind a control to a field: `<TextField {...form.field("title")} />`. */
  readonly field: <K extends keyof TValues & string>(
    name: K,
  ) => FieldBinding<TValues[K]>;
  /** Imperatively set a field value (e.g. from a composite control). */
  readonly setValue: <K extends keyof TValues & string>(
    name: K,
    value: TValues[K],
  ) => void;
  /** The current field errors, keyed by name, for the error summary. */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The form-level error, or null. */
  readonly formError: string | null;
  /** The declared/derived field order. */
  readonly fieldOrder: ReadonlyArray<keyof TValues & string>;
  /** Submit handler for the `<form onSubmit>`. */
  readonly handleSubmit: (event?: { preventDefault(): void }) => void;
  /** Restore the committed baseline (Cancel), clearing errors and touched state. */
  readonly reset: () => void;
  /** Focus a field by name (used by the error summary links). */
  readonly focusField: (name: string) => void;
  /** The stable base id for a field name (matches the control's `id`). */
  readonly fieldId: (name: string) => string;
}

const DEFAULT_UNEXPECTED_ERROR =
  "Something went wrong saving your changes. Your work is safe — please try again.";

export function useForm<TValues extends Record<string, unknown>>(
  options: UseFormOptions<TValues>,
): UseFormResult<TValues> {
  const formId = useId();
  const [values, setValues] = useState<TValues>(options.initialValues);
  const [baseline, setBaseline] = useState<TValues>(options.initialValues);
  const [submit, setSubmit] = useState<SubmitState>(INITIAL_SUBMIT_STATE);

  const controlRefs = useRef(new Map<string, FocusableControl | null>());
  const refCallbacks = useRef(
    new Map<string, (node: FocusableControl | null) => void>(),
  );
  // Per-field async validation sequence, so a stale response is ignored.
  const asyncSeq = useRef(new Map<string, number>());

  // A ref mirror of the latest values so blur/async/submit callbacks read the
  // current draft without being re-created on every keystroke.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const onSubmitRef = useRef(options.onSubmit);
  onSubmitRef.current = options.onSubmit;
  const unexpectedMessage =
    options.unexpectedErrorMessage ?? DEFAULT_UNEXPECTED_ERROR;

  const fieldsConfig = options.fields;
  const getConfig = useCallback(
    <K extends keyof TValues & string>(
      name: K,
    ): FormFieldConfig<TValues[K]> | undefined =>
      fieldsConfig?.[name] as FormFieldConfig<TValues[K]> | undefined,
    [fieldsConfig],
  );

  const fieldOrder: ReadonlyArray<keyof TValues & string> = useMemo(
    () =>
      options.fieldOrder ??
      (Object.keys(options.initialValues) as Array<keyof TValues & string>),
    [options.fieldOrder, options.initialValues],
  );

  const isDirty = useMemo(
    () => anyFieldDirty(values, baseline),
    [values, baseline],
  );
  const isSubmitting = submit.status === "submitting";

  const setFieldError = useCallback((name: string, message: string | null) => {
    setSubmit((prev) => {
      const next = { ...prev.fieldErrors };
      if (message) next[name] = message;
      else delete next[name];
      return { ...prev, fieldErrors: next };
    });
  }, []);

  const runAsyncValidation = useCallback(
    <K extends keyof TValues & string>(
      name: K,
      value: TValues[K],
      validator: AsyncValidator<TValues[K]>,
    ) => {
      const seq = (asyncSeq.current.get(name) ?? 0) + 1;
      asyncSeq.current.set(name, seq);
      const controller = new AbortController();
      validator(value, controller.signal)
        .then((outcome) => {
          if (asyncSeq.current.get(name) !== seq) return; // stale
          if (!outcome.ok) setFieldError(name, outcome.message);
        })
        .catch(() => {
          // A rejected async validation (including abort) is not surfaced;
          // server validation on submit stays authoritative.
        });
    },
    [setFieldError],
  );

  const setValue = useCallback(
    <K extends keyof TValues & string>(name: K, value: TValues[K]) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      // Live-clear/refresh an existing error as the user fixes the field; we do
      // NOT introduce a new error on change (validation is on blur/submit).
      setSubmit((prev) => {
        if (!prev.fieldErrors[name]) return prev;
        const outcome = runValidator(getConfig(name)?.validate, value);
        const next = { ...prev.fieldErrors };
        if (outcome.ok) delete next[name];
        else next[name] = outcome.message;
        return { ...prev, fieldErrors: next };
      });
    },
    [getConfig],
  );

  const validateFieldOnBlur = useCallback(
    (name: keyof TValues & string) => {
      const config = getConfig(name);
      const value = valuesRef.current[name];
      const outcome = runValidator(config?.validate, value);
      if (!outcome.ok) {
        setFieldError(name, outcome.message);
        return;
      }
      setFieldError(name, null);
      if (config?.validateAsync) {
        runAsyncValidation(name, value, config.validateAsync);
      }
    },
    [getConfig, setFieldError, runAsyncValidation],
  );

  const focusField = useCallback((name: string) => {
    controlRefs.current.get(name)?.focus();
  }, []);

  const getRefCallback = useCallback((name: string) => {
    let cb = refCallbacks.current.get(name);
    if (!cb) {
      cb = (node: FocusableControl | null) => {
        controlRefs.current.set(name, node);
      };
      refCallbacks.current.set(name, cb);
    }
    return cb;
  }, []);

  const fieldId = useCallback((name: string) => `${formId}-${name}`, [formId]);

  const field = useCallback(
    <K extends keyof TValues & string>(name: K): FieldBinding<TValues[K]> => ({
      id: fieldId(name),
      value: values[name],
      error: submit.fieldErrors[name] ?? null,
      onChange: (value: TValues[K]) => setValue(name, value),
      onBlur: () => validateFieldOnBlur(name),
      controlRef: getRefCallback(name),
    }),
    [
      fieldId,
      values,
      submit.fieldErrors,
      setValue,
      validateFieldOnBlur,
      getRefCallback,
    ],
  );

  const focusFirstInvalid = useCallback(
    (errors: Record<string, string>) => {
      const first = firstInvalidField(fieldOrder as readonly string[], errors);
      if (first) queueMicrotask(() => focusField(first));
    },
    [fieldOrder, focusField],
  );

  const handleSubmit = useCallback(
    (event?: { preventDefault(): void }) => {
      event?.preventDefault();
      if (submit.status === "submitting") return; // duplicate-submit guard

      // 1) Synchronous validation of every field.
      const syncErrors: Record<string, string> = {};
      for (const name of fieldOrder) {
        const outcome = runValidator(
          getConfig(name)?.validate,
          valuesRef.current[name],
        );
        if (!outcome.ok) syncErrors[name] = outcome.message;
      }
      if (Object.keys(syncErrors).length > 0) {
        setSubmit(submitFailed({ fieldErrors: syncErrors }));
        focusFirstInvalid(syncErrors);
        return;
      }

      // 2) Enter submitting; run async validation then persistence.
      setSubmit(beginSubmit());
      void (async () => {
        try {
          const asyncErrors: Record<string, string> = {};
          for (const name of fieldOrder) {
            const validator = getConfig(name)?.validateAsync;
            if (!validator) continue;
            const controller = new AbortController();
            const outcome = await validator(
              valuesRef.current[name],
              controller.signal,
            );
            if (!outcome.ok) asyncErrors[name] = outcome.message;
          }
          if (Object.keys(asyncErrors).length > 0) {
            setSubmit(submitFailed({ fieldErrors: asyncErrors }));
            focusFirstInvalid(asyncErrors);
            return;
          }

          const outcome = await onSubmitRef.current(valuesRef.current);
          if (!outcome || outcome.status === "success") {
            setBaseline(valuesRef.current);
            setSubmit(submitSucceeded());
            return;
          }
          const fieldErrors = (outcome.fieldErrors ?? {}) as Record<
            string,
            string
          >;
          setSubmit(
            submitFailed({
              formError: outcome.formError ?? null,
              fieldErrors,
            }),
          );
          focusFirstInvalid(fieldErrors);
        } catch {
          setSubmit(submitFailed({ formError: unexpectedMessage }));
        }
      })();
    },
    [
      submit.status,
      fieldOrder,
      getConfig,
      focusFirstInvalid,
      unexpectedMessage,
    ],
  );

  const reset = useCallback(() => {
    setValues(baseline);
    setSubmit(INITIAL_SUBMIT_STATE);
    asyncSeq.current.clear();
  }, [baseline]);

  return {
    values,
    submit,
    isDirty,
    isSubmitting,
    field,
    setValue,
    fieldErrors: submit.fieldErrors,
    formError: submit.formError,
    fieldOrder,
    handleSubmit,
    reset,
    focusField,
    fieldId,
  };
}

/** Structural-equality re-export so consumers can build custom `isEqual`. */
export { valuesEqual };
