import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchMetaContentConfig } from '@/meta-content/hooks/useMetaContentConfig';
import { fetchMetaCommentPosts } from '@/meta-content/hooks/useMetaContentCommentPostsQuery';
import { useOmnichannelSurveySettingsAdmin } from '@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

/** Warm sibling platform chunks + Meta config so TikTok → Facebook does not flash Suspense. */
export function usePrefetchManageCommentsPlatforms() {
  const queryClient = useQueryClient();
  const { organizationId } = useOmnichannelSurveySettingsAdmin();

  useEffect(() => {
    void import('@/6-0-social-media-manage-comments/pages/FacebookManageCommentsPage');
    void import('@/6-0-social-media-manage-comments/pages/InstagramManageCommentsPage');
    void import('@/6-0-social-media-manage-comments/pages/TikTokManageCommentsPage');
    void import('@/6-0-social-media-manage-comments/pages/YouTubeManageCommentsPage');
    void import('@/6-0-social-media-manage-comments/pages/LinkedInManageCommentsPage');
    void import('@/6-0-social-media-manage-comments/pages/ThreadsManageCommentsPage');
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    void queryClient
      .prefetchQuery({
        queryKey: ['meta-content-config', organizationId],
        queryFn: () => fetchMetaContentConfig(organizationId),
        staleTime: 60_000,
      })
      .then(() => {
        const config = queryClient.getQueryData<{
          accounts: Array<{ platform: MetaContentPlatform; account_id: string }>;
        }>(['meta-content-config', organizationId]);
        const facebookAccount = config?.accounts.find((a) => a.platform === 'facebook');
        if (!facebookAccount) return;
        void queryClient.prefetchQuery({
          queryKey: ['meta-content-comment-posts', organizationId, 'facebook', facebookAccount.account_id],
          queryFn: () =>
            fetchMetaCommentPosts({
              organizationId,
              platform: 'facebook',
              accountId: facebookAccount.account_id,
            }),
          staleTime: 8_000,
        });
      });
  }, [organizationId, queryClient]);
}
