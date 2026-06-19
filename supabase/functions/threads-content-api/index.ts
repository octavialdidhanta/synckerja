/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  threadsContentCorsHeaders,
  threadsContentJson,
} from "../_shared/threadsContentAuth.ts";
import { handleThreadsConfig } from "./handlers/config.ts";
import { handleThreadsMetrics } from "./handlers/metrics.ts";
import { handleThreadsComments } from "./handlers/comments.ts";

const COMMENT_ACTIONS = new Set([
  "getInboxState",
  "syncPostBaselines",
  "syncInboundComments",
  "dismissPostHighlight",
  "markCommentEngaged",
  "sync_posts",
  "listPosts",
  "getCommentPosts",
  "sync_comments",
  "listComments",
  "listReplies",
  "reply",
  "replyComment",
]);

const CONFIG_ACTIONS = new Set(["getSettings"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: threadsContentCorsHeaders });
  }

  if (req.method !== "POST") {
    return threadsContentJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return threadsContentJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return threadsContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();

  if (action === "getMetrics") {
    return await handleThreadsMetrics(admin, userRes.userId, body);
  }

  if (CONFIG_ACTIONS.has(action)) {
    return await handleThreadsConfig(admin, userRes.userId, body);
  }

  if (COMMENT_ACTIONS.has(action)) {
    return await handleThreadsComments(admin, userRes.userId, body);
  }

  return threadsContentJson({ error: "Unknown action" }, 400);
});
