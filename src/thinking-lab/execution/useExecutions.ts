import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  countLabExecutionsByIdea,
  deleteLabExecution,
  listLabExecutions,
  saveLabExecution,
  updateLabExecutionScript,
  type LabExecution,
} from "@/thinking-lab/execution/repository";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

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
    mutationFn: (input: {
      ideaId: string;
      pillar: string;
      contentPillarId?: string | null;
      pillarName: string;
      statement: string;
      script?: VoiceOverScript | null;
      facts: ExecutionSemanticFacts;
    }) => saveLabExecution({ organizationId: organizationId as string, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-executions", organizationId] });
    },
  });
  const patchScript = useMutation({
    mutationFn: (input: { id: string; script: VoiceOverScript }) =>
      updateLabExecutionScript(organizationId as string, input.id, input.script),
    onSuccess: (saved) => {
      queryClient.setQueryData<LabExecution[] | undefined>(
        ["thinking-lab-executions", organizationId, ideaId],
        (current) => (current ?? []).map((row) => (row.id === saved.id ? saved : row)),
      );
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteLabExecution(organizationId as string, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-executions", organizationId] });
    },
  });
  return { ...query, organizationId, save, patchScript, remove };
}

export function useLabExecutionCounts(ideaIds: string[]) {
  const { organizationId } = useCurrentOrg();
  const ids = [...new Set(ideaIds)].sort();
  const query = useQuery({
    queryKey: ["thinking-lab-executions", organizationId, "counts", ids],
    queryFn: () => countLabExecutionsByIdea(organizationId as string, ids),
    enabled: Boolean(organizationId && ids.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return query.data ?? {};
}
