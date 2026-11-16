const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_API_VERSION = "202610";

function linkedInRestHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export type LinkedInVideoUploadPart = {
  uploadUrl: string;
  firstByte: number;
  lastByte: number;
};

export type LinkedInVideoUploadInit = {
  uploadUrn: string;
  uploadToken: string;
  parts: LinkedInVideoUploadPart[];
  /** Persisted for resume / finalize. */
  uploadInstructions: Record<string, unknown>;
};

type InitializeUploadResponse = {
  value?: {
    video?: string;
    uploadToken?: string;
    uploadUrl?: string;
    uploadInstructions?: Array<{
      uploadUrl?: string;
      firstByte?: number;
      lastByte?: number;
    }>;
  };
  message?: string;
};

function parseUploadParts(
  value: NonNullable<InitializeUploadResponse["value"]>,
): LinkedInVideoUploadPart[] {
  const raw = value.uploadInstructions;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((part) => {
        const uploadUrl = String(part.uploadUrl ?? "").trim();
        const firstByte = Number(part.firstByte ?? 0);
        const lastByte = Number(part.lastByte ?? -1);
        if (!uploadUrl || !Number.isFinite(firstByte) || !Number.isFinite(lastByte) || lastByte < firstByte) {
          return null;
        }
        return { uploadUrl, firstByte, lastByte };
      })
      .filter((p): p is LinkedInVideoUploadPart => p != null);
  }

  // Legacy single-URL shape (pre multipart instructions).
  const legacyUrl = String(value.uploadUrl ?? "").trim();
  if (legacyUrl) {
    return [{ uploadUrl: legacyUrl, firstByte: 0, lastByte: Number.MAX_SAFE_INTEGER }];
  }
  return [];
}

export async function initializeLinkedInVideoUpload(
  accessToken: string,
  organizationUrn: string,
  fileSizeBytes: number,
): Promise<LinkedInVideoUploadInit> {
  const res = await fetch(`${LINKEDIN_API_BASE}/rest/videos?action=initializeUpload`, {
    method: "POST",
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: organizationUrn,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });

  const json = await res.json().catch(() => ({})) as InitializeUploadResponse;

  if (!res.ok) {
    throw new Error(`linkedin_video_init HTTP ${res.status}: ${json.message ?? "unknown"}`);
  }

  const value = json.value ?? {};
  const uploadUrn = String(value.video ?? "").trim();
  const uploadToken = String(value.uploadToken ?? "");
  const parts = parseUploadParts(value);
  if (!uploadUrn || parts.length === 0) {
    throw new Error("linkedin_video_init_missing_fields");
  }

  return {
    uploadUrn,
    uploadToken,
    parts,
    uploadInstructions: {
      uploadToken,
      uploadInstructions: parts,
    },
  };
}

function stripEtagQuotes(etag: string): string {
  return etag.trim().replace(/^W\//, "").replace(/^"+|"+$/g, "");
}

/**
 * PUT each multipart range. Signed upload URLs do not use the OAuth Authorization header.
 * Returns ETag part IDs in instruction order for finalizeUpload.
 */
export async function uploadLinkedInVideoBytes(
  parts: LinkedInVideoUploadPart[],
  videoBytes: Uint8Array,
  _mimeType?: string,
): Promise<string[]> {
  const uploadedPartIds: string[] = [];
  const lastIndex = videoBytes.byteLength - 1;

  for (const part of parts) {
    const first = Math.max(0, part.firstByte);
    const last = Math.min(
      part.lastByte === Number.MAX_SAFE_INTEGER ? lastIndex : part.lastByte,
      lastIndex,
    );
    if (last < first) {
      throw new Error(`linkedin_video_upload_bad_range:${first}-${last}`);
    }
    const chunk = videoBytes.slice(first, last + 1);
    const res = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(chunk.byteLength),
      },
      body: chunk,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`linkedin_video_upload HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const etag = res.headers.get("etag") ?? res.headers.get("ETag") ?? "";
    const partId = stripEtagQuotes(etag);
    if (!partId) {
      throw new Error("linkedin_video_upload_missing_etag");
    }
    uploadedPartIds.push(partId);
  }

  return uploadedPartIds;
}

export async function finalizeLinkedInVideoUpload(
  accessToken: string,
  uploadUrn: string,
  uploadInstructions: Record<string, unknown>,
  uploadedPartIds: string[],
): Promise<void> {
  const uploadToken = String(uploadInstructions.uploadToken ?? "");

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/videos?action=finalizeUpload`, {
    method: "POST",
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: uploadUrn,
        uploadToken,
        uploadedPartIds,
      },
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`linkedin_video_finalize HTTP ${res.status}: ${json.message ?? "unknown"}`);
  }
}

export async function createLinkedInVideoPost(
  accessToken: string,
  organizationUrn: string,
  videoUrn: string,
  commentary: string,
): Promise<{ postUrn: string }> {
  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      author: organizationUrn,
      commentary: commentary.slice(0, 3000),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: "Video",
          id: videoUrn,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  const postUrn = res.headers.get("x-restli-id")?.trim()
    ?? res.headers.get("X-RestLi-Id")?.trim()
    ?? "";

  if (!res.ok && !postUrn) {
    const json = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`linkedin_post_create HTTP ${res.status}: ${json.message ?? "unknown"}`);
  }

  if (!postUrn) {
    const json = await res.json().catch(() => ({})) as { id?: string };
    const id = String(json.id ?? "").trim();
    if (!id) throw new Error("linkedin_post_missing_urn");
    return { postUrn: id };
  }

  return { postUrn };
}

export function buildLinkedInPostUrl(postUrn: string): string {
  const encoded = encodeURIComponent(postUrn);
  return `https://www.linkedin.com/feed/update/${encoded}`;
}
