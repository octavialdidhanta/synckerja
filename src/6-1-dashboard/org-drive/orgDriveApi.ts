import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/shared/lib/parseEdgeFunctionError";
import {
  putFileToDriveUploadUrl,
  type DriveResumableUploadProgress,
} from "@/shared/lib/googleDriveResumableUploadClient";

/** Organization Google Drive ("gudang org") and versioned content plan videos. */

export type OrgDriveSettings = {
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  lastError: string | null;
  rootFolderName: string;
  rootFolderUrl: string | null;
  canManage: boolean;
  oauthConfigured?: boolean;
  encryptionReady?: boolean;
  redirectUri?: string;
};

export type ContentPlanMediaVersion = {
  id: string;
  version_no: number;
  status: "uploading" | "ready" | "failed";
  drive_file_id: string | null;
  drive_folder_id: string;
  file_name: string;
  size_bytes: number;
  source: "web" | "mcp";
  uploaded_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type PendingSchedule = { platform: string; scheduled_at: string; timezone: string | null };

export type ScheduleInfo = {
  pending: PendingSchedule[];
  production_approved: boolean;
  can_approve_production: boolean;
};

export class OrgDriveError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Non-2xx responses arrive as error.context (a Response); read { error, message } from it. */
async function readErrorBody(error: unknown): Promise<{ error?: string; message?: string } | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.clone !== "function") return null;
  try {
    return (await ctx.clone().json()) as { error?: string; message?: string };
  } catch {
    return null;
  }
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const payload = (await readErrorBody(error)) ?? ((data ?? {}) as { error?: string; message?: string });
    if (payload.error) throw new OrgDriveError(payload.error, payload.message ?? payload.error);
    const parsed = await parseEdgeFunctionError(error, data).catch(() => null);
    throw new OrgDriveError("request_failed", parsed?.message ?? (error as Error).message);
  }
  const payload = data as T & { error?: string; message?: string };
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new OrgDriveError(payload.error, payload.message ?? payload.error);
  }
  return payload;
}

export function fetchOrgDriveSettings(organizationId: string): Promise<OrgDriveSettings> {
  return invoke<OrgDriveSettings>("google-drive-org-config", { action: "getSettings", organization_id: organizationId });
}

export async function startOrgDriveOAuth(organizationId: string): Promise<void> {
  const { url } = await invoke<{ url: string }>("google-drive-org-oauth-start", { organization_id: organizationId });
  if (!url) throw new OrgDriveError("no_url", "Tidak ada URL login Google");
  window.location.href = url;
}

export function disconnectOrgDrive(organizationId: string): Promise<{ ok: boolean }> {
  return invoke("google-drive-org-config", { action: "disconnect", organization_id: organizationId });
}

export async function listContentPlanMediaVersions(planId: string): Promise<ContentPlanMediaVersion[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types yet
  const { data, error } = await (supabase as any)
    .from("content_plan_media_versions")
    .select("id, version_no, status, drive_file_id, drive_folder_id, file_name, size_bytes, source, uploaded_by, created_at, completed_at")
    .eq("social_media_plan_id", planId)
    .order("version_no", { ascending: false });
  if (error) throw new OrgDriveError("list_failed", error.message);
  return (data ?? []) as ContentPlanMediaVersion[];
}

export type UploadedVersion = { versionId: string; versionNo: number; googleDriveLink: string; shareWarning: string | null };

/** Start a new version, send the bytes straight to Google, then let Synckerja verify and share it. */
export async function uploadContentPlanVideo(args: {
  planId: string;
  file: File;
  onProgress?: (p: DriveResumableUploadProgress) => void;
}): Promise<UploadedVersion> {
  const started = await invoke<{ version_id: string; version_no: number; upload_url: string }>("content-plan-media-upload", {
    action: "start",
    plan_id: args.planId,
    file_name: args.file.name,
    mime_type: args.file.type,
    size_bytes: args.file.size,
  });
  const fileId = await putFileToDriveUploadUrl(started.upload_url, args.file, args.onProgress);
  const finished = await invoke<{ version_id: string; version_no: number; google_drive_link: string; share_warning?: string | null }>(
    "content-plan-media-upload",
    { action: "finish", version_id: started.version_id, file_id: fileId },
  );
  return {
    versionId: finished.version_id,
    versionNo: finished.version_no,
    googleDriveLink: finished.google_drive_link,
    shareWarning: finished.share_warning ?? null,
  };
}

export function fetchScheduleInfo(planId: string): Promise<ScheduleInfo> {
  return invoke<ScheduleInfo>("content-plan-media-upload", { action: "schedule_info", plan_id: planId });
}

export function activateApprovedVersion(versionId: string, moveSchedules: boolean): Promise<{
  google_drive_link: string;
  moved_schedules: number;
  cancelled_schedules: number;
}> {
  return invoke("content-plan-media-upload", { action: "activate", version_id: versionId, move_schedules: moveSchedules });
}

export function versionDriveLink(v: Pick<ContentPlanMediaVersion, "drive_file_id">): string | null {
  return v.drive_file_id ? `https://drive.google.com/file/d/${v.drive_file_id}/view` : null;
}

/** Same file id extraction as previewUtils (file/d/, d/, ?id=). */
export function driveFileIdFromLink(link: string | null | undefined): string | null {
  const s = String(link ?? "");
  const m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? s.match(/\/d\/([a-zA-Z0-9_-]+)/) ?? s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

const ERROR_TEXT: Record<string, string> = {
  not_connected: "Google Drive org belum disambungkan. Minta owner menyambungkan di Pengaturan Social Media → Google Drive org.",
  reconnect_required: "Sambungan Google Drive org kedaluwarsa. Minta owner menyambungkan ulang.",
  origin_not_allowed: "Upload dari alamat ini belum diizinkan.",
};

export function orgDriveErrorText(e: unknown): string {
  if (e instanceof OrgDriveError) return ERROR_TEXT[e.code] ?? e.message;
  return e instanceof Error ? e.message : String(e);
}
