import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { SocialMediaPerformanceHeaderAndTab } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { ManageCommentsInboxLayout } from "@/6-0-social-media-manage-comments/layout/ManageCommentsInboxLayout";
import { ManageCommentsPlatformTabs } from "@/6-0-social-media-manage-comments/container/ManageCommentsPlatformTabs";
import { ManageCommentsFilterTabs } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsFilterTabs";
import { ManageCommentsPostList } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsPostList";
import { ManageCommentsEmptyState } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState";
import { YouTubeCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/youtube/YouTubeCommentThreadPanel";
import { YouTubeManageCommentsPageSkeleton } from "@/6-0-social-media-manage-comments/skeletons/YouTubeManageCommentsPageSkeleton";
import { useRefetchOnTabVisible } from "@/6-0-social-media-manage-comments/hooks/useRefetchOnTabVisible";
import { filterManageCommentsPosts } from "@/6-0-social-media-manage-comments/lib/filterPostList";
import { sortPostsForInbox } from "@/6-0-social-media-manage-comments/lib/sortPostsForInbox";
import { useNewInboundPostHighlights } from "@/6-0-social-media-manage-comments/hooks/useNewInboundPostHighlights";
import {
  useSyncYouTubeManageCommentsPostBaselines,
  useYouTubeManageCommentsInboxState,
} from "@/6-0-social-media-manage-comments/hooks/useYouTubeManageCommentsInboxState";
import type {
  ManageCommentsPostFilter,
  ManageCommentsPostListItem,
} from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import {
  SOCIAL_MEDIA_MANAGE_COMMENTS_YOUTUBE_PATH,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsPaths";
import { YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH } from "@/youtube-content/settings/youtubeContentSettingsPaths";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useYouTubeContentReportingEnabled } from "@/youtube-content/hooks/useYouTubeContentReportingEnabled";
import { useYouTubeContentSettings } from "@/youtube-content/hooks/useYouTubeContentSettings";
import { useYouTubeContentCommentPostsQuery } from "@/youtube-content/hooks/useYouTubeContentCommentPostsQuery";
import { YouTubeContentSettingsPanel } from "@/youtube-content/settings/YouTubeContentSettingsPanel";
import { YouTubeContentAccountNav } from "@/6-0-social-media-performance/components/YouTubeContentAccountNav";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

const SOCIAL_MEDIA_PERFORMANCE_PATH = "/digital-marketing/social-media-performance";

export default function YouTubeManageCommentsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <YouTubeManageCommentsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <YouTubeManageCommentsPageContent />
    </ModuleShellContentGate>
  );
}

function YouTubeManageCommentsPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSettingsView = location.pathname === YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH;

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      void queryClient.invalidateQueries({ queryKey: ["youtube-content-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["youtube-content-comment-posts"] });
    }
  }, [searchParams, queryClient]);

  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useYouTubeContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useYouTubeContentSettings(
    organizationId,
    { enabled: Boolean(organizationId) && !gatePending },
  );

  const [channelId, setChannelId] = useState("");
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>("all");

  const selectedVideoId = searchParams.get("videoId");

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  useEffect(() => {
    if (!channelId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setChannelId(def.channel_id);
    }
  }, [activeAccounts, channelId]);

  useEffect(() => {
    setPostFilter("all");
  }, [channelId]);

  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.channel_id === channelId) ?? null,
    [activeAccounts, channelId],
  );

  const accountLabel =
    selectedAccount?.label?.trim() ||
    selectedAccount?.display_name?.trim() ||
    "YouTube";

  const commentsScopesGranted = selectedAccount?.comments_scopes_granted ?? false;

  const postsQuery = useYouTubeContentCommentPostsQuery({
    organizationId,
    channelId,
    accountAvatarUrl: selectedAccount?.thumbnail_url ?? null,
    accountLabel,
    enabled:
      reportingEnabled &&
      Boolean(channelId) &&
      activeAccounts.some((a) => a.channel_id === channelId) &&
      !isSettingsView &&
      canManage,
    liveRefresh: !isSettingsView,
  });

  const refetchPostsFromCache = useCallback(() => postsQuery.refetch(), [postsQuery.refetch]);
  useRefetchOnTabVisible(refetchPostsFromCache);

  useEffect(() => {
    if (searchParams.get("connected") !== "1" || !channelId || !organizationId) return;
    void postsQuery.refetchWithForce();
  }, [searchParams, channelId, organizationId, postsQuery.refetchWithForce]);

  const allPosts = postsQuery.data?.posts ?? [];
  const postsReady = postsQuery.isFetched && !postsQuery.isLoading;

  const inboxEnabled =
    Boolean(organizationId && channelId) &&
    reportingEnabled &&
    !isSettingsView &&
    canManage;

  const { syncPostBaselinesMutation, dismissPostHighlightMutation } =
    useYouTubeManageCommentsInboxState({
      organizationId,
      channelId,
      activeVideoId: selectedVideoId,
      enabled: inboxEnabled,
    });

  useSyncYouTubeManageCommentsPostBaselines({
    organizationId,
    channelId,
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
  } = useNewInboundPostHighlights(selectedVideoId, channelId);

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

  const youtubePlatformBadge = (
    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 ring-2 ring-white">
      <Youtube className="h-2.5 w-2.5 text-white" />
    </span>
  );

  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return <YouTubeManageCommentsPageSkeleton />;
  }

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
                  {t("digitalMarketing.youtubeContent.accessDeniedTitle", "Access restricted")}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    "digitalMarketing.youtubeContent.accessDeniedBody",
                    "Only the organization owner or an omnichannel admin can view YouTube content insights.",
                  )}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <YouTubeContentAccountNav
                accounts={activeAccounts}
                channelId={channelId}
                onChannelIdChange={(next) => {
                  setChannelId(next);
                  setSearchParams({}, { replace: true });
                  if (isSettingsView) {
                    navigate(SOCIAL_MEDIA_MANAGE_COMMENTS_YOUTUBE_PATH);
                  }
                }}
                settingsActive={isSettingsView}
                onSettingsSelect={() => navigate(YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH)}
              />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {isSettingsView ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                    {!commentsScopesGranted && (settings?.oauthConnected ?? false) ? (
                      <Alert className="mb-4">
                        <AlertTitle>
                          {t(
                            "digitalMarketing.manageComments.youtubeReconnectForCommentsTitle",
                            "Reconnect for comment access",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.manageComments.youtubeReconnectForComments",
                            "Reconnect your YouTube channel to grant the youtube.force-ssl scope required to read and reply to comments.",
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <YouTubeContentSettingsPanel
                      organizationId={organizationId}
                      oauthReturnPath={YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                    />
                  </div>
                ) : (
                  <>
                    {!reportingPending && !reportingEnabled ? (
                      <Alert className="mx-4 mb-2 mt-3 shrink-0">
                        <AlertTitle>
                          {t("digitalMarketing.youtubeContent.notConnected", "YouTube not connected")}
                        </AlertTitle>
                        <AlertDescription>
                          <Link
                            to={YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.youtubeContent.openSettings", "Open settings")}
                          </Link>
                        </AlertDescription>
                      </Alert>
                    ) : !commentsScopesGranted && reportingEnabled ? (
                      <Alert className="mx-4 mb-2 mt-3 shrink-0">
                        <AlertTitle>
                          {t(
                            "digitalMarketing.manageComments.youtubeReconnectForCommentsTitle",
                            "Reconnect for comment access",
                          )}
                        </AlertTitle>
                        <AlertDescription>
                          {t(
                            "digitalMarketing.manageComments.youtubeReconnectForComments",
                            "Reconnect your YouTube channel in settings to read and reply to comments (youtube.force-ssl scope).",
                          )}{" "}
                          <Link
                            to={YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                            className="font-medium text-primary underline"
                          >
                            {t("digitalMarketing.youtubeContent.openSettings", "Open settings")}
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
                              platformBadge={youtubePlatformBadge}
                            />
                          )}
                        </div>
                      }
                      main={
                        organizationId && channelId ? (
                          <YouTubeCommentThreadPanel
                            organizationId={organizationId}
                            channelId={channelId}
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
    </div>
  );
}
