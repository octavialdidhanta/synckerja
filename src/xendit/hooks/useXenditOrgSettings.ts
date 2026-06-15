import { useQuery } from "@tanstack/react-query";
import { fetchXenditSettings } from "@/xendit/lib/xenditApi";

export function useXenditOrgSettings(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["xendit-settings", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      return fetchXenditSettings(organizationId);
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });
}
