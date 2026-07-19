/**
 * DS-06 — the select control: keyboard combobox operation, single + multi.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SelectField } from "~/shared/forms";

const OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
];

describe("SelectField (single)", () => {
  it("opens, moves and selects with the keyboard", () => {
    function H() {
      const [value, setValue] = useState("");
      return (
        <SelectField
          label="Status"
          options={OPTIONS}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<H />);
    const input = screen.getByRole("combobox", { name: "Status" });
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("To do");
  });

  it("closes on Escape without changing the value", () => {
    render(
      <SelectField
        label="Status"
        options={OPTIONS}
        value=""
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Status" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an unavailable note for a stale value with no option", () => {
    render(
      <SelectField
        label="Status"
        options={OPTIONS}
        value="ghost"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/no longer\s+available/)).toBeInTheDocument();
  });
});

describe("SelectField (multi)", () => {
  it("adds and removes selections", () => {
    function H() {
      const [value, setValue] = useState<readonly string[]>([]);
      return (
        <SelectField
          label="Labels"
          multiple
          options={OPTIONS}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<H />);
    const input = screen.getByRole("combobox", { name: "Labels" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    // A chip for the chosen option appears with a remove button.
    const remove = screen.getByRole("button", { name: /Remove To do/ });
    expect(remove).toBeInTheDocument();
    fireEvent.click(remove);
    expect(
      screen.queryByRole("button", { name: /Remove To do/ }),
    ).not.toBeInTheDocument();
  });
});
