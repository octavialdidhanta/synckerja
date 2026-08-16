import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileSocialMediaPerformancePageFrame } from "@/mobile/6-0-social-media-performance/components/MobileSocialMediaPerformancePageFrame";
import { MobileManageCommentsAccountButton } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsAccountButton";
import { MobileManageCommentsInboxNav } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsInboxNav";
import { MobileManageCommentsThreadSheet } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsThreadSheet";
import { MobileSmpContentList } from "@/mobile/6-0-social-media-performance/components/MobileSmpContentList";
import { formatSmpCount } from "@/mobile/6-0-social-media-performance/shared/formatSmpMetrics";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { TikTokCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokCommentThreadPanel";
import { YouTubeCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/youtube/YouTubeCommentThreadPanel";
import { MetaCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/meta/MetaCommentThreadPanel";
import { LinkedInCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/linkedin/LinkedInCommentThreadPanel";
import { ThreadsCommentThreadPanel } from "@/6-0-social-media-manage-comments/components/threads/ThreadsCommentThreadPanel";
import { filterManageCommentsPosts } from "@/6-0-social-media-manage-comments/lib/filterPostList";
import { SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH } from "@/6-0-social-media-manage-comments/lib/manageCommentsPaths";
import type {
  ManageCommentsPostFilter,
  ManageCommentsPostListItem,
} from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import { missingScopesForFeature } from "@/meta-platform/constants/metaOAuthScopes";
import {
  missingLinkedInScopesForFeature,
  parseLinkedInGrantedScopes,
} from "@/linkedin-content/constants/linkedinOAuthScopes";
import { LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH } from "@/linkedin-content/settings/linkedinContentSettingsPaths";
import { CONNECT_THREADS_PATH } from "@/threads-content/settings/threadsContentSettingsPaths";
import { useTikTokContentReportingEnabled } from "@/tiktok-content/hooks/useTikTokContentReportingEnabled";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import { useTikTokContentCommentPostsQuery } from "@/tiktok-content/hooks/useTikTokContentCommentPostsQuery";
import { getTikTokAccountDisplayLabel } from "@/tiktok-content/lib/tiktokAccountDisplayLabel";
import { useYouTubeContentReportingEnabled } from "@/youtube-content/hooks/useYouTubeContentReportingEnabled";
import { useYouTubeContentSettings } from "@/youtube-content/hooks/useYouTubeContentSettings";
import { useYouTubeContentCommentPostsQuery } from "@/youtube-content/hooks/useYouTubeContentCommentPostsQuery";
import { useMetaContentConfig } from "@/meta-content/hooks/useMetaContentConfig";
import { useMetaContentCommentPostsQuery } from "@/meta-content/hooks/useMetaContentCommentPostsQuery";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";
import { useLinkedInContentSettings } from "@/linkedin-content/hooks/useLinkedInContentSettings";
import { useLinkedInContentCommentPostsQuery } from "@/linkedin-content/hooks/useLinkedInContentComments";
import { useThreadsContentSettings } from "@/threads-content/hooks/useThreadsContentSettings";
import { useThreadsContentCommentPostsQuery } from "@/threads-content/hooks/useThreadsContentComments";

type InboxPlatform = "tiktok" | "youtube" | "instagram" | "facebook" | "linkedin" | "threads";

function parseInboxPlatform(pathname: string): InboxPlatform | "hub" | null {
  if (pathname.endsWith("/manage-comments") || pathname.endsWith("/manage-comments/")) return "hub";
  if (pathname.includes("/manage-comments/tiktok")) return "tiktok";
  if (pathname.includes("/manage-comments/youtube")) return "youtube";
  if (pathname.includes("/manage-comments/instagram")) return "instagram";
  if (pathname.includes("/manage-comments/facebook")) return "facebook";
  if (pathname.includes("/manage-comments/linkedin")) return "linkedin";
  if (pathname.includes("/manage-comments/threads")) return "threads";
  return null;
}

function toListItems(
  posts: ManageCommentsPostListItem[],
  commentsLabel: string,
): Array<{
  id: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  metrics: Array<{ label: string; value: string }>;
}> {
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    subtitle: post.postedAt ? new Date(post.postedAt).toLocaleDateString() : post.snippet,
    coverImageUrl: post.coverImageUrl,
    metrics: [{ label: commentsLabel, value: formatSmpCount(post.commentCount ?? 0) }],
  }));
}

export default function MobileManageCommentsInboxPage() {
  const location = useLocation();
  const platform = parseInboxPlatform(location.pathname);
  if (platform === "hub" || platform == null) {
    return <Navigate to={SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH} replace />;
  }
  if (platform === "tiktok") return <TikTokInbox />;
  if (platform === "youtube") return <YouTubeInbox />;
  if (platform === "instagram" || platform === "facebook") {
    return <MetaInbox platform={platform} />;
  }
  if (platform === "linkedin") return <LinkedInInbox />;
  return <ThreadsInbox />;
}

function TikTokInbox() {
  const { t } = useAppTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false } = useTikTokContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const [openId, setOpenId] = useState("");
  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );
  useEffect(() => {
    if (!openId && activeAccounts.length > 0) {
      setOpenId((activeAccounts.find((a) => a.is_default) ?? activeAccounts[0]).open_id);
    }
  }, [activeAccounts, openId]);
  const selected = activeAccounts.find((a) => a.open_id === openId) ?? null;
  const postsQuery = useTikTokContentCommentPostsQuery({
    organizationId,
    openId,
    accountAvatarUrl: selected?.avatar_url ?? null,
    accountLabel: selected ? getTikTokAccountDisplayLabel(selected) : null,
    enabled: reportingEnabled && Boolean(openId) && canManage,
    liveRefresh: false,
  });
  const commentsLabel = t("digitalMarketing.tiktokContent.summaryComments", "Comments");
  const commentsScopesGranted = selected?.comments_scopes_granted ?? false;
  return (
    <InboxShell
      accounts={activeAccounts.map((a) => ({
        value: a.open_id,
        label: getTikTokAccountDisplayLabel(a),
      }))}
      accountId={openId}
      onAccountIdChange={setOpenId}
      accountsLoading={settingsPending}
      posts={postsQuery.data?.posts ?? []}
      isLoading={postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data)}
      isError={postsQuery.isError}
      errorMessage={(postsQuery.error as Error)?.message}
      commentsLabel={commentsLabel}
      onRefresh={() => void postsQuery.refetchWithForce()}
      refreshDisabled={!openId || postsQuery.isFetching}
      isRefreshing={postsQuery.isFetching}
      denied={!canManage && !gatePending}
      renderThread={
        organizationId && openId
          ? (post) => (
              <TikTokCommentThreadPanel
                organizationId={organizationId}
                openId={openId}
                post={post}
                commentsScopesGranted={commentsScopesGranted}
              />
            )
          : undefined
      }
    />
  );
}

