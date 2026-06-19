import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Linkedin } from 'lucide-react';
import { SocialMediaPerformanceHeaderAndTab } from '@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab';
import { ManageCommentsInboxLayout } from '@/6-0-social-media-manage-comments/layout/ManageCommentsInboxLayout';
import { ManageCommentsPlatformTabs } from '@/6-0-social-media-manage-comments/container/ManageCommentsPlatformTabs';
import { ManageCommentsFilterTabs } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsFilterTabs';
import { ManageCommentsPostList } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsPostList';
import { ManageCommentsEmptyState } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState';
import { ManageCommentsPlatformBadge } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsPlatformBadge';
import { LinkedInCommentThreadPanel } from '@/6-0-social-media-manage-comments/components/linkedin/LinkedInCommentThreadPanel';
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
import { LinkedInContentAccountNav } from '@/6-0-social-media-performance/components/LinkedInContentAccountNav';
import { useLinkedInContentSettings } from '@/linkedin-content/hooks/useLinkedInContentSettings';
import { useLinkedInContentCommentPostsQuery } from '@/linkedin-content/hooks/useLinkedInContentComments';
import {
  missingLinkedInScopesForFeature,
  parseLinkedInGrantedScopes,
} from '@/linkedin-content/constants/linkedinOAuthScopes';
import { LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH } from '@/linkedin-content/settings/linkedinContentSettingsPaths';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

const SOCIAL_MEDIA_PERFORMANCE_PATH = '/digital-marketing/social-media-performance';

export default function LinkedInManageCommentsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <MetaManageCommentsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <LinkedInManageCommentsPageContent />
    </ModuleShellContentGate>
  );
}

function LinkedInManageCommentsPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useLinkedInContentSettings(organizationId);
  const [pageId, setPageId] = useState('');
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>('all');
  const selectedPostId = searchParams.get('videoId')?.trim() || null;

  const platformBadge = useMemo(
    () => <ManageCommentsPlatformBadge platform="linkedin" />,
    [],
  );

  const accounts = useMemo(() => settingsQuery.data?.accounts ?? [], [settingsQuery.data?.accounts]);

  useEffect(() => {
    if (!pageId && accounts.length > 0) {
      const def = accounts.find((a) => a.is_default) ?? accounts[0];
      setPageId(def.page_id);
    }
  }, [accounts, pageId]);

  useEffect(() => {
    setPostFilter('all');
  }, [pageId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.page_id === pageId) ?? null,
    [accounts, pageId],
  );

  const commentsScopesGranted = useMemo(() => {
    if (!selectedAccount) return false;
    const granted = parseLinkedInGrantedScopes(selectedAccount.granted_scopes);
    return missingLinkedInScopesForFeature(granted, 'comments').length === 0;
  }, [selectedAccount]);

  const postsQuery = useLinkedInContentCommentPostsQuery({
    organizationId,
    pageId,
    accountAvatarUrl: selectedAccount?.thumbnail_url ?? null,
    accountLabel: selectedAccount?.label || selectedAccount?.display_name || null,
    enabled:
      Boolean(organizationId && pageId && canManage && !gatePending) &&
      accounts.some((a) => a.page_id === pageId),
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

  const handlePageChange = useCallback(
    (nextPageId: string) => {
      setPageId(nextPageId);
      setSearchParams({}, { replace: true });
    },
    [setSearchParams],
  );

  const rawPageLoadPending = gatePending || (canManage && settingsQuery.isPending);

  if (rawPageLoadPending) {
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
              <Linkedin className="mb-4 h-12 w-12 text-[#0A66C2]" />
              <p className="mb-4 text-sm text-slate-600">
                {t(
                  'digitalMarketing.linkedinContent.manageCommentsConnectFirst',
                  'Connect your LinkedIn page to manage comments.',
                )}
              </p>
              <Button asChild>
                <Link to={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}>
                  {t('digitalMarketing.linkedinContent.openSettings', 'Open LinkedIn settings')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <LinkedInContentAccountNav
                accounts={accounts}
                pageId={pageId}
                onPageIdChange={handlePageChange}
                onSettingsSelect={() => navigate(LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH)}
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
                        'digitalMarketing.linkedinContent.reconnectForComments',
                        'Reconnect LinkedIn to grant comment permissions.',
                      )}{' '}
                      <Link
                        to={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
                        className="font-medium text-primary underline"
                      >
                        {t('digitalMarketing.linkedinContent.openSettings', 'Open settings')}
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
                          listItemKeyPrefix={`linkedin-${pageId}`}
                        />
                      )}
                    </div>
                  }
                  main={
                    organizationId && pageId ? (
                      <LinkedInCommentThreadPanel
                        organizationId={organizationId}
                        pageId={pageId}
                        post={selectedPost}
                        commentsScopesGranted={commentsScopesGranted}
                        settingsPath={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
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
