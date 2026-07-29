import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidGoogleDriveAccessToken } from "./googleDriveAccess.ts";

export type SupabaseAdminClient = ReturnType<typeof createClient>;

export const SHARE_PUBLISH_DRIVE_FOLDER_NAME = "Synckerja Social Media Uploads";
const SHARE_PUBLISH_FOLDER_APP_PROP_KEY = "synckerja_share_publish";

export function driveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function parseDriveApiMessage(status: number, text: string): string {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    };
    const msg = json.error?.message;
    const reason = json.error?.errors?.[0]?.reason;
    if (msg && reason) return `${msg} (${reason})`;
    if (msg) return msg;
  } catch {
    /* not JSON */
  }
  return text.slice(0, 280) || `Drive API error HTTP ${status}`;
}

async function findAppUploadFolderId(
  accessToken: string,
): Promise<string | null> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${SHARE_PUBLISH_DRIVE_FOLDER_NAME}' and trashed=false and appProperties has { key='${SHARE_PUBLISH_FOLDER_APP_PROP_KEY}' and value='1' }`,
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(
      "google-drive-resumable-upload: folder search failed",
      res.status,
      text.slice(0, 200),
    );
    return null;
  }
  const json = (await res.json()) as { files?: Array<{ id?: string }> };
  const id = json.files?.[0]?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function createAppUploadFolder(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: SHARE_PUBLISH_DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: {
        [SHARE_PUBLISH_FOLDER_APP_PROP_KEY]: "1",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `drive_folder_create_failed: ${res.status} ${parseDriveApiMessage(res.status, text)}`,
    );
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("drive_folder_create_failed: missing id");
  return json.id;
}

export async function ensureSharePublishFolderId(accessToken: string): Promise<string> {
  const existing = await findAppUploadFolderId(accessToken);
  if (existing) return existing;
  return createAppUploadFolder(accessToken);
}

async function startResumableUploadSession(args: {
  accessToken: string;
  fileName: string;
  mimeType: string;
  folderId?: string;
  fileSizeBytes?: number;
}): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": args.mimeType || "video/mp4",
  };
  if (
    typeof args.fileSizeBytes === "number" &&
    args.fileSizeBytes > 0 &&
    Number.isFinite(args.fileSizeBytes)
  ) {
    headers["X-Upload-Content-Length"] = String(Math.floor(args.fileSizeBytes));
  }

  const metadata: Record<string, unknown> = {
    name: args.fileName,
    mimeType: args.mimeType || "video/mp4",
  };
  if (args.folderId) {
    metadata.parents = [args.folderId];
  }

  const metaRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers,
      body: JSON.stringify(metadata),
    },
  );
  if (!metaRes.ok) {
    const text = await metaRes.text();
    throw new Error(
      `drive_resumable_session_failed: ${metaRes.status} ${parseDriveApiMessage(metaRes.status, text)}`,
    );
  }
  const uploadUrl = metaRes.headers.get("Location") ?? metaRes.headers.get("location");
  if (!uploadUrl) throw new Error("drive_resumable_session_failed: missing Location");
  return uploadUrl;
}

export async function createResumableUploadSession(args: {
  accessToken: string;
  fileName: string;
  mimeType: string;
  folderId: string;
  fileSizeBytes?: number;
}): Promise<string> {
  const attempts: Array<{ folderId?: string; fileSizeBytes?: number }> = [
    { folderId: args.folderId, fileSizeBytes: args.fileSizeBytes },
    { folderId: args.folderId },
    {},
  ];
  // Deduplicate attempts
  const seen = new Set<string>();
  const uniqueAttempts = attempts.filter((a) => {
    const key = `${a.folderId ?? ""}:${a.fileSizeBytes ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let lastErr: Error | null = null;
  for (const attempt of uniqueAttempts) {
    try {
      return await startResumableUploadSession({
        accessToken: args.accessToken,
        fileName: args.fileName,
        mimeType: args.mimeType,
        folderId: attempt.folderId,
        fileSizeBytes: attempt.fileSizeBytes,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn("google-drive-resumable-upload: session attempt failed", lastErr.message);
    }
  }
  throw lastErr ?? new Error("drive_resumable_session_failed");
}

export async function setAnyoneWithLinkReader(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    },
  );
  // 409 = already shared; treat as success
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(
      `drive_permission_failed: ${res.status} ${parseDriveApiMessage(res.status, text)}`,
    );
  }
}

export async function resolveDriveAccessToken(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
): Promise<{ accessToken: string; error?: string }> {
  return getValidGoogleDriveAccessToken(
    supabaseAdmin,
    userId,
    "google-drive-resumable-upload",
  );
}

export function mapDriveUploadException(err: unknown): { status: number; body: Record<string, unknown> } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("google account not connected") || lower.includes("google session expired")) {
    return {
      status: 400,
      body: { error: message, code: "google_not_connected" },
    };
  }

  if (lower.includes("insufficient") || lower.includes("403") || lower.includes("forbidden")) {
    return {
      status: 403,
      body: {
        error:
          "Google Drive permission denied. Open Synckerja in browser, connect Google Drive again, then retry.",
        code: "drive_permission_denied",
        detail: message,
      },
    };
  }

  if (
    lower.includes("drive_folder_create_failed") ||
    lower.includes("drive_resumable_session_failed") ||
    lower.includes("drive_permission_failed")
  ) {
    return {
      status: 400,
      body: {
        error: message.replace(/^(drive_\w+failed:\s*\d+\s*)/i, "").trim() || message,
        code: "drive_api_error",
        detail: message,
      },
    };
  }

  return { status: 500, body: { error: message } };
}

export function parseFileSizeBytes(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return undefined;
}

const MIN_DRIVE_VIDEO_BYTES = 10 * 1024;

export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<{ size: number; mimeType: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=size,mimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `drive_metadata_failed: ${res.status} ${parseDriveApiMessage(res.status, text)}`,
    );
  }
  const json = (await res.json()) as { size?: string; mimeType?: string };
  const size = Number(json.size ?? 0);
  const mimeType = String(json.mimeType ?? "").trim();
  return { size: Number.isFinite(size) ? size : 0, mimeType };
}

export function assertDriveUploadedVideoSize(
  driveSize: number,
  expectedSizeBytes?: number,
): void {
  if (!driveSize || driveSize < MIN_DRIVE_VIDEO_BYTES) {
    throw new Error(
      `invalid_video_file: Drive file too small (${driveSize} bytes). Upload may be incomplete — share again.`,
    );
  }
  if (
    typeof expectedSizeBytes === "number" &&
    expectedSizeBytes > 0 &&
    driveSize !== expectedSizeBytes
  ) {
    throw new Error(
      `drive_upload_size_mismatch: expected ${expectedSizeBytes} bytes on Drive but got ${driveSize}`,
    );
  }
}
