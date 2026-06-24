const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_API_VERSION = "202411";

function linkedInRestHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export type LinkedInVideoUploadInit = {
  uploadUrn: string;
  uploadUrl: string;
  uploadInstructions: Record<string, unknown>;
};

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

  const json = await res.json().catch(() => ({})) as {
    value?: {
      video?: string;
      uploadUrl?: string;
      uploadInstructions?: Record<string, unknown>;
    };
    message?: string;
  };

  if (!res.ok) {
    throw new Error(`linkedin_video_init HTTP ${res.status}: ${json.message ?? "unknown"}`);
  }

  const uploadUrn = String(json.value?.video ?? "").trim();
  const uploadUrl = String(json.value?.uploadUrl ?? "").trim();
  if (!uploadUrn || !uploadUrl) throw new Error("linkedin_video_init_missing_fields");

  return {
    uploadUrn,
    uploadUrl,
    uploadInstructions: json.value?.uploadInstructions ?? {},
  };
}

export async function uploadLinkedInVideoBytes(
  uploadUrl: string,
  accessToken: string,
  videoBytes: Uint8Array,
  mimeType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
      "Content-Length": String(videoBytes.byteLength),
    },
    body: videoBytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`linkedin_video_upload HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function finalizeLinkedInVideoUpload(
  accessToken: string,
  uploadUrn: string,
  uploadInstructions: Record<string, unknown>,
): Promise<void> {
  const uploadToken = String(uploadInstructions.uploadToken ?? "").trim();
  if (!uploadToken) return;

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/videos?action=finalizeUpload`, {
    method: "POST",
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: uploadUrn,
        uploadToken,
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
