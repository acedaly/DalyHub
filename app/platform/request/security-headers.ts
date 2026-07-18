/**
 * FND-09 request platform — baseline response security headers and the generic
 * unauthenticated response.
 *
 * A small, verified header policy applied to every response at the Worker
 * boundary (ADR-016 §18). It is intentionally conservative so it cannot break
 * React Router SSR/hydration: the CSP restricts only `base-uri`, `frame-ancestors`
 * and `object-src` (no `script-src`, which would block hydration). Authenticated
 * responses are marked private/no-store so private application data is never
 * cached publicly; the public `/health` response keeps its own cache policy. No
 * framework stack traces or private details are ever emitted.
 */

import { AuthError } from "~/kernel/auth";

/** A conservative Permissions-Policy denying powerful features by default. */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

/** A minimal CSP that does not interfere with React Router hydration. */
const CONTENT_SECURITY_POLICY = [
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

/**
 * Apply the baseline security headers shared by every response. Uses `set` (not
 * `append`) so a header is never duplicated with a contradictory value.
 */
export function applyBaseSecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Frame-Options", "DENY");
}

/**
 * Ensure an authenticated response is not publicly cacheable. Only sets a policy
 * when the route did not already declare one, so a route's deliberate, narrower
 * cache policy is preserved and never contradicted.
 */
export function applyAuthenticatedCachePolicy(headers: Headers): void {
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "private, no-store");
  }
}

/**
 * Re-emit a response with the baseline security headers applied (and, for
 * authenticated responses, a private cache policy). Rebuilding the response keeps
 * the (possibly streaming) body intact while guaranteeing our headers win.
 */
export function withSecurityHeaders(
  response: Response,
  options: { readonly authenticated: boolean },
): Response {
  const headers = new Headers(response.headers);
  applyBaseSecurityHeaders(headers);
  if (options.authenticated) {
    applyAuthenticatedCachePolicy(headers);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Map an authentication failure to a generic HTTP status. */
function statusForAuthError(error: AuthError): number {
  if (error.configuration) {
    // Misconfiguration or infrastructure fault: a server-side problem.
    return 503;
  }
  switch (error.code) {
    case "missing_credentials":
      return 401;
    default:
      // invalid / expired / identity-claim / owner-mismatch: forbidden, and the
      // response never reveals which check failed.
      return 403;
  }
}

/**
 * Build the generic response for a failed authentication. Carries no token, no
 * claim, no team/AUD value and no stack trace — only a short generic message and
 * the baseline security headers. Not publicly cacheable.
 */
export function buildUnauthenticatedResponse(error: unknown): Response {
  const status = error instanceof AuthError ? statusForAuthError(error) : 403;
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "private, no-store",
  });
  applyBaseSecurityHeaders(headers);
  const message =
    status === 503 ? "Service unavailable." : "Authentication required.";
  return new Response(message, { status, headers });
}
