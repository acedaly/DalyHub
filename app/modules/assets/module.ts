/**
 * PX-03 — the Assets product module manifest (navigation shell only).
 *
 * Pre-registers the `asset` entity type identifier so the sidebar renders Assets
 * with its real entity-identity glyph rather than the generic fallback (see the
 * Notes manifest for the full rationale). ASSET-01 owns the real implementation
 * and simply extends this manifest.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "assets",
  name: "Assets",
  description: "Things of value — physical, digital or financial.",
  order: 140,
  routes,
  entityTypes: [{ type: "asset", singular: "Asset", plural: "Assets" }],
});
