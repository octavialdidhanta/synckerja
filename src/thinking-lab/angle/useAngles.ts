import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { labAngleKey } from "@/thinking-lab/shared/queryKeys";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import { insertLabAngle, listLabAngles, loadAngleSet, lockLabAngles, replaceLabAngle, saveAngleSet } from "@/thinking-lab/angle/repository";
import type { AngleSetRecord } from "@/thinking-lab/angle/setAudit";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

export function useLabAngles(territoryIds: string[]) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const ids = [...territoryIds].sort();
  const query = useQuery({
    queryKey: labAngleKey(organizationId, ids),
    queryFn: () => listLabAngles(organizationId as string, ids),
    enabled: Boolean(organizationId && ids.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const insert = useMutation({
    mutationFn: (input: {
      territoryId: string;
      expectedBigThoughtId?: string;
      masterThoughtFingerprint: string | null;
      code: string;
      statement: string;
      sortOrder: number;
      facts: AngleSemanticFacts;
      admission: IndividualAdmission;
    }) =>
      insertLabAngle({
        organizationId: organizationId as string,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-angles", organizationId] });
    },
  });

  const replace = useMutation({
    mutationFn: (input: {
      territoryId: string;
      id: string;
      statement: string;
      facts: AngleSemanticFacts;
      admission: IndividualAdmission;
    }) =>
      replaceLabAngle({
        organizationId: organizationId as string,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-angles", organizationId] });
    },
  });

  return { ...query, organizationId, insert, replace };
}

export function useAngleSet(territoryId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["thinking-lab-angle-set", organizationId, territoryId],
    queryFn: () => loadAngleSet(organizationId as string, territoryId as string),
    enabled: Boolean(organizationId && territoryId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    mutationFn: (record: AngleSetRecord) =>
      saveAngleSet({
        organizationId: organizationId as string,
        territoryId: territoryId as string,
        record,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-angle-set", organizationId, territoryId] });
    },
  });
  const lock = useMutation({
    mutationFn: (input: { territoryFingerprint: string; ids: string[] }) =>
      lockLabAngles({
        organizationId: organizationId as string,
        territoryId: territoryId as string,
        territoryFingerprint: input.territoryFingerprint,
        ids: input.ids,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-angles", organizationId] });
    },
  });
  return { ...query, save, lock };
}
