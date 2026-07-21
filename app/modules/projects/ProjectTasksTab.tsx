/**
 * PROJ-01 — the project overview's Tasks tab.
 *
 * The project's real child tasks using the shared DS-04 Card and the shared task
 * semantics (completion = the spine's `completedAt`; waiting = the TODAY-03 state;
 * scheduled vs due kept distinct). A restrained open/completed/all filter (URL
 * `?tasks=`) and an "Add task" affordance that opens the shared create Drawer. A task
 * Card opens the SAME shared Task Drawer used on Today (`?drawer=task:<id>`), so the
 * project stays behind the Drawer and the task is edited the one canonical way.
 */

import { Link, useSearchParams } from "react-router";

import { Card, CardCollection } from "~/shared/card";
import type { CardMetaItem, CardProps } from "~/shared/card";
import { DrawerTrigger, useDrawer, withDrawerPushed } from "~/shared/drawer";
import { EntityIcon, isEntityType } from "~/shared/entity";
import { EmptyState } from "~/shared/empty-state";
import {
  isTaskWaiting,
  taskDateLabel,
  taskDisplayStatus,
  waitingSubjectLabel,
} from "~/shared/task-record/task-view";

import { SegmentedFilter } from "./SegmentedFilter";
import type { SerializedProjectTask } from "./project-view";

const TASK_STATE_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
] as const;

/** The drawer key that opens the "New task" create form. */
export const NEW_TASK_KEY = "new-task";

interface ProjectTasksTabProps {
  readonly tasks: readonly SerializedProjectTask[];
  readonly taskState: "open" | "completed" | "all";
  readonly todayIso: string;
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

function toTaskCardProps(
  task: SerializedProjectTask,
  todayIso: string,
  openProps: (key: string) => { href: string; onOpen: () => void },
): CardProps {
  const completed = task.completedAt !== null;
  const waiting = isTaskWaiting(task);
  const status = taskDisplayStatus(completed, task.status, waiting);
  const date = taskDateLabel(task, todayIso);

  const metadata: CardMetaItem[] = [];
  if (waiting && task.waiting) {
    metadata.push({
      id: "waiting-for",
      label: "Waiting for",
      value: (
        <span className="dh-waiting-card__subject">
          {task.waiting.subject.kind === "entity" &&
          task.waiting.subject.type &&
          isEntityType(task.waiting.subject.type) ? (
            <EntityIcon type={task.waiting.subject.type} />
          ) : null}
          <span>{waitingSubjectLabel(task.waiting.subject)}</span>
        </span>
      ),
    });
  }

  return {
    id: task.id,
    title: task.title,
    typeLabel: "Task",
    icon: <EntityIcon type="task" />,
    headingLevel: 4,
    status: { label: status.label, tone: status.tone },
    metadata,
    dateLabel: date
      ? {
          label: date.label,
          tone: date.tone === "danger" ? "danger" : undefined,
        }
      : undefined,
    density: "comfortable",
    presentation: "list",
    openAriaLabel: `Open ${task.title}`,
    ...openProps(`task:${task.id}`),
  };
}

export function ProjectTasksTab({
  tasks,
  taskState,
  todayIso,
  nextCursor,
  hasMore,
}: ProjectTasksTabProps) {
  const { openDrawer } = useDrawer();
  const [searchParams] = useSearchParams();

  const openProps = (key: string) => ({
    href: `?${withDrawerPushed(searchParams, key).toString()}`,
    onOpen: () => openDrawer(key),
  });

  const nextParams = new URLSearchParams(searchParams);
  if (nextCursor) nextParams.set("taskCursor", nextCursor);
  return (
    <div className="dh-project-tasks">
      <div className="dh-project-tasks__toolbar">
        <SegmentedFilter
          param="tasks"
          options={TASK_STATE_OPTIONS}
          value={taskState}
          label="Filter tasks by state"
        />
        <DrawerTrigger
          drawerKey={NEW_TASK_KEY}
          className="dh-btn dh-btn--secondary"
        >
          Add task
        </DrawerTrigger>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<EntityIcon type="task" />}
          headingLevel={3}
          title={
            taskState === "completed"
              ? "No completed tasks"
              : taskState === "open"
                ? "No open tasks"
                : "No tasks yet"
          }
          description="Add a task to start moving this project forward."
          primaryAction={
            <DrawerTrigger
              drawerKey={NEW_TASK_KEY}
              className="dh-btn dh-btn--primary"
            >
              Add task
            </DrawerTrigger>
          }
        />
      ) : (
        <CardCollection
          items={tasks}
          getItemId={(task) => task.id}
          ariaLabel="Project tasks"
          presentation="list"
          density="comfortable"
          renderCard={(task) => (
            <Card {...toTaskCardProps(task, todayIso, openProps)} />
          )}
        />
      )}
      {hasMore && nextCursor ? (
        <Link
          className="dh-btn dh-btn--secondary"
          to={`?${nextParams.toString()}`}
        >
          Load more tasks
        </Link>
      ) : null}
    </div>
  );
}
