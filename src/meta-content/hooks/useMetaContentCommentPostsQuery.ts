import { useCallback, useMemo, useRef } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { MetaContentPlatform, MetaContentPostRow } from '@/meta-platform/types/metaContentTypes';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { MANAGE_COMMENTS_POSTS_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';

function stabilizePostListItem(
  prev: ManageCommentsPostListItem | undefined,
  next: ManageCommentsPostListItem,
): ManageCommentsPostListItem {
  if (!prev) return next;
  // Instagram/Facebook CDN URLs rotate query tokens on every poll; keep the first
  // playable URL so <video> does not remount and reset playback.
  const videoUrl = prev.videoUrl || next.videoUrl;
  const coverImageUrl = prev.coverImageUrl || next.coverImageUrl;
  if (
    prev.title === next.title &&
    prev.snippet === next.snippet &&
    prev.videoUrl === videoUrl &&
    prev.coverImageUrl === coverImageUrl &&
    prev.commentCount === next.commentCount &&
    prev.likeCount === next.likeCount &&
    prev.shareUrl === next.shareUrl &&
    prev.postedAt === next.postedAt &&
    prev.mediaType === next.mediaType &&
    prev.accountAvatarUrl === next.accountAvatarUrl &&
    prev.accountLabel === next.accountLabel
  ) {
    return prev;
  }
  return { ...next, videoUrl, coverImageUrl };
}

function toPostListItem(
  row: MetaContentPostRow,
  accountAvatarUrl: string | null,
  accountLabel: string,
): ManageCommentsPostListItem {
  const title = row.caption?.trim() || row.media_type || 'Post';
  const snippet =
    row.comment_count > 0
      ? `${row.comment_count} comment${row.comment_count === 1 ? '' : 's'}`
      : 'No comments yet';
  const id = String(row.id ?? row.media_id ?? '').trim();
  const mediaType = row.media_type?.trim() || null;
  const mediaUrl = row.media_url?.trim() || null;
  const isVideoType = Boolean(mediaType && /video|reel/i.test(mediaType));
  const looksLikeVideoFile = Boolean(mediaUrl && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl));
  const useAsVideo = Boolean(mediaUrl && (looksLikeVideoFile || isVideoType));
  return {
    id,
    title,
    snippet,
    coverImageUrl: row.thumbnail_url ?? (useAsVideo ? null : mediaUrl),
    videoUrl: useAsVideo ? mediaUrl : null,
    mediaType: isVideoType ? 'VIDEO' : mediaType,
    postedAt: row.timestamp,
    commentCount: row.comment_count,
    likeCount: row.like_count,
    viewCount: null,
    shareUrl: row.permalink,
    duration: null,
    accountAvatarUrl,
    accountLabel,
  };
}

export async function fetchMetaCommentPosts(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
}): Promise<{ posts: MetaContentPostRow[]; account_label: string }> {
  const { data, error } = await supabase.functions.invoke('meta-content-comments', {
    body: {
      action: 'listPosts',
      organization_id: args.organizationId,
      platform: args.platform,
      account_id: args.accountId,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as {
    posts?: MetaContentPostRow[];
    account_label?: string;
    error?: string;
  };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return { posts: payload.posts ?? [], account_label: payload.account_label ?? args.accountId };
}

export function useMetaContentCommentPostsQuery(args: {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  accountAvatarUrl?: string | null;
  accountLabel?: string | null;
  enabled?: boolean;
  liveRefresh?: boolean;
}) {
  const {
    organizationId,
    platform,
    accountId,
    accountAvatarUrl = null,
    accountLabel = null,
    enabled = true,
    liveRefresh = true,
  } = args;
  const forceRefreshRef = useRef(false);

  const query = useQuery({
    queryKey: ['meta-content-comment-posts', organizationId, platform, accountId],
    enabled: Boolean(organizationId && accountId && enabled),
    queryFn: async () => {
      const res = await fetchMetaCommentPosts({
        organizationId: organizationId!,
        platform,
        accountId,
      });
      forceRefreshRef.current = false;
      return res;
    },
    staleTime: liveRefresh ? 8_000 : 60_000,
    refetchInterval: liveRefresh ? MANAGE_COMMENTS_POSTS_POLL_MS : false,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  const postsByIdRef = useRef<Map<string, ManageCommentsPostListItem>>(new Map());

  const posts = useMemo(() => {
    const mapped = (query.data?.posts ?? []).map((row) =>
      toPostListItem(row, accountAvatarUrl, accountLabel ?? query.data?.account_label ?? accountId),
    );
    const prevById = postsByIdRef.current;
    const nextById = new Map<string, ManageCommentsPostListItem>();
    const nextPosts = mapped.map((item) => {
      const prev = prevById.get(item.id);
      const stable = stabilizePostListItem(prev, item);
      nextById.set(item.id, stable);
      return stable;
    });
    postsByIdRef.current = nextById;
    return nextPosts;
  }, [query.data, accountAvatarUrl, accountLabel, accountId]);

  const refetchWithForce = useCallback(async () => {
    forceRefreshRef.current = true;
    return query.refetch();
  }, [query]);

  return { ...query, posts, refetchWithForce };
}
