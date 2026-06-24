import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { SocialMediaLink } from '@/shared/types/social-media-links';
import { deletePlanPlatformPublish } from '../lib/deletePlanPlatformPublish';
import { useInvalidateScheduledPosts } from './useScheduledPostsByPlan';
import { syncPlanDoneStateClient } from '../lib/syncPlanDoneStateClient';
import type { ScheduledPost } from '../types/scheduled-post';

function removeYouTubeLinksFromCache(
  links: SocialMediaLink[],
  accountId: string,
): SocialMediaLink[] {
  const channelId = accountId.trim();
  return links.filter((link) => {
    if (link.platform !== 'YouTube') return true;
    const openId = link.platform_account_open_id?.trim();
    if (!openId) return false;
    return openId !== channelId;
  });
}

function cancelYouTubeSchedulesInCache(
  schedules: ScheduledPost[],
  accountId: string,
): ScheduledPost[] {
  const channelId = accountId.trim();
  return schedules.map((row) => {
    if (row.platform !== 'YouTube' || row.status === 'cancelled') return row;

    const rowChannel =
      row.platform_account_id?.trim()
      || String((row.provider_config as Record<string, unknown> | null)?.channel_id ?? '').trim();

    if (rowChannel && rowChannel !== channelId) return row;
    if (!rowChannel && row.status !== 'published' && !row.external_post_id?.trim()) {
      return row;
    }

    return {
      ...row,
      status: 'cancelled' as const,
      error_message: 'deleted_by_user',
      published_url: null,
      external_post_id: null,
    };
  });
}

export function useDeletePublishedPost() {
  const { t } = useTranslation();
  const invalidate = useInvalidateScheduledPosts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlanPlatformPublish,
    onSuccess: async (data, vars) => {
      if (vars.platform === 'YouTube') {
        queryClient.setQueryData(
          ['socialMediaLinks', vars.planId],
          (old: SocialMediaLink[] | undefined) =>
            old ? removeYouTubeLinksFromCache(old, vars.accountId) : old,
        );
        queryClient.setQueryData(
          ['socialMediaScheduledPosts', vars.planId],
          (old: ScheduledPost[] | undefined) =>
            old ? cancelYouTubeSchedulesInCache(old, vars.accountId) : old,
        );
      }

      invalidate(vars.planId, vars.organizationId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['content-plans'],
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['social-media-plans'],
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['socialMediaLinks', vars.planId],
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['all-social-media-links'],
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['plan-schedule-manual-locks', vars.planId],
          refetchType: 'active',
        }),
      ]);
      await syncPlanDoneStateClient(vars.planId);

      if (data.already_deleted || data.nothing_to_delete_on_platform) {
        toast.success(t('digitalMarketing.scheduledPosts.deleteFromPlatformAlreadyRemoved'));
      } else {
        toast.success(t('digitalMarketing.scheduledPosts.deleteFromPlatformSuccess'));
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('delete_scopes_not_granted')) {
        toast.error(t('digitalMarketing.scheduledPosts.deleteScopesMissing'));
        return;
      }
      toast.error(t('digitalMarketing.scheduledPosts.deleteFromPlatformFailed'));
    },
  });
}
