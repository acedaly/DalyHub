/**
 * PX-03 — the Notes product module manifest (navigation shell only).
 *
 * A real, side-effect-free production manifest that pre-registers the `note`
 * entity type identifier so the sidebar renders Notes with its real entity-identity
 * glyph (`app/shared/entity`) rather than the generic fallback, exactly as FND-09
 * pre-registered Areas/Goals/Projects/Tasks before their product experiences
 * existed. Registering the type here is metadata-only (ADR-013 §4.6) — it adds no
 * table, no migration and no EntityLinks/Activity contribution; NOTES-01 owns the
 * real implementation and simply extends this manifest when it lands.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "notes",
  name: "Notes",
  description: "Markdown records that document any entity in DalyHub.",
  order: 100,
  routes,
  entityTypes: [{ type: "note", singular: "Note", plural: "Notes" }],
});
