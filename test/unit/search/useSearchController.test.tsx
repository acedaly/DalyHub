import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSearchController } from "~/shared/search/useSearchController";
import { assembleOutcome, type SearchOutcome } from "~/shared/search/model";
import type { SearchFn } from "~/shared/search/client";

function outcomeWith(query: string, title: string): SearchOutcome {
  return assembleOutcome(query, [
    {
      providerId: "t.search",
      moduleId: "t",
      moduleLabel: "T",
      ok: true,
      items: [
        {
          id: title,
          title,
          entityType: "task",
          target: { kind: "route", to: "/x" },
        },
      ],
    },
  ]);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSearchController", () => {
  it("stays idle and never fetches for an empty query", async () => {
    const search = vi.fn<SearchFn>(async (q) => outcomeWith(q, "X"));
    const { result } = renderHook(() =>
      useSearchController({ search, debounceMs: 0 }),
    );
    act(() => result.current.setQuery("   "));
    await act(async () => {
      await Promise.resolve();
    });
    expect(search).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("debounces keystrokes into a single request", async () => {
    const search = vi.fn<SearchFn>(async (q) => outcomeWith(q, "Result"));
    const { result } = renderHook(() =>
      useSearchController({ search, debounceMs: 30 }),
    );
    act(() => result.current.setQuery("a"));
    act(() => result.current.setQuery("al"));
    act(() => result.current.setQuery("alp"));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("alp", expect.any(AbortSignal));
  });

  it("never lets a slower earlier response replace a newer one", async () => {
    const first = deferred<SearchOutcome>();
    const second = deferred<SearchOutcome>();
    const calls: string[] = [];
    const search: SearchFn = (q) => {
      calls.push(q);
      return calls.length === 1 ? first.promise : second.promise;
    };
    const { result } = renderHook(() =>
      useSearchController({ search, debounceMs: 0 }),
    );

    act(() => result.current.setQuery("a"));
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.setQuery("ab"));
    await waitFor(() => expect(calls).toHaveLength(2));

    // B (the newer request) resolves first...
    await act(async () => {
      second.resolve(outcomeWith("ab", "Beta"));
      await Promise.resolve();
    });
    expect(result.current.flatResults[0]?.title).toBe("Beta");

    // ...then A (the older request) resolves later — it must be ignored.
    await act(async () => {
      first.resolve(outcomeWith("a", "Alpha"));
      await Promise.resolve();
    });
    expect(result.current.flatResults[0]?.title).toBe("Beta");
  });

  it("returns to idle and cancels pending work when cleared", async () => {
    const pending = deferred<SearchOutcome>();
    const search = vi.fn<SearchFn>(() => pending.promise);
    const { result } = renderHook(() =>
      useSearchController({ search, debounceMs: 0 }),
    );
    act(() => result.current.setQuery("alpha"));
    await waitFor(() => expect(search).toHaveBeenCalled());
    act(() => result.current.clear());
    expect(result.current.phase).toBe("idle");
    // A late resolution of the cancelled request must not change state.
    await act(async () => {
      pending.resolve(outcomeWith("alpha", "Late"));
      await Promise.resolve();
    });
    expect(result.current.phase).toBe("idle");
  });

  it("surfaces a retryable error and recovers on retry", async () => {
    let mode: "fail" | "ok" = "fail";
    const search: SearchFn = async (q) => {
      if (mode === "fail") {
        throw new Error("network");
      }
      return outcomeWith(q, "Recovered");
    };
    const { result } = renderHook(() =>
      useSearchController({ search, debounceMs: 0 }),
    );
    act(() => result.current.setQuery("alpha"));
    await waitFor(() => expect(result.current.phase).toBe("error"));
    mode = "ok";
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.flatResults[0]?.title).toBe("Recovered");
  });

  it("shows healthy results when a newer request is partial", async () => {
    const search: SearchFn = async (q) =>
      assembleOutcome(q, [
        {
          providerId: "a.search",
          moduleId: "a",
          moduleLabel: "A",
          ok: true,
          items: [
            {
              id: "1",
              title: `Healthy ${q}`,
              entityType: "task",
              target: { kind: "route", to: "/x" },
            },
          ],
        },
        {
          providerId: "b.search",
          moduleId: "b",
          moduleLabel: "B",
          ok: false,
          items: [],
        },
      ]);
    const { result } = renderHook(() =>
      useSearchController({ search, debounceMs: 0 }),
    );
    act(() => result.current.setQuery("alpha"));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.isPartial).toBe(true);
    expect(result.current.hasResults).toBe(true);
  });

  it("does not update state after unmount", async () => {
    const pending = deferred<SearchOutcome>();
    const search: SearchFn = () => pending.promise;
    const { result, unmount } = renderHook(() =>
      useSearchController({ search, debounceMs: 0 }),
    );
    act(() => result.current.setQuery("alpha"));
    await waitFor(() => expect(result.current.phase).toBe("loading"));
    unmount();
    // Resolving after unmount must not throw or warn.
    await act(async () => {
      pending.resolve(outcomeWith("alpha", "After"));
      await Promise.resolve();
    });
  });
});
