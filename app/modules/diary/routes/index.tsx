/**
 * PX-03 — the Diary module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the Diary manifest. It renders
 * the shared PX-03 "Coming Soon" scaffold only; the Diary product experience is a
 * later roadmap item (DIARY-01 → DIARY-03).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "Diary · DalyHub" },
    {
      name: "description",
      content: "Dated Markdown journal entries, private by nature.",
    },
  ];
}

export default function DiaryRoute() {
  return (
    <ModuleComingSoon
      name="Diary"
      entityType="diary"
      summary="Dated Markdown journal entries, private by nature."
      fit="Diary is your private, dated journal — a place for reflection that sits beside the rest of your life without forcing structure onto it, connected to the day's meetings, tasks and people only when you choose to link them."
      roadmapStatus="It's planned for Phase 9 — Diary (DIARY-01 → DIARY-03) of the DalyHub V2 roadmap."
      capabilities={[
        "Write and read dated Markdown journal entries, private by nature",
        "Optionally link an entry to that day's meetings, tasks and people",
        "A mobile-complete diary for capturing entries on the go",
      ]}
    />
  );
}
