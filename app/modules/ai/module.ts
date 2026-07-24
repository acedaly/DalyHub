/**
 * PX-03 — the AI product module manifest (navigation shell only).
 *
 * AI is a cross-cutting proposal layer, not an entity type of its own — like
 * Today, it declares no `entityTypes`, so its sidebar row uses the shell's
 * documented generic navigation glyph (the same fallback Today uses, per
 * `app/modules/today/module.ts`). AI-01 owns the real proposal-engine
 * implementation and will extend this manifest when it lands.
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "ai",
  name: "AI",
  description: "A propose → review → apply loop over your real data.",
  order: 210,
  routes,
});
