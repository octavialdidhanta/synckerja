/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createResumableUploadSession,
  driveFileViewUrl,
  ensureSharePublishFolderId,
  mapDriveUploadException,
  parseFileSizeBytes,
  resolveDriveAccessToken,
  setAnyoneWithLinkReader,
  getDriveFileMetadata,
  assertDriveUploadedVideoSize,
} from "../_shared/googleDriveResumableUpload.ts";

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
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("google-drive-resumable-upload: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error(
        "google-drive-resumable-upload: getUser failed",
        userError?.message ?? userError,
      );
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const action = String(body.action ?? "").trim();
    const { accessToken, error: tokenErr } = await resolveDriveAccessToken(
      supabaseAdmin,
      user.id,
    );
    if (!accessToken) {
      return json(
        {
          error: tokenErr ?? "Google account not connected",
          code: "google_not_connected",
        },
        400,
      );
    }

    if (action === "create_session") {
      const fileName = String(body.file_name ?? "shared-video.mp4").trim() || "shared-video.mp4";
      const mimeType = String(body.mime_type ?? "video/mp4").trim() || "video/mp4";
      if (!mimeType.toLowerCase().startsWith("video/")) {
        return json({ error: "Only video uploads are supported" }, 400);
      }

      const rawSize = body.file_size_bytes;
      const fileSizeBytes = parseFileSizeBytes(rawSize);

      const folderId = await ensureSharePublishFolderId(accessToken);
      const uploadUrl = await createResumableUploadSession({
        accessToken,
        fileName,
        mimeType,
        folderId,
        fileSizeBytes,
      });

      return json({ ok: true, upload_url: uploadUrl, folder_id: folderId }, 200);
    }

    if (action === "finalize") {
      const fileId = String(body.file_id ?? "").trim();
      if (!fileId || !/^[a-zA-Z0-9-_]+$/.test(fileId)) {
        return json({ error: "Invalid or missing file_id" }, 400);
      }

      const expectedSizeBytes = parseFileSizeBytes(body.expected_size_bytes);
      const driveMeta = await getDriveFileMetadata(accessToken, fileId);
      assertDriveUploadedVideoSize(driveMeta.size, expectedSizeBytes);

      let permissionWarning: string | undefined;
      try {
        await setAnyoneWithLinkReader(accessToken, fileId);
      } catch (permErr) {
        const msg = permErr instanceof Error ? permErr.message : String(permErr);
        console.warn("google-drive-resumable-upload: permission best-effort failed", msg);
        permissionWarning = msg;
      }

      return json(
        {
          ok: true,
          file_id: fileId,
          google_drive_link: driveFileViewUrl(fileId),
          drive_size_bytes: driveMeta.size,
          ...(permissionWarning ? { permission_warning: permissionWarning } : {}),
        },
        200,
      );
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const mapped = mapDriveUploadException(err);
    console.error("google-drive-resumable-upload:", mapped.body.error ?? err);
    return json(mapped.body, mapped.status);
  }
});
