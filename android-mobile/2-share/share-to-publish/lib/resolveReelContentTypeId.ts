import { supabase } from "@/shared/lib/supabaseClient";

/** Resolve org (or global) content_types row named Reel (case-insensitive). */
export async function resolveReelContentTypeId(
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("content_types")
    .select("id, name, organization_id")
    .eq("organization_id", organizationId)
    .ilike("name", "reel")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id;

  const { data: globalRow, error: globalErr } = await supabase
    .from("content_types")
    .select("id, name")
    .ilike("name", "reel")
    .limit(1)
    .maybeSingle();
  if (globalErr) throw globalErr;
  return globalRow?.id ?? null;
}
