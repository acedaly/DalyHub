/**
 * PROJ-01 — the Projects collection (`/projects`).
 *
 * The real, D1-backed project collection: a bounded, workspace-scoped read through
 * the trusted authenticated composition boundary (`resolveAuthenticatedWorkspaceScope`
 * → the project read projection), composed ENTIRELY from the shared frame — the PX-02
 * CollectionLayout, the ONE DS-04 Card, the shared EmptyState and a restrained state
 * segment. Each Card opens its project overview through NORMAL client navigation
 * (a real link + SPA open), never an inaccessible clickable container. "New project"
 * opens the shared DS-03 Drawer hosting the DS-06 create form; creation goes through
 * `SpineRepository.createProject` server-side.
 */

import { env } from "cloudflare:workers";
import { useMemo } from "react";
import { useNavigate } from "react-router";

import { requireAuthenticatedSession } from "~/platform/request";
import { resolveAuthenticatedWorkspaceScope } from "~/platform/workspaces";
import { Card, CardCollection } from "~/shared/card";
import type { CardMetaItem, CardProps } from "~/shared/card";
import { CollectionLayout } from "~/shared/collection-layout";
import {
  DrawerProvider,
  DrawerTrigger,
  useDrawer,
  type DrawerEntry,
  type DrawerRenderResult,
} from "~/shared/drawer";
import { EntityIcon } from "~/shared/entity";
import { EmptyState } from "~/shared/empty-state";
import type { SelectOption } from "~/shared/forms/types";

import { NewProjectForm } from "../NewProjectForm";
import { SegmentedFilter } from "../SegmentedFilter";
import {
  serializeProjectListItem,
  toProjectCardData,
  type ProjectCardData,
  type SerializedProjectListItem,
} from "../project-view";
import type { Route } from "./+types/index";

export function meta() {
  return [
    { title: "Projects · DalyHub" },
    {
      name: "description",
      content: "The finite bodies of work you run under an Area or a Goal.",
    },
  ];
}

/** Bounded page size for the parent (Area/Goal) options in the create form. */
const PARENT_OPTIONS_LIMIT = 100;

/** The drawer key hosting the create form. */
const NEW_PROJECT_KEY = "new-project";

type ProjectState = "open" | "completed" | "all";

const STATE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
] as const;

function parseState(value: string | null): ProjectState {
  return value === "open" || value === "completed" ? value : "all";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = requireAuthenticatedSession(context);
  const state = parseState(new URL(request.url).searchParams.get("state"));

  try {
    const scope = await resolveAuthenticatedWorkspaceScope(env, session);
    const page = await scope.projects.listProjects({ state });
    // The Area/Goal parent options for the create form (bounded, workspace-scoped).
    const [areas, goals] = await Promise.all([
      scope.entities.list({ type: "area", limit: PARENT_OPTIONS_LIMIT }),
      scope.entities.list({ type: "goal", limit: PARENT_OPTIONS_LIMIT }),
    ]);
    const parentOptions: SelectOption[] = [
      ...areas.items.map((a) => ({
        value: a.id,
        label: a.title,
        description: "Area",
      })),
      ...goals.items.map((g) => ({
        value: g.id,
        label: g.title,
        description: "Goal",
      })),
    ];
    return {
      projects: page.items.map(serializeProjectListItem),
      parentOptions,
      state,
      failed: false,
    };
  } catch {
    return {
      projects: [] as SerializedProjectListItem[],
      parentOptions: [] as SelectOption[],
      state,
      failed: true,
    };
  }
}

export default function ProjectsRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();

  const renderDrawer = useMemo(() => {
    return function render(entry: DrawerEntry): DrawerRenderResult | null {
      if (entry.key !== NEW_PROJECT_KEY) {
        return null;
      }
      return {
        title: "New project",
        description: "Create a project under an Area or a Goal.",
        children: (
          <NewProjectFormHost parentOptions={loaderData.parentOptions} />
        ),
      };
    };
  }, [loaderData.parentOptions]);

  return (
    <DrawerProvider renderDrawer={renderDrawer}>
      <ProjectsCollection
        projects={loaderData.projects}
        state={loaderData.state}
        failed={loaderData.failed}
        onOpenProject={(id) => navigate(`/projects/${encodeURIComponent(id)}`)}
      />
    </DrawerProvider>
  );
}

