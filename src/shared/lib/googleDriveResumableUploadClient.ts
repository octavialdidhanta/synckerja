import { Capacitor } from "@capacitor/core";
import { ShareIntent } from "@/plugins/share-intent";
import { supabase } from "@/shared/lib/supabaseClient";
import { startGoogleDriveOAuthAsync } from "@/shared/lib/googleDriveOAuth";
import { parseEdgeFunctionError } from "@/shared/lib/parseEdgeFunctionError";
import { normalizeNativeVideoUploadMeta } from "@/shared/lib/normalizeNativeVideoUploadMeta";
import {
  ensureVideoFileName,
  validateVideoContainerHeader,
} from "@/shared/lib/validateVideoContainerHeader";

/** Keep in sync with Android MainActivity.MAX_SHARE_VIDEO_BYTES and Drive download helper. */
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
/** Smaller chunks on native WebView — fewer timeouts on mobile networks. */
const UPLOAD_CHUNK_BYTES = Capacitor.isNativePlatform()
  ? 4 * 1024 * 1024
  : 8 * 1024 * 1024;
const CHUNK_MAX_RETRIES = 4;
const CHUNK_RETRY_BASE_MS = 1200;

export type DriveResumableUploadProgress = {
  loaded: number;
  total: number;
  ratio: number;
};

export type DriveResumableNativeVideo = {
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

export type DriveResumableVideoSource =
  | { kind: "file"; file: File }
  | { kind: "native"; native: DriveResumableNativeVideo };

type CreateSessionResponse = {
  ok?: boolean;
  upload_url?: string;
  folder_id?: string;
  error?: string;
  code?: string;
};

type FinalizeResponse = {
  ok?: boolean;
  file_id?: string;
  google_drive_link?: string;
  permission_warning?: string;
  error?: string;
  code?: string;
  drive_size_bytes?: number;
};

type UploadStatusResult = {
  fileId?: string;
  resumeOffset?: number;
};

function isGoogleNotConnected(payload: { error?: string; code?: string } | null): boolean {
  if (!payload) return false;
  if (payload.code === "google_not_connected") return true;
  const msg = String(payload.error ?? "").toLowerCase();
  return msg.includes("google account not connected") || msg.includes("no google access");
}

function extractFileIdFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    const json = JSON.parse(trimmed) as { id?: string };
    if (typeof json.id === "string" && json.id.length > 0) return json.id;
  } catch {
    /* not JSON */
  }
  const m = trimmed.match(/"id"\s*:\s*"([a-zA-Z0-9-_]+)"/);
  return m?.[1] ?? "";
}

