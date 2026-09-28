import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  confirmMasterThought,
  createLabMaster,
  deleteLabMaster,
  listLabMasters,
  lockLabMaster,
  saveLabSetRecord,
  saveOriginalInput,
  saveUnderstanding,
  unlockLabMaster,
} from "@/thinking-lab/master-thought/repository";
import type {
  ConfirmationSource,
  LabMasterThought,
  MasterBeliefInput,
  MasterThoughtFacts,
} from "@/thinking-lab/master-thought/types";
import { labLockedTreeKey } from "@/thinking-lab/shared/queryKeys";

export const labMasterKey = (organizationId: string | null) =>
  ["thinking-lab-masters", organizationId] as const;

export function useMasterThought() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: labMasterKey(organizationId),
    queryFn: () => listLabMasters(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: labMasterKey(organizationId) });
    await queryClient.invalidateQueries({ queryKey: labLockedTreeKey(organizationId) });
  };

  const create = useMutation({
    mutationFn: (input: MasterBeliefInput) => createLabMaster(organizationId as string, input),
    onSuccess: invalidate,
  });

  const saveOriginal = useMutation({
    mutationFn: (input: { id: string } & MasterBeliefInput) =>
      saveOriginalInput(input.id, organizationId as string, input),
    onSuccess: invalidate,
  });

  const saveJudge = useMutation({
    mutationFn: (input: { id: string; facts: MasterThoughtFacts; fingerprint: string }) =>
      saveUnderstanding(input.id, organizationId as string, input.facts, input.fingerprint),
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: (input: {
      id: string;
      statement: string;
      source: ConfirmationSource;
      facts: MasterThoughtFacts;
      fingerprint: string;
    }) => confirmMasterThought(input.id, organizationId as string, input),
    onSuccess: invalidate,
  });

  const saveSet = useMutation({
    mutationFn: (input: { id: string; lastAudit: unknown }) =>
      saveLabSetRecord(input.id, organizationId as string, input.lastAudit),
    onSuccess: invalidate,
  });

  const lock = useMutation({
    mutationFn: (id: string) => lockLabMaster(id, organizationId as string),
    onSuccess: async (_void, id) => {
      queryClient.setQueryData<LabMasterThought[]>(labMasterKey(organizationId), (prev) =>
        (prev ?? []).map((row) => (row.id === id ? { ...row, mtStatus: "locked", status: "locked" } : row)),
      );
      await invalidate();
    },
  });

  const unlock = useMutation({
    mutationFn: (id: string) => unlockLabMaster(id, organizationId as string),
    onSuccess: async (_void, id) => {
      queryClient.setQueryData<LabMasterThought[]>(labMasterKey(organizationId), (prev) =>
        (prev ?? []).map((row) =>
          row.id === id ? { ...row, mtStatus: "confirmed", status: "draft" } : row,
        ),
      );
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLabMaster(id, organizationId as string),
    onSuccess: (_void, id) => {
      queryClient.setQueryData<LabMasterThought[]>(labMasterKey(organizationId), (prev) =>
        (prev ?? []).filter((row) => row.id !== id),
      );
      queryClient.removeQueries({ queryKey: ["thinking-lab-big-thoughts", organizationId, id] });
      void queryClient.invalidateQueries({ queryKey: labMasterKey(organizationId) });
      void queryClient.invalidateQueries({ queryKey: labLockedTreeKey(organizationId) });
    },
  });

  const dataPending = Boolean(organizationId) && query.isLoading;
  return {
    ...query,
    organizationId,
    orgLoading,
    hasPendingLoad: orgLoading || dataPending,
    create,
    saveOriginal,
    saveJudge,
    confirm,
    saveSet,
    lock,
    unlock,
    remove,
  };
}
