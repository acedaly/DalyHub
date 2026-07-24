/**
 * PX-03 — the Reviews product module manifest (navigation shell only).
 *
 * Pre-registers the `review` entity type identifier so the sidebar renders
 * Reviews with its real entity-identity glyph rather than the generic fallback
 * (see the Notes manifest for the full rationale). REVIEW-01 owns the real
 * implementation and simply extends this manifest.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "reviews",
  name: "Reviews",
  description: "Guided rituals that look across the whole system.",
  order: 200,
  routes,
  entityTypes: [{ type: "review", singular: "Review", plural: "Reviews" }],
});
