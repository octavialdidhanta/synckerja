/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleSchedulerTick } from "../_shared/scheduledPosts/handleSchedulerTick.ts";
import {
  isScheduledPostsInternalAuthorized,
  scheduledPostsCorsHeaders,
  scheduledPostsJson,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: scheduledPostsCorsHeaders });
  }

  if (!isScheduledPostsInternalAuthorized(req)) {
    return scheduledPostsJson({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return scheduledPostsJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const jobPromise = handleSchedulerTick(admin).catch((e: unknown) => {
    const message = e instanceof Error ? e.message : "scheduler_failed";
    console.error("social-media-scheduler:", message);
    return null;
  });

  // pg_cron aborts the HTTP call at 45s. waitUntil keeps upload/status polling alive after the response.
  const waitForResult = req.headers.get("x-scheduler-wait") === "1";
  if (
    !waitForResult &&
    typeof EdgeRuntime !== "undefined" &&
    typeof EdgeRuntime.waitUntil === "function"
  ) {
    EdgeRuntime.waitUntil(jobPromise);
    return scheduledPostsJson({ ok: true, accepted: true }, 202);
  }

  const result = await jobPromise;
  if (!result) return scheduledPostsJson({ error: "scheduler_failed" }, 500);
  return scheduledPostsJson(result, 200);
});
