import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { listLabCreativeIdeas } from "@/thinking-lab/creative-idea/repository";

export function creativeIdeaKey(organizationId: string | null, ideaId: string | null) {
  return ["thinking-lab-creative-ideas", organizationId, ideaId] as const;
}

export function useLabCreativeIdeas(ideaId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: creativeIdeaKey(organizationId, ideaId),
    queryFn: () => listLabCreativeIdeas(organizationId as string, ideaId as string),
    enabled: Boolean(organizationId && ideaId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return { ...query, organizationId, queryClient };
}
