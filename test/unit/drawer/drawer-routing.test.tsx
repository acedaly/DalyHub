/**
 * DS-03 — the Drawer routing/URL contract (controller behaviour).
 *
 * Proves that every drawer change is a real URL transition: opening adds a drawer
 * parameter (preserving existing query), closing removes the top level, closing
 * all clears them, replacing swaps the top in place, a copied/reloaded deep link
 * restores the full stack, and ordinary navigation to another page exits the
 * stack. Real browser Back/Forward is exercised end to end in Playwright.
 */

import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DrawerProvider, useDrawer } from "~/shared/drawer";
import type { DrawerEntry, DrawerRenderResult } from "~/shared/drawer";

const renderContent = (entry: DrawerEntry): DrawerRenderResult => ({
  title: `Record ${entry.key}`,
  children: <p>Body {entry.key}</p>,
});

function Controls() {
  const { openDrawer, closeDrawer, closeAll, replaceDrawer, depth, topKey } =
    useDrawer();
  return (
    <div>
      <button type="button" onClick={() => openDrawer("rec:a")}>
        open-a
      </button>
      <button type="button" onClick={() => openDrawer("rec:b")}>
        open-b
      </button>
      <button type="button" onClick={() => replaceDrawer("rec:z")}>
        replace-z
      </button>
      <button type="button" onClick={() => closeDrawer()}>
        close-top
      </button>
      <button type="button" onClick={() => closeAll()}>
        close-all
      </button>
      <Link to="/elsewhere">go elsewhere</Link>
      <span data-testid="depth">{depth}</span>
      <span data-testid="topkey">{topKey ?? "none"}</span>
    </div>
  );
}

function Probe() {
  const location = useLocation();
  return (
    <div data-testid="loc">{`${location.pathname}${location.search}`}</div>
  );
}

function renderHost(initialEntries: string[] = ["/host"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/host"
          element={
            <DrawerProvider renderDrawer={renderContent}>
              <Controls />
              <Probe />
            </DrawerProvider>
          }
        />
        <Route path="/elsewhere" element={<div>Elsewhere page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const loc = () => screen.getByTestId("loc").textContent ?? "";

describe("Drawer controller — URL transitions", () => {
  it("opening adds a drawer parameter to the URL", async () => {
    renderHost();
    fireEvent.click(screen.getByText("open-a"));
    await waitFor(() => expect(loc()).toContain("drawer=rec%3Aa"));
    expect(screen.getByTestId("depth")).toHaveTextContent("1");
    expect(screen.getByTestId("topkey")).toHaveTextContent("rec:a");
  });

  it("preserves an existing query parameter when opening", async () => {
    renderHost(["/host?status=active"]);
    fireEvent.click(screen.getByText("open-a"));
    await waitFor(() => expect(loc()).toContain("status=active"));
    expect(loc()).toContain("drawer=rec%3Aa");
  });

  it("nested opens stack deterministically in order", async () => {
    renderHost();
    fireEvent.click(screen.getByText("open-a"));
    await waitFor(() =>
      expect(screen.getByTestId("depth")).toHaveTextContent("1"),
    );
    fireEvent.click(screen.getByText("open-b"));
    await waitFor(() =>
      expect(screen.getByTestId("depth")).toHaveTextContent("2"),
    );
    expect(loc().indexOf("rec%3Aa")).toBeLessThan(loc().indexOf("rec%3Ab"));
    expect(screen.getByTestId("topkey")).toHaveTextContent("rec:b");
  });

  it("closing the top removes one level", async () => {
    renderHost(["/host?drawer=rec:a&drawer=rec:b"]);
    expect(screen.getByTestId("depth")).toHaveTextContent("2");
    fireEvent.click(screen.getByText("close-top"));
    await waitFor(() =>
      expect(screen.getByTestId("depth")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("topkey")).toHaveTextContent("rec:a");
  });

  it("closing all clears the stack but keeps other parameters", async () => {
    renderHost(["/host?status=active&drawer=rec:a&drawer=rec:b"]);
    fireEvent.click(screen.getByText("close-all"));
    await waitFor(() =>
      expect(screen.getByTestId("depth")).toHaveTextContent("0"),
    );
    expect(loc()).toContain("status=active");
    expect(loc()).not.toContain("drawer=");
  });

  it("replacing swaps the top level in place", async () => {
    renderHost(["/host?drawer=rec:a"]);
    fireEvent.click(screen.getByText("replace-z"));
    await waitFor(() =>
      expect(screen.getByTestId("topkey")).toHaveTextContent("rec:z"),
    );
    expect(screen.getByTestId("depth")).toHaveTextContent("1");
    expect(loc()).not.toContain("rec%3Aa");
  });

  it("restores the full stack from a copied/reloaded deep link", () => {
    renderHost(["/host?drawer=rec:a&drawer=rec:b"]);
    expect(screen.getByTestId("depth")).toHaveTextContent("2");
    expect(screen.getByRole("dialog", { name: "Record rec:b" })).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Record rec:a", hidden: true }),
    ).toBeInTheDocument();
  });

  it("ordinary navigation to another page exits the stack", async () => {
    renderHost(["/host?drawer=rec:a"]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "go elsewhere" }));
    await waitFor(() =>
      expect(screen.getByText("Elsewhere page")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