function YouTubeInbox() {
  const { t } = useAppTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false } = useYouTubeContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useYouTubeContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const [channelId, setChannelId] = useState("");
  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );
  useEffect(() => {
    if (!channelId && activeAccounts.length > 0) {
      setChannelId((activeAccounts.find((a) => a.is_default) ?? activeAccounts[0]).channel_id);
    }
  }, [activeAccounts, channelId]);
  const selected = activeAccounts.find((a) => a.channel_id === channelId) ?? null;
  const postsQuery = useYouTubeContentCommentPostsQuery({
    organizationId,
    channelId,
    accountAvatarUrl: selected?.thumbnail_url ?? null,
    accountLabel: selected?.label?.trim() || selected?.display_name?.trim() || "YouTube",
    enabled: reportingEnabled && Boolean(channelId) && canManage,
    liveRefresh: false,
  });
  const commentsScopesGranted = selected?.comments_scopes_granted ?? false;
  return (
    <InboxShell
      accounts={activeAccounts.map((a) => ({
        value: a.channel_id,
        label: a.label?.trim() || a.display_name?.trim() || a.channel_id,
      }))}
      accountId={channelId}
      onAccountIdChange={setChannelId}
      accountsLoading={settingsPending}
      posts={postsQuery.data?.posts ?? []}
      isLoading={postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data)}
      isError={postsQuery.isError}
      errorMessage={(postsQuery.error as Error)?.message}
      commentsLabel={t("digitalMarketing.tiktokContent.summaryComments", "Comments")}
      onRefresh={() => void postsQuery.refetchWithForce()}
      refreshDisabled={!channelId || postsQuery.isFetching}
      isRefreshing={postsQuery.isFetching}
      denied={!canManage && !gatePending}
      renderThread={
        organizationId && channelId
          ? (post) => (
              <YouTubeCommentThreadPanel
                organizationId={organizationId}
                channelId={channelId}
                post={post}
                commentsScopesGranted={commentsScopesGranted}
              />
            )
          : undefined
      }
    />
  );
}

