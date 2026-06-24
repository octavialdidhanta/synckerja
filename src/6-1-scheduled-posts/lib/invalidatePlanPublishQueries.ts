import type { QueryClient } from '@tanstack/react-query';
import type { SocialMediaLink } from '@/shared/types/social-media-links';
import type { ScheduledPost } from '../types/scheduled-post';

const SOCIAL_MEDIA_LINKS_KEY = 'socialMediaLinks';
const SCHEDULED_POSTS_KEY = 'socialMediaScheduledPosts';

export function removePlatformLinksFromCache(
  links: SocialMediaLink[],
  platform: string,
  accountId: string,
): SocialMediaLink[] {
  const accountTrim = accountId.trim();
  return links.filter((link) => {
    if (link.platform !== platform) return true;
    const openId = link.platform_account_open_id?.trim();
    if (!openId) return false;
    return openId !== accountTrim;
  });
}

export function cancelPlatformSchedulesInCache(
  schedules: ScheduledPost[],
  platform: string,
  accountId: string,
): ScheduledPost[] {
  const accountTrim = accountId.trim();
  return schedules.map((row) => {
    if (row.platform !== platform || row.status === 'cancelled') return row;

    const rowAccount =
      row.platform_account_id?.trim()
      || String((row.provider_config as Record<string, unknown> | null)?.open_id ?? '').trim()
      || String((row.provider_config as Record<string, unknown> | null)?.channel_id ?? '').trim();

    if (rowAccount && rowAccount !== accountTrim) return row;
    if (!rowAccount && row.status !== 'published' && !row.external_post_id?.trim()) {
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

export function removePlanLinksFromOrgCache(
  links: SocialMediaLink[],
  planId: string,
  removedLinkIds?: string[],
): SocialMediaLink[] {
  if (removedLinkIds?.length) {
    const removed = new Set(removedLinkIds);
    return links.filter((link) => !removed.has(link.id));
  }
  return links.filter((link) => link.social_media_plan_id !== planId);
}

type PatchArgs = {
  organizationId: string;
  planId: string;
  platform?: string;
  accountId?: string;
  patchLinks?: (links: SocialMediaLink[]) => SocialMediaLink[];
  patchSchedules?: (schedules: ScheduledPost[]) => ScheduledPost[];
};

export function patchPlanPublishCaches(queryClient: QueryClient, args: PatchArgs): void {
  const { organizationId, planId, platform, accountId, patchLinks, patchSchedules } = args;

  if (patchLinks) {
    queryClient.setQueryData(
      [SOCIAL_MEDIA_LINKS_KEY, planId],
      (old: SocialMediaLink[] | undefined) => (old ? patchLinks(old) : old),
    );
  } else if (platform && accountId) {
    queryClient.setQueryData(
      [SOCIAL_MEDIA_LINKS_KEY, planId],
      (old: SocialMediaLink[] | undefined) =>
        old ? removePlatformLinksFromCache(old, platform, accountId) : old,
    );
  }

  if (patchSchedules) {
    queryClient.setQueryData(
      [SCHEDULED_POSTS_KEY, planId],
      (old: ScheduledPost[] | undefined) => (old ? patchSchedules(old) : old),
    );
  } else if (platform && accountId) {
    queryClient.setQueryData(
      [SCHEDULED_POSTS_KEY, planId],
      (old: ScheduledPost[] | undefined) =>
        old ? cancelPlatformSchedulesInCache(old, platform, accountId) : old,
    );
  }

  const planLinks = queryClient.getQueryData<SocialMediaLink[]>([SOCIAL_MEDIA_LINKS_KEY, planId]);
  if (planLinks) {
    queryClient.setQueryData(
      ['all-social-media-links', organizationId],
      (old: SocialMediaLink[] | undefined) => {
        if (!old) return old;
        const withoutPlan = old.filter((link) => link.social_media_plan_id !== planId);
        return [...withoutPlan, ...planLinks];
      },
    );
  } else if (platform && accountId) {
    queryClient.setQueryData(
      ['all-social-media-links', organizationId],
      (old: SocialMediaLink[] | undefined) =>
        old ? removePlatformLinksFromCache(old, platform, accountId) : old,
    );
  }
}

export async function invalidatePlanPublishQueries(
  queryClient: QueryClient,
  args: {
    organizationId: string;
    planId: string;
  },
): Promise<void> {
  const { organizationId, planId } = args;

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [SCHEDULED_POSTS_KEY, planId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: [SCHEDULED_POSTS_KEY, 'org-active', organizationId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: [SOCIAL_MEDIA_LINKS_KEY, planId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: ['all-social-media-links', organizationId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: ['social-media-plans', organizationId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: ['social-media-plan', planId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: ['plan-schedule-manual-locks', planId],
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({
      queryKey: ['content-plans'],
      refetchType: 'active',
    }),
  ]);
}
