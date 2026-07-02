import { TIKTOK_CONTENT_API_BASE } from "../tiktokContentAuth.ts";
import { sleepMs } from "../scheduledPosts/scheduledPostRetry.ts";

export const TIKTOK_PUBLISH_SCOPES = ["video.upload", "video.publish"] as const;

export function tiktokScopesIncludePublish(scope: string | null | undefined): boolean {
  const parts = String(scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return TIKTOK_PUBLISH_SCOPES.every((required) => parts.includes(required));
}

type TikTokContentError = {
  code?: string;
  message?: string;
  log_id?: string;
};

type TikTokContentEnvelope<T> = {
  data?: T;
  error?: TikTokContentError;
};

function formatTikTokApiErrorDetail(
  prefix: string,
  err?: TikTokContentError,
  httpStatus?: number,
): string {
  const code = err?.code?.trim() ?? "";
  const msg = err?.message?.trim() ?? "";
  const logId = err?.log_id?.trim();
  const logSuffix = logId ? ` [log_id=${logId}]` : "";

  if (code === "unaudited_client_can_only_post_to_private_accounts") {
    return `${prefix}: TikTok app belum lolos App Review — posting sandbox hanya didukung dengan visibility Only me (SELF_ONLY) pada akun yang memenuhi syarat. Set akun TikTok ke Private sementara, atau selesaikan TikTok App Review untuk Direct Post.${logSuffix}`;
  }
  if (code === "privacy_level_option_mismatch") {
    return `${prefix}: Visibility tidak valid untuk akun TikTok ini. Gunakan opsi dari creator_info (biasanya Only me / SELF_ONLY untuk app belum diaudit).${logSuffix}`;
  }

  if (msg && msg !== "ok") {
    return `${prefix}: ${msg}${code && code !== "ok" ? ` (${code})` : ""}${logSuffix}`;
  }
  return `${prefix}${logSuffix}${httpStatus ? ` HTTP ${httpStatus}` : ""}`;
}

function throwPublishError(
  prefix: string,
  err?: TikTokContentError,
  httpStatus?: number,
  res?: Response,
): never {
  if (httpStatus === 429) {
    const retryAfter = res?.headers?.get("Retry-After");
    const seconds = retryAfter ? parseInt(retryAfter, 10) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      throw new Error(`http 429 retry-after:${seconds}`);
    }
    throw new Error("http 429");
  }

  throw new Error(formatTikTokApiErrorDetail(prefix, err, httpStatus));
}

export type TikTokCreatorInfo = {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

/** Pick a privacy level allowed for this creator (unaudited apps → SELF_ONLY). */
export function resolveTikTokPublishPrivacyLevel(
  requested: string | null | undefined,
  creatorInfo: Pick<TikTokCreatorInfo, "privacy_level_options">,
): string {
  const options = (creatorInfo.privacy_level_options ?? []).filter(Boolean);
  const wanted = String(requested ?? "").trim() || "SELF_ONLY";

  if (options.includes(wanted)) return wanted;
  if (options.includes("SELF_ONLY")) return "SELF_ONLY";

  throw new Error(
    `privacy_level_option_mismatch: Only me (SELF_ONLY) required for unaudited TikTok apps; available options: ${options.join(", ") || "none"}`,
  );
}

export function deriveTikTokPostInteractionFromCreator(
  creatorInfo: Pick<TikTokCreatorInfo, "comment_disabled" | "duet_disabled" | "stitch_disabled">,
): {
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
} {
  return {
    disableComment: creatorInfo.comment_disabled ?? false,
    disableDuet: creatorInfo.duet_disabled ?? false,
    disableStitch: creatorInfo.stitch_disabled ?? false,
  };
}

export async function queryTikTokCreatorInfo(
  accessToken: string,
  options?: { maxAttempts?: number },
): Promise<TikTokCreatorInfo> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastHttpStatus: number | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${TIKTOK_CONTENT_API_BASE}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: "{}",
    });
    const json = await res.json().catch(() => ({})) as TikTokContentEnvelope<TikTokCreatorInfo>;
    lastHttpStatus = res.status;

    if (res.ok && json.error?.code === "ok") {
      return json.data ?? {};
    }

    const retryable = res.status === 503 || res.status === 502 || res.status === 429 || res.status === 504;
    if (retryable && attempt < maxAttempts - 1) {
      await sleepMs(1500 * (attempt + 1));
      continue;
    }

    throwPublishError("creator_info_failed", json.error, res.status, res);
  }

  throwPublishError("creator_info_failed", undefined, lastHttpStatus);
}

export type TikTokVideoInitResult = {
  publish_id: string;
  upload_url?: string;
};

const DEFAULT_CHUNK_BYTES = 10 * 1024 * 1024;
const MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const MAX_CHUNKS = 1000;

