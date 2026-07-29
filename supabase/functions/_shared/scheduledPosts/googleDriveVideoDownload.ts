import { resolveGoogleDrivePublicVideoUrl } from "./googleDrivePublicVideoUrl.ts";
import { resolveValidatedVideoMimeType } from "./validateDownloadedVideo.ts";

/** Keep in sync with Android share copy limit and googleDriveResumableUploadClient. */
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

function isHtmlResponse(contentType: string | null, bytes: Uint8Array): boolean {
  const type = String(contentType ?? "").toLowerCase();
  if (type.includes("text/html")) return true;
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 256))).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
}

/** Download a publicly shared Google Drive video for TikTok FILE_UPLOAD. */
export async function downloadGoogleDriveVideo(
  driveShareUrl: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const downloadUrl = resolveGoogleDrivePublicVideoUrl(driveShareUrl);
  if (!downloadUrl) throw new Error("invalid_google_drive_video_url");

  const res = await fetch(downloadUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`drive_download_failed: HTTP ${res.status}`);
  }

  const contentLength = Number(res.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_VIDEO_BYTES) {
    throw new Error(`drive_video_too_large: ${contentLength} bytes (max ${MAX_VIDEO_BYTES})`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("drive_download_failed: empty file");
  }
  if (bytes.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(`drive_video_too_large: ${bytes.byteLength} bytes (max ${MAX_VIDEO_BYTES})`);
  }

  if (isHtmlResponse(res.headers.get("content-type"), bytes)) {
    throw new Error(
      "drive_download_failed: Google Drive returned HTML instead of video. Ensure the file is shared as Anyone with the link can view.",
    );
  }

  const mimeType = resolveValidatedVideoMimeType(bytes, res.headers.get("content-type"));

  return { bytes, mimeType };
}
