/**
 * PX-03 — the Notes module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the Notes manifest. It renders
 * the shared PX-03 "Coming Soon" scaffold only; the Notes product experience is a
 * later roadmap item (NOTES-01 → NOTES-04).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "Notes · DalyHub" },
    {
      name: "description",
      content: "Markdown records that document any entity in DalyHub.",
    },
  ];
}

export default function NotesRoute() {
  return (
    <ModuleComingSoon
      name="Notes"
      entityType="note"
      summary="Markdown records that document any entity in DalyHub."
      fit="Notes attach across the Area → Goal → Project → Task spine — documenting a Project, a Meeting or any other record — through DalyHub's shared EntityLinks, and are written with the same Markdown pipeline every long-form field in DalyHub uses."
      roadmapStatus="It's planned for Phase 5 — Notes (NOTES-01 → NOTES-04) of the DalyHub V2 roadmap."
      capabilities={[
        "Create, edit and read Markdown notes through the shared Record Layout and editor",
        "Link a note to any entity and see backlinks from the entities it documents",
        "Browse, filter and search notes by area, tag and content",
        "A mobile-complete note-taking experience",
      ]}
    />
  );
}
