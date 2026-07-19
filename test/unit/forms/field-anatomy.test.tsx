/**
 * DS-06 — shared field anatomy and simple controls: labels, help/error
 * association, required/optional cue, disabled vs read-only, input preservation.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { BooleanField, DateField, TextField } from "~/shared/forms";

describe("TextField anatomy", () => {
  it("associates label, help and error with the control", () => {
    render(
      <TextField
        label="Title"
        help="Give it a name"
        error="Required."
        value=""
        onChange={() => {}}
        required
      />,
    );
    const input = screen.getByLabelText("Title", { exact: false });
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("-help");
    expect(describedBy).toContain("-error");
    expect(screen.getByText("Give it a name")).toBeInTheDocument();
    expect(screen.getByText("Required.")).toBeInTheDocument();
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });

  it("shows an Optional cue on non-required fields", () => {
    render(<TextField label="Notes" value="" onChange={() => {}} />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("does not trim or mutate user input", () => {
    const onChange = vi.fn();
    render(<TextField label="Title" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Title", { exact: false }), {
      target: { value: "  spaced  " },
    });
    expect(onChange).toHaveBeenCalledWith("  spaced  ");
  });

  it("shows a length readout when configured", () => {
    render(
      <TextField
        label="Title"
        value="abc"
        onChange={() => {}}
        maxLength={10}
        showLength
      />,
    );
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
  });

  it("renders a multiline textarea when asked", () => {
    render(<TextField label="Body" value="" onChange={() => {}} multiline />);
    expect(screen.getByLabelText("Body", { exact: false }).tagName).toBe(
      "TEXTAREA",
    );
  });

  it("distinguishes disabled from read-only", () => {
    const { rerender } = render(
      <TextField label="X" value="v" onChange={() => {}} disabled />,
    );
    expect(screen.getByLabelText("X", { exact: false })).toBeDisabled();
    rerender(<TextField label="X" value="v" onChange={() => {}} readOnly />);
    const input = screen.getByLabelText("X", { exact: false });
    expect(input).toHaveAttribute("readonly");
    expect(input).not.toBeDisabled();
  });
});

describe("BooleanField", () => {
  it("uses a real checkbox with a clickable label", () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <BooleanField label="Pin it" value={on} onChange={setOn} />;
    }
    render(<Harness />);
    const checkbox = screen.getByRole("checkbox", { name: "Pin it" });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByText("Pin it"));
    expect(checkbox).toBeChecked();
  });

  it("supports switch semantics", () => {
    render(
      <BooleanField
        label="Notify"
        variant="switch"
        value
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("switch", { name: "Notify" })).toBeChecked();
  });
});

describe("DateField", () => {
  it("date-only passes the ISO value straight through", () => {
    const onChange = vi.fn();
    render(<DateField label="Due" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Due", { exact: false });
    expect(input).toHaveAttribute("type", "date");
    fireEvent.change(input, { target: { value: "2026-07-19" } });
    expect(onChange).toHaveBeenCalledWith("2026-07-19");
  });

  it("datetime serialises the wall-clock to a UTC instant", () => {
    const onChange = vi.fn();
    render(
      <DateField label="Starts" kind="datetime" value="" onChange={onChange} />,
    );
    const input = screen.getByLabelText("Starts", { exact: false });
    expect(input).toHaveAttribute("type", "datetime-local");
    fireEvent.change(input, { target: { value: "2026-07-19T09:30" } });
    expect(onChange).toHaveBeenCalledWith("2026-07-19T09:30:00Z");
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });
});
