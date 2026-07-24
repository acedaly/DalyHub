/**
 * PX-03 — the People module route descriptors (declarative, dependency-free).
 *
 * See the Notes manifest for the pattern this mirrors. `navGroup: "capture"`
 * places People in the sidebar's capture group.
 */

import type { RouteContribution } from "~/kernel/modules";

const routes: readonly RouteContribution[] = [
  {
    id: "people.index",
    path: "people",
    file: "routes/index.tsx",
    meta: { navLabel: "People", navGroup: "capture", navOrder: 130 },
  },
];

export default routes;
