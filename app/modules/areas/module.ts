/**
 * FND-07 — the Areas product module manifest.
 *
 * A real, side-effect-free production manifest (not a test fixture). It registers
 * only the metadata FND-07 owns: the `area` entity type. Areas are permanent
 * domains of life — they never complete, so there is no completion Activity type,
 * and they have no structural parent, so they own no hierarchy link type. Routes,
 * commands, settings, search providers and page components are deliberately out of
 * scope for FND-07 (they arrive with FND-09 and later module work).
 *
 * Hierarchy correctness itself lives in the shared spine kernel and the
 * SpineRepository (ADR-014 §4.1), never in this manifest — the manifest only
 * declares discoverable capability metadata.
 */

import { defineModule } from "~/kernel/modules";
import { AREA } from "~/kernel/spine";

export default defineModule({
  id: "areas",
  name: "Areas",
  description: "Permanent domains of life — the top of the spine.",
  order: 10,
  entityTypes: [{ type: AREA, singular: "Area", plural: "Areas" }],
});
