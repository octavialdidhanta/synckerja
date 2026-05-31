import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SupabaseAdminClient = ReturnType<typeof createClient>;

type CredentialsRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: string | null;
};

/** OAuth scope for Drive preview (non-sensitive; per-file access via Picker). */
export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export async function getValidGoogleDriveAccessToken(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  logPrefix = "google-drive",
): Promise<{ accessToken: string; error?: string }> {
  const { data: row, error } = await supabaseAdmin
    .from("user_google_oauth_credentials")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`${logPrefix}: read credentials`, error.message);
    return { accessToken: "", error: "Failed to read Google credentials" };
  }
  const r = row as CredentialsRow | null;
  if (!r) {
    return { accessToken: "", error: "Google account not connected" };
  }

  const expiresMs = r.access_token_expires_at ? new Date(r.access_token_expires_at).getTime() : 0;
  const fresh = r.access_token && expiresMs > Date.now() + 60_000;
  if (fresh) {
    return { accessToken: r.access_token! };
  }

  if (!r.refresh_token) {
    if (r.access_token) {
      return { accessToken: r.access_token };
    }
    return { accessToken: "", error: "Google session expired; connect Google again" };
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    return { accessToken: "", error: "Google OAuth not configured" };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: r.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof tokenJson.error_description === "string"
        ? tokenJson.error_description
        : typeof tokenJson.error === "string"
          ? tokenJson.error
          : "Token refresh failed";
    console.error(`${logPrefix}: refresh`, msg);
    return { accessToken: "", error: msg };
  }

  const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
  if (!accessToken) {
    return { accessToken: "", error: "No access token from refresh" };
  }

  const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("user_google_oauth_credentials")
    .update({
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  return { accessToken };
}

export function mapGoogleDriveApiFailure(
  driveStatus: number,
  driveJson: Record<string, unknown>,
  resourceId: string,
): { httpStatus: number; body: Record<string, unknown> } {
  const errObj = driveJson.error;
  const message =
    typeof errObj === "object" && errObj !== null && "message" in errObj
      ? String((errObj as { message?: string }).message)
      : "Drive API error";
  const reason =
    typeof errObj === "object" && errObj !== null && "errors" in errObj
      ? JSON.stringify((errObj as { errors?: unknown }).errors)
      : typeof errObj === "object" && errObj !== null && "reason" in errObj
        ? String((errObj as { reason?: string }).reason)
        : "";

  const combined = `${message} ${reason}`.toLowerCase();
  const grantRequired =
    driveStatus === 403 ||
    (driveStatus === 404 &&
      (combined.includes("not found") ||
        combined.includes("insufficient") ||
        combined.includes("filenotfound")));

  if (grantRequired || combined.includes("insufficientfilepermissions")) {
    return {
      httpStatus: 403,
      body: {
        error: message,
        code: "DRIVE_GRANT_REQUIRED",
        resourceId,
      },
    };
  }

  return {
    httpStatus: driveStatus === 404 ? 404 : 400,
    body: { error: message },
  };
}

export const DRIVE_GRANT_REQUIRED_HEADER = "x-synckerja-drive-code";

export type DriveFolderListItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  thumbnailLink: string | null;
  iconLink: string | null;
  webViewLink: string | null;
  fallbackThumbnailUrl: string | null;
};

export function getGoogleDriveServerApiKey(): string {
  return (
    Deno.env.get("GOOGLE_DRIVE_SERVER_API_KEY") ??
    Deno.env.get("GOOGLE_DRIVE_API_KEY") ??
    ""
  ).trim();
}

export function getGoogleDriveBrowserApiKey(): string {
  const serverKey = getGoogleDriveServerApiKey();
  if (serverKey) return serverKey;
  return (
    Deno.env.get("GOOGLE_PICKER_API_KEY") ??
    Deno.env.get("VITE_GOOGLE_PICKER_API_KEY") ??
    ""
  ).trim();
}

