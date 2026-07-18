import type { RouteConfigEntry } from "@react-router/dev/routes";
import { describe, expect, it } from "vitest";

import routeConfig from "~/routes";
import {
  composeModuleRouteConfig,
  resolveRouteModuleFile,
} from "~/platform/modules/react-router-route-adapter";

function findById(
  entries: readonly RouteConfigEntry[],
  id: string,
): RouteConfigEntry | undefined {
  for (const entry of entries) {
    if (entry.id === id) {
      return entry;
    }
    const nested = entry.children ? findById(entry.children, id) : undefined;
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

describe("the real app/routes.ts composition", () => {
  const config = routeConfig as unknown as RouteConfigEntry[];

  it("keeps /health and the theme action outside the shell layout", () => {
    const paths = config.map((entry) => entry.path);
    expect(paths).toContain("health");
    expect(paths).toContain("preferences/theme");
  });

  it("nests the four spine module routes inside the app-shell layout", () => {
    const shell = config.find((entry) => entry.id === "app-shell");
    expect(shell).toBeDefined();
    const ids = (shell?.children ?? []).map((child) => child.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "areas.index",
        "goals.index",
        "projects.index",
        "tasks.index",
      ]),
    );
  });

  it("resolves each module route file under its owning module", () => {
    for (const moduleId of ["areas", "goals", "projects", "tasks"]) {
      const entry = findById(config, `${moduleId}.index`);
      expect(entry?.file).toBe(`modules/${moduleId}/routes/index.tsx`);
      expect(entry?.path).toBe(moduleId);
    }
  });

  it("includes an authenticated index (home) under the shell", () => {
    const shell = config.find((entry) => entry.id === "app-shell");
    const home = (shell?.children ?? []).find((child) => child.index === true);
    expect(home?.file).toBe("routes/home.tsx");
  });
});

describe("composeModuleRouteConfig", () => {
  it("adds a new module's routes with NO central list change (glob-driven)", () => {
    // Simulate the glob discovering an extra module manifest. No edit to any
    // central array is needed — a new manifest simply appears.
    const entries = composeModuleRouteConfig({
      "./modules/widgets/routes.manifest.ts": {
        default: [
          {
            id: "widgets.index",
            path: "widgets",
            file: "routes/index.tsx",
          },
        ],
      },
      "./modules/areas/routes.manifest.ts": {
        default: [
          { id: "areas.index", path: "areas", file: "routes/index.tsx" },
        ],
      },
    });
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId["widgets.index"]?.file).toBe(
      "modules/widgets/routes/index.tsx",
    );
    expect(byId["areas.index"]?.file).toBe("modules/areas/routes/index.tsx");
  });

  it("composes in deterministic (path-sorted) order", () => {
    const entries = composeModuleRouteConfig({
      "./modules/zebra/routes.manifest.ts": {
        default: [
          { id: "zebra.index", path: "zebra", file: "routes/index.tsx" },
        ],
      },
      "./modules/apple/routes.manifest.ts": {
        default: [
          { id: "apple.index", path: "apple", file: "routes/index.tsx" },
        ],
      },
    });
    expect(entries.map((e) => e.id)).toEqual(["apple.index", "zebra.index"]);
  });
});

describe("resolveRouteModuleFile safety", () => {
  it("resolves a module-relative file under its module", () => {
    expect(
      resolveRouteModuleFile({
        moduleId: "areas" as never,
        file: "routes/index.tsx",
      }),
    ).toBe("modules/areas/routes/index.tsx");
  });

  it("rejects traversal, absolute and drive-letter file references", () => {
    for (const file of [
      "../areas/routes/index.tsx",
      "routes/../../secrets.tsx",
      "/etc/passwd.tsx",
      "C:/win.tsx",
    ]) {
      expect(() =>
        resolveRouteModuleFile({ moduleId: "notes" as never, file }),
      ).toThrow();
    }
  });
});
