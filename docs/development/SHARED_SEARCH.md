# SHARED_SEARCH.md — The Shared Search system (DS-08)

> How global Search works in DalyHub: a registry-driven, entity-agnostic search
> surface that returns grouped results from every module and opens records in the
> DS-03 Drawer. Decision record: [ADR-023](../decisions/ARCHITECTURE_DECISIONS.md#adr-023-shared-search--registry-driven-providers-runtime-orchestration-and-safe-navigation).

---

## What it is

One reusable Search system that any module contributes to by registering a
**search provider** — there is no per-module search UI and no central switch. It
lives in [`app/shared/search`](../../app/shared/search) and knows nothing about
Tasks, Projects, Notes, D1, workspaces, routes or Drawer keys.

Global search:

1. sends only a **bounded query** to the server;
2. runs every **registry-discovered** provider under a trusted, server-derived
   workspace scope;
3. returns **bounded, grouped, display-ready** results;
4. opens the chosen record in the existing **DS-03 Drawer** over its home surface,
   preserving unrelated URL state.

---

## The layers

| Layer | Location | Imports | Responsibility |
|---|---|---|---|
| **Model** (pure) | [`~/shared/search/model`](../../app/shared/search/model.ts) | kernel *types* only — no React/D1/bindings (import-guard tested) | normalisation, validation, ranking, grouping, dedup, limits, match ranges, selection maths |
| **Orchestrator** (runtime) | [`orchestrator.ts`](../../app/shared/search/orchestrator.ts) | kernel types + model | run providers, isolate failures, assemble the bounded outcome |
| **Endpoint** | [`app/routes/search.ts`](../../app/routes/search.ts) | worker `env`, registry, orchestrator | auth, trusted workspace scope, JSON `GET /search` |
| **Controller** (React) | [`useSearchController.ts`](../../app/shared/search/useSearchController.ts) | model + transport | debounce, abort, stale rejection, states |
| **Surface** (React) | [`SearchSurface.tsx`](../../app/shared/search/SearchSurface.tsx) | controller + DS-03 hooks + PX-02 identity | combobox/listbox UI, keyboard, highlighting, Drawer opening |

Separating them keeps the model and orchestrator React-free (reusable by a server
or a provider) and the UI server-free.

---

## The provider contract (FND-06, refined by DS-08)

A module registers a provider in its manifest:

```ts
export default defineModule({
  id: "today",
  // …
  searchProviders: [todaySearchProvider],
});
```

A provider returns `SearchResultItem`s from a workspace-scoped executor:

```ts
type SearchResultItem = {
  readonly id: string;              // unique within the provider
  readonly title: string;
  readonly subtitle?: string;       // concise subtitle / preview
  readonly target: SearchResultTarget;
  readonly entityType?: EntityType; // groups the result
  readonly score?: number;          // optional; a normalised tie-breaker only
};

type SearchResultTarget =
  | { kind: "drawer"; drawerKey: string; canonicalPath?: string }
  | { kind: "route"; to: string };
```

**Why `target` replaced `navigateTo`.** FND-06 modelled navigation as an opaque
string, which would force Search to parse a product path to guess how a result
opens — the central-switch coupling ADR-013 forbids. The typed
`SearchResultTarget` lets the **module own how its result opens**; Search dispatches
on `kind` and never parses product ids. Targets are validated at the boundary:
in-app paths must be app-relative, and `javascript:`, protocol-relative `//…`,
external URLs, backslashes and control characters are rejected (the result is
dropped).

The executor receives the trusted `ModuleRuntimeContext` and never searches across
workspaces:

```ts
const search: SearchExecutor = async (query, context) => {
  // query.text is normalised; query.limit is the per-provider bound.
  // context.workspace is the trusted, server-derived scope.
  return matches.slice(0, query.limit);
};
```

---

## Ranking and grouping

Ranking is **tiered and deterministic** so a provider's own score range can never
dominate global ordering:

1. exact title match
2. title prefix
3. title token (word-boundary) prefix
4. fuzzy title (subsequence)
5. subtitle / preview match
6. normalised provider score — tie-breaker only, then title, then id

Results **group primarily by entity type**; a result with no entity type falls
back to its owning module. Groups appear in **first-seen order** over the ranked
list, so the most relevant group leads without a hard-coded entity order.

Highlighting comes from **match ranges** (code-point indices) rendered as `<mark>`
from plain text segments — there is no `dangerouslySetInnerHTML` and no provider
HTML.

---

## Bounds (performance and safety)

Every edge is bounded ([`limits.ts`](../../app/shared/search/limits.ts)): query
length, provider count, results per provider, total results, and each display
field. Empty or invalid queries never execute a provider. The browser sends only
the bounded query and receives only bounded results — never a workspace dataset.

---

## Incremental search (no arbitrary timeouts)

The controller debounces keystrokes, aborts a superseded request, and stamps each
request with a **monotonic sequence number** so a slower earlier response can never
replace a newer one (the abort is best-effort; the sequence guard is
authoritative). Empty input returns to idle, loading keeps valid prior results, a
partial failure still shows healthy results, clearing cancels pending work, and
nothing updates state after unmount.

---

## Opening a result in the Drawer

A `drawer` target navigates to the route hosting that module's `DrawerProvider`
(its `canonicalPath`, or the current path) with the Drawer key appended via the
DS-03 pure URL helper, **preserving unrelated query parameters** — so opening a
result never discards filters or other state. Result rows are real links, so
modified/middle-click open in a new tab; a plain click/Enter opens in-app and
closes Search. There is **no second Drawer or record viewer**.

---

## Accessibility and modal behaviour

The surface reuses the DS-03/PX-02 modal machinery
(`useDrawerFocus`/`useBodyScrollLock`/`useInertBackground`) — **no second
focus-trap, scroll-lock or inertness system**. It is a WAI-ARIA combobox
controlling a `listbox`: opening focuses the input, Tab is contained, Escape
closes and restores focus to the trigger, ↑/↓ wrap, Home/End jump, Enter opens the
active option, `aria-activedescendant` tracks it, and a polite status region
announces count/state. Touch targets meet 44px; usable at 200% zoom and 320px, in
light/dark, with reduced motion. Search claims the **`/`** shortcut only — never
`⌘K` (reserved for the DS-09 Command Palette).

---

## Server composition

`GET /search` ([`app/routes/search.ts`](../../app/routes/search.ts)) authenticates
(the Worker boundary guarantees it), derives the workspace scope from **trusted
server configuration** (`env.DEFAULT_WORKSPACE_ID`) — never from the client —
discovers providers via `ModuleRegistry.listSearchProviders()`, runs the
orchestrator, and returns JSON. Because DS-08's only provider is fixture-backed and
reads no D1, the scope is built with `workspaceContextFromId` rather than the
existence-checking resolver; a future repository-backed provider enforces existence
through its repositories (ADR-010) with no change to this contract.

---

## The Today provider (fixture-backed)

The Today module registers a real, **registry-discovered** provider
([`app/modules/today/search.ts`](../../app/modules/today/search.ts)) over the
existing TODAY-01 fixtures (focus tasks, upcoming meetings/reminders/deadlines,
projects, notes). It returns the **existing Today Drawer keys**
(`task:<id>`, `upcoming:<id>`, `project:<id>`, `note:<id>`) with
`canonicalPath: "/today"`, so selecting a result opens the current DS-03 Record
Layout in the Drawer. It duplicates no fixtures and adds no persistence. When Today
swaps to real product repositories, **only the executor changes** — the shared
provider contract does not.

---

## Development demonstration

A development-only route (`/design/search`, excluded from production by the
`NODE_ENV` guard in `app/routes.ts`) drives the real surface against in-memory fake
providers through the real orchestrator, demonstrating multiple providers/entity
types, exact/prefix/fuzzy matches, highlighting, grouping, no-results, partial and
complete failure, duplicates, long content, keyboard navigation and real Drawer
opening. The real Product Frame Search (sidebar `/`) uses the live `/search`
endpoint and the Today provider.

---

## What DS-08 deliberately does NOT do

No command execution, record creation, Quick Actions, `⌘K`, Inspector/Settings,
product CRUD, persistence, migration, AI/vector/embedding search, background
indexing, or search-history persistence. Search exposes a clean API the DS-09
Command Palette can later launch or incorporate.

---

## Related documents
- [ADR-023](../decisions/ARCHITECTURE_DECISIONS.md#adr-023-shared-search--registry-driven-providers-runtime-orchestration-and-safe-navigation) — the decision record.
- [`MODULES.md`](MODULES.md) — the module registry and the provider contract.
- [`TODAY_DASHBOARD.md`](TODAY_DASHBOARD.md) — the Today module and its Drawer keys.
- [`DESIGN_SYSTEM.md → Search`](../design/DESIGN_SYSTEM.md#search) — the pattern.
- [`REFERENCE_PRODUCTS.md`](../reference/REFERENCE_PRODUCTS.md) — the open-source assessment.
