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

    const { accessToken, error: tokenErr } = await getValidGoogleDriveAccessToken(
      supabaseAdmin,
      user.id,
      "google-drive-list-folder",
    );
    if (!accessToken) {
      return json({ error: tokenErr ?? "No Google access" }, 400);
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
    const files: unknown[] = Array.isArray(rawFiles) ? rawFiles : [];

    const normalized = files.map((item) => {
      const f = item as Record<string, unknown>;
      const id = typeof f.id === "string" ? f.id : "";
      const name = typeof f.name === "string" ? f.name : "";
      const mimeType = typeof f.mimeType === "string" ? f.mimeType : "";
      const thumbnailLink = typeof f.thumbnailLink === "string" ? f.thumbnailLink : null;
      const iconLink = typeof f.iconLink === "string" ? f.iconLink : null;
      const webViewLink = typeof f.webViewLink === "string" ? f.webViewLink : null;
      const isFolder = mimeType === "application/vnd.google-apps.folder";
      const fallbackThumb =
        id && !isFolder ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w200` : null;
      return {
        id,
        name,
        mimeType,
        isFolder,
        thumbnailLink,
        iconLink,
        webViewLink,
        fallbackThumbnailUrl: fallbackThumb,
      };
    }).filter((f) => f.id && f.name);

    return json({ files: normalized }, 200);
  } catch (e) {
    const err = e as Error;
    console.error("google-drive-list-folder:", err.message);
    return json({ error: "Internal server error" }, 500);
  }
});
