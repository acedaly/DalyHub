/**
 * PX-03 — the Notes module route descriptors (declarative, dependency-free).
 *
 * The single source of truth for the Notes module's routes: plain data with only a
 * type import (erased at build time), safe for React Router's bare `routes.ts`
 * config loader and imported by `module.ts` for the runtime registry
 * (ADR-016 §5.10). `navGroup: "capture"` places Notes in the sidebar's capture
 * group (Notes/Diary/Meetings/People/Assets), after the spine modules.
 */

import type { RouteContribution } from "~/kernel/modules";

const routes: readonly RouteContribution[] = [
  {
    id: "notes.index",
    path: "notes",
    file: "routes/index.tsx",
    meta: { navLabel: "Notes", navGroup: "capture", navOrder: 100 },
  },
];

export default routes;
