import { supabase } from "@/shared/lib/supabaseClient";

export const STORY_BUCKET = "social-media-story";

export function storyExportPublicUrl(storagePath: string, cacheBust?: string | number | null): string {
  const path = String(storagePath ?? "").trim();
  if (!path) return "";
  const base = supabase.storage.from(STORY_BUCKET).getPublicUrl(path).data.publicUrl;
  const bust = String(cacheBust ?? "").trim();
  if (!bust) return base;
  return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(bust)}`;
}
