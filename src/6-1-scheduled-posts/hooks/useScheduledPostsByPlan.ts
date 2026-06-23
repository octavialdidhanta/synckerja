import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import type { ScheduledPost } from '../types/scheduled-post';
import { pickTikTokScheduleForModal } from '../lib/pickTikTokScheduleDisplay';

const SCHEDULED_POSTS_QUERY_KEY = 'socialMediaScheduledPosts';

export function useScheduledPostsByPlan(planId?: string) {
  return useQuery({
    queryKey: [SCHEDULED_POSTS_QUERY_KEY, planId],
    queryFn: async () => {
      if (!planId) return [] as ScheduledPost[];
      const { data, error } = await supabase
        .from('social_media_scheduled_posts')
        .select('*')
        .eq('social_media_plan_id', planId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScheduledPost[];
    },
    enabled: Boolean(planId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useTikTokScheduleForPlan(planId?: string) {
  const query = useScheduledPostsByPlan(planId);
  const tiktok = pickTikTokScheduleForModal(query.data ?? []);
  const activePending = query.data?.find(
    (s) => s.platform === 'TikTok' && (s.status === 'pending' || s.status === 'publishing'),
  ) ?? null;
  return { ...query, tiktokSchedule: tiktok, activeTikTokSchedule: activePending };
}

export function useInvalidateScheduledPosts() {
  const queryClient = useQueryClient();
  return (planId?: string, organizationId?: string) => {
    if (planId) {
      queryClient.invalidateQueries({ queryKey: [SCHEDULED_POSTS_QUERY_KEY, planId] });
    } else {
      queryClient.invalidateQueries({ queryKey: [SCHEDULED_POSTS_QUERY_KEY] });
    }
    if (organizationId) {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULED_POSTS_QUERY_KEY, 'org-active', organizationId],
      });
    }
  };
}

async function invokePublish(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('tiktok-content-publish', { body });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

export function useSchedulePostMutation() {
  const invalidate = useInvalidateScheduledPosts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      planId: string;
      openId: string;
      accountLabel: string;
      scheduledAtIso: string;
      caption: string;
      title?: string;
      employeeId?: string;
    }) => {
      return invokePublish({
        action: 'schedule',
        organization_id: args.organizationId,
        social_media_plan_id: args.planId,
        open_id: args.openId,
        account_label: args.accountLabel,
        scheduled_at: args.scheduledAtIso,
        caption: args.caption,
        title: args.title ?? null,
        employee_id: args.employeeId ?? null,
      });
    },
    onSuccess: (_data, vars) => {
      invalidate(vars.planId, vars.organizationId);
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
      queryClient.invalidateQueries({ queryKey: ['socialMediaLinks', vars.planId] });
      queryClient.invalidateQueries({ queryKey: ['all-social-media-links'] });
    },
  });
}

export function usePostNowMutation() {
  const invalidate = useInvalidateScheduledPosts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      planId: string;
      openId: string;
      accountLabel: string;
      caption: string;
      title?: string;
      employeeId?: string;
    }) => {
      return invokePublish({
        action: 'post_now',
        organization_id: args.organizationId,
        social_media_plan_id: args.planId,
        open_id: args.openId,
        account_label: args.accountLabel,
        caption: args.caption,
        title: args.title ?? null,
        employee_id: args.employeeId ?? null,
      });
    },
    onSuccess: (_data, vars) => {
      invalidate(vars.planId, vars.organizationId);
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
      queryClient.invalidateQueries({ queryKey: ['socialMediaLinks', vars.planId] });
      queryClient.invalidateQueries({ queryKey: ['all-social-media-links'] });
    },
  });
}

export function useCancelScheduleMutation() {
  const invalidate = useInvalidateScheduledPosts();

  return useMutation({
    mutationFn: async (args: { organizationId: string; scheduleId: string; planId: string }) => {
      return invokePublish({
        action: 'cancel',
        organization_id: args.organizationId,
        schedule_id: args.scheduleId,
        social_media_plan_id: args.planId,
      });
    },
    onSuccess: (_data, vars) => {
      invalidate(vars.planId, vars.organizationId);
    },
  });
}
