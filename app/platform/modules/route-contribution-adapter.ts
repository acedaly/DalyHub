/**
 * FND-06 platform adapter — route contribution composition surface.
 *
 * FND-06 builds the module registry but NOT the app shell or router. This adapter
 * is the single, typed query surface FND-09 will consume to compose the actual
 * React Router route tree from module-owned route contributions (ADR-013 §8). It
 * lives in `app/platform` (not the kernel) because framework/router adaptation
 * belongs outside the storage-independent kernel — though it deliberately stays
 * framework-agnostic here, returning plain data that FND-09 maps onto React
 * Router primitives.
 *
 * It resolves the flat, validated route list into a parent→children tree using
 * each route's `parentId`. It passes every route's declarative `file` reference
 * through UNCHANGED, so composing (or querying) route structure is pure data
 * assembly that never eagerly loads a module's page component.
 */

import type {
  ModuleId,
  RegisteredRoute,
  RouteMeta,
  RouteModuleFile,
} from "~/kernel/modules";

/**
 * A resolved route node: a module-owned route plus its nested children. This is
 * the framework-agnostic shape the React Router adapter maps onto
 * `route()`/`index()` calls with nesting; `file` is carried through untouched for
 * the adapter to resolve into a build-time route-module reference.
 */
export type RouteTreeNode = {
  readonly id: string;
  readonly moduleId: ModuleId;
  readonly path?: string;
  readonly index?: boolean;
  readonly file: RouteModuleFile;
  readonly meta?: RouteMeta;
  readonly children: readonly RouteTreeNode[];
};

/**
 * Build the module route tree from the registry's flat, deterministic route
 * list. Root routes (no `parentId`) become top-level nodes; every other route
 * nests under its parent. The registry has already validated that every parent
 * resolves, is owned by the same module, and that no paths conflict — so this is
 * a straightforward, bounded assembly that preserves the registry's order.
 */
export function buildModuleRouteTree(
  routes: readonly RegisteredRoute[],
): readonly RouteTreeNode[] {
  const childrenByParent = new Map<string, RouteTreeNode[]>();
  const nodeById = new Map<string, RouteTreeNode>();
  const roots: RouteTreeNode[] = [];

  // First pass: create a node per route, preserving deterministic order.
  const nodes: { route: RegisteredRoute; node: RouteTreeNode }[] = routes.map(
    (route) => {
      const node: RouteTreeNode = {
        id: route.id,
        moduleId: route.moduleId,
        ...(route.path === undefined ? {} : { path: route.path }),
        ...(route.index === undefined ? {} : { index: route.index }),
        file: route.file,
        ...(route.meta === undefined ? {} : { meta: route.meta }),
        children: [],
      };
      nodeById.set(route.id, node);
      return { route, node };
    },
  );

  // Second pass: attach each node to its parent (or the roots).
  for (const { route, node } of nodes) {
    if (route.parentId === undefined) {
      roots.push(node);
      continue;
    }
    let siblings = childrenByParent.get(route.parentId);
    if (siblings === undefined) {
      siblings = [];
      childrenByParent.set(route.parentId, siblings);
    }
    siblings.push(node);
  }

  // Third pass: fold collected children into their (mutable-at-build) parents,
  // then freeze so the returned tree is immutable.
  for (const [parentId, children] of childrenByParent) {
    const parent = nodeById.get(parentId);
    if (parent === undefined) {
      // Unreachable after registry validation; skip defensively rather than throw.
      continue;
    }
    (parent as { children: readonly RouteTreeNode[] }).children =
      Object.freeze(children);
  }

  for (const node of nodeById.values()) {
    Object.freeze(node.children);
    Object.freeze(node);
  }
  return Object.freeze(roots);
}
