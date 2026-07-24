/**
 * PX-03 — the authenticated index route.
 *
 * `/` is no longer a standalone landing surface: it redirects to `/today`, the
 * calm daily home TODAY-01 built. This runs as a loader-level redirect — it
 * executes AFTER the Worker request boundary has authenticated the request (FND-09
 * ADR-016 §5.6), so authentication behaviour is unchanged; an unauthenticated
 * request never reaches this loader. React Router resolves a loader redirect
 * before rendering, so no component ever mounts here, and a full-page visit to
 * `/` (bookmark, typed URL) receives a normal HTTP redirect that lands cleanly on
 * `/today` without leaving `/` behind as a back-button trap. Deep links to any
 * other in-app path are untouched — this route only ever matches the exact root.
 */

import { redirect } from "react-router";

export function loader() {
  return redirect("/today");
}
