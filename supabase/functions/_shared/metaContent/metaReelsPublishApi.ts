import { graphUrl } from "../metaContentAuth.ts";
import { sleepMs } from "../scheduledPosts/scheduledPostRetry.ts";

export type MetaReelsContainerResult = {
  containerId: string;
  uploadUri: string;
};

export type InstagramContainerStatus = {
  statusCode: string;
  status: string | null;
};

const IG_CONTAINER_READY = "FINISHED";
const IG_CONTAINER_FATAL = new Set(["ERROR", "EXPIRED"]);

/** Default: Meta often finishes in 30s–2m; keep under typical waitUntil budget. */
const DEFAULT_CONTAINER_MAX_WAIT_MS = 180_000;
const DEFAULT_CONTAINER_POLL_MS = 5_000;

export async function createInstagramReelsContainer(
  igBusinessAccountId: string,
  pageAccessToken: string,
  args: { caption: string },
): Promise<MetaReelsContainerResult> {
  const url = graphUrl(`${igBusinessAccountId}/media`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      media_type: "REELS",
      upload_type: "resumable",
      caption: args.caption.slice(0, 2200),
    }),
  });

  const json = await res.json().catch(() => ({})) as {
    id?: string;
    uri?: string;
    error?: { message?: string; code?: number };
  };

  if (!res.ok || !json.id) {
    throw new Error(
      `meta_reels_container HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }

  const uploadUri = String(json.uri ?? "").trim();
  if (!uploadUri) throw new Error("meta_reels_missing_upload_uri");

  return { containerId: String(json.id), uploadUri };
}

export async function uploadInstagramReelsVideo(
  uploadUri: string,
  pageAccessToken: string,
  videoBytes: Uint8Array,
): Promise<void> {
  const res = await fetch(uploadUri, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      "Content-Type": "application/octet-stream",
      offset: "0",
      file_size: String(videoBytes.byteLength),
    },
    body: videoBytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`meta_reels_upload HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function fetchInstagramContainerStatus(
  containerId: string,
  pageAccessToken: string,
): Promise<InstagramContainerStatus> {
  const url = graphUrl(containerId, { fields: "status_code,status" });
  const res = await fetch(
    `${url}&access_token=${encodeURIComponent(pageAccessToken)}`,
  );
  const json = await res.json().catch(() => ({})) as {
    status_code?: string;
    status?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      `meta_reels_container_status HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }

  return {
    statusCode: String(json.status_code ?? "").trim().toUpperCase(),
    status: json.status?.trim() ? String(json.status).trim() : null,
  };
}

/**
 * Poll IG media container until FINISHED (required before media_publish).
 * Throws media_not_ready on timeout; meta_reels_container_error/expired on fatal status.
 */
export async function waitForInstagramReelsContainerReady(
  containerId: string,
  pageAccessToken: string,
  options?: { maxWaitMs?: number; intervalMs?: number },
): Promise<InstagramContainerStatus> {
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_CONTAINER_MAX_WAIT_MS;
  const intervalMs = options?.intervalMs ?? DEFAULT_CONTAINER_POLL_MS;
  const deadline = Date.now() + maxWaitMs;
  let last: InstagramContainerStatus = { statusCode: "", status: null };

  while (Date.now() <= deadline) {
    last = await fetchInstagramContainerStatus(containerId, pageAccessToken);
    if (last.statusCode === IG_CONTAINER_READY) return last;
    if (IG_CONTAINER_FATAL.has(last.statusCode)) {
      const detail = last.status ? ` — ${last.status}` : "";
      throw new Error(
        `meta_reels_container_${last.statusCode.toLowerCase()}${detail}`,
      );
    }
    await sleepMs(intervalMs);
  }

  throw new Error(
    `media_not_ready: Instagram container status=${last.statusCode || "unknown"} after ${maxWaitMs}ms`,
  );
}

export async function publishInstagramReelsContainer(
  igBusinessAccountId: string,
  pageAccessToken: string,
  containerId: string,
): Promise<{ mediaId: string }> {
  const url = graphUrl(`${igBusinessAccountId}/media_publish`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      creation_id: containerId,
    }),
  });

  const json = await res.json().catch(() => ({})) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok || !json.id) {
    const msg = json.error?.message ?? "unknown";
    const lower = msg.toLowerCase();
    // Publish-before-ready / still processing — surface as transient media_not_ready.
    if (
      lower.includes("media id is not available") ||
      lower.includes("media is not ready") ||
      lower.includes("not ready for publishing")
    ) {
      throw new Error(`media_not_ready: ${msg}`);
    }
    throw new Error(`meta_reels_publish HTTP ${res.status}: ${msg}`);
  }

  return { mediaId: String(json.id) };
}

export async function fetchInstagramMediaPermalink(
  mediaId: string,
  pageAccessToken: string,
): Promise<string | null> {
  const url = graphUrl(mediaId, { fields: "permalink" });
  const res = await fetch(`${url}&access_token=${encodeURIComponent(pageAccessToken)}`);
  const json = await res.json().catch(() => ({})) as { permalink?: string };
  return json.permalink?.trim() ?? null;
}

export function buildInstagramReelsFallbackUrl(mediaId: string): string {
  return `https://www.instagram.com/reel/${encodeURIComponent(mediaId)}/`;
}
