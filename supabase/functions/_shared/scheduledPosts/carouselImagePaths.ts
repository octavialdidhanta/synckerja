import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CAROUSEL_PUBLISH_IMAGE_LIMIT,
  carouselMediaSnapshot,
} from "../tiktokCarouselImageUrl.ts";

export async function loadCarouselStoragePaths(
  admin: SupabaseClient,
  planId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("social_media_plan_carousel_images")
    .select("storage_path")
    .eq("social_media_plan_id", planId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("carousel_images_load_failed");
  return (data ?? [])
    .map((row) => String((row as { storage_path?: string }).storage_path ?? "").trim())
    .filter(Boolean);
}

export function assertCarouselPublishPaths(storagePaths: string[]): string[] {
  if (storagePaths.length < 1) throw new Error("carousel_images");
  if (storagePaths.length > CAROUSEL_PUBLISH_IMAGE_LIMIT) throw new Error("carousel_image_limit");
  return storagePaths;
}

export { carouselMediaSnapshot };