export function normalizeDriveFolderListItems(rawFiles: unknown[]): DriveFolderListItem[] {
  const files: unknown[] = Array.isArray(rawFiles) ? rawFiles : [];
  return files
    .map((item) => {
      const f = item as Record<string, unknown>;
      const id = typeof f.id === "string" ? f.id : "";
      const name = typeof f.name === "string" ? f.name : "";
      const mimeType = typeof f.mimeType === "string" ? f.mimeType : "";
      const thumbnailLink = typeof f.thumbnailLink === "string" ? f.thumbnailLink : null;
      const iconLink = typeof f.iconLink === "string" ? f.iconLink : null;
      const webViewLink = typeof f.webViewLink === "string" ? f.webViewLink : null;
      const isFolder = mimeType === "application/vnd.google-apps.folder";
      const fallbackThumb =
        id && !isFolder
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w200`
          : null;
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
    })
    .filter((f) => f.id && f.name);
}

type PublicDriveJson = Record<string, unknown>;

async function fetchPublicDriveJson(
  url: string,
): Promise<{ ok: true; json: PublicDriveJson } | { ok: false; status: number; json: PublicDriveJson }> {
  const res = await fetch(url);
  const json = (await res.json()) as PublicDriveJson;
  if (!res.ok) return { ok: false, status: res.status, json };
  return { ok: true, json };
}

export async function listPublicDriveFolder(
  folderId: string,
  apiKey: string,
): Promise<{ ok: true; files: DriveFolderListItem[] } | { ok: false; status: number; json: PublicDriveJson }> {
  const metaUrl =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}` +
    `?fields=${encodeURIComponent("id,name,mimeType")}` +
    `&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`;
  const meta = await fetchPublicDriveJson(metaUrl);
  if (!meta.ok) return meta;

  const folderMime = typeof meta.json.mimeType === "string" ? meta.json.mimeType : "";
  if (folderMime && folderMime !== "application/vnd.google-apps.folder") {
    return { ok: false, status: 400, json: { error: { message: "Resource is not a folder" } } };
  }

  const q = `'${folderId}' in parents and trashed=false`;
  const fields = encodeURIComponent("files(id,name,mimeType,thumbnailLink,iconLink,webViewLink)");
  const listUrl =
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${fields}` +
    `&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=folder,name` +
    `&key=${encodeURIComponent(apiKey)}`;

  const list = await fetchPublicDriveJson(listUrl);
  if (!list.ok) return list;

  const rawFiles = list.json.files;
  return { ok: true, files: normalizeDriveFolderListItems(Array.isArray(rawFiles) ? rawFiles : []) };
}

export async function fetchPublicDriveFileMeta(
  fileId: string,
  apiKey: string,
  fields = "id,name,mimeType,thumbnailLink,iconLink",
): Promise<{ ok: true; json: PublicDriveJson } | { ok: false; status: number; json: PublicDriveJson }> {
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
    `?fields=${encodeURIComponent(fields)}&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`;
  return fetchPublicDriveJson(url);
}

export function buildPublicDriveMediaUrl(fileId: string, apiKey: string): string {
  return (
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
    `?alt=media&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`
  );
}

function decodeEmbedHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractDriveIdFromEmbedHref(href: string): string | null {
  const folderMatch = href.match(/\/drive\/folders\/([a-zA-Z0-9-_]+)/);
  if (folderMatch) return folderMatch[1]!;
  const fileMatch = href.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (fileMatch) return fileMatch[1]!;
  const docsMatch = href.match(
    /\/(?:spreadsheets|document|presentation|forms)\/d\/([a-zA-Z0-9-_]+)/,
  );
  if (docsMatch) return docsMatch[1]!;
  return null;
}

function inferMimeFromEmbedHref(href: string, imgAlt?: string): string {
  if (/\/drive\/folders\//i.test(href)) return "application/vnd.google-apps.folder";
  if (/\/spreadsheets\//i.test(href)) return "application/vnd.google-apps.spreadsheet";
  if (/\/document\//i.test(href)) return "application/vnd.google-apps.document";
  if (/\/presentation\//i.test(href)) return "application/vnd.google-apps.presentation";
  if (/\/forms\//i.test(href)) return "application/vnd.google-apps.form";
  const alt = (imgAlt ?? "").toLowerCase();
  if (alt.includes("video")) return "video/mp4";
  if (alt.includes("image") || alt.includes("photo")) return "image/jpeg";
  if (alt.includes("pdf")) return "application/pdf";
  if (/\/file\/d\//i.test(href)) return "application/octet-stream";
  return "application/octet-stream";
}

export function parseEmbedFolderHtml(html: string): DriveFolderListItem[] {
  const items: DriveFolderListItem[] = [];
  const entryBlockRegex =
    /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<div class="flip-entry-last-modified">/g;
  let match: RegExpExecArray | null;
  while ((match = entryBlockRegex.exec(html)) !== null) {
    const block = match[0];
    const entryId = match[1]!;
    const hrefMatch = block.match(/<a href="([^"]+)"/);
    const titleMatch = block.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/);
    const thumbMatch = block.match(/<img src="([^"]+)"[^>]*alt="([^"]*)"/);
    if (!hrefMatch || !titleMatch) continue;

    const href = decodeEmbedHtmlEntities(hrefMatch[1]!);
    const name = decodeEmbedHtmlEntities(titleMatch[1]!.replace(/<[^>]+>/g, "").trim());
    if (!name) continue;

    const imgAlt = thumbMatch?.[2] ? decodeEmbedHtmlEntities(thumbMatch[2]) : undefined;
    const thumbSrc = thumbMatch?.[1] ? decodeEmbedHtmlEntities(thumbMatch[1]) : null;
    const id = extractDriveIdFromEmbedHref(href) ?? entryId;
    const mimeType = inferMimeFromEmbedHref(href, imgAlt);
    const isFolder = mimeType === "application/vnd.google-apps.folder";

    items.push({
      id,
      name,
      mimeType,
      isFolder,
      thumbnailLink: thumbSrc,
      iconLink: null,
      webViewLink: href,
      fallbackThumbnailUrl: !isFolder
        ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w200`
        : null,
    });
  }
  return items;
}

export async function listPublicDriveFolderFromEmbedHtml(
  folderId: string,
): Promise<{ ok: true; files: DriveFolderListItem[] } | { ok: false }> {
  try {
    const url =
      `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return { ok: false };
    const html = await res.text();
    const files = parseEmbedFolderHtml(html);
    if (files.length === 0) return { ok: false };
    return { ok: true, files };
  } catch (e) {
    console.error("listPublicDriveFolderFromEmbedHtml:", e);
    return { ok: false };
  }
}
