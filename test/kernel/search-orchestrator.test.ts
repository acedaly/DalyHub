import { beforeEach, describe, expect, it } from "vitest";

import {
  parseWorkspaceId,
  type WorkspaceRepository,
} from "~/kernel/workspaces";
import { createConfiguredWorkspaceContextResolver } from "~/platform/workspaces";
import {
  parseModuleId,
  type ModuleRuntimeContext,
  type RegisteredSearchProvider,
  type SearchExecutor,
} from "~/kernel/modules";
import { executeSearch } from "~/shared/search/orchestrator";

import { makeWorkspaceRepository, resetTables } from "./support";

/**
 * DS-08 — the server composition boundary in the REAL Workers runtime.
 *
 * Proves that the workspace scope a search executor receives is resolved from
 * TRUSTED server configuration (request-free) and delivered unchanged through
 * `ModuleRuntimeContext` — a client can neither supply nor influence it, because
 * the resolver takes no request input and `executeSearch` has no workspace-id
 * parameter.
 */

const CONFIGURED = "search-boundary-workspace";

function recordingProvider(
  onContext: (context: ModuleRuntimeContext) => void,
): RegisteredSearchProvider {
  const search: SearchExecutor = async (query, context) => {
    onContext(context);
    return [
      {
        id: "r1",
        title: `Match ${query.text}`,
        target: { kind: "route", to: "/x" },
        entityType: "task",
      },
    ];
  };
  return {
    id: "probe.search",
    moduleId: parseModuleId("probe"),
    label: "Probe",
    search,
  };
}

describe("search orchestration over the real workspace boundary", () => {
  let repository: WorkspaceRepository;

  beforeEach(async () => {
    await resetTables();
    repository = makeWorkspaceRepository();
  });

  it("delivers the trusted, server-resolved workspace to the provider", async () => {
    await repository.create({ id: parseWorkspaceId(CONFIGURED) });
    const workspace = await createConfiguredWorkspaceContextResolver({
      configuredWorkspaceId: CONFIGURED,
      repository,
    }).resolve();

    let delivered: string | undefined;
    const outcome = await executeSearch({
      providers: [
        recordingProvider((c) => (delivered = c.workspace.workspaceId)),
      ],
      context: { workspace },
      rawQuery: "alpha",
    });

    expect(delivered).toBe(CONFIGURED);
    expect(outcome.status).toBe("ok");
    expect(outcome.totalCount).toBe(1);
  });

  it("fails closed if the configured workspace is absent (no fabricated scope)", async () => {
    // The configured workspace was never created — resolution must reject, so
    // search never runs against an unverified scope.
    const resolver = createConfiguredWorkspaceContextResolver({
      configuredWorkspaceId: "ghost-scope",
      repository,
    });
    await expect(resolver.resolve()).rejects.toThrow();
  });
});
