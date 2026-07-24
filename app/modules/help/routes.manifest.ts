/**
 * PX-03 — the Help module route descriptors (declarative, dependency-free).
 *
 * See the Notes manifest for the pattern this mirrors. `navGroup: "system"`
 * places Help last, alongside Settings.
 */

import type { RouteContribution } from "~/kernel/modules";

const routes: readonly RouteContribution[] = [
  {
    id: "help.index",
    path: "help",
    file: "routes/index.tsx",
    meta: { navLabel: "Help", navGroup: "system", navOrder: 310 },
  },
];

export default routes;
