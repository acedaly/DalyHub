/**
 * PX-03 — the Meetings product module manifest (navigation shell only).
 *
 * Pre-registers the `meeting` entity type identifier so the sidebar renders
 * Meetings with its real entity-identity glyph rather than the generic fallback
 * (see the Notes manifest for the full rationale). MEET-01 owns the real
 * implementation and simply extends this manifest.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "meetings",
  name: "Meetings",
  description: "Attendees, agenda, notes and outcomes for a meeting.",
  order: 120,
  routes,
  entityTypes: [{ type: "meeting", singular: "Meeting", plural: "Meetings" }],
});
