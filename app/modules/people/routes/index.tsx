/**
 * PX-03 — the People module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the People manifest. It renders
 * the shared PX-03 "Coming Soon" scaffold only; the People product experience is a
 * later roadmap item (PEOPLE-01 → PEOPLE-04).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "People · DalyHub" },
    {
      name: "description",
      content: "The people in your life — care, not a CRM.",
    },
  ];
}

export default function PeopleRoute() {
  return (
    <ModuleComingSoon
      name="People"
      entityType="person"
      summary="The people in your life — care, not a CRM."
      fit="People are woven through DalyHub, not bolted on as a CRM — linked to meetings, projects, tasks and notes so the system helps you remember what matters to the people in your life, never to run a sales pipeline."
      roadmapStatus="It's planned for Phase 7 — People (PEOPLE-01 → PEOPLE-04) of the DalyHub V2 roadmap."
      capabilities={[
        "Create and edit people as first-class entities, linked to meetings, tasks and notes",
        "See a person's accumulated relationship timeline",
        "Gentle, calm stay-in-touch signals — never nagging",
        "A mobile-complete People experience",
      ]}
    />
  );
}
