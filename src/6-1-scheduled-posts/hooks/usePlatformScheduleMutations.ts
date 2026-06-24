import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { useInvalidateScheduledPosts } from './useScheduledPostsByPlan';

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
  const invalidate = useInvalidateScheduledPosts();
  const queryClient = useQueryClient();

  const onSuccess = (planId: string, organizationId: string) => {
    invalidate(planId, organizationId);
    queryClient.invalidateQueries({ queryKey: ['content-plans'] });
    queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
    queryClient.invalidateQueries({ queryKey: ['socialMediaLinks', planId] });
    queryClient.invalidateQueries({ queryKey: ['all-social-media-links'] });
  };

  const scheduleMutation = useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      invokePlatformPublish(functionName, { action: 'schedule', ...args }),
    onSuccess: (_data, vars) => {
      onSuccess(
        String(vars.social_media_plan_id ?? vars.planId),
        String(vars.organization_id ?? vars.organizationId),
      );
    },
  });

  const postNowMutation = useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      invokePlatformPublish(functionName, { action: 'post_now', ...args }),
    onSuccess: (_data, vars) => {
      onSuccess(
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
      invalidate(vars.planId, vars.organizationId);
    },
  });

  return { scheduleMutation, postNowMutation, cancelMutation };
}
