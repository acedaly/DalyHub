/**
 * PX-03 — the Assets module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the Assets manifest. It renders
 * the shared PX-03 "Coming Soon" scaffold only; the Assets product experience is a
 * later roadmap item (ASSET-01 → ASSET-03).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "Assets · DalyHub" },
    {
      name: "description",
      content: "Things of value — physical, digital or financial.",
    },
  ];
}

export default function AssetsRoute() {
  return (
    <ModuleComingSoon
      name="Assets"
      entityType="asset"
      summary="Things of value — physical, digital or financial."
      fit="Assets track the things of value in your life — physical, digital or financial — so their history, warranties and renewals live in the same place as the rest of what you're responsible for."
      roadmapStatus="It's planned for Phase 8 — Assets (ASSET-01 → ASSET-03) of the DalyHub V2 roadmap."
      capabilities={[
        "Create and edit assets with type-specific metadata and links",
        "See an asset's history, warranties and upcoming renewals as calm reminders",
        "A mobile-complete Assets experience",
      ]}
    />
  );
}
