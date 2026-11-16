import { supabase } from "@/shared/lib/supabaseClient";

export const STORY_BUCKET = "social-media-story";

export function storyExportPublicUrl(storagePath: string): string {
  const path = String(storagePath ?? "").trim();
  if (!path) return "";
  return supabase.storage.from(STORY_BUCKET).getPublicUrl(path).data.publicUrl;
}
