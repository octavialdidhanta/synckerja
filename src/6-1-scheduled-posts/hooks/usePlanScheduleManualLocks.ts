import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type PlanScheduleManualLock = {
  id: string;
  organization_id: string;
  social_media_plan_id: string;
  platform: string;
  platform_account_id: string;
  locked_at: string;
  locked_by: string | null;
};

export function usePlanScheduleManualLocks(planId: string | undefined) {
  return useQuery({
    queryKey: ['plan-schedule-manual-locks', planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<PlanScheduleManualLock[]> => {
      const { data, error } = await supabase
        .from('social_media_plan_schedule_manual_locks')
        .select('*')
        .eq('social_media_plan_id', planId!);
      if (error) throw error;
      return (data ?? []) as PlanScheduleManualLock[];
    },
  });
}

export function useUpsertPlanScheduleManualLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      planId: string;
      platform: string;
      accountId: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('social_media_plan_schedule_manual_locks').upsert(
        {
          organization_id: args.organizationId,
          social_media_plan_id: args.planId,
          platform: args.platform.trim(),
          platform_account_id: args.accountId.trim(),
          locked_by: user?.id ?? null,
        },
        { onConflict: 'social_media_plan_id,platform,platform_account_id' },
      );

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['plan-schedule-manual-locks', variables.planId],
      });
    },
  });
}
