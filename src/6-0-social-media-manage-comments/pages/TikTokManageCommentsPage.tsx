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

  const [openIdOverride, setOpenIdOverride] = useState("");
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>("all");

  const selectedVideoId = searchParams.get("videoId");

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );
  const defaultOpenId =
    (activeAccounts.find((a) => a.is_default) ?? activeAccounts[0])?.open_id ?? "";
  const openId =
    openIdOverride && activeAccounts.some((a) => a.open_id === openIdOverride)
      ? openIdOverride
      : defaultOpenId;

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
    const nextVideoId =
      filteredPosts.length === 0
        ? null
        : selectedVideoId && filteredPosts.some((p) => p.id === selectedVideoId)
          ? selectedVideoId
          : filteredPosts[0]?.id?.trim() || null;

    if (nextVideoId === selectedVideoId) return;
    setSearchParams(
      (prev) => {
        const current = prev.get("videoId")?.trim() || null;
        if (current === nextVideoId) return prev;
        if (!nextVideoId) return new URLSearchParams();
        return new URLSearchParams({ videoId: nextVideoId });
      },
      { replace: true },
    );
  }, [filteredPosts, selectedVideoId, setSearchParams]);

  const handleNewInboundComments = useCallback(() => {
    if (selectedVideoId) markPostWithNewActivity(selectedVideoId);
  }, [selectedVideoId, markPostWithNewActivity]);

  const handleSelectPost = useCallback(
    (post: ManageCommentsPostListItem) => {
      setSearchParams({ videoId: post.id }, { replace: true });
    },
    [setSearchParams],
  );

  const showAccessDenied = !gatePending && !canManage;

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
          {showAccessDenied ? (
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
                  setOpenIdOverride(next);
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
                              isLoading={gatePending || reportingPending || settingsPending || postsQuery.isLoading}
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
                            onNewInboundComments={handleNewInboundComments}
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
