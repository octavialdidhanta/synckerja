import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { labMasterKey } from "@/thinking-lab/master-thought/useMasterThought";
import {
  deleteLabBigThought,
  insertLabBigThought,
  listLabBigThoughts,
  listLockedLabBigThoughts,
  lockLabBigThoughts,
  rejectLabBigThought,
  unlockLabBigThoughts,
  updateLabBigThoughtFacts,
  updateLabBigThoughtLabels,
} from "@/thinking-lab/big-thought/repository";
import type { BigThoughtFacts, LabBigThought } from "@/thinking-lab/big-thought/types";
import { labLockedTreeKey } from "@/thinking-lab/shared/queryKeys";

export const labBigThoughtKey = (organizationId: string | null, masterThoughtId: string | null) =>
  ["thinking-lab-big-thoughts", organizationId, masterThoughtId] as const;

export function useBigThoughts(masterThoughtId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: labBigThoughtKey(organizationId, masterThoughtId),
    queryFn: () => listLabBigThoughts(organizationId as string, masterThoughtId as string),
    enabled: Boolean(organizationId && masterThoughtId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: labBigThoughtKey(organizationId, masterThoughtId) });
    await queryClient.invalidateQueries({ queryKey: labMasterKey(organizationId) });
    await queryClient.invalidateQueries({ queryKey: labLockedTreeKey(organizationId) });
  };

  const insert = useMutation({
    mutationFn: (input: {
      code: string;
      statement: string;
      label?: string;
      sortOrder: number;
      facts: BigThoughtFacts;
      masterFingerprint: string;
    }) =>
      insertLabBigThought({
        organizationId: organizationId as string,
        masterThoughtId: masterThoughtId as string,
        ...input,
      }),
    onSuccess: invalidate,
  });

  const updateFacts = useMutation({
    mutationFn: (input: {
      id: string;
      statement: string;
      label?: string;
      facts: BigThoughtFacts;
      masterFingerprint: string;
    }) =>
      updateLabBigThoughtFacts({
        ...input,
        organizationId: organizationId as string,
        masterThoughtId: masterThoughtId as string,
      }),
    onSuccess: invalidate,
  });

  const saveLabels = useMutation({
    mutationFn: (labels: Array<{ id: string; label: string }>) =>
      updateLabBigThoughtLabels({
        organizationId: organizationId as string,
        masterThoughtId: masterThoughtId as string,
        labels,
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLabBigThought(id, organizationId as string, masterThoughtId as string),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territories", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-angles", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-territory-set", organizationId] });
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      rejectLabBigThought(id, organizationId as string, masterThoughtId as string),
    onSuccess: invalidate,
  });

  const lockMany = useMutation({
    mutationFn: (ids: string[]) =>
      lockLabBigThoughts(ids, organizationId as string, masterThoughtId as string),
    onSuccess: async (_void, ids) => {
      const lockedIds = new Set(ids);
      queryClient.setQueryData<LabBigThought[]>(labBigThoughtKey(organizationId, masterThoughtId), (prev) =>
        (prev ?? []).map((row) => (lockedIds.has(row.id) ? { ...row, status: "locked" } : row)),
      );
      await invalidate();
    },
  });

  const unlockAll = useMutation({
    mutationFn: () => unlockLabBigThoughts(masterThoughtId as string, organizationId as string),
    onSuccess: async () => {
      queryClient.setQueryData<LabBigThought[]>(labBigThoughtKey(organizationId, masterThoughtId), (prev) =>
        (prev ?? []).map((row) => (row.status === "locked" ? { ...row, status: "candidate" } : row)),
      );
      await invalidate();
    },
  });

  return { ...query, organizationId, insert, updateFacts, saveLabels, remove, reject, lockMany, unlockAll };
}

export function useLockedLabTree() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: labLockedTreeKey(organizationId),
    queryFn: () => listLockedLabBigThoughts(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
