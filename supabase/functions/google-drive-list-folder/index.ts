/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getGoogleDriveBrowserApiKey,
  getValidGoogleDriveAccessToken,
  listPublicDriveFolder,
  listPublicDriveFolderFromEmbedHtml,
  mapGoogleDriveApiFailure,
  normalizeDriveFolderListItems,
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
      console.error("google-drive-list-folder: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error("google-drive-list-folder: getUser failed", userError?.message ?? userError);
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const folderIdRaw = body.folder_id != null ? String(body.folder_id).trim() : "";
    if (!folderIdRaw || !/^[a-zA-Z0-9-_]+$/.test(folderIdRaw)) {
      return json({ error: "Invalid or missing folder_id" }, 400);
    }

    const apiKey = getGoogleDriveBrowserApiKey();
    if (apiKey) {
      const publicList = await listPublicDriveFolder(folderIdRaw, apiKey);
      if (publicList.ok) {
        return json({ files: publicList.files, accessMode: "public_link" }, 200);
      }
    }

    const embedList = await listPublicDriveFolderFromEmbedHtml(folderIdRaw);
    if (embedList.ok) {
      return json({ files: embedList.files, accessMode: "public_embed" }, 200);
    }

    const { accessToken, error: tokenErr } = await getValidGoogleDriveAccessToken(
      supabaseAdmin,
      user.id,
      "google-drive-list-folder",
    );
    if (!accessToken) {
      return json(
        {
          error:
            "Folder is private or not publicly shared. Set Drive sharing to Anyone with the link (Viewer), or connect Google and grant folder access.",
          code: "DRIVE_GRANT_REQUIRED",
          resourceId: folderIdRaw,
        },
        403,
      );
    }

    const folderFields = encodeURIComponent("id,name,mimeType");
    const folderMetaUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderIdRaw)}` +
      `?fields=${folderFields}&supportsAllDrives=true`;
    const folderRes = await fetch(folderMetaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const folderJson = (await folderRes.json()) as Record<string, unknown>;
    if (!folderRes.ok) {
      const mapped = mapGoogleDriveApiFailure(folderRes.status, folderJson, folderIdRaw);
      console.error("google-drive-list-folder: folder meta", mapped.body.error);
      return json(mapped.body, mapped.httpStatus);
    }

    const folderMime =
      typeof folderJson.mimeType === "string" ? folderJson.mimeType : "";
    if (folderMime && folderMime !== "application/vnd.google-apps.folder") {
      return json({ error: "Resource is not a folder" }, 400);
    }

    const q = `'${folderIdRaw}' in parents and trashed=false`;
    const fields = encodeURIComponent("files(id,name,mimeType,thumbnailLink,iconLink,webViewLink)");
    const listUrl =
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${fields}` +
      `&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=folder,name`;

    const driveRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const listJson = (await driveRes.json()) as Record<string, unknown>;
    if (!driveRes.ok) {
      const mapped = mapGoogleDriveApiFailure(driveRes.status, listJson, folderIdRaw);
      console.error("google-drive-list-folder:", mapped.body.error);
      return json(mapped.body, mapped.httpStatus);
    }

    const rawFiles = listJson.files;
    const normalized = normalizeDriveFolderListItems(Array.isArray(rawFiles) ? rawFiles : []);

    if (normalized.length === 0) {
      const oauthEmbedFallback = await listPublicDriveFolderFromEmbedHtml(folderIdRaw);
      if (oauthEmbedFallback.ok) {
        return json({ files: oauthEmbedFallback.files, accessMode: "public_embed" }, 200);
      }
    }

    return json({ files: normalized, accessMode: "oauth" }, 200);
  } catch (e) {
    const err = e as Error;
    console.error("google-drive-list-folder:", err.message);
    return json({ error: "Internal server error" }, 500);
  }
});
