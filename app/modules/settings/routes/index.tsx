/**
 * PX-03 — the Settings module route (Coming Soon placeholder).
 *
 * Module-owned route referenced declaratively by the Settings manifest. It
 * renders the shared PX-03 "Coming Soon" scaffold only; real settings are a later
 * roadmap item (SET-01 → SET-03).
 */

import { ModuleComingSoon } from "~/shared/shell/ModuleComingSoon";

export function meta() {
  return [
    { title: "Settings · DalyHub" },
    {
      name: "description",
      content: "App, workspace and account configuration.",
    },
  ];
}

export default function SettingsRoute() {
  return (
    <ModuleComingSoon
      name="Settings"
      summary="App, workspace and account configuration."
      fit="Settings is where DalyHub's app-wide, workspace and account configuration will live — using the same shared Settings layout (DS-10b) every module's own settings tab already reuses, so nothing here is a bespoke screen."
      roadmapStatus="It's planned for Phase 13 — Settings & Platform (SET-01 → SET-03) of the DalyHub V2 roadmap."
      capabilities={[
        "Coherent app and workspace configuration",
        "Trustworthy backup and restore of all your data",
        "Account and security management",
      ]}
    />
  );
}
