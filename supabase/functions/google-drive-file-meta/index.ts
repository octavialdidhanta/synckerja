/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getValidGoogleDriveAccessToken,
  mapGoogleDriveApiFailure,
} from "../_shared/googleDriveAccess.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const json = (body: object, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("google-drive-file-meta: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error("google-drive-file-meta: getUser failed", userError?.message ?? userError);
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const fileIdRaw = body.file_id != null ? String(body.file_id).trim() : "";
    if (!fileIdRaw || !/^[a-zA-Z0-9-_]+$/.test(fileIdRaw)) {
      return json({ error: "Invalid or missing file_id" }, 400);
    }

    const { accessToken, error: tokenErr } = await getValidGoogleDriveAccessToken(
      supabaseAdmin,
      user.id,
      "google-drive-file-meta",
    );
    if (!accessToken) {
      return json({ error: tokenErr ?? "No Google access" }, 400);
    }

    const fields = encodeURIComponent("id,name,mimeType,thumbnailLink,iconLink");
    const driveUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileIdRaw)}?fields=${fields}&supportsAllDrives=true`;

    const driveRes = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const meta = (await driveRes.json()) as Record<string, unknown>;
    if (!driveRes.ok) {
      const mapped = mapGoogleDriveApiFailure(driveRes.status, meta, fileIdRaw);
      console.error("google-drive-file-meta: Drive API", mapped.body.error);
      return json(mapped.body, mapped.httpStatus);
    }

    const thumbnailLink = typeof meta.thumbnailLink === "string" ? meta.thumbnailLink : null;
    const iconLink = typeof meta.iconLink === "string" ? meta.iconLink : null;
    const name = typeof meta.name === "string" ? meta.name : null;
    const mimeType = typeof meta.mimeType === "string" ? meta.mimeType : null;

    const fallbackThumbnailUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileIdRaw)}&sz=w2000`;

    return json(
      {
        id: fileIdRaw,
        name,
        mimeType,
        thumbnailLink,
        iconLink,
        /** Client may try if thumbnailLink fails in &lt;img&gt; (sharing-dependent). */
        fallbackThumbnailUrl,
      },
      200,
    );
  } catch (e) {
    const err = e as Error;
    console.error("google-drive-file-meta:", err.message);
    return json({ error: "Internal server error" }, 500);
  }
});
