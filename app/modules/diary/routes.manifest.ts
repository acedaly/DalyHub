/**
 * PX-03 — the Diary module route descriptors (declarative, dependency-free).
 *
 * See the Notes manifest for the pattern this mirrors. `navGroup: "capture"`
 * places Diary in the sidebar's capture group.
 */

import type { RouteContribution } from "~/kernel/modules";

const routes: readonly RouteContribution[] = [
  {
    id: "diary.index",
    path: "diary",
    file: "routes/index.tsx",
    meta: { navLabel: "Diary", navGroup: "capture", navOrder: 110 },
  },
];

export default routes;
