import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Instagram, Facebook } from 'lucide-react';
import { SocialMediaPerformanceHeaderAndTab } from '@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab';
import { ManageCommentsInboxLayout } from '@/6-0-social-media-manage-comments/layout/ManageCommentsInboxLayout';
import { ManageCommentsPlatformTabs } from '@/6-0-social-media-manage-comments/container/ManageCommentsPlatformTabs';
import { ManageCommentsFilterTabs } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsFilterTabs';
import { ManageCommentsPostList } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsPostList';
import { ManageCommentsEmptyState } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState';
import { ManageCommentsPlatformBadge } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsPlatformBadge';
import { MetaCommentThreadPanel } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentThreadPanel';
import { MetaManageCommentsPageSkeleton } from '@/6-0-social-media-manage-comments/skeletons/MetaManageCommentsPageSkeleton';
import { useRefetchOnTabVisible } from '@/6-0-social-media-manage-comments/hooks/useRefetchOnTabVisible';
import { filterManageCommentsPosts } from '@/6-0-social-media-manage-comments/lib/filterPostList';
import { sortPostsForInbox } from '@/6-0-social-media-manage-comments/lib/sortPostsForInbox';
import type {
  ManageCommentsPostFilter,
  ManageCommentsPostListItem,
} from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useOmnichannelSurveySettingsAdmin } from '@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin';
import { MetaContentAccountNav } from '@/6-0-social-media-performance/components/MetaContentAccountNav';
import { useMetaContentConfig } from '@/meta-content/hooks/useMetaContentConfig';
import { useMetaContentCommentPostsQuery } from '@/meta-content/hooks/useMetaContentCommentPostsQuery';
import { missingScopesForFeature } from '@/meta-platform/constants/metaOAuthScopes';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

const SOCIAL_MEDIA_PERFORMANCE_PATH = '/digital-marketing/social-media-performance';
const CONNECT_PATH = '/omnichannel/integrations/instagram';

type MetaManageCommentsPageProps = {
  platform: MetaContentPlatform;
};

export function MetaManageCommentsPage({ platform }: MetaManageCommentsPageProps) {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <MetaManageCommentsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <MetaManageCommentsPageContent platform={platform} />
    </ModuleShellContentGate>
  );
}

