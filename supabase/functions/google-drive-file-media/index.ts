/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DRIVE_GRANT_REQUIRED_HEADER,
  mapGoogleDriveApiFailure,
} from "../_shared/googleDriveAccess.ts";
import {
  cacheControlForReviewResource,
  parseSupabaseJwtFromRequest,
  resolveDriveAccessFromJwt,
  resolveDriveAccessFromReviewToken,
} from "../_shared/googleDriveReviewAccess.ts";

/**
 * Streams Drive file bytes (alt=media) with the user's stored Google OAuth token.
 * Supports Range for HTML5 video seeking.
 *
 * Auth (one of):
 * - Supabase JWT via Authorization header or query `supabase_token` (dashboard / logged-in preview)
 * - Public review link via query `review_token` + `file_id` (/review/{token} guest preview)
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const LOG_PREFIX = "google-drive-file-media";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const textError = (message: string, status: number) =>
    new Response(message, {
      status,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });

  if (req.method !== "GET" && req.method !== "HEAD") {
    return textError("Method not allowed", 405);
  }

  try {
    const url = new URL(req.url);
    const jwt = parseSupabaseJwtFromRequest(req, url);
    const reviewToken = url.searchParams.get("review_token")?.trim() ?? "";

    const fileIdRaw = url.searchParams.get("file_id")?.trim() ?? "";
    if (!fileIdRaw || !/^[a-zA-Z0-9-_]+$/.test(fileIdRaw)) {
      return textError("Invalid or missing file_id", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error(`${LOG_PREFIX}: SUPABASE_SERVICE_ROLE_KEY missing`);
      return textError("Server configuration error", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let accessToken: string;
    if (jwt) {
      const resolved = await resolveDriveAccessFromJwt(supabaseAdmin, jwt, LOG_PREFIX);
      if (!resolved.ok) return textError(resolved.message, resolved.status);
      accessToken = resolved.accessToken;
    } else if (reviewToken) {
      const resolved = await resolveDriveAccessFromReviewToken(
        supabaseAdmin,
        reviewToken,
        fileIdRaw,
        LOG_PREFIX,
      );
      if (!resolved.ok) return textError(resolved.message, resolved.status);
      accessToken = resolved.accessToken;
    } else {
      return textError("Unauthorized", 401);
    }

    const reviewCache = cacheControlForReviewResource(reviewToken, req.method === "HEAD" ? "probe" : "media");

    if (req.method === "HEAD") {
      const out = new Headers(corsHeaders);
      out.set("Cache-Control", reviewCache);
      return new Response(null, { status: 200, headers: out });
    }

    const driveUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileIdRaw)}?alt=media&supportsAllDrives=true`;

    const range = req.headers.get("Range");
    const driveHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (range) {
      driveHeaders["Range"] = range;
    }

    const driveRes = await fetch(driveUrl, {
      method: req.method,
      headers: driveHeaders,
    });

    const out = new Headers(corsHeaders);
    out.set("Cache-Control", reviewToken ? reviewCache : "private, max-age=300");

    if (!driveRes.ok) {
      try {
        const errJson = (await driveRes.clone().json()) as Record<string, unknown>;
        const mapped = mapGoogleDriveApiFailure(driveRes.status, errJson, fileIdRaw);
        if (mapped.body.code === "DRIVE_GRANT_REQUIRED") {
          out.set(DRIVE_GRANT_REQUIRED_HEADER, "DRIVE_GRANT_REQUIRED");
          out.set("Content-Type", "text/plain; charset=utf-8");
          return new Response(String(mapped.body.error ?? "Grant required"), {
            status: mapped.httpStatus,
            headers: out,
          });
        }
      } catch {
        /* fall through */
      }
    }

    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ];
    for (const name of passthrough) {
      const v = driveRes.headers.get(name);
      if (v) out.set(name, v);
    }

    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: out,
    });
  } catch (e) {
    const err = e as Error;
    console.error(`${LOG_PREFIX}:`, err.message);
    return textError("Internal server error", 500);
  }
});
