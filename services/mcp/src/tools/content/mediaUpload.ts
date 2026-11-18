import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const MEDIA_UPLOAD_MAX_BYTES = 512 * 1024 * 1024;
/** Each PUT to /uploads/<ticket> may carry at most this many bytes. */
export const MEDIA_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
/** Google resumable rule: every chunk except the last is a multiple of 256 KiB. */
export const MEDIA_UPLOAD_GRANULARITY = 256 * 1024;

export const startMediaUploadInput = z
  .object({
    plan_id: z.string().uuid(),
    file_name: z.string().trim().min(1).max(255),
    size_bytes: z.number().int().min(10 * 1024).max(MEDIA_UPLOAD_MAX_BYTES),
    mime_type: z.enum(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]).optional(),
  })
  .strict();

export type StartMediaUploadInput = {
  planId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string | null;
};

export type StartMediaUploadResult = {
  version_id: string;
  version_no: number;
  file_name: string;
  folder_url: string;
  upload_url: string;
  expires_at: string;
  size_bytes: number;
  chunk_bytes: number;
  how_to_upload: string;
};

export const listMediaVersionsInput = z.object({ plan_id: z.string().uuid() }).strict();

export type MediaVersionRow = {
  version_no: number;
  status: "uploading" | "ready" | "failed";
  google_drive_link: string | null;
  active: boolean;
  source: "web" | "mcp";
  size_bytes: number;
  created_at: string;
  completed_at: string | null;
};

export type ListMediaVersionsResult = {
  plan_id: string;
  folder_url: string | null;
  versions: MediaVersionRow[];
  how_to_read: string;
};

export function howToUpload(uploadUrl: string, sizeBytes: number): string {
  return [
    `Send the video bytes to ${uploadUrl} with HTTP PUT (no Authorization header; the URL itself is a one-time ticket valid 6 hours).`,
    `A file of ${MEDIA_UPLOAD_CHUNK_BYTES} bytes or less can go in ONE request: curl -sS -X PUT --data-binary @video.mp4 -H "Content-Type: application/octet-stream" "<upload_url>".`,
    `Larger files go in chunks of exactly ${MEDIA_UPLOAD_CHUNK_BYTES} bytes (the last one may be smaller), in order, each with header "Content-Range: bytes START-END/${sizeBytes}".`,
    "Example loop: i=0; while [ $((i*CHUNK)) -lt SIZE ]; do dd if=video.mp4 bs=CHUNK skip=$i count=1 2>/dev/null > part; START=$((i*CHUNK)); END=$((START+$(stat -c%s part)-1)); curl -sS -X PUT --data-binary @part -H \"Content-Range: bytes $START-$END/SIZE\" \"<upload_url>\"; i=$((i+1)); done",
    "Each chunk answers {received_bytes, total_bytes}. The last chunk answers done true with version_no and google_drive_link: the video is already saved on the plan as the active version (production status Need Review, like pasting a link in Office).",
    "If a request fails, GET the same URL to see received_bytes and continue from there. Never retry from 0 after bytes were received.",
    "Every error answer has error (a code) and next_step (what to do): follow next_step.",
  ].join(" ");
}

export const MEDIA_VERSIONS_HOW_TO_READ =
  "versions are the videos uploaded for this content plan into the organization Google Drive, newest first. " +
  "active true is the version saved on the plan now (the one review links and scheduled posts use). " +
  "status uploading or failed means that upload did not finish. To add a version use content.plans.media.upload.start.";

export type StartMediaUpload = (ctx: McpAuthContext, input: StartMediaUploadInput) => Promise<StartMediaUploadResult>;
export type ListMediaVersions = (ctx: McpAuthContext, planId: string) => Promise<ListMediaVersionsResult>;

export function startMediaUploadResult(ctx: McpAuthContext, args: unknown, start: StartMediaUpload): Promise<StartMediaUploadResult> {
  const parsed = startMediaUploadInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return start(ctx, {
    planId: parsed.data.plan_id,
    fileName: parsed.data.file_name,
    sizeBytes: parsed.data.size_bytes,
    mimeType: parsed.data.mime_type ?? null,
  });
}

