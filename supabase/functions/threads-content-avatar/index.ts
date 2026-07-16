/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchThreadsProfile } from "../_shared/threadsContentApi.ts";
import {
  getThreadsAccessToken,
  getUserFromBearer,
  requireActiveOrg,
  resolveThreadsContentAccount,
  threadsContentCorsHeaders,
} from "../_shared/threadsContentAuth.ts";

const corsHeaders: Record<string, string> = {
  ...threadsContentCorsHeaders,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function textError(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return textError("Method not allowed", 405);
  }

  try {
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organization_id")?.trim() ?? "";
    const accountId = url.searchParams.get("account_id")?.trim() ?? "";

    if (!organizationId || !accountId) {
      return textError("Missing organization_id or account_id", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return textError("Server misconfigured", 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const resolved = await resolveThreadsContentAccount(admin, organizationId, accountId);
    if (!resolved) return textError("Account not found", 404);

    let pictureUrl = resolved.threadsProfilePictureUrl?.trim() || null;
    const accessToken = await getThreadsAccessToken(admin, organizationId, resolved.threadsUserId);

    if (accessToken) {
      try {
        const profile = await fetchThreadsProfile(accessToken);
        const freshUrl = profile.threads_profile_picture_url?.trim() || null;
        if (freshUrl) {
          pictureUrl = freshUrl;
          await admin
            .from("organization_instagram_accounts")
            .update({
              threads_profile_picture_url: freshUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId)
            .eq("threads_user_id", resolved.threadsUserId)
            .eq("has_threads", true);
        }
      } catch (e) {
        console.warn("threads-content-avatar fetchThreadsProfile:", e);
      }
    }

    if (!pictureUrl) return textError("Profile picture not available", 404);

    const imgRes = await fetch(pictureUrl);
    if (!imgRes.ok) return textError("Failed to fetch profile picture", 502);

    const bytes = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("threads-content-avatar:", msg);
    return textError(msg, 500);
  }
});
