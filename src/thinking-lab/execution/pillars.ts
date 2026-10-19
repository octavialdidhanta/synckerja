import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type ContentPillarFunnel = "top" | "middle" | "bottom";

export type LabContentPillar = {
  id: string;
  name: string;
  funnel: ContentPillarFunnel;
  category: string | null;
  description?: string | null;
  isDefault: boolean;
};

export function contentPillarFunnel(value: string | null | undefined): ContentPillarFunnel {
  if (value === "middle" || value === "bottom") return value;
  return "top";
}

export function groupContentPillars(pillars: LabContentPillar[]): Array<{ funnel: ContentPillarFunnel; items: LabContentPillar[] }> {
  const order: ContentPillarFunnel[] = ["top", "middle", "bottom"];
  return order.flatMap((funnel) => {
    const items = pillars.filter((pillar) => pillar.funnel === funnel);
    return items.length > 0 ? [{ funnel, items }] : [];
  });
}

export function useOrgContentPillars(organizationId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["thinking-lab-content-pillars", organizationId],
    queryFn: async (): Promise<LabContentPillar[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("content_pillars")
        .select("id, name, is_active, organization_id, is_default, funnel_stage, category, description")
        .or(`is_default.eq.true,organization_id.eq.${organizationId}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).flatMap((row) => {
        const name = typeof row.name === "string" ? row.name.trim() : "";
        if (!name || seen.has(name.toLowerCase())) return [];
        seen.add(name.toLowerCase());
        return [
          {
            id: row.id,
            name,
            funnel: contentPillarFunnel(row.funnel_stage),
            category: typeof row.category === "string" && row.category.trim() ? row.category.trim() : null,
            description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : null,
            isDefault: row.is_default === true,
          },
        ];
      });
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
