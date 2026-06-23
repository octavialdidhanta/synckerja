/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tiktokContentCorsHeaders, tiktokContentJson } from "../_shared/tiktokContentAuth.ts";

const BATCH_SIZE = 10;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: tiktokContentCorsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const internalSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    return tiktokContentJson({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cronSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const authorized = token === serviceRoleKey || (cronSecret.length > 0 && token === cronSecret);
  if (!authorized) {
    return tiktokContentJson({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  const { data: dueRows, error } = await admin
    .from("social_media_scheduled_posts")
    .select("id, organization_id")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("tiktok-content-scheduler query:", error.message);
    return tiktokContentJson({ error: error.message }, 500);
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const row of dueRows ?? []) {
    const scheduleId = String((row as { id: string }).id);
    const organizationId = String((row as { organization_id: string }).organization_id);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/tiktok-content-publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          action: "execute",
          organization_id: organizationId,
          schedule_id: scheduleId,
          internal_secret: internalSecret,
        }),
      });
      const payload = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        results.push({ id: scheduleId, ok: false, error: payload.error ?? `HTTP ${res.status}` });
      } else {
        results.push({ id: scheduleId, ok: true });
      }
    } catch (e) {
      results.push({
        id: scheduleId,
        ok: false,
        error: e instanceof Error ? e.message : "invoke_failed",
      });
    }
  }

  return tiktokContentJson({
    processed: results.length,
    results,
  }, 200);
});
