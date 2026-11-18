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
