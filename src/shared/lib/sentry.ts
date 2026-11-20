import * as Sentry from "@sentry/react";

/**
 * Error monitoring (Sentry). Runs in production builds only, on web and inside the
 * Capacitor Android apps (same bundle). No PII: no IP/user, no console breadcrumbs,
 * and tokens are stripped from URLs (review links, OAuth callbacks, media tokens).
 *
 * The DSN is public by design (it only allows sending events). Override with
 * VITE_SENTRY_DSN, or set it to "off" to disable.
 */
const DEFAULT_DSN =
  "https://0ddbeeb9f13e0f84af17e38aebd3e070@o4512459626250240.ingest.us.sentry.io/4512459751030784";

const SENSITIVE_PARAM =
  /([?&#](?:review_token|token|access_token|refresh_token|id_token|media_token|code|state|apikey|api_key|key|signature|sig)=)[^&#]*/gi;

/** Replace sensitive query/hash parameter values with [redacted]. */
export function scrubUrl(url: string): string {
  return url.replace(SENSITIVE_PARAM, "$1[redacted]");
}

function scrubUnknownUrl(value: unknown): unknown {
  return typeof value === "string" ? scrubUrl(value) : value;
}

let initialized = false;

export function initSentry(): void {
  if (initialized || !import.meta.env.PROD) return;
  const configured = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (configured === "off") return;
  const dsn = configured || DEFAULT_DSN;
  initialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || "production",
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.trim() || undefined,
    // Collect nothing personal: no user/IP, cookies, headers, query params or bodies.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      urlQueryParams: false,
      httpBodies: [],
    },
    ignoreErrors: [
      // Benign browser noise.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Stale chunk after a deploy: main.tsx already reloads once (setupAssetLoadRecovery).
      "Failed to fetch dynamically imported module",
      "Importing a module script failed",
    ],
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console") return null;
      if (breadcrumb.data) {
        breadcrumb.data.url = scrubUnknownUrl(breadcrumb.data.url);
        breadcrumb.data.from = scrubUnknownUrl(breadcrumb.data.from);
        breadcrumb.data.to = scrubUnknownUrl(breadcrumb.data.to);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      // Keep only the opaque user id (UUID) set by setSentryIdentity; drop email/IP/username.
      const userId = event.user?.id;
      event.user = userId ? { id: String(userId) } : undefined;
      if (event.request) {
        if (event.request.url) event.request.url = scrubUrl(event.request.url);
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });

  void import("@capacitor/core")
    .then(({ Capacitor }) => {
      Sentry.setTag("app_platform", Capacitor.getPlatform());
    })
    .catch(() => undefined);
}

/**
 * Attach anonymous identity to future events: user id, active organization id and role.
 * UUIDs only; resolve them to a tenant in Synckerja's own database, never in Sentry.
 */
export function setSentryIdentity(identity: {
  userId: string | null;
  orgId: string | null;
  role: string | null;
}): void {
  if (!initialized) return;
  Sentry.setUser(identity.userId ? { id: identity.userId } : null);
  Sentry.setTag("org_id", identity.orgId ?? undefined);
  Sentry.setTag("org_role", identity.role ?? undefined);
}

/** Report an error caught by a React error boundary (React 18 does not rethrow these). */
export function reportBoundaryError(
  error: unknown,
  info: { componentStack?: string | null } | undefined,
  boundary: string,
): void {
  Sentry.withScope((scope) => {
    scope.setTag("error_boundary", boundary);
    if (info?.componentStack) scope.setContext("react", { componentStack: info.componentStack });
    Sentry.captureException(error);
  });
}
