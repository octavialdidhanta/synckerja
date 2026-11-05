import { graphUrl } from "../metaContentAuth.ts";

const CAROUSEL_BUCKET = "social-media-carousel";
const IG_CAPTION_LIMIT = 2200;

export function publicCarouselImageUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const encoded = storagePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/storage/v1/object/public/${CAROUSEL_BUCKET}/${encoded}`;
}

export function instagramCarouselImageUrls(storagePaths: string[]): string[] {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!supabaseUrl) throw new Error("supabase_url_missing");
  return storagePaths.map((storagePath) => publicCarouselImageUrl(supabaseUrl, storagePath));
}

async function readGraphId(res: Response, label: string): Promise<string> {
  const json = await res.json().catch(() => ({})) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    throw new Error(
      `${label} HTTP ${res.status}: ${json.error?.message ?? "unknown"}`,
    );
  }
  return String(json.id);
}

export async function createInstagramPhotoContainer(
  igBusinessAccountId: string,
  pageAccessToken: string,
  args: { imageUrl: string; caption?: string; carouselItem?: boolean },
): Promise<{ containerId: string }> {
  const params: Record<string, string> = {
    access_token: pageAccessToken,
    image_url: args.imageUrl,
  };
  if (args.carouselItem) {
    params.is_carousel_item = "true";
  } else if (args.caption?.trim()) {
    params.caption = args.caption.trim().slice(0, IG_CAPTION_LIMIT);
  }

  const res = await fetch(graphUrl(`${igBusinessAccountId}/media`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return { containerId: await readGraphId(res, "meta_ig_photo_container") };
}

export async function createInstagramCarouselContainer(
  igBusinessAccountId: string,
  pageAccessToken: string,
  args: { childIds: string[]; caption: string },
): Promise<{ containerId: string }> {
  if (args.childIds.length < 2 || args.childIds.length > 10) {
    throw new Error("instagram_carousel_count");
  }
  const res = await fetch(graphUrl(`${igBusinessAccountId}/media`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      media_type: "CAROUSEL",
      children: args.childIds.join(","),
      caption: args.caption.trim().slice(0, IG_CAPTION_LIMIT),
    }),
  });
  return { containerId: await readGraphId(res, "meta_ig_carousel_container") };
}
