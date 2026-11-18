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
  resolveDriveAccessFromMediaToken,
  resolveDriveAccessFromReviewToken,
} from "../_shared/googleDriveReviewAccess.ts";

/**
 * Returns Drive file thumbnail bytes using stored Google OAuth.
 * Auth: media_token (file-scoped) OR Supabase JWT in the Authorization header (the old supabase_token query is rejected)
 * OR public review_token + file_id.
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const LOG_PREFIX = "google-drive-file-thumbnail";

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

/**
 * Public "anyone with the link" thumbnail. Link-shared files owned by another Google account
 * are invisible to the office account ("File not found") but still have a public thumbnail.
 * Returns null unless Google answers with an image.
 */
async function fetchSharedDriveThumbnail(fileId: string): Promise<Response | null> {
  const id = encodeURIComponent(fileId);
  const candidates = [
    `https://lh3.googleusercontent.com/d/${id}=w2000`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
  ];
  for (const u of candidates) {
    try {
      const res = await fetch(u, { redirect: "follow" });
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && res.body && ct.toLowerCase().startsWith("image/")) return res;
      await res.body?.cancel();
    } catch {
      /* try next candidate */
    }
  }
  return null;
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
    const jwt = parseSupabaseJwtFromRequest(req, url);
    const reviewToken = url.searchParams.get("review_token")?.trim() ?? "";
    const mediaToken = url.searchParams.get("media_token")?.trim() ?? "";

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
      console.error(`${LOG_PREFIX}: SUPABASE_SERVICE_ROLE_KEY missing`);
      return new Response("Server configuration error", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let accessToken: string;
    if (mediaToken) {
      const resolved = await resolveDriveAccessFromMediaToken(
        supabaseAdmin,
        mediaToken,
        fileIdRaw,
        LOG_PREFIX,
      );
      if (!resolved.ok) {
        return new Response(resolved.message, {
          status: resolved.status,
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      accessToken = resolved.accessToken;
    } else if (jwt) {
      const resolved = await resolveDriveAccessFromJwt(supabaseAdmin, jwt, LOG_PREFIX, fileIdRaw);
      if (!resolved.ok) {
        return new Response(resolved.message, {
          status: resolved.status,
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      accessToken = resolved.accessToken;
    } else if (reviewToken) {
      const resolved = await resolveDriveAccessFromReviewToken(
        supabaseAdmin,
        reviewToken,
        fileIdRaw,
        LOG_PREFIX,
      );
      if (!resolved.ok) {
        return new Response(resolved.message, {
          status: resolved.status,
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      accessToken = resolved.accessToken;
    } else {
      return new Response("Unauthorized", {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const cacheControl = cacheControlForReviewResource(reviewToken, "thumbnail");

    const fields = encodeURIComponent("thumbnailLink");
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileIdRaw)}?fields=${fields}&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const meta = (await metaRes.json()) as Record<string, unknown>;
    if (!metaRes.ok) {
      console.error(`${LOG_PREFIX}: Drive meta`, JSON.stringify(meta).slice(0, 200));
      const shared = await fetchSharedDriveThumbnail(fileIdRaw);
      if (shared) {
        const out = new Headers(corsHeaders);
        out.set("Content-Type", shared.headers.get("content-type") ?? "image/jpeg");
        out.set("Cache-Control", cacheControl);
        return new Response(shared.body, { status: 200, headers: out });
      }
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
          out.set("Cache-Control", cacheControl);
          return new Response(imgRes.body, { status: 200, headers: out });
        }
      }
    }

    const out = new Headers(corsHeaders);
    out.set("Content-Type", "image/svg+xml; charset=utf-8");
    out.set("Cache-Control", reviewToken ? cacheControl : "private, max-age=60");
    return new Response(placeholderSvg, { status: 200, headers: out });
  } catch (e) {
    const err = e as Error;
    console.error(`${LOG_PREFIX}:`, err.message);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
