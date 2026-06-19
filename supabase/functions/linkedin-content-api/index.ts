/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  linkedinContentCorsHeaders,
  linkedinContentJson,
} from "../_shared/linkedinContentAuth.ts";
import { handleLinkedInConfig } from "./handlers/config.ts";
import { handleLinkedInMetrics } from "./handlers/metrics.ts";
import { handleLinkedInComments } from "./handlers/comments.ts";
import { handleLinkedInOAuthStart } from "./handlers/oauthStart.ts";
import { handleLinkedInOAuthCallback } from "./handlers/oauthCallback.ts";

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

const CONFIG_ACTIONS = new Set([
  "getSettings",
  "getPendingPages",
  "completePageConnect",
  "disconnect",
  "setDefaultAccount",
  "deleteAccount",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: linkedinContentCorsHeaders });
  }

  const url = new URL(req.url);
  if (req.method === "GET") {
    if (url.searchParams.has("code") || url.searchParams.has("error")) {
      return await handleLinkedInOAuthCallback(req);
    }
    return linkedinContentJson({ error: "Method not allowed" }, 405);
  }

  if (req.method !== "POST") {
    return linkedinContentJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return linkedinContentJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return linkedinContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();

  if (action === "oauthStart") {
    return await handleLinkedInOAuthStart(admin, userRes.userId, body);
  }

  if (action === "getMetrics") {
    return await handleLinkedInMetrics(admin, userRes.userId, body);
  }

  if (CONFIG_ACTIONS.has(action)) {
    return await handleLinkedInConfig(admin, userRes.userId, body);
  }

  if (COMMENT_ACTIONS.has(action)) {
    return await handleLinkedInComments(admin, userRes.userId, body);
  }

  return linkedinContentJson({ error: "Unknown action" }, 400);
});
