import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectOrgDrive,
  fetchOrgDriveSettings,
  listContentPlanMediaVersions,
  startOrgDriveOAuth,
} from "./orgDriveApi";

export const orgDriveSettingsKey = (organizationId: string | null | undefined) => ["org-drive-settings", organizationId];
export const planMediaVersionsKey = (planId: string | null | undefined) => ["content-plan-media-versions", planId];

export function useOrgDriveSettings(organizationId: string | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = orgDriveSettingsKey(organizationId);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchOrgDriveSettings(organizationId as string),
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
  });
  const connect = useMutation({
    mutationFn: () => startOrgDriveOAuth(organizationId as string),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectOrgDrive(organizationId as string),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });
  return { ...query, connect, disconnect };
}

export function usePlanMediaVersions(planId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: planMediaVersionsKey(planId),
    queryFn: () => listContentPlanMediaVersions(planId as string),
    enabled: Boolean(planId) && enabled,
    staleTime: 15_000,
  });
}
