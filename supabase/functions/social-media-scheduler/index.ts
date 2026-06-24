/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

  try {
    const result = await handleSchedulerTick(admin);
    return scheduledPostsJson(result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "scheduler_failed";
    console.error("social-media-scheduler:", message);
    return scheduledPostsJson({ error: message }, 500);
  }
});
