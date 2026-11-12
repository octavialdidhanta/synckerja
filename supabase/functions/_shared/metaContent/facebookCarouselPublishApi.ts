import { graphUrl } from "../metaContentAuth.ts";
import { publicCarouselImageUrl } from "./instagramCarouselPublishApi.ts";

const FB_MESSAGE_LIMIT = 5000;

export type FacebookPagePhotoResult = {
  photoId: string;
  postId: string | null;
};

export function facebookCarouselImageUrls(storagePaths: string[]): string[] {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!supabaseUrl) throw new Error("supabase_url_missing");
  return storagePaths.map((storagePath) => publicCarouselImageUrl(supabaseUrl, storagePath));
}

/** Form fields for a Page feed post that attaches already uploaded photos. */
export function facebookAttachedMediaFields(photoIds: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  photoIds.forEach((photoId, index) => {
    const id = photoId.trim();
    if (!id) throw new Error("facebook_photo_id_missing");
    fields[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
  });
  return fields;
}

export function buildFacebookPhotoPostUrl(postId: string): string {
  return `https://www.facebook.com/${postId}`;
}

async function readGraphId(res: Response, label: string): Promise<{ id: string; postId: string | null }> {
  const json = await res.json().catch(() => ({})) as {
    id?: string;
    post_id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    throw new Error(
      `${label} HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }
  const postId = String(json.post_id ?? "").trim();
  return { id: String(json.id), postId: postId || null };
}

export async function uploadFacebookPagePhoto(
  pageId: string,
  pageAccessToken: string,
  args: { imageUrl: string; published: boolean; caption?: string },
): Promise<FacebookPagePhotoResult> {
  const params: Record<string, string> = {
    access_token: pageAccessToken,
    url: args.imageUrl,
    published: args.published ? "true" : "false",
  };
  if (args.published && args.caption?.trim()) {
    params.caption = args.caption.trim().slice(0, FB_MESSAGE_LIMIT);
  }

  const res = await fetch(graphUrl(`${pageId}/photos`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(45_000),
  });
  const created = await readGraphId(res, "meta_fb_photo");
  return { photoId: created.id, postId: created.postId };
}

export async function publishFacebookMultiPhotoPost(
  pageId: string,
  pageAccessToken: string,
  args: { photoIds: string[]; message: string },
): Promise<{ postId: string }> {
  if (args.photoIds.length < 1 || args.photoIds.length > 10) {
    throw new Error("facebook_carousel_count");
  }
  const res = await fetch(graphUrl(`${pageId}/feed`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      message: args.message.trim().slice(0, FB_MESSAGE_LIMIT),
      ...facebookAttachedMediaFields(args.photoIds),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const created = await readGraphId(res, "meta_fb_feed");
  return { postId: created.postId ?? created.id };
}

export async function fetchFacebookPostPermalink(
  postId: string,
  pageAccessToken: string,
): Promise<string | null> {
  const url = graphUrl(postId, { fields: "permalink_url" });
  const res = await fetch(`${url}&access_token=${encodeURIComponent(pageAccessToken)}`);
  const json = await res.json().catch(() => ({})) as { permalink_url?: string };
  const permalink = json.permalink_url?.trim() ?? "";
  if (!permalink) return null;
  if (permalink.startsWith("http://") || permalink.startsWith("https://")) return permalink;
  return `https://www.facebook.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;
}
