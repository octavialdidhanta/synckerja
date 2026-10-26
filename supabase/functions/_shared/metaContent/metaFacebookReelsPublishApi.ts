import { graphUrl } from "../metaContentAuth.ts";
import {
  isFetchAbortError,
  PLATFORM_BYTE_UPLOAD_TIMEOUT_MS,
} from "../scheduledPosts/fetchTimeout.ts";

export type FacebookReelsStartResult = {
  videoId: string;
  uploadUrl: string;
};

export type FacebookReelsFinishResult = {
  videoId: string;
  postId: string | null;
};

function parseGraphError(json: unknown, fallback: string): string {
  const err = (json as { error?: { message?: string } })?.error?.message;
  return err?.trim() || fallback;
}

export async function startFacebookReelsUploadSession(
  pageId: string,
  pageAccessToken: string,
): Promise<FacebookReelsStartResult> {
  const url = graphUrl(`${pageId}/video_reels`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      upload_phase: "start",
    }),
  });

  const json = await res.json().catch(() => ({})) as {
    video_id?: string;
    upload_url?: string;
    error?: { message?: string };
  };

  if (!res.ok || !json.video_id) {
    throw new Error(
      `meta_fb_reels_start HTTP ${res.status}: ${parseGraphError(json, "unknown")}`,
    );
  }

  const uploadUrl = String(json.upload_url ?? "").trim();
  if (!uploadUrl) throw new Error("meta_fb_reels_missing_upload_url");

  return { videoId: String(json.video_id), uploadUrl };
}

const FACEBOOK_FILE_URL_TIMEOUT_MS = 45_000;
const FACEBOOK_TRANSFER_POLL_MS = 5_000;
const FACEBOOK_TRANSFER_MAX_WAIT_MS = 180_000;

/**
 * Ask Facebook to fetch a public video URL. The request itself is small;
 * Facebook downloads the file, then we poll status before finish.
 */
export async function uploadFacebookReelsFromUrl(
  uploadUrl: string,
  pageAccessToken: string,
  fileUrl: string,
): Promise<void> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageAccessToken}`,
        file_url: fileUrl,
      },
      signal: AbortSignal.timeout(FACEBOOK_FILE_URL_TIMEOUT_MS),
    });
  } catch (err) {
    if (isFetchAbortError(err)) {
      throw new Error(
        `fb_file_url_timeout: Facebook did not accept the video URL in ${FACEBOOK_FILE_URL_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`meta_fb_reels_file_url HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    const json = JSON.parse(text) as { success?: boolean };
    if (json.success === false) {
      throw new Error(`meta_fb_reels_file_url rejected: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("meta_fb_reels_file_url")) throw err;
  }
  console.info(`facebook_file_url_ok ms=${Date.now() - started}`);
}

export async function waitForFacebookReelUpload(
  videoId: string,
  pageAccessToken: string,
  options?: { onTick?: () => Promise<void>; maxWaitMs?: number },
): Promise<FacebookReelProgress> {
  const deadline = Date.now() + (options?.maxWaitMs ?? FACEBOOK_TRANSFER_MAX_WAIT_MS);
  let last = "upload_needed";
  while (Date.now() <= deadline) {
    if (options?.onTick) await options.onTick();
    const snap = await fetchFacebookReelStatus(videoId, pageAccessToken);
    const progress = classifyFacebookReelStatus(snap);
    last = `${snap.uploading}/${snap.processing}/${snap.publishing}/${progress}`;
    console.info(`facebook_transfer_status videoId=${videoId} ${last}`);
    if (progress !== "upload_needed") return progress;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(FACEBOOK_TRANSFER_POLL_MS, remaining)));
  }
  throw new Error(`fb_file_url_timeout: Facebook did not finish fetching the video (${last})`);
}

export async function uploadFacebookReelsVideo(
  uploadUrl: string,
  pageAccessToken: string,
  videoBytes: Uint8Array,
): Promise<void> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageAccessToken}`,
        "Content-Type": "application/octet-stream",
        offset: "0",
        file_size: String(videoBytes.byteLength),
      },
      body: videoBytes,
      signal: AbortSignal.timeout(PLATFORM_BYTE_UPLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    if (isFetchAbortError(err)) {
      throw new Error(
        `fb_upload_timeout: Facebook upload did not finish in ${PLATFORM_BYTE_UPLOAD_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`meta_fb_reels_upload HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  console.info(
    `facebook_upload_ok bytes=${videoBytes.byteLength} ms=${Date.now() - started}`,
  );
}

export type FacebookReelStatusSnapshot = {
  videoStatus: string;
  uploading: string;
  processing: string;
  publishing: string;
};

export type FacebookReelProgress =
  | "published"
  | "upload_complete"
  | "processing"
  | "upload_needed"
  | "error";

/** Map Graph video status into the next local action. Missing upload means bytes still have to be sent. */
export function classifyFacebookReelStatus(
  snapshot: FacebookReelStatusSnapshot,
): FacebookReelProgress {
  const publishing = snapshot.publishing.trim().toLowerCase();
  const uploading = snapshot.uploading.trim().toLowerCase();
  const processing = snapshot.processing.trim().toLowerCase();
  const video = snapshot.videoStatus.trim().toLowerCase();

  if (publishing === "complete" || video === "ready") return "published";
  if (uploading === "error" || processing === "error" || publishing === "error" || video === "error") {
    return "error";
  }
  if (uploading === "complete" || uploading === "completed") {
    return processing === "in_progress" ? "processing" : "upload_complete";
  }
  return "upload_needed";
}

export async function fetchFacebookReelStatus(
  videoId: string,
  pageAccessToken: string,
): Promise<FacebookReelStatusSnapshot> {
  const url = graphUrl(videoId, { fields: "status" });
  const res = await fetch(`${url}&access_token=${encodeURIComponent(pageAccessToken)}`);
  const json = await res.json().catch(() => ({})) as {
    status?: {
      video_status?: string;
      uploading_phase?: { status?: string };
      processing_phase?: { status?: string };
      publishing_phase?: { status?: string };
    };
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      `meta_fb_reels_status HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }
  const status = json.status ?? {};
  return {
    videoStatus: String(status.video_status ?? ""),
    uploading: String(status.uploading_phase?.status ?? ""),
    processing: String(status.processing_phase?.status ?? ""),
    publishing: String(status.publishing_phase?.status ?? ""),
  };
}

