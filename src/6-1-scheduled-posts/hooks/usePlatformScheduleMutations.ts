import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { invalidatePlanPublishQueries } from '../lib/invalidatePlanPublishQueries';
import { syncPlanCompletionStateClient } from '../lib/syncPlanCompletionStateClient';

export type PlatformPublishFunction =
  | 'tiktok-content-publish'
  | 'youtube-content-publish'
  | 'meta-content-publish'
  | 'linkedin-content-publish';

async function invokePlatformPublish(
  functionName: PlatformPublishFunction,
  body: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

export function usePlatformScheduleMutations(functionName: PlatformPublishFunction) {
  const queryClient = useQueryClient();

  const onSuccess = async (planId: string, organizationId: string) => {
    await syncPlanCompletionStateClient(planId);
    await invalidatePlanPublishQueries(queryClient, { organizationId, planId });
  };

  const scheduleMutation = useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      invokePlatformPublish(functionName, { action: 'schedule', ...args }),
    onSuccess: (_data, vars) => {
      void onSuccess(
        String(vars.social_media_plan_id ?? vars.planId),
        String(vars.organization_id ?? vars.organizationId),
      );
    },
  });

  const postNowMutation = useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      invokePlatformPublish(functionName, { action: 'post_now', ...args }),
    onSuccess: (_data, vars) => {
      void onSuccess(
        String(vars.social_media_plan_id ?? vars.planId),
        String(vars.organization_id ?? vars.organizationId),
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (args: {
      organizationId: string;
      scheduleId: string;
      planId: string;
    }) =>
      invokePlatformPublish(functionName, {
        action: 'cancel',
        organization_id: args.organizationId,
        schedule_id: args.scheduleId,
        social_media_plan_id: args.planId,
      }),
    onSuccess: (_data, vars) => {
      void onSuccess(vars.planId, vars.organizationId);
    },
  });

  return { scheduleMutation, postNowMutation, cancelMutation };
}
