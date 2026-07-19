/**
 * DS-06 Shared Forms — deterministic, timezone-safe date model.
 *
 * Dates are the most common place a form silently corrupts data: a `YYYY-MM-DD`
 * pushed through `new Date()` and back can shift a day depending on the viewer's
 * timezone. DS-06 refuses that class of bug by keeping two UNAMBIGUOUS
 * representations and never round-tripping a calendar date through an instant:
 *
 *   - a DATE-ONLY value is the literal ISO calendar string `YYYY-MM-DD`. It is
 *     validated and compared purely as year/month/day integers — it never becomes
 *     a `Date`, so it can never be shifted by a zone.
 *   - a DATETIME value is an ISO-8601 UTC instant (`YYYY-MM-DDTHH:MM:SSZ`). The
 *     control treats the wall-clock the user enters as UTC EXPLICITLY (documented,
 *     not hidden), so there is exactly one interpretation and one serialisation.
 *
 * Everything here is pure and framework-free. Validation messages are specific
 * and recovery-oriented; none leaks an internal error.
 */

import { invalid, VALID } from "./validation";
import type { ValidationOutcome } from "./types";

/** A parsed calendar date, as plain integers. `month` is 1-12. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return lengths[month - 1] ?? 0;
}

/**
 * Parse a `YYYY-MM-DD` string into calendar integers, validating that it is a
 * REAL date (correct month range and day-of-month, leap years included). Returns
 * null for any malformed or impossible date — never a "corrected" one (JS `Date`
 * would silently roll `2026-02-30` into March; we reject it).
 */
export function parseDateOnly(value: string): CalendarDate | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Is `value` a valid ISO date-only string? */
export function isValidDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null;
}

/**
 * Compare two date-only strings as calendar dates. Returns a negative number when
 * `a` is earlier, zero when equal, positive when later. Assumes both are valid
 * (validate first). Comparison is purely integer-based — no `Date`, no zone.
 */
export function compareDateOnly(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validate a date-only value with specific messages. An empty string is treated
 * as "no date" and passes here (compose with `required` to demand one). Optional
 * `min`/`max` bounds (inclusive, also date-only strings) are enforced.
 */
export function validateDateOnly(
  value: string,
  options?: { readonly min?: string; readonly max?: string },
): ValidationOutcome {
  if (value.length === 0) return VALID;
  if (!isValidDateOnly(value)) {
    return invalid("Enter a real date in YYYY-MM-DD format.");
  }
  if (options?.min && compareDateOnly(value, options.min) < 0) {
    return invalid(`Choose a date on or after ${options.min}.`);
  }
  if (options?.max && compareDateOnly(value, options.max) > 0) {
    return invalid(`Choose a date on or before ${options.max}.`);
  }
  return VALID;
}

/**
 * Convert a `datetime-local` control value (`YYYY-MM-DDTHH:MM` or with seconds)
 * into an ISO-8601 UTC instant. The wall-clock is interpreted as UTC — the one,
 * documented rule — so serialisation is deterministic and never applies the
 * viewer's offset. Returns null if the input is malformed or not a real
 * date/time.
 */
export function dateTimeLocalToUtcIso(value: string): string | null {
  const match = DATETIME_LOCAL_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}Z`;
}

/**
 * Convert a stored ISO-8601 UTC instant back into a `datetime-local` control
 * value (`YYYY-MM-DDTHH:MM`), reading the UTC wall-clock verbatim so the control
 * round-trips exactly what was stored. Returns null for a non-UTC or malformed
 * string — DS-06 stores only `…Z` instants, so an offset string is out of
 * contract and rejected rather than silently shifted.
 */
export function utcIsoToDateTimeLocal(value: string): string | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z$/.exec(
      value,
    );
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
}

/** Is `value` a valid `datetime-local` string that maps to a real UTC instant? */
export function isValidDateTimeLocal(value: string): boolean {
  return dateTimeLocalToUtcIso(value) !== null;
}

/**
 * Validate a `datetime-local` value with specific messages. Empty passes
 * (compose with `required`). Validation is on the wall-clock string; the caller
 * serialises with {@link dateTimeLocalToUtcIso} once valid.
 */
export function validateDateTimeLocal(value: string): ValidationOutcome {
  if (value.length === 0) return VALID;
  if (!isValidDateTimeLocal(value)) {
    return invalid("Enter a real date and time.");
  }
  return VALID;
}
