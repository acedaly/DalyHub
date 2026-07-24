/**
 * PX-03 — the Diary product module manifest (navigation shell only).
 *
 * Pre-registers the `diary` entity type identifier so the sidebar renders Diary
 * with its real entity-identity glyph rather than the generic fallback (see the
 * Notes manifest for the full rationale — this follows the same FND-09 precedent).
 * DIARY-01 owns the real implementation and simply extends this manifest.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "diary",
  name: "Diary",
  description: "Dated Markdown journal entries, private by nature.",
  order: 110,
  routes,
  entityTypes: [{ type: "diary", singular: "Diary", plural: "Diary" }],
});
