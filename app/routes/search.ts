/**
 * DS-08 Shared Search — the server search endpoint (`GET /search`).
 *
 * A resource route (no UI) that runs global search on the server and returns a
 * bounded, grouped, display-ready {@link SearchOutcome} as JSON. It is the trusted
 * composition boundary:
 *
 *   - authentication is guaranteed by the Worker boundary before this runs;
 *     `requireAuthenticatedSession` is defence in depth;
 *   - the workspace scope is derived from TRUSTED server configuration
 *     (`env.DEFAULT_WORKSPACE_ID`) — the client cannot supply or influence a
 *     workspace id (ADR-013 §4.5, ADR-010);
 *   - providers come only from `ModuleRegistry.listSearchProviders()` (registry
 *     discovery), never a manual array;
 *   - the pure orchestrator normalises/bounds the query, isolates provider
 *     failures, validates output and enforces every limit.
 *
 * Note (ADR-023): DS-08's only provider is TODAY-01's fixture-backed provider,
 * which reads no D1. The scope is therefore built with `workspaceContextFromId`
 * over the trusted configured id, rather than the D1-existence-checking resolver —
 * coupling a fixture feature to a persisted workspace row it never queries would be
 * gratuitous. When a module ships a repository-backed provider, its repositories
 * enforce workspace existence exactly as ADR-010 requires; the shared contract does
 * not change.
 *
 * The browser sends only the bounded `q` query and receives only bounded results —
 * never a workspace dataset. The raw query is not logged. Any failure returns a
 * typed, safe, retryable outcome (no internal detail leaks).
 */

import { env } from "cloudflare:workers";

import { discoverModuleRegistry } from "~/modules/discover-modules";
import { requireAuthenticatedSession } from "~/platform/request";
import { workspaceContextFromId } from "~/kernel/workspaces";
import { executeSearch } from "~/shared/search/orchestrator";
import { SEARCH_QUERY_PARAM } from "~/shared/search/client";
import { failureOutcome } from "~/shared/search/model";
import type { SearchOutcome } from "~/shared/search/model";

import type { Route } from "./+types/search";

function json(outcome: SearchOutcome): Response {
  return new Response(JSON.stringify(outcome), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  // Defence in depth — the Worker boundary already authenticated this request.
  requireAuthenticatedSession(context);

  const rawQuery =
    new URL(request.url).searchParams.get(SEARCH_QUERY_PARAM) ?? "";

  try {
    const configuredWorkspaceId = env.DEFAULT_WORKSPACE_ID;
    if (
      typeof configuredWorkspaceId !== "string" ||
      configuredWorkspaceId.trim().length === 0
    ) {
      // Misconfiguration is a safe, retryable failure — never a crash or leak.
      return json(failureOutcome("", []));
    }

    // Trusted, request-free workspace scope. The client cannot choose it.
    const workspace = workspaceContextFromId(configuredWorkspaceId);
    const registry = discoverModuleRegistry();

    const outcome = await executeSearch({
      providers: registry.listSearchProviders(),
      context: { workspace },
      rawQuery,
    });
    return json(outcome);
  } catch {
    // Never leak the scope-resolution failure; return a safe, retryable state.
    return json(failureOutcome("", []));
  }
}
