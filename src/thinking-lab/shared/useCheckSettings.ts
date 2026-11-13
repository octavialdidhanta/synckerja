import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseCheckSettings } from "./checkSettings";

export const checkSettingsKey = (organizationId: string | null) => ["thinking-lab-check-settings", organizationId] as const;

export type CheckSettingsState = { checks: Record<string, boolean>; canEdit: boolean };

function readState(value: unknown): CheckSettingsState {
  const row = value && typeof value === "object" ? (value as { checks?: unknown; can_edit?: unknown }) : {};
  return { checks: parseCheckSettings(row.checks), canEdit: row.can_edit === true };
}

export function useCheckSettings(organizationId: string | null) {
  return useQuery({
    queryKey: checkSettingsKey(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CheckSettingsState> => {
      // Not in the generated types yet.
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: unknown; error: Error | null }>)(
        "thinking_lab_check_settings_get",
        { p_organization_id: organizationId },
      );
      if (error) throw error;
      return readState(data);
    },
  });
}

export function useSaveCheckSettings(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (checks: Record<string, boolean>): Promise<CheckSettingsState> => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: unknown; error: Error | null }>)(
        "thinking_lab_check_settings_set",
        { p_organization_id: organizationId, p_checks: checks },
      );
      if (error) throw error;
      return readState(data);
    },
    onMutate: async (checks) => {
      const key = checkSettingsKey(organizationId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CheckSettingsState>(key);
      queryClient.setQueryData<CheckSettingsState>(key, { checks, canEdit: previous?.canEdit ?? true });
      return { previous };
    },
    onError: (_error, _checks, context) => {
      if (context?.previous) queryClient.setQueryData(checkSettingsKey(organizationId), context.previous);
    },
    onSuccess: (state) => {
      queryClient.setQueryData(checkSettingsKey(organizationId), state);
    },
  });
}