function extractFileIdFromResponse(res: Response, bodyText: string): string {
  const fromBody = extractFileIdFromText(bodyText);
  if (fromBody) return fromBody;
  const loc = res.headers.get("Location") ?? res.headers.get("location") ?? "";
  const m = loc.match(/\/files\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? "";
}

function parseUploadedEndByte(rangeHeader: string | null): number {
  if (!rangeHeader) return -1;
  const match = rangeHeader.match(/(\d+)-(\d+)/);
  if (!match) return -1;
  return Number(match[2]);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function wrapFetchError(err: unknown, context: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes("failed to fetch") || err instanceof TypeError) {
    return new Error(
      `drive_upload_failed: network error during ${context}. Check internet connection and try again.`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function isRetryableUploadFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network error");
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function drivePut(
  uploadUrl: string,
  init: RequestInit,
  context: string,
): Promise<Response> {
  try {
    return await fetch(uploadUrl, init);
  } catch (e) {
    throw wrapFetchError(e, context);
  }
}

async function drivePutWithRetry(
  uploadUrl: string,
  init: RequestInit,
  context: string,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < CHUNK_MAX_RETRIES; attempt++) {
    try {
      const res = await drivePut(uploadUrl, init, context);
      if (isRetryableHttpStatus(res.status) && attempt < CHUNK_MAX_RETRIES - 1) {
        await sleep(CHUNK_RETRY_BASE_MS * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (!isRetryableUploadFailure(e) || attempt >= CHUNK_MAX_RETRIES - 1) {
        throw e;
      }
      await sleep(CHUNK_RETRY_BASE_MS * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function invokeCreateSession(args: {
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
}): Promise<CreateSessionResponse> {
  const { data, error } = await supabase.functions.invoke<CreateSessionResponse>(
    "google-drive-resumable-upload",
    {
      body: {
        action: "create_session",
        file_name: args.fileName,
        mime_type: args.mimeType,
        file_size_bytes: args.fileSizeBytes,
      },
    },
  );
  if (error) {
    const parsed = await parseEdgeFunctionError(error, data);
    const msg = parsed.message || "Failed to create upload session";
    if (msg.toLowerCase().includes("failed to fetch")) {
      return { error: "Cannot reach upload server. Check internet connection." };
    }
    return {
      error: msg,
      code: parsed.code ?? (data as CreateSessionResponse)?.code,
    };
  }
  if (data?.error) {
    return { error: data.error, code: data.code };
  }
  return data ?? { error: "Empty response" };
}

async function invokeFinalize(
  fileId: string,
  expectedSizeBytes: number,
): Promise<FinalizeResponse> {
  const { data, error } = await supabase.functions.invoke<FinalizeResponse>(
    "google-drive-resumable-upload",
    {
      body: {
        action: "finalize",
        file_id: fileId,
        expected_size_bytes: expectedSizeBytes,
      },
    },
  );
  if (data?.google_drive_link) {
    return data;
  }
  if (error) {
    const parsed = await parseEdgeFunctionError(error, data);
    return { error: parsed.message || "Failed to finalize upload", code: parsed.code };
  }
  if (data?.error) {
    return { error: data.error, code: data.code };
  }
  return data ?? { error: "Empty response" };
}

function getSourceMeta(source: DriveResumableVideoSource): {
  name: string;
  mimeType: string;
  total: number;
} {
  if (source.kind === "file") {
    const file = source.file;
    return {
      name: file.name || "shared-video.mp4",
      mimeType: file.type || "video/mp4",
      total: file.size,
    };
  }
  const native = source.native;
  return {
    name: native.name || "shared-video.mp4",
    mimeType: native.mimeType || "video/mp4",
    total: native.size,
  };
}

async function resolveNativeFileSize(path: string): Promise<number> {
  const stat = await ShareIntent.getFileStat({ path });
  return stat.size > 0 ? stat.size : 0;
}

async function getUploadTotal(source: DriveResumableVideoSource): Promise<number> {
  if (source.kind === "file") return source.file.size;
  const native = source.native;
  if (native.size > 0) return native.size;
  const resolved = await resolveNativeFileSize(native.path);
  if (resolved > 0) return resolved;
  throw new Error("drive_upload_failed: could not determine video file size");
}

async function readNativeChunk(path: string, offset: number, length: number): Promise<File> {
  const { data, bytesRead } = await ShareIntent.readFileChunk({
    path,
    offset,
    length,
  });
  if (!bytesRead || !data) {
    return new File([], 'drive-upload-chunk.bin', { type: 'application/octet-stream' });
  }
  const bytes = base64ToBytes(data);
  return new File([bytes], 'drive-upload-chunk.bin', { type: 'application/octet-stream' });
}

async function readUploadChunk(
  source: DriveResumableVideoSource,
  offset: number,
  endExclusive: number,
): Promise<Blob> {
  const length = endExclusive - offset;
  if (length <= 0) return new Blob([]);

  if (source.kind === "file") {
    return source.file.slice(offset, endExclusive);
  }

  return readNativeChunk(source.native.path, offset, length);
}

/** Query Google resumable session when the final chunk response omits file id (common on WebView). */
async function queryResumableUploadStatus(
  uploadUrl: string,
  total: number,
  nativePath?: string,
): Promise<UploadStatusResult> {
  if (nativePath && Capacitor.isNativePlatform()) {
    const native = await ShareIntent.putDriveResumableChunk({
      path: nativePath,
      uploadUrl,
      offset: total,
      length: 0,
      total,
      statusQuery: true,
    });
    const text = native.body ?? "";
    if (native.statusCode === 200 || native.statusCode === 201) {
      const id = extractFileIdFromText(text);
      if (id) return { fileId: id };
    }
    if (native.statusCode === 308) {
      const uploadedEnd = parseUploadedEndByte(native.range ?? null);
      if (uploadedEnd >= 0) return { resumeOffset: uploadedEnd + 1 };
      return { resumeOffset: 0 };
    }
    throw new Error(
      `drive_upload_failed: upload status HTTP ${native.statusCode}${text ? ` — ${text.slice(0, 180)}` : ""}`.trim(),
    );
  }

  const res = await drivePutWithRetry(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${total}`,
      },
    },
    "upload status check",
  );
  const text = await res.text().catch(() => "");
  if (res.status === 200 || res.status === 201) {
    const id = extractFileIdFromResponse(res, text);
    if (id) return { fileId: id };
  }
  if (res.status === 308) {
    const uploadedEnd = parseUploadedEndByte(
      res.headers.get("Range") ?? res.headers.get("range"),
    );
    if (uploadedEnd >= 0) return { resumeOffset: uploadedEnd + 1 };
    return { resumeOffset: 0 };
  }
  throw new Error(
    `drive_upload_failed: upload status HTTP ${res.status}${text ? ` — ${text.slice(0, 180)}` : ""}`.trim(),
  );
}

async function putResumableChunksViaNative(
  uploadUrl: string,
  path: string,
  total: number,
  onProgress?: (p: DriveResumableUploadProgress) => void,
): Promise<string> {
  let offset = 0;
  let fileId = "";

  while (true) {
    if (offset >= total) {
      if (fileId) break;
      const status = await queryResumableUploadStatus(uploadUrl, total, path);
      if (status.fileId) {
        fileId = status.fileId;
        break;
      }
      if (status.resumeOffset !== undefined && status.resumeOffset < total) {
        offset = status.resumeOffset;
        continue;
      }
      throw new Error("drive_upload_failed: missing file id after upload");
    }

    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, total);
    const length = end - offset;

    let nativeRes: Awaited<ReturnType<typeof ShareIntent.putDriveResumableChunk>> | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < CHUNK_MAX_RETRIES; attempt++) {
      try {
        nativeRes = await ShareIntent.putDriveResumableChunk({
          path,
          uploadUrl,
          offset,
          length,
          total,
        });
        if (isRetryableHttpStatus(nativeRes.statusCode) && attempt < CHUNK_MAX_RETRIES - 1) {
          await sleep(CHUNK_RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        break;
      } catch (e) {
        lastErr = e;
        if (!isRetryableUploadFailure(e) || attempt >= CHUNK_MAX_RETRIES - 1) {
          throw e;
        }
        await sleep(CHUNK_RETRY_BASE_MS * (attempt + 1));
      }
    }
    if (!nativeRes) {
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }

    const text = nativeRes.body ?? "";
    const chunkEnd = offset + length;

    if (nativeRes.statusCode === 308) {
      const uploadedEnd = parseUploadedEndByte(nativeRes.range ?? null);
      offset = uploadedEnd >= 0 ? uploadedEnd + 1 : chunkEnd;
      onProgress?.({
        loaded: Math.min(offset, total),
        total,
        ratio: total > 0 ? Math.min(offset, total) / total : 0,
      });
      continue;
    }

    if (
      nativeRes.statusCode !== 200 &&
      nativeRes.statusCode !== 201 &&
      nativeRes.statusCode >= 400
    ) {
      throw new Error(
        `drive_upload_failed: HTTP ${nativeRes.statusCode} ${text.slice(0, 180)}`.trim(),
      );
    }

    fileId =
      extractFileIdFromText(text) ||
      (nativeRes.location ? extractFileIdFromText(nativeRes.location) : "") ||
      fileId;
    offset = chunkEnd;
    onProgress?.({
      loaded: Math.min(offset, total),
      total,
      ratio: total > 0 ? Math.min(offset, total) / total : 0,
    });

    if (offset >= total && fileId) break;
  }

  if (!fileId) {
    const status = await queryResumableUploadStatus(uploadUrl, total, path);
    if (status.fileId) return status.fileId;
    throw new Error("drive_upload_failed: missing file id after upload");
  }
  return fileId;
}

async function putResumableChunks(
  uploadUrl: string,
  source: DriveResumableVideoSource,
  onProgress?: (p: DriveResumableUploadProgress) => void,
): Promise<string> {
  const total = await getUploadTotal(source);

  if (source.kind === "native" && Capacitor.isNativePlatform()) {
    return putResumableChunksViaNative(uploadUrl, source.native.path, total, onProgress);
  }

  let offset = 0;
  let fileId = "";

  while (true) {
    if (offset >= total) {
      if (fileId) break;
      const status = await queryResumableUploadStatus(uploadUrl, total);
      if (status.fileId) {
        fileId = status.fileId;
        break;
      }
      if (status.resumeOffset !== undefined && status.resumeOffset < total) {
        offset = status.resumeOffset;
        continue;
      }
      throw new Error("drive_upload_failed: missing file id after upload");
    }

    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, total);
    const chunk = await readUploadChunk(source, offset, end);
    const chunkSize = chunk.size;
    if (chunkSize <= 0) {
      throw new Error(`drive_upload_failed: empty chunk at offset ${offset}`);
    }

    const chunkEnd = offset + chunkSize;
    const contentRange = `bytes ${offset}-${chunkEnd - 1}/${total}`;

    const res = await drivePutWithRetry(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(chunkSize),
          "Content-Range": contentRange,
        },
        body: chunk,
      },
      `chunk ${offset}-${chunkEnd - 1}`,
    );

    if (res.status === 308) {
      const uploadedEnd = parseUploadedEndByte(
        res.headers.get("Range") ?? res.headers.get("range"),
      );
      offset = uploadedEnd >= 0 ? uploadedEnd + 1 : chunkEnd;
      onProgress?.({
        loaded: Math.min(offset, total),
        total,
        ratio: total > 0 ? Math.min(offset, total) / total : 0,
      });
      continue;
    }

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      const text = await res.text().catch(() => "");
      throw new Error(`drive_upload_failed: HTTP ${res.status} ${text.slice(0, 180)}`.trim());
    }

    const text = await res.text().catch(() => "");
    fileId = extractFileIdFromResponse(res, text) || fileId;
    offset = chunkEnd;
    onProgress?.({
      loaded: Math.min(offset, total),
      total,
      ratio: total > 0 ? Math.min(offset, total) / total : 0,
    });

    if (offset >= total && fileId) break;
  }

  if (!fileId) {
    const status = await queryResumableUploadStatus(uploadUrl, total);
    if (status.fileId) return status.fileId;
    throw new Error("drive_upload_failed: missing file id after upload");
  }
  return fileId;
}

function driveLinkFromFileId(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function toVideoSource(args: {
  file?: File;
  nativeVideo?: DriveResumableNativeVideo;
}): DriveResumableVideoSource {
  if (args.nativeVideo) return { kind: "native", native: args.nativeVideo };
  if (args.file) return { kind: "file", file: args.file };
  throw new Error("drive_upload_failed: no video source");
}

/**
 * Upload a video to the user's Google Drive via resumable session, then set
 * anyone-with-link and return a canonical Drive file URL for social_media_plans.
 *
 * Prefer `nativeVideo` on Capacitor — native plugin streams chunks to Drive (CapacitorHttp corrupts binary PUT bodies).
 */
export async function uploadVideoToGoogleDriveResumable(args: {
  file?: File;
  nativeVideo?: DriveResumableNativeVideo;
  onProgress?: (p: DriveResumableUploadProgress) => void;
  promptConnectIfNeeded?: boolean;
}): Promise<{ googleDriveLink: string; fileId: string; permissionWarning?: string }> {
  let source = toVideoSource(args);

  if (source.kind === "native") {
    const normalized = await normalizeNativeVideoUploadMeta({
      path: source.native.path,
      name: source.native.name,
      mimeType: source.native.mimeType,
      fallbackSize: source.native.size,
    });
    source = {
      kind: "native",
      native: {
        path: normalized.path,
        name: normalized.name,
        mimeType: normalized.mimeType,
        size: normalized.size,
      },
    };
  } else {
    const header = source.file.slice(0, 64);
    const headerBytes = new Uint8Array(await header.arrayBuffer());
    const { mimeType } = validateVideoContainerHeader(headerBytes);
    const name = ensureVideoFileName(source.file.name, mimeType);
    source = {
      kind: "file",
      file: new File([source.file], name, { type: mimeType }),
    };
  }

  const meta = getSourceMeta(source);
  const total = await getUploadTotal(source);

  if (
    !meta.mimeType.toLowerCase().startsWith("video/") &&
    !/\.(mp4|mov|webm|m4v)$/i.test(meta.name)
  ) {
    throw new Error("Only video files are supported");
  }
  if (total > MAX_VIDEO_BYTES) {
    throw new Error(`Video too large (max ${MAX_VIDEO_BYTES} bytes)`);
  }

  let session = await invokeCreateSession({
    fileName: meta.name,
    mimeType: meta.mimeType,
    fileSizeBytes: total,
  });

  if (isGoogleNotConnected(session) && args.promptConnectIfNeeded !== false) {
    const oauth = await startGoogleDriveOAuthAsync();
    if (!oauth.ok) {
      throw new Error(
        oauth.reason === "popup_blocked"
          ? "Google connect popup blocked"
          : "Google Drive is not connected",
      );
    }
    throw new Error(
      "Google Drive connection started. After connecting, tap Save video to plan again.",
    );
  }

  if (!session.upload_url) {
    throw new Error(session.error || "Failed to create Drive upload session");
  }

  const fileId = await putResumableChunks(session.upload_url, source, args.onProgress);
  const finalized = await invokeFinalize(fileId, total);

  if (
    typeof finalized.drive_size_bytes === "number" &&
    finalized.drive_size_bytes > 0 &&
    finalized.drive_size_bytes !== total
  ) {
    throw new Error(
      `drive_upload_failed: uploaded size mismatch (expected ${total}, got ${finalized.drive_size_bytes})`,
    );
  }

  const googleDriveLink =
    finalized.google_drive_link || (fileId ? driveLinkFromFileId(fileId) : "");
  if (!googleDriveLink) {
    throw new Error(finalized.error || "Failed to finalize Drive upload");
  }

  return {
    googleDriveLink,
    fileId: finalized.file_id || fileId,
    permissionWarning: finalized.permission_warning,
  };
}

export { MAX_VIDEO_BYTES };
