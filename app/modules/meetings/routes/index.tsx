/**
 * PX-03 — the Meetings module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the Meetings manifest. It
 * renders the shared PX-03 "Coming Soon" scaffold only; the Meetings product
 * experience is a later roadmap item (MEET-01 → MEET-04).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "Meetings · DalyHub" },
    {
      name: "description",
      content: "Attendees, agenda, notes and outcomes for a meeting.",
    },
  ];
}

export default function MeetingsRoute() {
  return (
    <ModuleComingSoon
      name="Meetings"
      entityType="meeting"
      summary="Attendees, agenda, notes and outcomes for a meeting."
      fit="Meetings capture who was in the room, what was discussed and what was decided — attaching People, spawning Tasks, and contributing to every attendee's relationship history through the shared Activity model."
      roadmapStatus="It's planned for Phase 6 — Meetings (MEET-01 → MEET-04) of the DalyHub V2 roadmap."
      capabilities={[
        "Capture attendees, agenda, notes and outcomes for a meeting",
        "Turn meeting outcomes into linked tasks",
        "See a meeting in every attendee's People timeline",
        "A mobile-complete meeting-capture experience",
      ]}
    />
  );
}
