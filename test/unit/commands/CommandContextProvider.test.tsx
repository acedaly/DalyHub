import { render, act } from "@testing-library/react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { describe, expect, it } from "vitest";

import {
  CommandContextProvider,
  useCommandRecents,
  useContextualActions,
  useRegisterContextualActions,
  type AppAction,
  type CommandRecents,
} from "~/shared/commands";

const okRun = () => ({ ok: true as const });

function action(id: string, title = id): AppAction {
  return { id, title, kind: "run", run: okRun };
}

let observed: readonly AppAction[] = [];
function Observer() {
  observed = useContextualActions();
  return null;
}

function Surface({ actions }: { readonly actions: readonly AppAction[] }) {
  useRegisterContextualActions(actions);
  return null;
}

describe("CommandContextProvider", () => {
  it("registers actions and removes them on unmount", () => {
    function App({ mounted }: { readonly mounted: boolean }) {
      return (
        <CommandContextProvider>
          <Observer />
          {mounted ? <Surface actions={[action("a")]} /> : null}
        </CommandContextProvider>
      );
    }
    const { rerender } = render(<App mounted />);
    expect(observed.map((a) => a.id)).toEqual(["a"]);
    rerender(<App mounted={false} />);
    expect(observed).toEqual([]);
  });

  it("dedupes duplicate ids (first registration wins) and orders deterministically", () => {
    render(
      <CommandContextProvider>
        <Observer />
        <Surface actions={[action("a", "first"), action("b")]} />
        <Surface actions={[action("a", "second"), action("c")]} />
      </CommandContextProvider>,
    );
    expect(observed.map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(observed.find((a) => a.id === "a")?.title).toBe("first");
  });

  it("updates when a surface changes its actions (no stale action survives)", () => {
    let setActions: (a: readonly AppAction[]) => void = () => {};
    function DynamicSurface() {
      const [actions, set] = useState<readonly AppAction[]>([action("x")]);
      setActions = set;
      useRegisterContextualActions(actions);
      return null;
    }
    render(
      <CommandContextProvider>
        <Observer />
        <DynamicSurface />
      </CommandContextProvider>,
    );
    expect(observed.map((a) => a.id)).toEqual(["x"]);
    act(() => setActions([action("y")]));
    expect(observed.map((a) => a.id)).toEqual(["y"]);
  });

  it("re-registers the latest closures when only the behaviour (run/target) changes", () => {
    // The presentation fields (id/title/subtitle/kind/disabled) stay identical,
    // but the `run` closure changes to close over fresh state. The registry must
    // hold the latest object so the palette never activates a stale closure.
    type RunFn = () => { ok: true };
    let setRun: Dispatch<SetStateAction<RunFn>> = () => {};
    function DynamicSurface() {
      const [run, set] = useState<RunFn>(() => okRun);
      setRun = set;
      // A freshly-built array each render, same presentation fields, new closure.
      useRegisterContextualActions([{ id: "x", title: "X", kind: "run", run }]);
      return null;
    }
    render(
      <CommandContextProvider>
        <Observer />
        <DynamicSurface />
      </CommandContextProvider>,
    );
    const firstRun = observed.find((a) => a.id === "x");
    expect(firstRun && firstRun.kind === "run" ? firstRun.run : null).toBe(
      okRun,
    );

    const nextRun = () => ({ ok: true as const });
    act(() => setRun(() => nextRun));
    const secondRun = observed.find((a) => a.id === "x");
    expect(secondRun && secondRun.kind === "run" ? secondRun.run : null).toBe(
      nextRun,
    );
  });

  it("returns an empty list with no provider", () => {
    render(<Observer />);
    expect(observed).toEqual([]);
  });

  it("keeps recent commands on the provider so they survive a consumer unmount", () => {
    const held: { store: CommandRecents | null } = { store: null };
    function Reader() {
      held.store = useCommandRecents();
      return null;
    }
    const { rerender } = render(
      <CommandContextProvider>
        <Reader />
      </CommandContextProvider>,
    );
    expect(held.store).not.toBeNull();

    // Record two recents: most-recent first, deduped on repeat.
    act(() => held.store?.remember("today.open"));
    act(() => held.store?.remember("projects.open"));
    act(() => held.store?.remember("today.open"));
    expect(held.store?.getRecentIds()).toEqual(["today.open", "projects.open"]);

    // AppShell unmounts the palette (the consumer) on close…
    rerender(
      <CommandContextProvider>
        <span />
      </CommandContextProvider>,
    );
    // …and remounts it on the next open: the provider outlives it, so the
    // recent/suggested ordering is still there (the pre-fix controller ref reset).
    rerender(
      <CommandContextProvider>
        <Reader />
      </CommandContextProvider>,
    );
    expect(held.store?.getRecentIds()).toEqual(["today.open", "projects.open"]);
  });

  it("bounds recents to the most-recent five", () => {
    const held: { store: CommandRecents | null } = { store: null };
    function Reader() {
      held.store = useCommandRecents();
      return null;
    }
    render(
      <CommandContextProvider>
        <Reader />
      </CommandContextProvider>,
    );
    act(() => {
      for (const id of ["a", "b", "c", "d", "e", "f", "g"]) {
        held.store?.remember(id);
      }
    });
    expect(held.store?.getRecentIds()).toEqual(["g", "f", "e", "d", "c"]);
  });
});
