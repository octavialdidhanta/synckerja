import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptOrgDriveToken, encryptOrgDriveToken } from "./crypto.ts";
import { ORG_DRIVE_ROOT_FOLDER_NAME, planFolderName } from "./naming.ts";

/** drive.file = Synckerja only sees files and folders it created itself. */
export const ORG_DRIVE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export const ORG_DRIVE_SETTINGS_PATH = "/digital-marketing/social-media/settings";
export const ORG_DRIVE_SETTINGS_SECTION = "google-drive";

const ROOT_APP_PROP = "synckerja_org_drive_root";
const PLAN_APP_PROP = "synckerja_plan_id";
export const VERSION_APP_PROP = "synckerja_version_id";

export const orgDriveCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function orgDriveJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...orgDriveCorsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function readGoogleOAuthClient(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim() ?? "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function orgDriveOAuthRedirectUri(): string {
  const explicit = Deno.env.get("GOOGLE_DRIVE_ORG_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${base}/functions/v1/google-drive-org-oauth-callback`;
}

export function appPublicOrigin(): string {
  const raw = Deno.env.get("APP_PUBLIC_URL")?.trim() || Deno.env.get("SYNCKERJA_APP_URL")?.trim() || "";
  return raw.replace(/\/+$/, "");
}

export async function getUserIdFromBearer(admin: SupabaseClient, authHeader: string | null): Promise<string | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function isActiveOrgMember(admin: SupabaseClient, userId: string, orgId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_organizations")
    .select("id, is_active")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return Boolean(data?.id) && (data as { is_active?: boolean | null }).is_active !== false;
}

export async function isOrgOwnerOrAdmin(admin: SupabaseClient, userId: string, orgId: string): Promise<boolean> {
  if (!(await isActiveOrgMember(admin, userId, orgId))) return false;
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .in("role", ["owner", "admin"])
    .limit(1);
  return (data ?? []).length > 0;
}

export function parseDriveError(status: number, text: string): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    const msg = json.error?.message;
    const reason = json.error?.errors?.[0]?.reason;
    if (msg && reason) return `${msg} (${reason})`;
    if (msg) return msg;
  } catch {
    /* not json */
  }
  return text.slice(0, 200) || `Drive API HTTP ${status}`;
}

export type OrgDriveToken =
  | { ok: true; accessToken: string; email: string | null; rootFolderId: string | null }
  | { ok: false; code: "not_connected" | "reconnect_required" | "server_error"; message: string };

type TokenRow = {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
};