export function listMediaVersionsResult(ctx: McpAuthContext, args: unknown, list: ListMediaVersions): Promise<ListMediaVersionsResult> {
  const parsed = listMediaVersionsInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return list(ctx, parsed.data.plan_id);
}

/**
 * What the AI should do next for each upload error. Any AI connected to Synckerja reads these,
 * so they must be self-explanatory without a client-side skill.
 */
const UPLOAD_NEXT_STEP: Record<string, string> = {
  not_found:
    "No content plan with this plan_id in the organization locked in this session. Check plan_id with content.plans.list, or switch organization with session.switchOrg.",
  forbidden: "The signed-in member cannot upload for this organization. Tell the user to ask the organization owner for access.",
  invalid_input:
    "Check file_name, the exact size_bytes (10 KB to 512 MB), and that the file is an MP4, MOV, WebM, or M4V video.",
  not_approved:
    "The brief of this content plan is not approved yet. Tell the user: a person must approve the brief in Synckerja first. Do not approve it yourself.",
  production_locked:
    "Production of this content plan is already approved, so its video is locked. Tell the user: a reviewer must click Request Revision on this plan in Synckerja, then call content.plans.media.upload.start again. Do not request the revision yourself.",
  not_video_content: "This plan is a Post or Carousel, which uses images, not a video. Images are uploaded in Synckerja instead.",
  not_connected:
    "This organization has no Google Drive connected for content videos. Tell the user: the organization owner or admin opens Synckerja > Digital Marketing > Social Media > Settings > Google Drive org and clicks Sambungkan Google Drive.",
  reconnect_required:
    "The organization's Google Drive connection expired. Tell the user: the owner or admin reconnects it in Synckerja > Digital Marketing > Social Media > Settings > Google Drive org.",
  busy: "Another upload for this plan started at the same moment. Wait a few seconds and call content.plans.media.upload.start again.",
  upload_start_failed: "Synckerja could not start the upload. Wait a moment and try once more; if it fails again, tell the user.",
  request_failed: "Synckerja could not read the versions right now. Try again in a moment.",
  unknown_ticket: "This upload_url is unknown. Start a new upload with content.plans.media.upload.start.",
  already_done: "This upload already finished. Check content.plans.media.versions.list; do not send the file again.",
  expired:
    "This upload_url expired (valid 6 hours). Start a new upload with content.plans.media.upload.start and send the whole file again.",
  invalid_content_range:
    "Send the header Content-Range: bytes START-END/TOTAL, where TOTAL is size_bytes and the body is END-START+1 bytes. A file of 8388608 bytes or less can go in one PUT without the header.",
  out_of_order: "Chunks must arrive in order. GET the upload_url to read received_bytes and continue from that byte.",
  chunk_too_large: "Each PUT carries at most 8388608 bytes. Split the file into 8388608-byte chunks.",
  chunk_not_multiple_of_256k: "Every chunk except the last must be a multiple of 262144 bytes. Use 8388608-byte chunks.",
  empty_body: "The PUT body was empty. Send the video bytes, for example with curl --data-binary @video.mp4.",
  google_unreachable:
    "Google Drive did not take this chunk. Wait a few seconds, GET the upload_url to read received_bytes, and resend from there.",
  google_missing_file_id: "Google Drive finished without a file id. Start a new upload with content.plans.media.upload.start.",
  link_not_approved:
    "The video is saved as a new version but was not put on the plan, because the brief is not approved. Tell the user; a person can make it active in Synckerja after approving the brief.",
};

export function uploadNextStep(code: string): string {
  if (UPLOAD_NEXT_STEP[code]) return UPLOAD_NEXT_STEP[code];
  if (code.startsWith("google_http_")) return UPLOAD_NEXT_STEP.google_unreachable;
  // Verification failures after the bytes arrived (file_not_for_this_version, size_mismatch, ...).
  return `The upload could not be completed (${code}). Start a new upload with content.plans.media.upload.start; tell the user if it happens again.`;
}

/** Error text for MCP tool errors: the code first (stable for callers), then what to do. */
export function uploadToolError(code: string): Error {
  return new Error(`${code}: ${uploadNextStep(code)}`);
}
