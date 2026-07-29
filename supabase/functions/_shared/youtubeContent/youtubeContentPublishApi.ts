const YOUTUBE_UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";

const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;
const MIN_CHUNK_BYTES = 256 * 1024;

export type YouTubeUploadPrivacyStatus = "public" | "unlisted" | "private";

export function mapSchedulePrivacyToYouTube(privacyLevel: string | null | undefined): YouTubeUploadPrivacyStatus {
  const level = String(privacyLevel ?? "").trim().toUpperCase();
  if (level === "PUBLIC" || level === "PUBLIC_TO_EVERYONE") return "public";
  if (level === "UNLISTED") return "unlisted";
  if (level === "PRIVATE" || level === "SELF_ONLY") return "private";
  return "public";
}

export function computeYouTubeUploadChunkPlan(videoSize: number): {
  chunkSize: number;
  totalChunkCount: number;
} {
  if (!Number.isFinite(videoSize) || videoSize <= 0) {
    throw new Error("invalid_video_size");
  }
  if (videoSize <= MIN_CHUNK_BYTES) {
    return { chunkSize: videoSize, totalChunkCount: 1 };
  }
  const chunkSize = DEFAULT_CHUNK_BYTES;
  const totalChunkCount = Math.ceil(videoSize / chunkSize);
  return { chunkSize, totalChunkCount };
}

export async function initYouTubeResumableUpload(
  accessToken: string,
  args: {
    title: string;
    description: string;
    privacyStatus: YouTubeUploadPrivacyStatus;
    videoSize: number;
    mimeType: string;
  },
): Promise<{ uploadUrl: string }> {
  const res = await fetch(
    `${YOUTUBE_UPLOAD_API}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(args.videoSize),
        "X-Upload-Content-Type": args.mimeType,
      },
      body: JSON.stringify({
        snippet: {
          title: args.title.slice(0, 100),
          description: args.description.slice(0, 5000),
          categoryId: "22",
        },
        status: {
          privacyStatus: args.privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`youtube_init_upload HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const uploadUrl = res.headers.get("Location")?.trim() ?? "";
  if (!uploadUrl) throw new Error("youtube_init_upload_missing_location");
  return { uploadUrl };
}

export async function uploadYouTubeVideoChunks(
  uploadUrl: string,
  accessToken: string,
  videoBytes: Uint8Array,
  chunkPlan: { chunkSize: number; totalChunkCount: number },
  mimeType: string,
  startByte = 0,
): Promise<{ videoId: string }> {
  const totalSize = videoBytes.byteLength;
  let offset = startByte;

  while (offset < totalSize) {
    const end = Math.min(offset + chunkPlan.chunkSize, totalSize) - 1;
    const chunk = videoBytes.subarray(offset, end + 1);
    const contentRange = `bytes ${offset}-${end}/${totalSize}`;

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": String(chunk.byteLength),
        "Content-Type": mimeType,
        "Content-Range": contentRange,
      },
      body: chunk,
    });

    if (res.status === 308) {
      const range = res.headers.get("Range");
      if (range) {
        const match = range.match(/(\d+)-(\d+)/);
        if (match) offset = Number(match[2]) + 1;
        else offset = end + 1;
      } else {
        offset = end + 1;
      }
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`youtube_upload_chunk HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = await res.json().catch(() => ({})) as { id?: string };
    const videoId = String(json.id ?? "").trim();
    if (!videoId) throw new Error("youtube_upload_missing_video_id");
    return { videoId };
  }

  throw new Error("youtube_upload_incomplete");
}

type VideoProcessingStatus = {
  id: string;
  processingStatus: string | null;
};

export async function fetchYouTubeVideoProcessingStatus(
  accessToken: string,
  videoId: string,
): Promise<VideoProcessingStatus & { found: boolean }> {
  const url = new URL(`${YOUTUBE_DATA_API}/videos`);
  url.searchParams.set("part", "processingDetails,status,snippet");
  url.searchParams.set("id", videoId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as {
    items?: Array<{ id?: string; processingDetails?: { processingStatus?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      `youtube_video_status HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }

  const item = json.items?.[0];
  if (!item?.id) {
    return { id: videoId, processingStatus: null, found: false };
  }

  return {
    id: String(item.id),
    processingStatus: item.processingDetails?.processingStatus ?? null,
    found: true,
  };
}

export type YouTubeVerifiedVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  privacyStatus: YouTubeUploadPrivacyStatus | null;
};

export async function assertYouTubeVideoOwnedByChannel(
  accessToken: string,
  videoId: string,
  channelId: string,
): Promise<YouTubeVerifiedVideo> {
  const url = new URL(`${YOUTUBE_DATA_API}/videos`);
  url.searchParams.set("part", "snippet,status");
  url.searchParams.set("id", videoId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as {
    items?: Array<{
      id?: string;
      snippet?: { channelId?: string; channelTitle?: string; title?: string };
      status?: { privacyStatus?: string };
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      `youtube_video_verify HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }

  const item = json.items?.[0];
  const ownerChannelId = String(item?.snippet?.channelId ?? "").trim();
  if (!ownerChannelId) {
    throw new Error("youtube_video_not_found: Upload reported success but video is not visible to this account");
  }
  if (ownerChannelId !== channelId.trim()) {
    const ownerTitle = String(item?.snippet?.channelTitle ?? "").trim() || ownerChannelId;
    throw new Error(
      `youtube_video_wrong_channel: expected ${channelId}, got ${ownerChannelId} (${ownerTitle})`,
    );
  }

  const privacyRaw = String(item?.status?.privacyStatus ?? "").trim().toLowerCase();
  const privacyStatus = privacyRaw === "public" || privacyRaw === "unlisted" || privacyRaw === "private"
    ? privacyRaw
    : null;

  return {
    videoId: String(item?.id ?? videoId).trim(),
    channelId: ownerChannelId,
    channelTitle: String(item?.snippet?.channelTitle ?? "").trim() || ownerChannelId,
    title: String(item?.snippet?.title ?? "").trim() || videoId,
    privacyStatus,
  };
}

export async function assertYouTubeVideoOwnedByChannelWithRetry(
  accessToken: string,
  videoId: string,
  channelId: string,
  maxAttempts = 15,
  delayMs = 2000,
): Promise<YouTubeVerifiedVideo> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await assertYouTubeVideoOwnedByChannel(accessToken, videoId, channelId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("youtube_video_not_found")) throw e;
      lastError = e instanceof Error ? e : new Error(msg);
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError ?? new Error("youtube_video_not_found: video not visible after retries");
}

export async function pollYouTubeVideoUntilProcessed(
  accessToken: string,
  videoId: string,
  maxAttempts = 45,
  delayMs = 2000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await fetchYouTubeVideoProcessingStatus(accessToken, videoId);
    if (!status.found) {
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw new Error("youtube_video_not_found: video id not returned by YouTube Data API");
    }
    const processing = String(status.processingStatus ?? "").toLowerCase();
    if (!processing || processing === "processed" || processing === "succeeded") {
      return;
    }
    if (processing === "failed" || processing === "terminated") {
      throw new Error(`youtube_processing_failed:${processing}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("processing_timeout");
}

export function buildYouTubePublishedUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function appendShortsHashtag(description: string, isReel: boolean): string {
  if (!isReel) return description;
  if (description.toLowerCase().includes("#shorts")) return description;
  return `${description.trim()}\n\n#Shorts`.trim();
}
