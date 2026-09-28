import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { labIdeaKey } from "@/thinking-lab/shared/queryKeys";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import { insertLabIdea, listLabIdeas, loadIdeaSet, lockLabIdeas, replaceLabIdea, saveIdeaSet } from "@/thinking-lab/idea/repository";
import type { IdeaSetRecord } from "@/thinking-lab/idea/setAudit";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";

export function useLabIdeas(angleIds: string[]) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const ids = [...angleIds].sort();
  const query = useQuery({
    queryKey: labIdeaKey(organizationId, ids),
    queryFn: () => listLabIdeas(organizationId as string, ids),
    enabled: Boolean(organizationId && ids.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const insert = useMutation({
    mutationFn: (input: {
      angleId: string;
      expectedTerritoryId?: string;
      masterThoughtFingerprint: string | null;
      code: string;
      statement: string;
      sortOrder: number;
      facts: IdeaSemanticFacts;
      admission: IndividualAdmission;
    }) => insertLabIdea({ organizationId: organizationId as string, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-ideas", organizationId] });
    },
  });
  const replace = useMutation({
    mutationFn: (input: {
      angleId: string;
      id: string;
      statement: string;
      facts: IdeaSemanticFacts;
      admission: IndividualAdmission;
    }) => replaceLabIdea({ organizationId: organizationId as string, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-ideas", organizationId] });
    },
  });
  return { ...query, organizationId, insert, replace };
}

export function useIdeaSet(angleId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["thinking-lab-idea-set", organizationId, angleId],
    queryFn: () => loadIdeaSet(organizationId as string, angleId as string),
    enabled: Boolean(organizationId && angleId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    mutationFn: (record: IdeaSetRecord) =>
      saveIdeaSet({
        organizationId: organizationId as string,
        angleId: angleId as string,
        record,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-idea-set", organizationId, angleId] });
    },
  });
  const lock = useMutation({
    mutationFn: (input: { angleFingerprint: string; ids: string[] }) =>
      lockLabIdeas({
        organizationId: organizationId as string,
        angleId: angleId as string,
        angleFingerprint: input.angleFingerprint,
        ids: input.ids,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-ideas", organizationId] });
    },
  });
  return { ...query, save, lock };
}
