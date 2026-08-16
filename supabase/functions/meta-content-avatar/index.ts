/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchMetaAccountProfilePictureUrl } from "../_shared/metaContentAccountProfile.ts";
import { resolveIgBusinessDiscovery } from "../_shared/metaContent/resolveIgBusinessDiscovery.ts";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  requireActiveOrg,
  resolveMetaContentAccount,
  type MetaContentPlatform,
} from "../_shared/metaContentAuth.ts";

const corsHeaders: Record<string, string> = {
  ...metaContentCorsHeaders,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function parseSupabaseJwt(req: Request, url: URL): string {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return url.searchParams.get("supabase_token")?.trim() ?? "";
}

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
    const platform = url.searchParams.get("platform")?.trim() as MetaContentPlatform;
    const accountId = url.searchParams.get("account_id")?.trim() ?? "";
    const username = url.searchParams.get("username")?.trim().replace(/^@+/, "") ?? "";
    const userId = url.searchParams.get("user_id")?.trim() ?? "";

    if (!organizationId || !accountId) {
      return textError("Missing organization_id or account_id", 400);
    }
    if (platform !== "instagram" && platform !== "facebook") {
      return textError("Invalid platform", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return textError("Server misconfigured", 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const jwt = parseSupabaseJwt(req, url);
    if (!jwt) return textError("Unauthorized", 401);

    const userRes = await getUserFromBearer(admin, `Bearer ${jwt}`);
    if ("error" in userRes) return userRes.error;

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const resolved = await resolveMetaContentAccount(admin, organizationId, platform, accountId);
    if (!resolved) return textError("Account not found", 404);

    const graphNodeId = platform === "instagram"
      ? resolved.igBusinessAccountId ?? accountId
      : resolved.pageId;

    let pictureUrl: string | null = null;
    if (platform === "instagram" && username) {
      const accountUsername = resolved.accountLabel.replace(/^@+/, "").toLowerCase();
      if (username.toLowerCase() === accountUsername) {
        pictureUrl = await fetchMetaAccountProfilePictureUrl(
          platform,
          graphNodeId,
          resolved.pageAccessToken,
        );
      } else if (resolved.igBusinessAccountId) {
        const discovered = await resolveIgBusinessDiscovery({
          igBusinessAccountId: resolved.igBusinessAccountId,
          pageAccessToken: resolved.pageAccessToken,
          username,
        });
        pictureUrl = discovered?.profilePictureUrl ?? null;
      }
    } else if (platform === "facebook" && userId) {
      pictureUrl = await fetchMetaAccountProfilePictureUrl(
        "facebook",
        userId,
        resolved.pageAccessToken,
      );
    } else {
      pictureUrl = await fetchMetaAccountProfilePictureUrl(
        platform,
        graphNodeId,
        resolved.pageAccessToken,
      );
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
    console.error("meta-content-avatar:", msg);
    return textError(msg, 500);
  }
});
