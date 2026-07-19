/**
 * DS-06 — the entity-link picker: keyboard search + create, remove, loading and
 * no-entity-specific logic. Data access is entirely via callbacks.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  EntityLinkPicker,
  type EntityLinkSelection,
  type EntityLinkTargetOption,
} from "~/shared/forms";

const TARGETS: EntityLinkTargetOption[] = [
  { id: "n1", type: "note", title: "Creative brief" },
  { id: "p1", type: "person", title: "Mel Okoye" },
];

const LINK_TYPES = [
  { type: "project.supporting_note", label: "Supporting note" },
];

function Harness({
  onLink,
  onUnlink,
  initial = [],
}: {
  readonly onLink?: (params: {
    target: EntityLinkTargetOption;
    linkType: string;
    direction: "outgoing" | "incoming";
  }) => Promise<void>;
  readonly onUnlink?: (link: EntityLinkSelection) => Promise<void>;
  readonly initial?: EntityLinkSelection[];
}) {
  const [links, setLinks] = useState<readonly EntityLinkSelection[]>(initial);
  return (
    <EntityLinkPicker
      label="Related items"
      anchorId="anchor"
      linkTypes={LINK_TYPES}
      existingLinks={links}
      searchTargets={async (query) =>
        TARGETS.filter((t) =>
          t.title.toLowerCase().includes(query.toLowerCase()),
        )
      }
      onLink={async (params) => {
        await onLink?.(params);
        setLinks((cur) => [
          ...cur,
          {
            linkId: `l-${params.target.id}`,
            target: params.target,
            linkType: params.linkType,
            direction: params.direction,
          },
        ]);
      }}
      onUnlink={async (link) => {
        await onUnlink?.(link);
        setLinks((cur) => cur.filter((l) => l.linkId !== link.linkId));
      }}
    />
  );
}

describe("EntityLinkPicker", () => {
  it("searches and creates a link with the keyboard", async () => {
    const onLink = vi.fn(async () => {});
    render(<Harness onLink={onLink} />);
    const input = screen.getByRole("combobox", { name: "Related items" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "brief" } });

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Creative brief/ }),
      ).toBeInTheDocument(),
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(onLink).toHaveBeenCalledWith(
        expect.objectContaining({
          linkType: "project.supporting_note",
          direction: "outgoing",
          target: expect.objectContaining({ id: "n1" }),
        }),
      ),
    );
  });

  it("shows and removes an existing link", async () => {
    const onUnlink = vi.fn(async () => {});
    render(
      <Harness
        onUnlink={onUnlink}
        initial={[
          {
            linkId: "l-n1",
            target: TARGETS[0]!,
            linkType: "project.supporting_note",
            direction: "outgoing",
          },
        ]}
      />,
    );
    expect(screen.getByText("Creative brief")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Remove link to Creative brief/ }),
    );
    await waitFor(() => expect(onUnlink).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText("Creative brief")).not.toBeInTheDocument(),
    );
  });

  it("excludes an already-linked target from results", async () => {
    render(
      <Harness
        initial={[
          {
            linkId: "l-n1",
            target: TARGETS[0]!,
            linkType: "project.supporting_note",
            direction: "outgoing",
          },
        ]}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Related items" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "e" } });
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Mel Okoye/ }),
      ).toBeInTheDocument(),
    );
    // The already-linked "Creative brief" is not offered as an option.
    expect(
      screen.queryByRole("option", { name: /Creative brief/ }),
    ).not.toBeInTheDocument();
  });
});