function MetaInbox({ platform }: { platform: MetaContentPlatform }) {
  const { t } = useAppTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const configQuery = useMetaContentConfig(organizationId);
  const [accountId, setAccountId] = useState("");
  const platformAccounts = useMemo(
    () => (configQuery.data?.accounts ?? []).filter((a) => a.platform === platform),
    [configQuery.data?.accounts, platform],
  );
  useEffect(() => {
    if (!accountId && platformAccounts.length > 0) {
      setAccountId(platformAccounts[0].account_id);
    }
  }, [platformAccounts, accountId]);
  const selected = platformAccounts.find((a) => a.account_id === accountId) ?? null;
  const commentsScopesGranted = useMemo(() => {
    if (!selected) return false;
    return missingScopesForFeature(selected.granted_scopes ?? [], "comments").length === 0;
  }, [selected]);
  const postsQuery = useMetaContentCommentPostsQuery({
    organizationId,
    platform,
    accountId,
    accountAvatarUrl: selected?.avatar_url ?? null,
    accountLabel: selected?.account_label ?? null,
    enabled: Boolean(organizationId && accountId && canManage && !gatePending),
    liveRefresh: false,
  });
  return (
    <InboxShell
      accounts={platformAccounts.map((a) => ({
        value: a.account_id,
        label: a.account_label || a.account_id,
      }))}
      accountId={accountId}
      onAccountIdChange={setAccountId}
      accountsLoading={configQuery.isPending}
      posts={postsQuery.posts}
      isLoading={postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data)}
      isError={postsQuery.isError}
      errorMessage={(postsQuery.error as Error)?.message}
      commentsLabel={t("digitalMarketing.tiktokContent.summaryComments", "Comments")}
      onRefresh={() => void postsQuery.refetchWithForce()}
      refreshDisabled={!accountId || postsQuery.isFetching}
      isRefreshing={postsQuery.isFetching}
      denied={!canManage && !gatePending}
      likesContext={
        organizationId && accountId
          ? { organizationId, accountId }
          : undefined
      }
      renderThread={
        organizationId && accountId
          ? (post) => (
              <MetaCommentThreadPanel
                organizationId={organizationId}
                platform={platform}
                accountId={accountId}
                post={post}
                commentsScopesGranted={commentsScopesGranted}
                connectPath="/omnichannel/integrations/instagram"
              />
            )
          : undefined
      }
    />
  );
}

function LinkedInInbox() {
  const { t } = useAppTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useLinkedInContentSettings(organizationId);
  const [pageId, setPageId] = useState("");
  const accounts = useMemo(() => settingsQuery.data?.accounts ?? [], [settingsQuery.data?.accounts]);
  useEffect(() => {
    if (!pageId && accounts.length > 0) {
      setPageId((accounts.find((a) => a.is_default) ?? accounts[0]).page_id);
    }
  }, [accounts, pageId]);
  const selected = accounts.find((a) => a.page_id === pageId) ?? null;
  const commentsScopesGranted = useMemo(() => {
    if (!selected) return false;
    const granted = parseLinkedInGrantedScopes(selected.granted_scopes);
    return missingLinkedInScopesForFeature(granted, "comments").length === 0;
  }, [selected]);
  const postsQuery = useLinkedInContentCommentPostsQuery({
    organizationId,
    pageId,
    accountAvatarUrl: selected?.thumbnail_url ?? null,
    accountLabel: selected?.label || selected?.display_name || null,
    enabled: Boolean(organizationId && pageId && canManage && !gatePending),
    liveRefresh: false,
  });
  return (
    <InboxShell
      accounts={accounts.map((a) => ({
        value: a.page_id,
        label: a.label?.trim() || a.display_name?.trim() || a.page_id,
      }))}
      accountId={pageId}
      onAccountIdChange={setPageId}
      accountsLoading={settingsQuery.isPending}
      posts={postsQuery.posts}
      isLoading={postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data)}
      isError={postsQuery.isError}
      errorMessage={(postsQuery.error as Error)?.message}
      commentsLabel={t("digitalMarketing.tiktokContent.summaryComments", "Comments")}
      onRefresh={() => void postsQuery.refetchWithForce()}
      refreshDisabled={!pageId || postsQuery.isFetching}
      isRefreshing={postsQuery.isFetching}
      denied={!canManage && !gatePending}
      renderThread={
        organizationId && pageId
          ? (post) => (
              <LinkedInCommentThreadPanel
                organizationId={organizationId}
                pageId={pageId}
                post={post}
                commentsScopesGranted={commentsScopesGranted}
                settingsPath={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
              />
            )
          : undefined
      }
    />
  );
}

