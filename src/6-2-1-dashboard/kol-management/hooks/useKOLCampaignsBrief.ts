import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

/** Jumlah kampanye aktif / selesai untuk ringkasan dashboard (satu query ringan). */
export const useKOLCampaignsBrief = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ["kol-campaigns-brief", organizationId],
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!organizationId) return { active: 0, completed: 0 };

      const { data, error } = await supabase.from("kol_campaigns").select("status").eq("organization_id", organizationId);

      if (error) throw error;

      const rows = data || [];
      return {
        active: rows.filter((r: { status?: string }) => r.status === "active").length,
        completed: rows.filter((r: { status?: string }) => r.status === "completed").length,
      };
    },
  });
};
