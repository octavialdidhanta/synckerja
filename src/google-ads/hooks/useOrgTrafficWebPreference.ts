import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export function useOrgTrafficWebPreference(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["org-traffic-web-preference", organizationId];

  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_traffic_web_preferences")
        .select("default_web_id")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      const raw = data?.default_web_id;
      return raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
    },
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: async (defaultWebId: string) => {
      if (!organizationId) throw new Error("No organization");
      const trimmed = defaultWebId.trim();
      const { error } = await supabase.from("organization_traffic_web_preferences").upsert(
        {
          organization_id: organizationId,
          default_web_id: trimmed || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      return trimmed;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    defaultWebId: query.data ?? "",
    isLoading: query.isPending,
    save,
  };
}
