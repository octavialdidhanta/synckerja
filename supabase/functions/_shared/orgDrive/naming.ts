/** Pure naming / validation helpers for org Drive uploads (unit-tested, no I/O). */

export const ORG_DRIVE_ROOT_FOLDER_NAME = "Synckerja Social Media Uploads";
export const ORG_DRIVE_MAX_VIDEO_BYTES = 512 * 1024 * 1024;
/** Google resumable uploads need every chunk except the last to be a multiple of 256 KiB. */
export const DRIVE_CHUNK_GRANULARITY = 256 * 1024;

const VIDEO_EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

/** Content ID shown to people = first 8 chars of the plan uuid (e.g. "bd995747"). */
export function planShortId(planId: string): string {
  return planId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

function cleanTitle(title: string | null | undefined): string {
  return String(title ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

/** "<shortId> <title>" — one Drive subfolder per content plan. */
export function planFolderName(planId: string, title: string | null | undefined): string {
  const clean = cleanTitle(title);
  const id = planShortId(planId);
  return clean ? `${id} ${clean}` : id;
}

export function normalizeVideoMime(mime: string | null | undefined, fileName?: string | null): string | null {
  const m = String(mime ?? "").trim().toLowerCase();
  if (VIDEO_EXT_BY_MIME[m]) return m;
  const name = String(fileName ?? "").toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".m4v")) return "video/x-m4v";
  return null;
}

/** "v3.mp4" — the original file name never decides the stored name. */
export function versionFileName(versionNo: number, mime: string): string {
  const ext = VIDEO_EXT_BY_MIME[mime] ?? "mp4";
  return `v${versionNo}.${ext}`;
}

export function parseSizeBytes(raw: unknown): number | null {
  const n = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 10 * 1024 || n > ORG_DRIVE_MAX_VIDEO_BYTES) return null;
  return n;
}

export function driveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Same id rules as everywhere else in Synckerja. */
export function isDriveId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{10,200}$/.test(value);
}

/**
 * Browser origin allowed to PUT straight to the Google resumable URL.
 * Google only answers CORS for the origin sent when the session was created.
 */
export function allowedUploadOrigin(requestOrigin: string | null, allowList: string[]): string | null {
  const origin = String(requestOrigin ?? "").trim().replace(/\/+$/, "");
  if (!origin) return null;
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) return null;
  const allowed = allowList.map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  if (allowed.includes(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/i.test(origin)) return origin;
  return null;
}
