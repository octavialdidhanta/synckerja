import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { listLabExecutions, saveLabExecution } from "@/thinking-lab/execution/repository";
import type { ExecutionPillar, ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

export function useLabExecutions(ideaId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["thinking-lab-executions", organizationId, ideaId],
    queryFn: () => listLabExecutions(organizationId as string, ideaId as string),
    enabled: Boolean(organizationId && ideaId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    mutationFn: (input: { ideaId: string; pillar: ExecutionPillar; statement: string; facts: ExecutionSemanticFacts }) =>
      saveLabExecution({ organizationId: organizationId as string, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-executions", organizationId, ideaId] });
    },
  });
  return { ...query, organizationId, save };
}