export async function finishFacebookReelsPublish(
  pageId: string,
  pageAccessToken: string,
  args: { videoId: string; description: string },
): Promise<FacebookReelsFinishResult> {
  const url = graphUrl(`${pageId}/video_reels`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      upload_phase: "finish",
      video_id: args.videoId,
      video_state: "PUBLISHED",
      description: args.description.slice(0, 2200),
    }),
  });

  const json = await res.json().catch(() => ({})) as {
    video_id?: string;
    post_id?: string;
    success?: boolean;
    error?: { message?: string; code?: number };
  };

  if (!res.ok || json.success === false) {
    const msg = parseGraphError(json, "unknown");
    if (msg.toLowerCase().includes("limit") || json.error?.code === 368) {
      throw new Error(`meta_fb_reels_rate_limit: ${msg}`);
    }
    throw new Error(`meta_fb_reels_finish HTTP ${res.status}: ${msg}`);
  }

  return {
    videoId: String(json.video_id ?? args.videoId),
    postId: json.post_id ? String(json.post_id) : null,
  };
}

export async function fetchFacebookReelPermalink(
  videoId: string,
  pageAccessToken: string,
): Promise<string | null> {
  const url = graphUrl(videoId, { fields: "permalink_url,permalink" });
  const res = await fetch(`${url}&access_token=${encodeURIComponent(pageAccessToken)}`);
  const json = await res.json().catch(() => ({})) as {
    permalink_url?: string;
    permalink?: string;
  };
  return json.permalink_url?.trim() || json.permalink?.trim() || null;
}

export function buildFacebookReelFallbackUrl(pageId: string, videoId: string): string {
  return `https://www.facebook.com/${encodeURIComponent(pageId)}/videos/${encodeURIComponent(videoId)}/`;
}

/** Reel permalinks carry the video id, the only delete target that survives resume cleanup. */
export function extractFacebookVideoIdFromUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  const patterns = [
    /\/videos\/(?:[^/?#]+\/)?(\d{5,})/,
    /\/reels?\/(\d{5,})/,
    /[?&]v=(\d{5,})/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

type GraphDeleteAttempt = {
  ok: boolean;
  missingObject: boolean;
  error?: string;
};

async function graphDeleteObject(
  objectId: string,
  pageAccessToken: string,
): Promise<GraphDeleteAttempt> {
  const url = graphUrl(encodeURIComponent(objectId));
  const res = await fetch(`${url}?access_token=${encodeURIComponent(pageAccessToken)}`, {
    method: "DELETE",
  });
  const json = await res.json().catch(() => ({})) as {
    success?: boolean;
    error?: { message?: string; code?: number };
  };

  if (res.ok && json.success !== false) {
    return { ok: true, missingObject: false };
  }

  const code = json.error?.code;
  const message = json.error?.message ?? `http_${res.status}`;
  const lower = message.toLowerCase();
  const missingObject = code === 100 && lower.includes("does not exist");

  return { ok: false, missingObject, error: message };
}

export type FacebookDeleteContentResult = {
  ok: boolean;
  alreadyDeleted: boolean;
  deletedTarget?: string;
  error?: string;
};

/**
 * Graph rejects a bare Page post id with error #12 (singular statuses API deprecated),
 * so try every known id shape (video node, `{page}_{post}`, raw id) before failing.
 */
export async function deleteFacebookPublishedContent(
  candidateIds: readonly string[],
  pageAccessToken: string,
): Promise<FacebookDeleteContentResult> {
  const attempted = new Set<string>();
  const failures: string[] = [];
  let missingObject = false;

  for (const candidate of candidateIds) {
    const target = candidate.trim();
    if (!target || attempted.has(target)) continue;
    attempted.add(target);

    const attempt = await graphDeleteObject(target, pageAccessToken);
    if (attempt.ok) {
      return { ok: true, alreadyDeleted: false, deletedTarget: target };
    }
    if (attempt.missingObject) missingObject = true;
    failures.push(`${target}: ${attempt.error ?? "unknown"}`);
  }

  if (attempted.size === 0 || missingObject) {
    return { ok: true, alreadyDeleted: true };
  }

  return { ok: false, alreadyDeleted: false, error: failures.join(" | ") };
}

export async function deleteInstagramMedia(
  mediaId: string,
  pageAccessToken: string,
): Promise<{ ok: boolean; alreadyDeleted: boolean; error?: string }> {
  const url = graphUrl(mediaId);
  const res = await fetch(`${url}?access_token=${encodeURIComponent(pageAccessToken)}`, {
    method: "DELETE",
  });
  const json = await res.json().catch(() => ({})) as {
    success?: boolean;
    error?: { message?: string; code?: number };
  };

  if (res.ok && json.success !== false) {
    return { ok: true, alreadyDeleted: false };
  }

  const code = json.error?.code;
  const msg = json.error?.message ?? "";
  if (code === 100 || msg.toLowerCase().includes("not exist")) {
    return { ok: true, alreadyDeleted: true };
  }

  return { ok: false, alreadyDeleted: false, error: msg || `http_${res.status}` };
}
