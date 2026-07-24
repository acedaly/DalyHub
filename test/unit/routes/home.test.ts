/**
 * PX-03 — `/` no longer serves a standalone Home page; it redirects to `/today`.
 *
 * The loader runs INSIDE the pathless, authenticated `app-shell` layout
 * (`app/routes.ts`), after the Worker request boundary has already authenticated
 * the request (FND-09 ADR-016 §5.6) — so authentication behaviour is unchanged and
 * out of scope here. This proves only the redirect contract: an unauthenticated
 * request never reaches this loader, and every other in-app path is untouched.
 */

import { describe, expect, it } from "vitest";

import { loader } from "~/routes/home";

describe("PX-03 index redirect", () => {
  it("redirects / to /today", () => {
    const response = loader();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBeGreaterThanOrEqual(300);
    expect((response as Response).status).toBeLessThan(400);
    expect((response as Response).headers.get("Location")).toBe("/today");
  });
});