function MetaManageCommentsPageContent({ platform }: { platform: MetaContentPlatform }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const configQuery = useMetaContentConfig(organizationId);
  const [accountId, setAccountId] = useState('');
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>('all');
  const selectedMediaId = searchParams.get('videoId')?.trim() || null;

  const platformBadge = useMemo(
    () => <ManageCommentsPlatformBadge platform={platform} />,
    [platform],
  );
  const PlatformIcon = platform === 'instagram' ? Instagram : Facebook;

  const platformAccounts = useMemo(
    () => (configQuery.data?.accounts ?? []).filter((a) => a.platform === platform),
    [configQuery.data?.accounts, platform],
  );

  useEffect(() => {
    if (!accountId && platformAccounts.length > 0) {
      setAccountId(platformAccounts[0].account_id);
    }
  }, [platformAccounts, accountId]);

  useEffect(() => {
    setPostFilter('all');
  }, [accountId]);

  const selectedAccount = useMemo(
    () => platformAccounts.find((a) => a.account_id === accountId) ?? null,
    [platformAccounts, accountId],
  );

  const commentsScopesGranted = useMemo(() => {
    if (!selectedAccount) return false;
    return missingScopesForFeature(selectedAccount.granted_scopes ?? [], 'comments').length === 0;
  }, [selectedAccount]);

  const postsQuery = useMetaContentCommentPostsQuery({
    organizationId,
    platform,
    accountId,
    accountAvatarUrl: selectedAccount?.avatar_url ?? null,
    accountLabel: selectedAccount?.account_label ?? null,
    enabled:
      Boolean(organizationId && accountId && canManage && !gatePending) &&
      platformAccounts.some((a) => a.account_id === accountId),
    liveRefresh: true,
  });

  const refetchPosts = useCallback(() => postsQuery.refetch(), [postsQuery.refetch]);
  useRefetchOnTabVisible(refetchPosts);

  const allPosts = postsQuery.posts;
  const filteredPosts = useMemo(() => {
    const filtered = filterManageCommentsPosts(allPosts, postFilter, '', new Set());
    return sortPostsForInbox(filtered, new Set(), new Map());
  }, [allPosts, postFilter]);

  const selectedPost = useMemo(
    () => filteredPosts.find((p) => String(p.id) === selectedMediaId) ?? null,
    [filteredPosts, selectedMediaId],
  );

  useEffect(() => {
    if (filteredPosts.length === 0) {
      if (selectedMediaId) setSearchParams({}, { replace: true });
      return;
    }
    const hasSelection = selectedMediaId != null &&
      filteredPosts.some((p) => String(p.id) === selectedMediaId);
    if (!hasSelection) {
      setSearchParams({ videoId: String(filteredPosts[0].id) }, { replace: true });
    }
  }, [filteredPosts, selectedMediaId, setSearchParams]);

  const handleSelectPost = useCallback(
    (post: ManageCommentsPostListItem) => {
      setSearchParams({ videoId: String(post.id) }, { replace: true });
    },
    [setSearchParams],
  );

  const handleAccountChange = useCallback(
    (nextAccountId: string) => {
      setAccountId(nextAccountId);
      setSearchParams({}, { replace: true });
    },
    [setSearchParams],
  );

  const rawPageLoadPending = gatePending || (canManage && configQuery.isPending);

  if (rawPageLoadPending) {
    return <MetaManageCommentsPageSkeleton />;
  }

  const showConnectCta = platformAccounts.length === 0;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 shrink-0">
          <SocialMediaPerformanceHeaderAndTab />
        </div>

        <div className="flex max-h-[calc(100vh-120px)] min-h-0 flex-1 flex-row overflow-hidden">
          {!canManage ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <Alert>
                <AlertTitle>
                  {t('digitalMarketing.tiktokContent.accessDeniedTitle', 'Access restricted')}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    'digitalMarketing.tiktokContent.accessDeniedBody',
                    'Only the organization owner or an omnichannel admin can manage comments.',
                  )}
                </AlertDescription>
              </Alert>
            </div>
          ) : showConnectCta ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
              <PlatformIcon className="mb-4 h-12 w-12 text-slate-300" />
              <p className="mb-4 text-sm text-slate-600">
                {t(
                  'metaPlatform.manageComments.connectFirst',
                  'Connect your Meta account to manage comments.',
                )}
              </p>
              <Button asChild>
                <Link to={CONNECT_PATH}>
                  {t('metaPlatform.manageComments.openConnect', 'Connect Instagram / Facebook')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <MetaContentAccountNav
                platform={platform}
                accounts={configQuery.data?.accounts ?? []}
                selectedAccountId={accountId}
                onSelectAccountId={handleAccountChange}
                onSettingsSelect={() => navigate(CONNECT_PATH)}
              />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {!commentsScopesGranted ? (
                  <Alert className="mx-4 mb-2 mt-3 shrink-0">
                    <AlertTitle>
                      {t(
                        'digitalMarketing.manageComments.reconnectForCommentsTitle',
                        'Comment permissions required',
                      )}
                    </AlertTitle>
                    <AlertDescription>
                      {t(
                        'digitalMarketing.manageComments.reconnectForComments',
                        'Reconnect your Meta account to grant comment permissions.',
                      )}{' '}
                      <Link to={CONNECT_PATH} className="font-medium text-primary underline">
                        {t('digitalMarketing.tiktokContent.openSettings', 'Open settings')}
                      </Link>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <ManageCommentsInboxLayout
                  sidebar={
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                      <ManageCommentsPlatformTabs />
                      <ManageCommentsFilterTabs value={postFilter} onChange={setPostFilter} />
                      {postsQuery.isError ? (
                        <div className="px-3 py-4 text-xs text-destructive">
                          {(postsQuery.error as Error)?.message}
                        </div>
                      ) : (
                        <ManageCommentsPostList
                          posts={filteredPosts}
                          selectedId={selectedMediaId}
                          highlightedPostIds={new Set()}
                          onSelect={handleSelectPost}
                          isLoading={postsQuery.isLoading}
                          isFetching={postsQuery.isFetching}
                          totalPosts={allPosts.length}
                          activeFilter={postFilter}
                          hasSearch={false}
                          onClearFilters={() => setPostFilter('all')}
                          platformBadge={platformBadge}
                          contentKind="post"
                          listItemKeyPrefix={`${platform}-${accountId}`}
                        />
                      )}
                    </div>
                  }
                  main={
                    organizationId && accountId ? (
                      <MetaCommentThreadPanel
                        organizationId={organizationId}
                        platform={platform}
                        accountId={accountId}
                        post={selectedPost}
                        commentsScopesGranted={commentsScopesGranted}
                        connectPath={CONNECT_PATH}
                      />
                    ) : (
                      <ManageCommentsEmptyState />
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
