import { graphUrl } from "../metaContentAuth.ts";

const STORY_BUCKET = "social-media-story";

export function publicStoryImageUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const encoded = storagePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/storage/v1/object/public/${STORY_BUCKET}/${encoded}`;
}

export function instagramStoryImageUrl(storagePath: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!supabaseUrl) throw new Error("supabase_url_missing");
  const path = String(storagePath ?? "").trim();
  if (!path) throw new Error("story_export_path_missing");
  return publicStoryImageUrl(supabaseUrl, path);
}

/** Create an IG Stories image container (no caption — Meta STORIES does not support it). */
export async function createInstagramStoriesImageContainer(
  igBusinessAccountId: string,
  pageAccessToken: string,
  args: { imageUrl: string },
): Promise<{ containerId: string }> {
  const res = await fetch(graphUrl(`${igBusinessAccountId}/media`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      image_url: args.imageUrl,
      media_type: "STORIES",
    }),
  });

  const json = await res.json().catch(() => ({})) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    throw new Error(
      `meta_ig_stories_container HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }
  return { containerId: String(json.id) };
}
