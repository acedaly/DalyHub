/**
 * DS-06 — deterministic, timezone-safe date model.
 */

import { describe, expect, it } from "vitest";

import {
  compareDateOnly,
  dateTimeLocalToUtcIso,
  isValidDateOnly,
  parseDateOnly,
  utcIsoToDateTimeLocal,
  validateDateOnly,
  validateDateTimeLocal,
} from "~/shared/forms/model";

describe("parseDateOnly", () => {
  it("accepts real dates and rejects impossible ones (no silent rollover)", () => {
    expect(parseDateOnly("2026-07-19")).toEqual({
      year: 2026,
      month: 7,
      day: 19,
    });
    expect(parseDateOnly("2024-02-29")).not.toBeNull(); // leap year
    expect(parseDateOnly("2026-02-29")).toBeNull(); // not a leap year
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-00-10")).toBeNull();
    expect(parseDateOnly("nope")).toBeNull();
  });

  it("is stable regardless of process timezone (pure integer parse)", () => {
    // The value is the literal calendar date — never routed through Date.
    expect(isValidDateOnly("2026-01-01")).toBe(true);
    expect(parseDateOnly("2026-01-01")).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });
});

describe("compareDateOnly", () => {
  it("orders calendar dates", () => {
    expect(compareDateOnly("2026-01-01", "2026-01-02")).toBeLessThan(0);
    expect(compareDateOnly("2026-02-01", "2026-01-01")).toBeGreaterThan(0);
    expect(compareDateOnly("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("validateDateOnly", () => {
  it("passes empty and valid, rejects malformed, and enforces bounds", () => {
    expect(validateDateOnly("").ok).toBe(true);
    expect(validateDateOnly("2026-07-19").ok).toBe(true);
    expect(validateDateOnly("2026-02-30").ok).toBe(false);
    expect(validateDateOnly("2026-01-01", { min: "2026-02-01" }).ok).toBe(
      false,
    );
    expect(validateDateOnly("2026-03-01", { max: "2026-02-01" }).ok).toBe(
      false,
    );
    expect(
      validateDateOnly("2026-01-15", { min: "2026-01-01", max: "2026-02-01" })
        .ok,
    ).toBe(true);
  });
});

describe("datetime serialisation (UTC, deterministic)", () => {
  it("maps a datetime-local wall-clock to a UTC instant with no offset shift", () => {
    expect(dateTimeLocalToUtcIso("2026-07-19T09:30")).toBe(
      "2026-07-19T09:30:00Z",
    );
    expect(dateTimeLocalToUtcIso("2026-07-19T09:30:45")).toBe(
      "2026-07-19T09:30:45Z",
    );
  });

  it("round-trips a UTC instant back to the control value verbatim", () => {
    expect(utcIsoToDateTimeLocal("2026-07-19T09:30:00Z")).toBe(
      "2026-07-19T09:30",
    );
    // A non-UTC (offset) string is out of contract and rejected, not shifted.
    expect(utcIsoToDateTimeLocal("2026-07-19T09:30:00+02:00")).toBeNull();
  });

  it("rejects impossible date/times", () => {
    expect(dateTimeLocalToUtcIso("2026-02-30T09:30")).toBeNull();
    expect(dateTimeLocalToUtcIso("2026-07-19T25:00")).toBeNull();
    expect(validateDateTimeLocal("2026-07-19T09:30").ok).toBe(true);
    expect(validateDateTimeLocal("bad").ok).toBe(false);
    expect(validateDateTimeLocal("").ok).toBe(true);
  });
});