export function computeTikTokFileUploadChunkPlan(videoSize: number): {
  chunkSize: number;
  totalChunkCount: number;
} {
  if (!Number.isFinite(videoSize) || videoSize <= 0) {
    throw new Error("invalid_video_size");
  }

  // TikTok FILE_UPLOAD rules:
  // - <5 MB: one chunk, chunk_size === video_size
  // - <=64 MB: may upload whole file in one chunk (chunk_size === video_size)
  // - >64 MB: multi-chunk; total_chunk_count = floor(video_size / chunk_size);
  //   the final chunk absorbs trailing bytes (may exceed chunk_size, up to 128 MB)
  if (videoSize <= MAX_CHUNK_BYTES) {
    return { chunkSize: videoSize, totalChunkCount: 1 };
  }

  let chunkSize = DEFAULT_CHUNK_BYTES;
  let totalChunkCount = Math.floor(videoSize / chunkSize);
  while (totalChunkCount > MAX_CHUNKS) {
    chunkSize = Math.min(chunkSize * 2, MAX_CHUNK_BYTES);
    totalChunkCount = Math.floor(videoSize / chunkSize);
  }

  if (totalChunkCount < 2) {
    chunkSize = MAX_CHUNK_BYTES;
    totalChunkCount = Math.floor(videoSize / chunkSize);
  }
  if (totalChunkCount < 2) {
    throw new Error("invalid_video_chunk_plan");
  }

  return { chunkSize, totalChunkCount };
}

export async function initTikTokVideoPublishFileUpload(
  accessToken: string,
  args: {
    videoSize: number;
    chunkSize: number;
    totalChunkCount: number;
    caption: string;
    privacyLevel: string;
    disableComment?: boolean;
    disableDuet?: boolean;
    disableStitch?: boolean;
  },
): Promise<TikTokVideoInitResult> {
  const res = await fetch(`${TIKTOK_CONTENT_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: args.caption.slice(0, 2200),
        privacy_level: args.privacyLevel,
        disable_comment: args.disableComment ?? false,
        disable_duet: args.disableDuet ?? false,
        disable_stitch: args.disableStitch ?? false,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: args.videoSize,
        chunk_size: args.chunkSize,
        total_chunk_count: args.totalChunkCount,
      },
    }),
  });
  const json = await res.json().catch(() => ({})) as TikTokContentEnvelope<TikTokVideoInitResult>;
  if (!res.ok || json.error?.code !== "ok" || !json.data?.publish_id || !json.data?.upload_url) {
    throwPublishError("video_init_failed", json.error, res.status, res);
  }
  return json.data;
}

export async function uploadTikTokVideoChunks(
  uploadUrl: string,
  videoBytes: Uint8Array,
  chunkPlan: { chunkSize: number; totalChunkCount: number },
  mimeType = "video/mp4",
): Promise<void> {
  const totalSize = videoBytes.byteLength;
  for (let chunkIndex = 0; chunkIndex < chunkPlan.totalChunkCount; chunkIndex++) {
    const start = chunkIndex * chunkPlan.chunkSize;
    const end = chunkIndex === chunkPlan.totalChunkCount - 1
      ? totalSize - 1
      : Math.min(start + chunkPlan.chunkSize - 1, totalSize - 1);
    const chunk = videoBytes.subarray(start, end + 1);

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      },
      body: chunk,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `video_upload_failed: chunk ${chunkIndex + 1}/${chunkPlan.totalChunkCount} HTTP ${res.status}${body ? ` ${body.slice(0, 200)}` : ""}`,
      );
    }
  }
}

export async function initTikTokVideoPublishPullFromUrl(
  accessToken: string,
  args: {
    videoUrl: string;
    caption: string;
    privacyLevel: string;
    disableComment?: boolean;
    disableDuet?: boolean;
    disableStitch?: boolean;
  },
): Promise<TikTokVideoInitResult> {
  const res = await fetch(`${TIKTOK_CONTENT_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: args.caption.slice(0, 2200),
        privacy_level: args.privacyLevel,
        disable_comment: args.disableComment ?? false,
        disable_duet: args.disableDuet ?? false,
        disable_stitch: args.disableStitch ?? false,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: args.videoUrl,
      },
    }),
  });
  const json = await res.json().catch(() => ({})) as TikTokContentEnvelope<TikTokVideoInitResult>;
  if (!res.ok || json.error?.code !== "ok" || !json.data?.publish_id) {
    throwPublishError("video_init_failed", json.error, res.status, res);
  }
  return json.data;
}

export type TikTokPublishStatus = {
  status: string;
  fail_reason?: string;
  publicaly_available_post_id?: string[];
  uploaded_bytes?: number;
};

export async function fetchTikTokPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<TikTokPublishStatus> {
  const res = await fetch(`${TIKTOK_CONTENT_API_BASE}/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const json = await res.json().catch(() => ({})) as TikTokContentEnvelope<TikTokPublishStatus>;
  if (!res.ok || json.error?.code !== "ok") {
    throwPublishError("publish_status_failed", json.error, res.status, res);
  }
  return json.data ?? { status: "UNKNOWN" };
}

export async function pollTikTokPublishUntilComplete(
  accessToken: string,
  publishId: string,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<TikTokPublishStatus> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const delayMs = options?.delayMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const status = await fetchTikTokPublishStatus(accessToken, publishId);
    const s = String(status.status ?? "").toUpperCase();
    if (s === "PUBLISH_COMPLETE") return status;
    if (s === "FAILED") {
      throw new Error(`publish_failed: ${status.fail_reason ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("publish_timeout: TikTok publish did not complete in time");
}
