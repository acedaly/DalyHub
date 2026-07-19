/**
 * DS-06 — the explicit-save form host: blur/submit validation, error summary +
 * first-invalid focus, input preservation on failure, Cancel, duplicate-submit
 * prevention, server-authoritative errors.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Form,
  FormActions,
  FormButton,
  FormErrorSummary,
  TextField,
  required,
  useForm,
  type SubmitOutcome,
} from "~/shared/forms";

type Values = { title: string; owner: string };

function TestForm({
  onSubmit,
}: {
  readonly onSubmit: (values: Values) => Promise<SubmitOutcome<Values> | void>;
}) {
  const form = useForm<Values>({
    initialValues: { title: "", owner: "" },
    fieldOrder: ["title", "owner"],
    fields: {
      title: { validate: required("Title is required.") },
      owner: { validate: required("Owner is required.") },
    },
    onSubmit,
  });
  return (
    <Form
      aria-label="Test"
      busy={form.isSubmitting}
      onSubmit={form.handleSubmit}
    >
      <FormErrorSummary
        formError={form.formError}
        fieldErrors={form.fieldErrors}
        order={form.fieldOrder as string[]}
        labels={{ title: "Title", owner: "Owner" }}
        onFocusField={form.focusField}
      />
      <TextField label="Title" {...form.field("title")} />
      <TextField label="Owner" {...form.field("owner")} />
      <FormActions>
        <FormButton type="submit" variant="primary" pending={form.isSubmitting}>
          Save
        </FormButton>
        <FormButton type="button" onClick={form.reset}>
          Cancel
        </FormButton>
        <span data-testid="dirty">{form.isDirty ? "dirty" : "clean"}</span>
      </FormActions>
    </Form>
  );
}

describe("useForm explicit save", () => {
  it("validates on blur with a specific message", async () => {
    render(<TestForm onSubmit={async () => ({ status: "success" })} />);
    fireEvent.blur(screen.getByLabelText("Title", { exact: false }));
    // The message appears inline on the field (and, once present, also in the
    // summary), so assert at least one occurrence.
    await waitFor(() =>
      expect(screen.getAllByText("Title is required.").length).toBeGreaterThan(
        0,
      ),
    );
  });

  it("blocks submit while invalid, shows the summary and focuses the first invalid field", async () => {
    const onSubmit = vi.fn(async () => ({ status: "success" as const }));
    render(<TestForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText("Title", { exact: false })).toHaveFocus(),
    );
  });

  it("preserves every entered value when the server fails, and shows the form error", async () => {
    const onSubmit = vi.fn(async (): Promise<SubmitOutcome<Values>> => ({
      status: "error",
      formError: "Server unavailable.",
    }));
    render(<TestForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Title", { exact: false }), {
      target: { value: "Launch" },
    });
    fireEvent.change(screen.getByLabelText("Owner", { exact: false }), {
      target: { value: "Mel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Server unavailable.")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Title", { exact: false })).toHaveValue(
      "Launch",
    );
    expect(screen.getByLabelText("Owner", { exact: false })).toHaveValue("Mel");
  });

  it("treats server field errors as authoritative even when client validation passed", async () => {
    const onSubmit = vi.fn(async (): Promise<SubmitOutcome<Values>> => ({
      status: "error",
      fieldErrors: { title: "That title is taken." },
    }));
    render(<TestForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Title", { exact: false }), {
      target: { value: "Launch" },
    });
    fireEvent.change(screen.getByLabelText("Owner", { exact: false }), {
      target: { value: "Mel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        screen.getAllByText("That title is taken.").length,
      ).toBeGreaterThan(0),
    );
  });

  it("Cancel restores the committed baseline", async () => {
    render(<TestForm onSubmit={async () => ({ status: "success" })} />);
    fireEvent.change(screen.getByLabelText("Title", { exact: false }), {
      target: { value: "Draft" },
    });
    expect(screen.getByTestId("dirty")).toHaveTextContent("dirty");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Title", { exact: false })).toHaveValue("");
    expect(screen.getByTestId("dirty")).toHaveTextContent("clean");
  });

  it("prevents duplicate submits while one is in flight", async () => {
    let resolve!: (v: SubmitOutcome<Values>) => void;
    const onSubmit = vi.fn(
      () => new Promise<SubmitOutcome<Values>>((r) => (resolve = r)),
    );
    render(<TestForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Title", { exact: false }), {
      target: { value: "Launch" },
    });
    fireEvent.change(screen.getByLabelText("Owner", { exact: false }), {
      target: { value: "Mel" },
    });
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.click(save);
    fireEvent.click(save);
    resolve({ status: "success" });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
