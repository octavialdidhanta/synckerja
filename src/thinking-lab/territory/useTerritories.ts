import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { labTerritoryKey } from "@/thinking-lab/shared/queryKeys";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import {
  deleteLabTerritory,
  insertLabTerritory,
  listLabTerritories,
  loadTerritorySet,
  lockLabTerritories,
  replaceLabTerritory,
  saveTerritorySet,
} from "@/thinking-lab/territory/repository";
import type { TerritorySetRecord } from "@/thinking-lab/territory/setAudit";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

export function useLabTerritories(bigThoughtIds: string[]) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const ids = [...bigThoughtIds].sort();
  const query = useQuery({
    queryKey: labTerritoryKey(organizationId, ids),
    queryFn: () => listLabTerritories(organizationId as string, ids),
    enabled: Boolean(organizationId && ids.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const insert = useMutation({
    mutationFn: (input: {
      bigThoughtId: string;
      masterThoughtFingerprint: string | null;
      code: string;
      statement: string;
      sortOrder: number;
      facts: TerritorySemanticFacts;
      admission: IndividualAdmission;
    }) =>
      insertLabTerritory({
        organizationId: organizationId as string,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territories", organizationId] });
    },
  });

  const remove = useMutation({
    mutationFn: (input: { bigThoughtId: string; id: string }) =>
      deleteLabTerritory({
        organizationId: organizationId as string,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territories", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-angles", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territory-set", organizationId] });
    },
  });

  const replace = useMutation({
    mutationFn: (input: {
      bigThoughtId: string;
      id: string;
      statement: string;
      facts: TerritorySemanticFacts;
      admission: IndividualAdmission;
    }) =>
      replaceLabTerritory({
        organizationId: organizationId as string,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territories", organizationId] });
    },
  });

  return { ...query, organizationId, insert, remove, replace };
}

export function useTerritorySet(bigThoughtId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["thinking-lab-territory-set", organizationId, bigThoughtId],
    queryFn: () => loadTerritorySet(organizationId as string, bigThoughtId as string),
    enabled: Boolean(organizationId && bigThoughtId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    mutationFn: (record: TerritorySetRecord) =>
      saveTerritorySet({
        organizationId: organizationId as string,
        bigThoughtId: bigThoughtId as string,
        record,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territory-set", organizationId, bigThoughtId] });
    },
  });
  const lock = useMutation({
    mutationFn: (input: { bigThoughtFingerprint: string; ids: string[] }) =>
      lockLabTerritories({
        organizationId: organizationId as string,
        bigThoughtId: bigThoughtId as string,
        bigThoughtFingerprint: input.bigThoughtFingerprint,
        ids: input.ids,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territories", organizationId] });
    },
  });
  return { ...query, save, lock };
}
