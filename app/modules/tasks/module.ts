/**
 * FND-07 — the Tasks product module manifest.
 *
 * A real, side-effect-free production manifest. It registers the `task` entity
 * type, the two structural links a Task owns (`task.belongs_to_area` and
 * `task.belongs_to_project`, both directed child → parent), and the Task
 * completion Activity types. Hierarchy correctness lives in the SpineRepository
 * (ADR-014 §4.1); this manifest only declares discoverable metadata. No routes,
 * commands, settings or search providers — those are out of scope for FND-07.
 */

import { defineModule } from "~/kernel/modules";
import {
  AREA,
  PROJECT,
  TASK,
  TASK_BELONGS_TO_AREA,
  TASK_BELONGS_TO_PROJECT,
  TASK_COMPLETED,
  TASK_REOPENED,
} from "~/kernel/spine";

export default defineModule({
  id: "tasks",
  name: "Tasks",
  description: "Atomic units of action under an Area or a Project.",
  order: 40,
  entityTypes: [{ type: TASK, singular: "Task", plural: "Tasks" }],
  entityLinkTypes: [
    {
      type: TASK_BELONGS_TO_AREA,
      sourceLabel: "belongs to area",
      targetLabel: "has task",
      sourceEntityType: TASK,
      targetEntityType: AREA,
    },
    {
      type: TASK_BELONGS_TO_PROJECT,
      sourceLabel: "belongs to project",
      targetLabel: "has task",
      sourceEntityType: TASK,
      targetEntityType: PROJECT,
    },
  ],
  activityTypes: [
    {
      type: TASK_COMPLETED,
      label: "Task completed",
      description: "A task was marked complete.",
    },
    {
      type: TASK_REOPENED,
      label: "Task reopened",
      description: "A completed task was reopened.",
    },
  ],
});
