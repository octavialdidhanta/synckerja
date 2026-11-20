/**
 * Sentry error reporting for Edge Functions (Supabase pattern: no default integrations,
 * explicit capture, flush before the isolate may stop).
 *
 * - Off unless the SENTRY_DSN secret is set.
 * - The SDK is imported lazily, only when something has to be reported, so a failed
 *   import can never break the function itself.
 * - No PII: no headers, cookies, query string or bodies; only method + path.
 *
 * Usage:  Deno.serve(withSentry("function-name", async (req) => { ... }));
 *         await reportEdgeError("function-name", error, { stage: "publish" });  // handled errors
 */

type Handler = (req: Request) => Response | Promise<Response>;
// deno-lint-ignore no-explicit-any
type SentryModule = any;

const SENTRY_SDK = "npm:@sentry/deno@11.13.0";

let sentryPromise: Promise<SentryModule | null> | null = null;

function loadSentry(): Promise<SentryModule | null> {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  if (!dsn) return Promise.resolve(null);
  sentryPromise ??= import(SENTRY_SDK)
    .then((Sentry: SentryModule) => {
      Sentry.init({
        dsn,
        defaultIntegrations: false,
        tracesSampleRate: 0,
        environment: Deno.env.get("SENTRY_ENVIRONMENT")?.trim() || "production",
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          urlQueryParams: false,
          httpBodies: [],
        },
        beforeSend(event: SentryModule) {
          delete event.user;
          if (event.request) {
            delete event.request.headers;
            delete event.request.cookies;
            delete event.request.query_string;
            delete event.request.data;
          }
          return event;
        },
      });
      return Sentry;
    })
    .catch((error: unknown) => {
      console.error("[sentry] init failed", error);
      return null;
    });
  return sentryPromise;
}

/** Run in the background when the runtime allows it, so reporting never delays the response. */
function runInBackground(task: Promise<void>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
    return Promise.resolve();
  }
  return task;
}

function requestContext(req: Request | null): { method?: string; path?: string } {
  if (!req) return {};
  try {
    return { method: req.method, path: new URL(req.url).pathname };
  } catch {
    return { method: req.method };
  }
}

async function capture(
  fn: string,
  error: unknown,
  req: Request | null,
  extra: { status?: number; tags?: Record<string, string> } = {},
): Promise<void> {
  try {
    const Sentry = await loadSentry();
    if (!Sentry) return;
    Sentry.withScope((scope: SentryModule) => {
      scope.setTag("function", fn);
      const region = Deno.env.get("SB_REGION");
      if (region) scope.setTag("region", region);
      const executionId = Deno.env.get("SB_EXECUTION_ID");
      if (executionId) scope.setTag("execution_id", executionId);
      if (extra.status) scope.setTag("http_status", String(extra.status));
      for (const [key, value] of Object.entries(extra.tags ?? {})) scope.setTag(key, value);
      scope.setContext("request", requestContext(req));
      if (error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(`${fn} responded ${extra.status}`, "error");
      }
    });
    await Sentry.flush(2000);
  } catch (reportError) {
    console.error("[sentry] report failed", reportError);
  }
}

/** Wrap a Deno.serve handler: reports thrown errors and 5xx responses, then behaves as before. */
export function withSentry(fn: string, handler: Handler): Handler {
  return async (req: Request) => {
    try {
      const res = await handler(req);
      if (res.status >= 500) await runInBackground(capture(fn, null, req, { status: res.status }));
      return res;
    } catch (error) {
      await runInBackground(capture(fn, error, req));
      throw error;
    }
  };
}

/** Report an error the function caught and handled itself (e.g. one post failed in a batch). */
export function reportEdgeError(
  fn: string,
  error: unknown,
  tags?: Record<string, string>,
): Promise<void> {
  return runInBackground(capture(fn, error, null, { tags }));
}
