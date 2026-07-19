/**
 * DS-06 — the Markdown source control: edits source, safe preview through the
 * shared pipeline, source preserved verbatim.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownField } from "~/shared/forms";

describe("MarkdownField", () => {
  it("edits the source verbatim (no trimming or mutation)", () => {
    const onChange = vi.fn();
    render(<MarkdownField label="Description" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: "  # Heading  \n\n- item" },
    });
    expect(onChange).toHaveBeenCalledWith("  # Heading  \n\n- item");
  });

  it("renders a safe preview through the shared Markdown pipeline", async () => {
    function H() {
      const [value, setValue] = useState("# Hello\n\nSome **bold** text.");
      return (
        <MarkdownField label="Description" value={value} onChange={setValue} />
      );
    }
    render(<H />);
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Hello" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("bold")).toBeInTheDocument();
  });
});