/** The create-form host: closes the Drawer and navigates to the new project. */
function NewProjectFormHost({
  parentOptions,
}: {
  readonly parentOptions: readonly SelectOption[];
}) {
  const navigate = useNavigate();
  const { closeDrawer } = useDrawer();
  return (
    <NewProjectForm
      parentOptions={parentOptions}
      onCreated={(projectId) =>
        navigate(`/projects/${encodeURIComponent(projectId)}`)
      }
      onCancel={closeDrawer}
    />
  );
}

function toCardProps(
  card: ProjectCardData,
  onOpenProject: (id: string) => void,
): CardProps {
  const metadata: CardMetaItem[] = [];
  if (card.goalLabel) {
    metadata.push({ id: "goal", label: "Goal", value: card.goalLabel });
  }
  if (!card.progress.has) {
    metadata.push({ id: "tasks", label: "Tasks", value: "No tasks yet" });
  }
  if (card.updatedLabel) {
    metadata.push({
      id: "updated",
      label: "Updated",
      value: card.updatedLabel,
    });
  }

  return {
    id: card.id,
    title: card.title,
    typeLabel: "Project",
    icon: <EntityIcon type="project" />,
    headingLevel: 2,
    status: card.state,
    context: card.areaLabel ? { label: card.areaLabel } : undefined,
    metadata,
    progress: card.progress.has
      ? {
          value: card.progress.completed,
          max: card.progress.total,
          label: card.progress.summary,
        }
      : undefined,
    density: "comfortable",
    presentation: "list",
    href: `/projects/${encodeURIComponent(card.id)}`,
    onOpen: () => onOpenProject(card.id),
    openAriaLabel: `Open ${card.title}`,
  };
}

function ProjectsCollection({
  projects,
  state,
  failed,
  onOpenProject,
}: {
  readonly projects: readonly SerializedProjectListItem[];
  readonly state: ProjectState;
  readonly failed: boolean;
  readonly onOpenProject: (id: string) => void;
}) {
  const cards = useMemo(
    () => projects.map((project) => toProjectCardData(project)),
    [projects],
  );

  const count = projects.length;
  const subtitle = failed
    ? "We couldn't load your projects."
    : count === 1
      ? "1 project"
      : `${count} projects`;

  const newProjectAction = (
    <DrawerTrigger
      drawerKey={NEW_PROJECT_KEY}
      className="dh-btn dh-btn--primary"
    >
      New project
    </DrawerTrigger>
  );

  return (
    <CollectionLayout
      title="Projects"
      subtitle={subtitle}
      entityType="project"
      primaryAction={newProjectAction}
      filterBar={
        <SegmentedFilter
          param="state"
          options={STATE_OPTIONS}
          value={state}
          label="Filter projects by state"
        />
      }
      error={
        failed ? (
          <EmptyState
            title="We couldn't load your projects"
            description="Something went wrong. Please try again."
          />
        ) : undefined
      }
      isFilteredEmpty={!failed && count === 0 && state !== "all"}
      filteredEmptySlot={
        <EmptyState
          icon={<EntityIcon type="project" />}
          title={
            state === "completed" ? "No completed projects" : "No open projects"
          }
          description="Try a different state, or create a project."
          primaryAction={
            <DrawerTrigger
              drawerKey={NEW_PROJECT_KEY}
              className="dh-btn dh-btn--primary"
            >
              New project
            </DrawerTrigger>
          }
        />
      }
      isEmpty={!failed && count === 0 && state === "all"}
      emptySlot={
        <EmptyState
          icon={<EntityIcon type="project" />}
          title="No projects yet"
          description="Projects are the finite bodies of work you run under an Area or a Goal. Create your first one to get started."
          primaryAction={
            <DrawerTrigger
              drawerKey={NEW_PROJECT_KEY}
              className="dh-btn dh-btn--primary"
            >
              New project
            </DrawerTrigger>
          }
        />
      }
    >
      <CardCollection
        items={cards}
        getItemId={(card) => card.id}
        ariaLabel="Projects"
        presentation="list"
        density="comfortable"
        renderCard={(card) => <Card {...toCardProps(card, onOpenProject)} />}
      />
    </CollectionLayout>
  );
}
