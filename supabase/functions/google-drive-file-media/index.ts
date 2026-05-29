/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DRIVE_GRANT_REQUIRED_HEADER,
  getValidGoogleDriveAccessToken,
  mapGoogleDriveApiFailure,
} from "../_shared/googleDriveAccess.ts";

/**
 * Streams Drive file bytes (alt=media) with the user's stored Google OAuth token.
 * Supports Range for HTML5 video seeking.
 *
 * `<video src>` cannot send Authorization headers cross-origin, so the client may pass
 * the Supabase JWT as query `supabase_token` (treat like a secret; avoid sharing URLs).
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function parseSupabaseJwt(req: Request, url: URL): string | null {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const t = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (t) return t;
  }
  const q = url.searchParams.get("supabase_token")?.trim();
  return q || null;
}

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
    const jwt = parseSupabaseJwt(req, url);
    if (!jwt) {
      return textError("Unauthorized", 401);
    }

    const fileIdRaw = url.searchParams.get("file_id")?.trim() ?? "";
    if (!fileIdRaw || !/^[a-zA-Z0-9-_]+$/.test(fileIdRaw)) {
      return textError("Invalid or missing file_id", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("google-drive-file-media: SUPABASE_SERVICE_ROLE_KEY missing");
      return textError("Server configuration error", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      return textError("Invalid or expired session", 401);
    }

    const { accessToken, error: tokenErr } = await getValidGoogleDriveAccessToken(
      supabaseAdmin,
      user.id,
      "google-drive-file-media",
    );
    if (!accessToken) {
      return textError(tokenErr ?? "No Google access", 400);
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
    console.error("google-drive-file-media:", err.message);
    return textError("Internal server error", 500);
  }
});
