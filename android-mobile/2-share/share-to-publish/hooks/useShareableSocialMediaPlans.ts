import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  SHAREABLE_PLAN_SELECT,
  sortShareablePlans,
  type ShareableSocialMediaPlan,
} from "../lib/buildSharePlanQuery";

export function useShareableSocialMediaPlans(args: {
  organizationId: string | null | undefined;
  currentEmployeeId?: string;
  search?: string;
}) {
  const { organizationId, currentEmployeeId, search } = args;
  const q = (search ?? "").trim().toLowerCase();

  return useQuery({
    queryKey: ["shareToPublishPlans", organizationId, currentEmployeeId ?? null, q],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ShareableSocialMediaPlan[]> => {
      if (!organizationId) return [];

      let query = supabase
        .from("social_media_plans")
        .select(SHAREABLE_PLAN_SELECT)
        .eq("organization_id", organizationId)
        .not("service_id", "is", null)
        .order("post_date", { ascending: false })
        .limit(80);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as ShareableSocialMediaPlan[];
      const filtered = q
        ? rows.filter((p) => {
            const hay = [
              p.title,
              p.service?.name,
              p.content_type?.name,
              p.pic?.full_name,
              p.post_date,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          })
        : rows;

      return sortShareablePlans(filtered, currentEmployeeId);
    },
  });
}
