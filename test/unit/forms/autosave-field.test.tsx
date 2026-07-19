/**
 * DS-06 — the autosave field hook: blur-triggered save, calm status,
 * failure + retry, no save while invalid.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SaveStatusIndicator,
  TextField,
  useAutosaveField,
} from "~/shared/forms";
import { required } from "~/shared/forms/model";

function Harness({
  onSave,
}: {
  readonly onSave: (value: string) => Promise<void>;
}) {
  const field = useAutosaveField<string>({
    initialValue: "start",
    debounceMs: 0, // blur-only for deterministic tests
    validate: required("Required."),
    onSave: (value) => onSave(value),
  });
  return (
    <div>
      <TextField
        label="Title"
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        error={field.validationError}
      />
      <SaveStatusIndicator
        status={field.status}
        error={field.error}
        onRetry={field.retry}
      />
    </div>
  );
}

describe("useAutosaveField", () => {
  it("saves on blur and reaches the Saved status", async () => {
    const onSave = vi.fn(async () => {});
    render(<Harness onSave={onSave} />);
    const input = screen.getByLabelText("Title", { exact: false });
    fireEvent.change(input, { target: { value: "edited" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("edited"));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });

  it("keeps input and offers Retry on failure, then recovers", async () => {
    let attempt = 0;
    const onSave = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("boom");
    });
    render(<Harness onSave={onSave} />);
    const input = screen.getByLabelText("Title", { exact: false });
    fireEvent.change(input, { target: { value: "edited" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(screen.getByText("Couldn't save")).toBeInTheDocument(),
    );
    expect(input).toHaveValue("edited"); // input preserved

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("does not save an invalid (empty) value", async () => {
    const onSave = vi.fn(async () => {});
    render(<Harness onSave={onSave} />);
    const input = screen.getByLabelText("Title", { exact: false });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    // Give any scheduled work a chance to (not) run.
    await new Promise((r) => setTimeout(r, 20));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Required.")).toBeInTheDocument();
  });
});
