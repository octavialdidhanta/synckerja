import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { ScriptMedium } from "@/thinking-lab/execution/script";

export function usePillarMediumDefaults(organizationId: string | null) {
  return useQuery({
    queryKey: ["thinking-lab-pillar-defaults", organizationId],
    queryFn: async (): Promise<Record<string, ScriptMedium>> => {
      if (!organizationId) return {};
      const { data, error } = await supabase
        .from("thinking_lab_pillar_defaults")
        .select("content_pillar_id, medium")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const defaults: Record<string, ScriptMedium> = {};
      for (const row of data ?? []) {
        const id = typeof row.content_pillar_id === "string" ? row.content_pillar_id : "";
        if (!id || (row.medium !== "image" && row.medium !== "video")) continue;
        defaults[id] = row.medium;
      }
      return defaults;
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export async function savePillarMediumDefault(
  organizationId: string,
  contentPillarId: string,
  medium: ScriptMedium,
): Promise<void> {
  const { error } = await supabase.from("thinking_lab_pillar_defaults").upsert(
    {
      organization_id: organizationId,
      content_pillar_id: contentPillarId,
      medium,
    },
    { onConflict: "organization_id,content_pillar_id" },
  );
  if (error) throw error;
}
