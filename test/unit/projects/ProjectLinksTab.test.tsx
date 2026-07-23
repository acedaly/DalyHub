import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectLinksTab } from "~/modules/projects/ProjectLinksTab";

/**
 * PROJ-01/PROJ-05 — the project Key links tab: the structural Area/Goal
 * relationships render, and (PROJ-05 §5) an archived project's picker goes
 * read-only — the add/remove controls are HIDDEN, not merely disabled, since
 * link/unlink against an archived project's Task endpoints always fails.
 */

function renderTab(archived: boolean) {
  return render(
    <ProjectLinksTab
      projectId="p1"
      area={{ kind: "area", id: "a1", title: "Career" }}
      goal={null}
      links={[
        {
          linkId: "l1",
          linkType: "project.relates_to",
          direction: "outgoing",
          target: { id: "n1", type: "note", title: "Design notes" },
        },
      ]}
      searchTargets={vi.fn(() => Promise.resolve([]))}
      onLink={vi.fn(() => Promise.resolve())}
      onUnlink={vi.fn(() => Promise.resolve())}
      archived={archived}
    />,
  );
}

describe("ProjectLinksTab", () => {
  it("shows the structural Area/Goal relationship and existing related records", () => {
    renderTab(false);
    expect(screen.getByText("Career")).toBeInTheDocument();
    expect(screen.getByText("Design notes")).toBeInTheDocument();
  });

  it("offers search/add and remove controls when not archived", () => {
    renderTab(false);
    expect(
      screen.getByRole("combobox", { name: "Related records" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Remove link to Design notes/ }),
    ).toBeInTheDocument();
  });

  it("hides search/add and remove controls when the project is archived", () => {
    renderTab(true);
    // The existing relationship is still readable...
    expect(screen.getByText("Design notes")).toBeInTheDocument();
    // ...but nothing offers to mutate it (hidden, not disabled).
    expect(
      screen.queryByRole("combobox", { name: "Related records" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove link to Design notes/ }),
    ).not.toBeInTheDocument();
  });
});
