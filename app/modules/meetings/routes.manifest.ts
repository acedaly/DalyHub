/**
 * PX-03 — the Meetings module route descriptors (declarative, dependency-free).
 *
 * See the Notes manifest for the pattern this mirrors. `navGroup: "capture"`
 * places Meetings in the sidebar's capture group.
 */

import type { RouteContribution } from "~/kernel/modules";

const routes: readonly RouteContribution[] = [
  {
    id: "meetings.index",
    path: "meetings",
    file: "routes/index.tsx",
    meta: { navLabel: "Meetings", navGroup: "capture", navOrder: 120 },
  },
];

export default routes;
