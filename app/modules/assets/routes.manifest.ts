/**
 * PX-03 — the Assets module route descriptors (declarative, dependency-free).
 *
 * See the Notes manifest for the pattern this mirrors. `navGroup: "capture"`
 * places Assets in the sidebar's capture group.
 */

import type { RouteContribution } from "~/kernel/modules";

const routes: readonly RouteContribution[] = [
  {
    id: "assets.index",
    path: "assets",
    file: "routes/index.tsx",
    meta: { navLabel: "Assets", navGroup: "capture", navOrder: 140 },
  },
];

export default routes;
