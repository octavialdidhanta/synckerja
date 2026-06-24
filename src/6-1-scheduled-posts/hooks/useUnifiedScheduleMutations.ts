import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { buildPlatformPublishPayload, getEdgeFunctionForPlatform } from '../lib/buildPlatformPublishPayload';
import { invalidatePlanPublishQueries } from '../lib/invalidatePlanPublishQueries';
import { syncPlanCompletionStateClient } from '../lib/syncPlanCompletionStateClient';

async function invokePlatformPublish(
  platform: string,
  action: 'schedule' | 'post_now' | 'cancel',
  body: Record<string, unknown>,
) {
  const functionName = getEdgeFunctionForPlatform(platform);
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { action, ...body },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

export function useUnifiedScheduleMutations() {
  const queryClient = useQueryClient();

  const onSuccess = async (planId: string, organizationId: string) => {
    await syncPlanCompletionStateClient(planId);
    await invalidatePlanPublishQueries(queryClient, { organizationId, planId });
  };

  const scheduleMutation = useMutation({
    mutationFn: async (args: {
      platform: string;
      organizationId: string;
      planId: string;
      accountId: string;
      accountLabel: string;
      scheduledAtIso: string;
      caption: string;
      title?: string;
      employeeId?: string;
      privacyLevel?: string;
    }) => {
      const payload = buildPlatformPublishPayload(args.platform, {
        organizationId: args.organizationId,
        planId: args.planId,
        accountId: args.accountId,
        accountLabel: args.accountLabel,
        scheduledAtIso: args.scheduledAtIso,
        caption: args.caption,
        title: args.title,
        employeeId: args.employeeId,
        privacyLevel: args.privacyLevel,
      });
      return invokePlatformPublish(args.platform, 'schedule', payload);
    },
    onSuccess: (_data, vars) => {
      void onSuccess(vars.planId, vars.organizationId);
    },
  });

  const postNowMutation = useMutation({
    mutationFn: async (args: {
      platform: string;
      organizationId: string;
      planId: string;
      accountId: string;
      accountLabel: string;
      caption: string;
      title?: string;
      employeeId?: string;
      privacyLevel?: string;
    }) => {
      const payload = buildPlatformPublishPayload(args.platform, {
        organizationId: args.organizationId,
        planId: args.planId,
        accountId: args.accountId,
        accountLabel: args.accountLabel,
        scheduledAtIso: new Date().toISOString(),
        caption: args.caption,
        title: args.title,
        employeeId: args.employeeId,
        privacyLevel: args.privacyLevel,
      });
      return invokePlatformPublish(args.platform, 'post_now', payload);
    },
    onSuccess: (_data, vars) => {
      void onSuccess(vars.planId, vars.organizationId);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (args: {
      platform: string;
      organizationId: string;
      scheduleId: string;
      planId: string;
    }) =>
      invokePlatformPublish(args.platform, 'cancel', {
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
