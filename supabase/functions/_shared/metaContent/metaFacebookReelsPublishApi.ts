import { graphUrl } from "../metaContentAuth.ts";

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

export async function uploadFacebookReelsVideo(
  uploadUrl: string,
  pageAccessToken: string,
  videoBytes: Uint8Array,
): Promise<void> {
  const res = await fetch(uploadUrl, {
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
    throw new Error(`meta_fb_reels_upload HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
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

export async function deleteFacebookReelVideo(
  videoId: string,
  pageAccessToken: string,
): Promise<{ ok: boolean; alreadyDeleted: boolean; error?: string }> {
  const url = graphUrl(videoId);
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
