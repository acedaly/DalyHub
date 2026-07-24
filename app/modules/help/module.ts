/**
 * PX-03 — the Help product module manifest (navigation shell only).
 *
 * Help is a cross-cutting guidance surface, not an entity type — like Today, AI
 * and Settings, it declares no `entityTypes`, so its sidebar row uses the shell's
 * documented generic navigation glyph. There is no dedicated ROADMAP_V2 phase for
 * in-app help yet; this manifest exists so Help has a real, reachable place in
 * navigation rather than being a dead link, per AGENTS.md §6 (no dead ends).
 */

import { defineModule } from "~/kernel/modules";

import routes from "./routes.manifest";

export default defineModule({
  id: "help",
  name: "Help",
  description: "Guidance for how DalyHub works.",
  order: 310,
  routes,
});
