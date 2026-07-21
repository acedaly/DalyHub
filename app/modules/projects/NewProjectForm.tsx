/**
 * PROJ-01 — the "New project" form (hosted in the shared DS-03 Drawer).
 *
 * Built entirely from DS-06 shared controls (`useForm`, `TextField`, `SelectField`)
 * with explicit Save/Cancel, required-field validation, duplicate-submit prevention
 * (via `useForm`) and server-authoritative errors. It posts to the trusted
 * `/projects/new` action; the server resolves the parent's KIND from its id, so the
 * client only chooses an Area/Goal — it can't assert a project's kind or ownership.
 * On success the parent closes the Drawer and navigates to the new project.
 */

import {
  Form,
  FormActions,
  FormButton,
  FormErrorSummary,
  SelectField,
  TextField,
  required,
  useForm,
  type SubmitOutcome,
} from "~/shared/forms";
import type { SelectOption } from "~/shared/forms/types";

import type { CreateProjectResult } from "./routes/new";

type Values = { readonly title: string; readonly parentId: string };

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  parentId: "Area or Goal",
};

interface NewProjectFormProps {
  /** The Area/Goal parent options (value = entity id; description = kind). */
  readonly parentOptions: readonly SelectOption[];
  /** Called with the new project's id after a successful create. */
  readonly onCreated: (projectId: string) => void;
  /** Called when the user cancels. */
  readonly onCancel: () => void;
}

export function NewProjectForm({
  parentOptions,
  onCreated,
  onCancel,
}: NewProjectFormProps) {
  const form = useForm<Values>({
    initialValues: { title: "", parentId: "" },
    fields: {
      title: { validate: required("A title is required") },
      parentId: { validate: required("Choose an Area or a Goal") },
    },
    fieldOrder: ["title", "parentId"],
    onSubmit: async (values): Promise<SubmitOutcome<Values>> => {
      const body = new FormData();
      body.set("title", values.title);
      body.set("parentId", values.parentId);
      let data: CreateProjectResult;
      try {
        const response = await fetch("/projects/new", {
          method: "POST",
          body,
        });
        data = (await response.json()) as CreateProjectResult;
      } catch {
        return {
          status: "error",
          formError: "That project couldn't be created. Please try again.",
        };
      }
      if (data.ok) {
        onCreated(data.projectId);
        return { status: "success" };
      }
      return {
        status: "error",
        formError: data.formError,
        fieldErrors: data.fieldErrors as
          Partial<Record<keyof Values & string, string>> | undefined,
      };
    },
  });

  const titleField = form.field("title");
  const parentField = form.field("parentId");

  return (
    <Form
      aria-label="New project"
      busy={form.isSubmitting}
      onSubmit={form.handleSubmit}
    >
      <FormErrorSummary
        formError={form.formError}
        fieldErrors={form.fieldErrors}
        order={form.fieldOrder as string[]}
        labels={FIELD_LABELS}
        onFocusField={form.focusField}
      />
      <TextField label="Title" required maxLength={512} {...titleField} />
      <SelectField
        label="Area or Goal"
        help="A project belongs to an Area, or advances a Goal."
        placeholder="Choose an Area or a Goal"
        required
        options={parentOptions}
        {...parentField}
      />
      <FormActions>
        <FormButton
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={form.isSubmitting}
        >
          Cancel
        </FormButton>
        <FormButton type="submit" variant="primary" pending={form.isSubmitting}>
          Create project
        </FormButton>
      </FormActions>
    </Form>
  );
}
