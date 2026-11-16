const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_API_VERSION = "202610";
const IMAGE_READY_MAX_WAIT_MS = 60_000;
const IMAGE_READY_INTERVAL_MS = 1_500;
const IMAGE_UPLOAD_TIMEOUT_MS = 120_000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 60_000;

function linkedInRestHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

type InitializeImageUploadResponse = {
  value?: {
    image?: string;
    uploadUrl?: string;
  };
  message?: string;
};

export type LinkedInImageUploadInit = {
  imageUrn: string;
  uploadUrl: string;
};

export async function initializeLinkedInImageUpload(
  accessToken: string,
  organizationUrn: string,
): Promise<LinkedInImageUploadInit> {
  const res = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: organizationUrn,
      },
    }),
  });
  const json = await res.json().catch(() => ({})) as InitializeImageUploadResponse;
  const imageUrn = String(json.value?.image ?? "").trim();
  const uploadUrl = String(json.value?.uploadUrl ?? "").trim();
  if (!res.ok || !imageUrn || !uploadUrl) {
    throw new Error(
      `linkedin_image_init HTTP ${res.status}: ${json.message ?? "unknown"}`,
    );
  }
  return { imageUrn, uploadUrl };
}

export async function uploadLinkedInImageBytes(
  uploadUrl: string,
  accessToken: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: bytes,
    signal: AbortSignal.timeout(IMAGE_UPLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `linkedin_image_upload HTTP ${res.status}: ${text.slice(0, 200) || "unknown"}`,
    );
  }
}

type ImageStatusResponse = {
  status?: string;
  message?: string;
};

export async function waitForLinkedInImageAvailable(
  accessToken: string,
  imageUrn: string,
  opts?: { onTick?: () => void },
): Promise<void> {
  const encoded = encodeURIComponent(imageUrn);
  const started = Date.now();
  while (Date.now() - started < IMAGE_READY_MAX_WAIT_MS) {
    opts?.onTick?.();
    const res = await fetch(`${LINKEDIN_API_BASE}/rest/images/${encoded}`, {
      method: "GET",
      headers: linkedInRestHeaders(accessToken),
    });
    const json = await res.json().catch(() => ({})) as ImageStatusResponse;
    const status = String(json.status ?? "").toUpperCase();
    if (status === "AVAILABLE") return;
    if (status === "PROCESSING_FAILED") {
      throw new Error(`linkedin_image_processing_failed: ${json.message ?? imageUrn}`);
    }
    await new Promise((r) => setTimeout(r, IMAGE_READY_INTERVAL_MS));
  }
  throw new Error(`linkedin_image_not_ready: ${imageUrn}`);
}

export async function downloadCarouselImageBytes(
  imageUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(imageUrl, {
    method: "GET",
    signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`linkedin_carousel_image_download HTTP ${res.status}`);
  }
  const contentType = String(res.headers.get("content-type") ?? "image/jpeg")
    .split(";")[0]
    .trim() || "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 1) throw new Error("linkedin_carousel_image_empty");
  return { bytes: buf, contentType };
}

async function createLinkedInPostsApiPost(
  accessToken: string,
  organizationUrn: string,
  commentary: string,
  content: Record<string, unknown>,
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
      content,
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

export async function createLinkedInImagePost(
  accessToken: string,
  organizationUrn: string,
  imageUrn: string,
  commentary: string,
): Promise<{ postUrn: string }> {
  return createLinkedInPostsApiPost(accessToken, organizationUrn, commentary, {
    media: {
      title: "Image",
      id: imageUrn,
    },
  });
}

export async function createLinkedInMultiImagePost(
  accessToken: string,
  organizationUrn: string,
  imageUrns: string[],
  commentary: string,
): Promise<{ postUrn: string }> {
  if (imageUrns.length < 2) {
    throw new Error("linkedin_multi_image_requires_2");
  }
  return createLinkedInPostsApiPost(accessToken, organizationUrn, commentary, {
    multiImage: {
      images: imageUrns.map((id) => ({ id })),
    },
  });
}