function ThreadsInbox() {
  const { t } = useAppTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useThreadsContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const [accountId, setAccountId] = useState("");
  const accounts = useMemo(() => settingsQuery.data?.accounts ?? [], [settingsQuery.data?.accounts]);
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].account_id);
    }
  }, [accounts, accountId]);
  const selected = accounts.find((a) => a.account_id === accountId) ?? null;
  const postsQuery = useThreadsContentCommentPostsQuery({
    organizationId,
    accountId,
    accountAvatarUrl: selected?.avatar_url ?? null,
    accountLabel: selected?.account_label ?? null,
    enabled: Boolean(organizationId && accountId && canManage && settingsQuery.data?.oauthConnected),
    liveRefresh: false,
  });
  return (
    <InboxShell
      accounts={accounts.map((a) => ({
        value: a.account_id,
        label: a.account_label || a.account_id,
      }))}
      accountId={accountId}
      onAccountIdChange={setAccountId}
      accountsLoading={settingsQuery.isPending}
      posts={postsQuery.posts}
      isLoading={postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data)}
      isError={postsQuery.isError}
      errorMessage={(postsQuery.error as Error)?.message}
      commentsLabel={t("digitalMarketing.tiktokContent.summaryComments", "Comments")}
      onRefresh={() => void postsQuery.refetchWithForce()}
      refreshDisabled={!accountId || postsQuery.isFetching}
      isRefreshing={postsQuery.isFetching}
      denied={!canManage && !gatePending}
      renderThread={
        organizationId && accountId
          ? (post) => (
              <ThreadsCommentThreadPanel
                organizationId={organizationId}
                accountId={accountId}
                account={selected}
                post={post}
                connectPath={CONNECT_THREADS_PATH}
              />
            )
          : undefined
      }
    />
  );
}

function InboxShell({
  accounts,
  accountId,
  onAccountIdChange,
  accountsLoading,
  posts,
  isLoading,
  isError,
  errorMessage,
  commentsLabel,
  onRefresh,
  refreshDisabled,
  isRefreshing,
  denied,
  renderThread,
  likesContext,
}: {
  accounts: Array<{ value: string; label: string }>;
  accountId: string;
  onAccountIdChange: (id: string) => void;
  accountsLoading?: boolean;
  posts: ManageCommentsPostListItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  commentsLabel: string;
  onRefresh: () => void;
  refreshDisabled: boolean;
  isRefreshing: boolean;
  denied: boolean;
  renderThread?: (post: ManageCommentsPostListItem) => ReactNode;
  likesContext?: {
    organizationId: string;
    accountId: string;
  };
}) {
  const { t } = useAppTranslation();
  const [postFilter, setPostFilter] = useState<ManageCommentsPostFilter>("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const filteredPosts = useMemo(
    () => filterManageCommentsPosts(posts, postFilter, ""),
    [posts, postFilter],
  );
  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );

  useEffect(() => {
    setSelectedPostId(null);
  }, [accountId]);
  return (
    <MobileSocialMediaPerformancePageFrame
      onRefresh={onRefresh}
      refreshDisabled={refreshDisabled}
      isRefreshing={isRefreshing}
      headerActions={
        denied ? undefined : (
          <MobileManageCommentsAccountButton
            accounts={accounts}
            accountId={accountId}
            onAccountIdChange={onAccountIdChange}
            accountsLoading={accountsLoading}
          />
        )
      }
    >
      {denied ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.tiktokContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.accessDeniedBody",
              "Only the organization owner or an omnichannel admin can view this inbox.",
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <MobileManageCommentsInboxNav filter={postFilter} onFilterChange={setPostFilter} />
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t("digitalMarketing.manageComments.error", "Failed to load posts")}
              </AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpContentList
              items={toListItems(filteredPosts, commentsLabel)}
              isLoading={isLoading}
              emptyText={t("digitalMarketing.manageComments.noPosts", "No posts in this inbox.")}
              onItemSelect={renderThread ? setSelectedPostId : undefined}
            />
          )}
          {renderThread && selectedPost ? (
            <MobileManageCommentsThreadSheet
              open
              onOpenChange={(open) => {
                if (!open) setSelectedPostId(null);
              }}
              post={selectedPost}
              likesContext={likesContext}
            >
              {renderThread(selectedPost)}
            </MobileManageCommentsThreadSheet>
          ) : null}
        </>
      )}
    </MobileSocialMediaPerformancePageFrame>
  );
}
