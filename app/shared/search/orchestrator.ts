/**
 * DS-08 Shared Search — the runtime orchestration boundary (React-free).
 *
 * The trusted seam that turns a raw query into a bounded, grouped outcome by
 * executing registered providers. It:
 *
 *   1. obtains providers ONLY from the caller (which sourced them from
 *      `ModuleRegistry.listSearchProviders()`); it never keeps a manual array;
 *   2. receives a trusted, server-derived `ModuleRuntimeContext` — it never accepts
 *      or reads a client-supplied workspace id;
 *   3. normalises and bounds the query (an empty/invalid query runs no provider);
 *   4. bounds the provider count and the per-provider result count;
 *   5. executes providers with `Promise.allSettled`, so one broken provider can
 *      never crash global search;
 *   6. isolates failures to `ok: false` — no stack trace, SQL, binding or raw
 *      exception message ever leaves this boundary;
 *   7. delegates validation, dedupe, ranking, limits and grouping to the pure
 *      model, returning a calm partial-results state (or a retryable total
 *      failure) as appropriate.
 *
 * It does not log the raw query. It imports only kernel *types* and the pure
 * model — no React, no D1, no bindings.
 */

import type {
  ModuleRuntimeContext,
  RegisteredSearchProvider,
  SearchResultItem,
} from "~/kernel/modules";

import {
  MAX_PROVIDERS,
  MAX_RESULTS_PER_PROVIDER,
  MAX_TOTAL_RESULTS,
  assembleOutcome,
  emptyOutcome,
  isExecutableQuery,
  normaliseQuery,
  type ProviderResultBatch,
  type SearchOutcome,
} from "./model";

export type ExecuteSearchOptions = {
  /** Providers to run — sourced from `ModuleRegistry.listSearchProviders()`. */
  readonly providers: readonly RegisteredSearchProvider[];
  /** The trusted, server-derived runtime context (workspace scope). */
  readonly context: ModuleRuntimeContext;
  /** The raw, unbounded query text from the request. */
  readonly rawQuery: string;
  readonly maxProviders?: number;
  readonly maxResultsPerProvider?: number;
  readonly maxTotalResults?: number;
};

/**
 * Execute global search. Never throws for a provider failure; returns a bounded,
 * grouped {@link SearchOutcome}. An empty or sub-minimal query returns a safe empty
 * outcome without executing any provider.
 */
export async function executeSearch(
  options: ExecuteSearchOptions,
): Promise<SearchOutcome> {
  const query = normaliseQuery(options.rawQuery);
  if (!isExecutableQuery(query)) {
    return emptyOutcome(query);
  }

  const maxProviders = options.maxProviders ?? MAX_PROVIDERS;
  const perProvider = options.maxResultsPerProvider ?? MAX_RESULTS_PER_PROVIDER;
  const providers = options.providers.slice(0, Math.max(0, maxProviders));

  const searchQuery = { text: query, limit: perProvider };

  const settled = await Promise.allSettled(
    // An async wrapper converts a synchronous provider throw into a rejection,
    // so `allSettled` isolates it like any other failure.
    providers.map(async (provider) =>
      provider.search(searchQuery, options.context),
    ),
  );

  const batches: ProviderResultBatch[] = providers.map((provider, index) => {
    const outcome = settled[index];
    const ok = outcome.status === "fulfilled" && Array.isArray(outcome.value);
    return {
      providerId: provider.id,
      moduleId: provider.moduleId,
      moduleLabel: provider.label,
      ok,
      items: ok ? (outcome.value as readonly SearchResultItem[]) : [],
    };
  });

  return assembleOutcome(query, batches, {
    maxResultsPerProvider: perProvider,
    maxTotalResults: options.maxTotalResults ?? MAX_TOTAL_RESULTS,
  });
}
