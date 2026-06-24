import { graphUrl } from "../metaContentAuth.ts";

export type MetaReelsContainerResult = {
  containerId: string;
  uploadUri: string;
};

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
    throw new Error(
      `meta_reels_publish HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
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
