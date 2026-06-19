import { useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { MetaContentPlatform, MetaContentPostRow } from '@/meta-platform/types/metaContentTypes';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { MANAGE_COMMENTS_POSTS_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';

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
  return {
    id,
    title: title.length > 80 ? `${title.slice(0, 77)}…` : title,
    snippet,
    coverImageUrl: row.thumbnail_url ?? row.media_url,
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

async function fetchMetaCommentPosts(args: {
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
    refetchInterval: liveRefresh ? MANAGE_COMMENTS_POSTS_POLL_MS : false,
  });

  const posts = useMemo(
    () =>
      (query.data?.posts ?? []).map((row) =>
        toPostListItem(row, accountAvatarUrl, accountLabel ?? query.data?.account_label ?? accountId),
      ),
    [query.data, accountAvatarUrl, accountLabel, accountId],
  );

  const refetchWithForce = useCallback(async () => {
    forceRefreshRef.current = true;
    return query.refetch();
  }, [query]);

  return { ...query, posts, refetchWithForce };
}
