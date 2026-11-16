import { graphUrl } from "../metaContentAuth.ts";

export type FacebookPagePhotoStoryResult = {
  success: boolean;
  postId: string;
};

/** Publish an unpublished Page photo as a Facebook Page Story. */
export async function publishFacebookPagePhotoStory(
  pageId: string,
  pageAccessToken: string,
  photoId: string,
): Promise<FacebookPagePhotoStoryResult> {
  const id = String(photoId ?? "").trim();
  if (!id) throw new Error("facebook_story_photo_id_missing");

  const res = await fetch(graphUrl(`${pageId}/photo_stories`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      photo_id: id,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const json = await res.json().catch(() => ({})) as {
    success?: boolean;
    post_id?: string | number;
    error?: { message?: string };
  };

  if (!res.ok || json.success !== true) {
    throw new Error(
      `meta_fb_photo_stories HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }

  const postId = String(json.post_id ?? "").trim();
  if (!postId) throw new Error("meta_fb_photo_stories_missing_post_id");
  return { success: true, postId };
}

export function buildFacebookStoryUrl(postId: string): string {
  return `https://www.facebook.com/stories/${encodeURIComponent(postId)}`;
}