/** Valid access token for the org's connected Drive (refreshing it when needed). */
export async function getOrgDriveAccessToken(admin: SupabaseClient, orgId: string): Promise<OrgDriveToken> {
  const { data: conn } = await admin
    .from("organization_google_drive_connections")
    .select("is_active, google_account_email, root_folder_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!conn?.is_active) return { ok: false, code: "not_connected", message: "Google Drive org belum disambungkan" };

  const { data: tok } = await admin
    .from("organization_google_drive_connection_tokens")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("organization_id", orgId)
    .maybeSingle();
  const row = tok as TokenRow | null;
  if (!row?.refresh_token_enc) return { ok: false, code: "not_connected", message: "Google Drive org belum disambungkan" };

  const email = (conn.google_account_email as string | null) ?? null;
  const rootFolderId = (conn.root_folder_id as string | null) ?? null;

  const expiresMs = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (row.access_token_enc && expiresMs > Date.now() + 60_000) {
    try {
      return { ok: true, accessToken: await decryptOrgDriveToken(row.access_token_enc), email, rootFolderId };
    } catch {
      /* fall through to refresh */
    }
  }

  const client = readGoogleOAuthClient();
  if (!client) return { ok: false, code: "server_error", message: "Google OAuth belum dikonfigurasi di server" };

  let refreshToken: string;
  try {
    refreshToken = await decryptOrgDriveToken(row.refresh_token_enc);
  } catch {
    return { ok: false, code: "server_error", message: "Token Google Drive org tidak bisa dibuka" };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const reason = json.error ?? `http_${res.status}`;
    const reconnect = reason === "invalid_grant" || reason === "unauthorized_client";
    await admin
      .from("organization_google_drive_connections")
      .update({ last_error: `refresh_failed: ${reason}`.slice(0, 300) })
      .eq("organization_id", orgId);
    return reconnect
      ? { ok: false, code: "reconnect_required", message: "Sambungan Google Drive org kedaluwarsa. Owner perlu menyambungkan ulang." }
      : { ok: false, code: "server_error", message: "Gagal memperbarui akses Google Drive org" };
  }

  const expiresAt = new Date(Date.now() + Math.max(60, Number(json.expires_in ?? 3600)) * 1000).toISOString();
  try {
    await admin
      .from("organization_google_drive_connection_tokens")
      .update({
        access_token_enc: await encryptOrgDriveToken(json.access_token),
        access_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId);
  } catch (e) {
    console.warn("orgDrive: could not cache access token", (e as Error).message);
  }
  return { ok: true, accessToken: json.access_token, email, rootFolderId };
}

async function driveJson<T>(token: string, url: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, message: parseDriveError(res.status, text) };
  return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
}

type DriveFolder = { id?: string; trashed?: boolean; mimeType?: string };

async function folderUsable(token: string, folderId: string | null | undefined): Promise<boolean> {
  if (!folderId) return false;
  const r = await driveJson<DriveFolder>(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed,mimeType&supportsAllDrives=true`,
  );
  return r.ok && r.data.trashed !== true && r.data.mimeType === "application/vnd.google-apps.folder";
}

async function createFolder(token: string, name: string, parentId: string | null, appProperties: Record<string, string>): Promise<string> {
  const body: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder", appProperties };
  if (parentId) body.parents = [parentId];
  const r = await driveJson<{ id?: string }>(token, "https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.data.id) throw new Error(`drive_folder_create_failed: ${r.ok ? "missing id" : r.message}`);
  return r.data.id;
}

/** Root "Synckerja Social Media Uploads" folder of the org Drive (created once, reused). */
export async function ensureOrgRootFolder(admin: SupabaseClient, orgId: string, token: string, knownId: string | null): Promise<string> {
  if (await folderUsable(token, knownId)) return knownId as string;

  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='${ROOT_APP_PROP}' and value='1' }`,
  );
  const found = await driveJson<{ files?: Array<{ id?: string }> }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1&spaces=drive`,
  );
  const id = (found.ok && found.data.files?.[0]?.id) || (await createFolder(token, ORG_DRIVE_ROOT_FOLDER_NAME, null, { [ROOT_APP_PROP]: "1" }));

  await admin.from("organization_google_drive_connections").update({ root_folder_id: id }).eq("organization_id", orgId);
  return id;
}

/** "<shortId> <title>" subfolder for one content plan inside the org root folder. */
export async function ensurePlanFolder(
  admin: SupabaseClient,
  args: { orgId: string; planId: string; title: string | null; token: string; rootFolderId: string; email: string | null },
): Promise<string> {
  const { data: existing } = await admin
    .from("content_plan_drive_folders")
    .select("drive_folder_id")
    .eq("social_media_plan_id", args.planId)
    .maybeSingle();
  const knownId = (existing?.drive_folder_id as string | undefined) ?? null;
  if (await folderUsable(args.token, knownId)) return knownId as string;

  const name = planFolderName(args.planId, args.title);
  const id = await createFolder(args.token, name, args.rootFolderId, { [PLAN_APP_PROP]: args.planId });
  const { error } = await admin.from("content_plan_drive_folders").upsert(
    {
      social_media_plan_id: args.planId,
      organization_id: args.orgId,
      drive_folder_id: id,
      folder_name: name,
      google_account_email: args.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "social_media_plan_id" },
  );
  if (error) throw new Error(`plan_folder_save_failed: ${error.message}`);
  return id;
}

/** Google resumable session. `origin` lets that browser PUT straight to Google (CORS). */
export async function createOrgResumableSession(args: {
  token: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string;
  versionId: string;
  origin: string | null;
}): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": args.mimeType,
    "X-Upload-Content-Length": String(args.sizeBytes),
  };
  if (args.origin) headers.Origin = args.origin;
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size,parents,appProperties",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: args.fileName,
        mimeType: args.mimeType,
        parents: [args.folderId],
        appProperties: { [VERSION_APP_PROP]: args.versionId },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`drive_resumable_session_failed: ${parseDriveError(res.status, await res.text())}`);
  }
  await res.body?.cancel();
  const url = res.headers.get("Location") ?? res.headers.get("location");
  if (!url) throw new Error("drive_resumable_session_failed: missing Location");
  return url;
}

export type DriveFileMeta = {
  id: string;
  size: number;
  mimeType: string;
  parents: string[];
  appProperties: Record<string, string>;
  trashed: boolean;
};

export async function getDriveFileMeta(token: string, fileId: string): Promise<DriveFileMeta | null> {
  const r = await driveJson<{
    id?: string;
    size?: string;
    mimeType?: string;
    parents?: string[];
    appProperties?: Record<string, string>;
    trashed?: boolean;
  }>(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,size,mimeType,parents,appProperties,trashed&supportsAllDrives=true`,
  );
  if (!r.ok || !r.data.id) return null;
  return {
    id: r.data.id,
    size: Number(r.data.size ?? 0),
    mimeType: r.data.mimeType ?? "",
    parents: r.data.parents ?? [],
    appProperties: r.data.appProperties ?? {},
    trashed: r.data.trashed === true,
  };
}

/** "Anyone with the link can view" — needed for review links and publishing. 409 = already shared. */
export async function setAnyoneWithLinkReader(token: string, fileId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (!res.ok && res.status !== 409) {
    throw new Error(`drive_permission_failed: ${parseDriveError(res.status, await res.text())}`);
  }
  await res.body?.cancel();
}

/**
 * When a Drive file was uploaded through the org Drive, preview/stream it with the org token.
 * Returns null for files Synckerja did not upload (callers keep their previous behaviour).
 */
export async function resolveOrgDriveTokenForFile(
  admin: SupabaseClient,
  fileId: string,
): Promise<{ organizationId: string; planId: string; accessToken: string } | null> {
  const { data } = await admin
    .from("content_plan_media_versions")
    .select("organization_id, social_media_plan_id")
    .eq("drive_file_id", fileId)
    .eq("status", "ready")
    .maybeSingle();
  if (!data?.organization_id) return null;
  const tok = await getOrgDriveAccessToken(admin, String(data.organization_id));
  if (!tok.ok) return null;
  return {
    organizationId: String(data.organization_id),
    planId: String(data.social_media_plan_id),
    accessToken: tok.accessToken,
  };
}
