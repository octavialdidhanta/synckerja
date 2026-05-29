/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DRIVE_GRANT_REQUIRED_HEADER,
  getValidGoogleDriveAccessToken,
  mapGoogleDriveApiFailure,
} from "../_shared/googleDriveAccess.ts";

/**
 * Returns the Drive file thumbnail image bytes using the user's Google OAuth token.
 * Used for <img src> / video poster because private files often block drive.google.com/thumbnail in the browser.
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

/** Match client `upscaleGoogleDriveThumbnailUrl` — request largest still Google allows. */
function upscaleGoogleDriveThumbnailUrl(url: string): string {
  if (!url?.trim()) return url;
  if (url.includes("googleusercontent.com") && /=s\d+/.test(url)) {
    return url.replace(/=s\d+/, "=s2000");
  }
  if (url.includes("drive.google.com/thumbnail")) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      u.searchParams.set("sz", "w2000");
      return u.toString();
    } catch {
      return url;
    }
  }
  if (url.includes("googleusercontent.com") && /=w\d+-h\d+/.test(url)) {
    return url.replace(/=w\d+-h\d+(-[a-z]*)?/i, "=w2000-h2000");
  }
  return url;
}

const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect fill="#e5e5e5" width="100%" height="100%"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#737373" font-family="system-ui,sans-serif" font-size="18">Preview</text>
</svg>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const url = new URL(req.url);
    const jwt = parseSupabaseJwt(req, url);
    if (!jwt) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const fileIdRaw = url.searchParams.get("file_id")?.trim() ?? "";
    if (!fileIdRaw || !/^[a-zA-Z0-9-_]+$/.test(fileIdRaw)) {
      return new Response("Invalid or missing file_id", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("google-drive-file-thumbnail: SUPABASE_SERVICE_ROLE_KEY missing");
      return new Response("Server configuration error", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      return new Response("Invalid or expired session", {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const { accessToken, error: tokenErr } = await getValidGoogleDriveAccessToken(
      supabaseAdmin,
      user.id,
      "google-drive-file-thumbnail",
    );
    if (!accessToken) {
      return new Response(tokenErr ?? "No Google access", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const fields = encodeURIComponent("thumbnailLink");
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileIdRaw)}?fields=${fields}&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const meta = (await metaRes.json()) as Record<string, unknown>;
    if (!metaRes.ok) {
      console.error("google-drive-file-thumbnail: Drive meta", JSON.stringify(meta).slice(0, 200));
      const mapped = mapGoogleDriveApiFailure(metaRes.status, meta, fileIdRaw);
      if (mapped.body.code === "DRIVE_GRANT_REQUIRED") {
        const out = new Headers(corsHeaders);
        out.set(DRIVE_GRANT_REQUIRED_HEADER, "DRIVE_GRANT_REQUIRED");
        out.set("Content-Type", "text/plain; charset=utf-8");
        return new Response(String(mapped.body.error ?? "Grant required"), {
          status: mapped.httpStatus,
          headers: out,
        });
      }
    }

    const thumbnailLink = typeof meta.thumbnailLink === "string" ? meta.thumbnailLink : null;

    if (thumbnailLink) {
      const hiRes = upscaleGoogleDriveThumbnailUrl(thumbnailLink);
      const tryUrls = hiRes !== thumbnailLink ? [hiRes, thumbnailLink] : [thumbnailLink];
      for (const u of tryUrls) {
        const imgRes = await fetch(u, { redirect: "follow" });
        if (imgRes.ok && imgRes.body) {
          const out = new Headers(corsHeaders);
          const ct = imgRes.headers.get("content-type");
          if (ct) out.set("Content-Type", ct);
          out.set("Cache-Control", "private, max-age=300");
          return new Response(imgRes.body, { status: 200, headers: out });
        }
      }
    }

    const out = new Headers(corsHeaders);
    out.set("Content-Type", "image/svg+xml; charset=utf-8");
    out.set("Cache-Control", "private, max-age=60");
    return new Response(placeholderSvg, { status: 200, headers: out });
  } catch (e) {
    const err = e as Error;
    console.error("google-drive-file-thumbnail:", err.message);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
