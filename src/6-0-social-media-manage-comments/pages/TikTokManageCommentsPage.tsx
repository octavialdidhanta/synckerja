import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { SocialMediaPerformanceModuleShell } from "@/6-0-social-media-performance/layout/SocialMediaPerformanceModuleShell";
import { ManageCommentsInboxLayout } from "@/6-0-social-media-manage-comments/layout/ManageCommentsInboxLayout";
import { ManageCommentsPlatformTabs } from "@/6-0-social-media-manage-comments/container/ManageCommentsPlatformTabs";
import { ManageCommentsFilterTabs } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsFilterTabs";
import { ManageCommentsPostList } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsPostList";
import { ManageCommentsEmptyState } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState";
import { TikTokCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokCommentThreadPanel";
import { TikTokManageCommentsPageSkeleton } from "@/6-0-social-media-manage-comments/skeletons/TikTokManageCommentsPageSkeleton";
import { useRefetchOnTabVisible } from "@/6-0-social-media-manage-comments/hooks/useRefetchOnTabVisible";
import { filterManageCommentsPosts } from "@/6-0-social-media-manage-comments/lib/filterPostList";
import { sortPostsForInbox } from "@/6-0-social-media-manage-comments/lib/sortPostsForInbox";
import { useNewInboundPostHighlights } from "@/6-0-social-media-manage-comments/hooks/useNewInboundPostHighlights";
import {
  useManageCommentsInboxState,
  useSyncManageCommentsPostBaselines,
} from "@/6-0-social-media-manage-comments/hooks/useManageCommentsInboxState";
import type {
  ManageCommentsPostFilter,
  ManageCommentsPostListItem,
} from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import { TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH } from "@/tiktok-content/settings/tiktokContentSettingsPaths";
import { SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH } from "@/6-0-social-media-manage-comments/lib/manageCommentsPaths";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useTikTokContentReportingEnabled } from "@/tiktok-content/hooks/useTikTokContentReportingEnabled";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import { useTikTokContentCommentPostsQuery } from "@/tiktok-content/hooks/useTikTokContentCommentPostsQuery";
import { TikTokContentSettingsPanel } from "@/tiktok-content/settings/TikTokContentSettingsPanel";
import { TikTokContentAccountNav } from "@/6-0-social-media-performance/components/TikTokContentAccountNav";
import { getTikTokAccountDisplayLabel } from "@/tiktok-content/lib/tiktokAccountDisplayLabel";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

export default function TikTokManageCommentsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokManageCommentsPageSkeleton />;
  return (
    <SocialMediaPerformanceModuleShell>
      <TikTokManageCommentsPageContent />
    </SocialMediaPerformanceModuleShell>
  );
}

function TikTokManageCommentsPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSettingsView = location.pathname === TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH;

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      void queryClient.invalidateQueries({ queryKey: ["tiktok-content-settings"] });
    }
  }, [searchParams, queryClient]);

  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokContentSettings(
    organizationId,
    { enabled: Boolean(organizationId) && !gatePending },
  );

  const [openId, setOpenId] = useState("");
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>("all");

  const selectedVideoId = searchParams.get("videoId");

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  useEffect(() => {
    if (!openId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setOpenId(def.open_id);
    }
  }, [activeAccounts, openId]);

  useEffect(() => {
    setPostFilter("all");
  }, [openId]);

  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.open_id === openId) ?? null,
    [activeAccounts, openId],
  );

  const commentsScopesGranted = selectedAccount?.comments_scopes_granted ?? false;

  const postsQuery = useTikTokContentCommentPostsQuery({
    organizationId,
    openId,
    accountAvatarUrl: selectedAccount?.avatar_url ?? null,
    accountLabel: selectedAccount ? getTikTokAccountDisplayLabel(selectedAccount) : null,
    enabled:
      reportingEnabled &&
      Boolean(openId) &&
      activeAccounts.some((a) => a.open_id === openId) &&
      !isSettingsView &&
      canManage,
    liveRefresh: !isSettingsView,
  });

  const refetchPosts = useCallback(() => postsQuery.refetch(), [postsQuery.refetch]);
  useRefetchOnTabVisible(refetchPosts);

  const allPosts = postsQuery.data?.posts ?? [];

  const postsReady = postsQuery.isFetched && !postsQuery.isLoading;

  const inboxEnabled =
    Boolean(organizationId && openId) &&
    reportingEnabled &&
    !isSettingsView &&
    canManage;

  const { syncPostBaselinesMutation, dismissPostHighlightMutation } = useManageCommentsInboxState({
    organizationId,
    openId,
    activeVideoId: selectedVideoId,
    enabled: inboxEnabled,
  });

  useSyncManageCommentsPostBaselines({
    organizationId,
    openId,
    posts: allPosts,
    postsReady,
    enabled: inboxEnabled,
    syncPostBaselines: syncPostBaselinesMutation,
  });

  const {
    pinnedPostIds,
    highlightedPostIds,
    pinnedAtMs,
    pinnedAtVersion,
    markPostWithNewActivity,
    dismissPostHighlight,
  } = useNewInboundPostHighlights(selectedVideoId, openId);

  const visibleHighlightedPostIds = useMemo(() => {
    const countById = new Map(allPosts.map((p) => [p.id, p.commentCount]));
    const next = new Set<string>();
    for (const id of highlightedPostIds) {
      if ((countById.get(id) ?? 0) > 0) next.add(id);
    }
    return next;
  }, [highlightedPostIds, allPosts]);

  const handlePostHighlightResolved = useCallback(
    (postId: string) => {
      dismissPostHighlight(postId);
      void dismissPostHighlightMutation.mutateAsync(postId).catch(() => {});
    },
    [dismissPostHighlight, dismissPostHighlightMutation],
  );

  const filteredPosts = useMemo(() => {
    const filtered = filterManageCommentsPosts(
      allPosts,
      postFilter,
      "",
      visibleHighlightedPostIds,
    );
    return sortPostsForInbox(filtered, pinnedPostIds, pinnedAtMs);
    // pinnedAtVersion drives re-sort when bump order changes
  }, [allPosts, postFilter, visibleHighlightedPostIds, pinnedPostIds, pinnedAtMs, pinnedAtVersion]);

  const selectedPost = useMemo(
    () => filteredPosts.find((p) => p.id === selectedVideoId) ?? null,
    [filteredPosts, selectedVideoId],
  );

  useEffect(() => {
    if (filteredPosts.length === 0) {
      if (selectedVideoId) setSearchParams({}, { replace: true });
      return;
    }
    if (!selectedVideoId || !filteredPosts.some((p) => p.id === selectedVideoId)) {
      setSearchParams({ videoId: filteredPosts[0].id }, { replace: true });
    }
  }, [filteredPosts, selectedVideoId, setSearchParams]);

  const handleSelectPost = useCallback(
    (post: ManageCommentsPostListItem) => {
      setSearchParams({ videoId: post.id }, { replace: true });
    },
    [setSearchParams],
  );

  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex max-h-[calc(100vh-120px)] min-h-0 flex-1 flex-row overflow-hidden">
          {!canManage ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <Alert>
                <AlertTitle>
                  {t("digitalMarketing.tiktokContent.accessDeniedTitle", "Access restricted")}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    "digitalMarketing.tiktokContent.accessDeniedBody",
                    "Only the organization owner or an omnichannel admin can manage TikTok comments.",
                  )}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <TikTokContentAccountNav
                accounts={activeAccounts}
                openId={openId}
                onOpenIdChange={(next) => {
                  setOpenId(next);
                  setSearchParams({}, { replace: true });
                  if (isSettingsView) {
                    navigate(SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH);
                  }
                }}
                settingsActive={isSettingsView}
                onSettingsSelect={() => navigate(TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH)}
              />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {isSettingsView ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                    {!commentsScopesGranted && (settings?.oauthConnected ?? false) ? (
                      <Alert className="mb-4">
                        <AlertTitle>
                          {t(
                            "digitalMarketing.manageComments.reconnectForCommentsTitle",
                            "Comment permissions required",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.manageComments.reconnectForComments",
                            "Reconnect your TikTok account to grant comment.list and comment.list.manage scopes.",
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <TikTokContentSettingsPanel
                      organizationId={organizationId}
                      oauthReturnPath={TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                    />
                  </div>
                ) : (
                  <>
                    {!reportingPending && !reportingEnabled ? (
                      <Alert className="mx-4 mb-2 mt-3 shrink-0">
                        <AlertTitle>
                          {t(
                            "digitalMarketing.tiktokContent.notConnected",
                            "TikTok not connected",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          <Link
                            to={TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.tiktokContent.openSettings", "Open settings")}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    ) : !commentsScopesGranted && reportingEnabled ? (
                      <Alert className="mx-4 mb-2 mt-3 shrink-0">
                        <AlertTitle>
                          {t(
                            "digitalMarketing.manageComments.reconnectForCommentsTitle",
                            "Comment permissions required",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.manageComments.reconnectForComments",
                            "Reconnect your TikTok account in settings to manage comments.",
                          )}{" "}
                          <Link
                            to={TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.tiktokContent.openSettings", "Open settings")}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <ManageCommentsInboxLayout
                      sidebar={
                        <div className="flex h-full min-h-0 flex-col overflow-hidden">
                          <ManageCommentsPlatformTabs />
                          <ManageCommentsFilterTabs
                            value={postFilter}
                            onChange={setPostFilter}
                          />
                          {postsQuery.isError ? (
                            <div className="px-3 py-4 text-xs text-destructive">
                              {(postsQuery.error as Error)?.message}
                            </div>
                          ) : (
                            <ManageCommentsPostList
                              posts={filteredPosts}
                              selectedId={selectedVideoId}
                              highlightedPostIds={visibleHighlightedPostIds}
                              onSelect={handleSelectPost}
                              isLoading={postsQuery.isLoading}
                              isFetching={postsQuery.isFetching}
                              totalPosts={postsQuery.data?.totalPosts ?? 0}
                              activeFilter={postFilter}
                              hasSearch={false}
                              onClearFilters={() => {
                                setPostFilter("all");
                              }}
                            />
                          )}
                        </div>
                      }
                      main={
                        organizationId && openId ? (
                          <TikTokCommentThreadPanel
                            organizationId={organizationId}
                            openId={openId}
                            post={selectedPost}
                            commentsScopesGranted={commentsScopesGranted}
                            postHighlightActive={
                              selectedPost
                                ? visibleHighlightedPostIds.has(selectedPost.id)
                                : false
                            }
                            onNewInboundComments={() => {
                              if (selectedPost) markPostWithNewActivity(selectedPost.id);
                            }}
                            onPostHighlightResolved={handlePostHighlightResolved}
                          />
                        ) : (
                          <ManageCommentsEmptyState />
                        )
                      }
                    />
                  </>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
