/**
 * PX-03 — the Reviews module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the Reviews manifest. It
 * renders the shared PX-03 "Coming Soon" scaffold only; the Review product
 * experience is a later roadmap item (REVIEW-01 → REVIEW-04).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "Reviews · DalyHub" },
    {
      name: "description",
      content: "Guided rituals that look across the whole system.",
    },
  ];
}

export default function ReviewsRoute() {
  return (
    <ModuleComingSoon
      name="Reviews"
      entityType="review"
      summary="Guided rituals that look across the whole system."
      fit="Review is DalyHub's ritual layer — guided daily, weekly, monthly and quarterly sessions that look across the whole system to surface what to process, celebrate and re-plan, grounded in your real Areas, Projects and Goals."
      roadmapStatus="It's planned for Phase 10 — Review (REVIEW-01 → REVIEW-04) of the DalyHub V2 roadmap."
      capabilities={[
        "Guided daily, weekly, monthly and quarterly review rituals",
        "The flagship weekly review — inbox to zero, project check, goal alignment",
        "Calm, honest insight into what moved and what stalled — no vanity metrics",
        "A mobile-complete Review experience",
      ]}
    />
  );
}
