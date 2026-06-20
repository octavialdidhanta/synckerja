import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SocialMediaPerformanceHeaderAndTab } from '@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab';
import { ManageCommentsInboxLayout } from '@/6-0-social-media-manage-comments/layout/ManageCommentsInboxLayout';
import { ManageCommentsPlatformTabs } from '@/6-0-social-media-manage-comments/container/ManageCommentsPlatformTabs';
import { ManageCommentsFilterTabs } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsFilterTabs';
import { ManageCommentsPostList } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsPostList';
import { ManageCommentsEmptyState } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState';
import { ManageCommentsPlatformBadge } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsPlatformBadge';
import { ThreadsCommentThreadPanel } from '@/6-0-social-media-manage-comments/components/threads/ThreadsCommentThreadPanel';
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
import { ThreadsContentAccountNav } from '@/6-0-social-media-performance/components/ThreadsContentAccountNav';
import { useThreadsContentSettings } from '@/threads-content/hooks/useThreadsContentSettings';
import { useThreadsContentCommentPostsQuery } from '@/threads-content/hooks/useThreadsContentComments';
import { CONNECT_THREADS_PATH } from '@/threads-content/settings/threadsContentSettingsPaths';
import { ThreadsTabIcon } from '@/6-0-social-media-performance/components/ThreadsTabIcon';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

const SOCIAL_MEDIA_PERFORMANCE_PATH = '/digital-marketing/social-media-performance';

export default function ThreadsManageCommentsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <MetaManageCommentsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <ThreadsManageCommentsPageContent />
    </ModuleShellContentGate>
  );
}

function ThreadsManageCommentsPageContent() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useThreadsContentSettings(organizationId);
  const [accountId, setAccountId] = useState('');
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>('all');
  const selectedPostId = searchParams.get('videoId')?.trim() || null;

  const platformBadge = useMemo(() => <ManageCommentsPlatformBadge platform="threads" />, []);
  const accounts = useMemo(() => settingsQuery.data?.accounts ?? [], [settingsQuery.data?.accounts]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].account_id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    setPostFilter('all');
  }, [accountId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.account_id === accountId) ?? null,
    [accounts, accountId],
  );

  const postsQuery = useThreadsContentCommentPostsQuery({
    organizationId,
    accountId,
    accountAvatarUrl: selectedAccount?.avatar_url ?? null,
    accountLabel: selectedAccount?.account_label ?? null,
    enabled:
      Boolean(organizationId && accountId && canManage && !gatePending) &&
      accounts.some((a) => a.account_id === accountId),
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
    () => filteredPosts.find((p) => String(p.id) === selectedPostId) ?? null,
    [filteredPosts, selectedPostId],
  );

  useEffect(() => {
    if (filteredPosts.length === 0) {
      if (selectedPostId) setSearchParams({}, { replace: true });
      return;
    }
    const hasSelection =
      selectedPostId != null && filteredPosts.some((p) => String(p.id) === selectedPostId);
    if (!hasSelection) {
      setSearchParams({ videoId: String(filteredPosts[0].id) }, { replace: true });
    }
  }, [filteredPosts, selectedPostId, setSearchParams]);

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

  if (gatePending || (canManage && settingsQuery.isPending)) {
    return <MetaManageCommentsPageSkeleton />;
  }

  const showConnectCta = accounts.length === 0;

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
              <ThreadsTabIcon className="mb-4 h-12 w-12 text-gray-800" />
              <p className="mb-4 text-sm text-slate-600">
                {t(
                  'digitalMarketing.threadsContent.manageCommentsConnectFirst',
                  'Connect Threads on the Threads integration tab to manage replies.',
                )}
              </p>
              <Button asChild>
                <Link to={CONNECT_THREADS_PATH}>
                  {t('threadsConnect.tabTitle', 'Connect Threads')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ThreadsContentAccountNav
                accounts={accounts}
                accountId={accountId}
                onAccountIdChange={handleAccountChange}
              />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
                          selectedId={selectedPostId}
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
                          listItemKeyPrefix={`threads-${accountId}`}
                        />
                      )}
                    </div>
                  }
                  main={
                    organizationId && accountId ? (
                      <ThreadsCommentThreadPanel
                        organizationId={organizationId}
                        accountId={accountId}
                        account={selectedAccount}
                        post={selectedPost}
                        connectPath={CONNECT_INSTAGRAM_PATH}
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
