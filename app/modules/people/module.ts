/**
 * PX-03 — the People product module manifest (navigation shell only).
 *
 * Pre-registers the `person` entity type identifier so the sidebar renders People
 * with its real entity-identity glyph rather than the generic fallback (see the
 * Notes manifest for the full rationale). PEOPLE-01 owns the real implementation
 * and simply extends this manifest.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "people",
  name: "People",
  description: "The people in your life — care, not a CRM.",
  order: 130,
  routes,
  entityTypes: [{ type: "person", singular: "Person", plural: "People" }],
});
