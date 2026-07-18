import { describe, expect, it } from "vitest";

import {
  AuthConfigurationError,
  ExpiredCredentialsError,
  InvalidCredentialsError,
  MissingCredentialsError,
  OwnerMismatchError,
} from "~/kernel/auth";
import {
  applyBaseSecurityHeaders,
  buildUnauthenticatedResponse,
  withSecurityHeaders,
} from "~/platform/request/security-headers";

describe("baseline security headers", () => {
  it("sets the conservative header policy without a script-src CSP", () => {
    const headers = new Headers();
    applyBaseSecurityHeaders(headers);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("script-src");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });
});

describe("withSecurityHeaders", () => {
  it("marks authenticated responses private and non-cacheable", async () => {
    const response = withSecurityHeaders(new Response("hi"), {
      authenticated: true,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("hi");
  });

  it("does not add a private cache policy to public responses", () => {
    const response = withSecurityHeaders(
      new Response("ok", { headers: { "Cache-Control": "no-store" } }),
      { authenticated: false },
    );
    // Public route keeps its own policy; not overwritten with a contradictory one.
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves a route's own cache policy rather than duplicating it", () => {
    const response = withSecurityHeaders(
      new Response("x", { headers: { "Cache-Control": "private, max-age=5" } }),
      { authenticated: true },
    );
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=5");
  });
});

describe("buildUnauthenticatedResponse", () => {
  it("maps missing credentials to 401 and other failures to 403", () => {
    expect(
      buildUnauthenticatedResponse(new MissingCredentialsError()).status,
    ).toBe(401);
    for (const error of [
      new InvalidCredentialsError(),
      new ExpiredCredentialsError(),
      new OwnerMismatchError(),
    ]) {
      expect(buildUnauthenticatedResponse(error).status).toBe(403);
    }
  });

  it("maps configuration/infrastructure faults to 503", () => {
    expect(
      buildUnauthenticatedResponse(new AuthConfigurationError()).status,
    ).toBe(503);
  });

  it("returns a generic body with no token, no-store and security headers", async () => {
    const response = buildUnauthenticatedResponse(
      new InvalidCredentialsError({ cause: new Error("eyJ.token.sig") }),
    );
    const body = await response.text();
    expect(body).not.toContain("eyJ");
    expect(body.toLowerCase()).toContain("authentication required");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
