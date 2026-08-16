import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { MANAGE_COMMENTS_POSTS_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';

export type LinkedInCommentPostRow = {
  id: string;
  media_id?: string;
  post_id?: string;
  caption?: string;
  title?: string;
  thumbnail_url?: string | null;
  cover_image_url?: string | null;
  permalink?: string | null;
  share_url?: string | null;
  timestamp?: string | null;
  posted_at?: string | null;
  comment_count: number;
  like_count?: number;
};

export type LinkedInContentCommentRow = {
  id: string;
  media_id: string;
  post_id?: string;
  text: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_channel_owner: boolean;
  can_reply: boolean;
};

async function invokeLinkedInComments(args: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('linkedin-content-api', { body: args });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

function toPostListItem(
  row: LinkedInCommentPostRow,
  accountAvatarUrl: string | null,
  accountLabel: string,
): ManageCommentsPostListItem {
  const title = (row.caption ?? row.title ?? '').trim() || 'Post';
  const snippet =
    row.comment_count > 0
      ? `${row.comment_count} comment${row.comment_count === 1 ? '' : 's'}`
      : 'No comments yet';
  const id = String(row.id ?? row.media_id ?? row.post_id ?? '').trim();
  return {
    id,
    title,
    snippet,
    coverImageUrl: row.thumbnail_url ?? row.cover_image_url ?? null,
    postedAt: row.timestamp ?? row.posted_at ?? null,
    commentCount: row.comment_count,
    likeCount: row.like_count ?? null,
    viewCount: null,
    shareUrl: row.permalink ?? row.share_url ?? null,
    duration: null,
    accountAvatarUrl,
    accountLabel,
  };
}

export function useLinkedInContentCommentPostsQuery(args: {
  organizationId: string | null | undefined;
  pageId: string;
  accountAvatarUrl?: string | null;
  accountLabel?: string | null;
  enabled?: boolean;
  liveRefresh?: boolean;
}) {
  const {
    organizationId,
    pageId,
    accountAvatarUrl = null,
    accountLabel = null,
    enabled = true,
    liveRefresh = true,
  } = args;

  const query = useQuery({
    queryKey: ['linkedin-content-comment-posts', organizationId, pageId],
    enabled: Boolean(organizationId && pageId && enabled),
    queryFn: async () => {
      const data = await invokeLinkedInComments({
        action: 'getCommentPosts',
        organization_id: organizationId,
        page_id: pageId,
      });
      return data as { posts: LinkedInCommentPostRow[]; account_label?: string };
    },
    refetchInterval: liveRefresh ? MANAGE_COMMENTS_POSTS_POLL_MS : false,
  });

  const posts = useMemo(
    () =>
      (query.data?.posts ?? []).map((row) =>
        toPostListItem(row, accountAvatarUrl, accountLabel ?? query.data?.account_label ?? pageId),
      ),
    [query.data, accountAvatarUrl, accountLabel, pageId],
  );

  const refetchWithForce = useCallback(() => query.refetch(), [query]);

  return { ...query, posts, refetchWithForce };
}

export function useLinkedInContentCommentsQuery(args: {
  organizationId: string;
  pageId: string;
  postId: string | null;
  enabled?: boolean;
  refetchIntervalMs?: number;
}) {
  const { organizationId, pageId, postId, enabled = true, refetchIntervalMs } = args;
  return useQuery({
    queryKey: ['linkedin-content-comments', organizationId, pageId, postId],
    enabled: Boolean(organizationId && pageId && postId && enabled),
    queryFn: async () => {
      const data = await invokeLinkedInComments({
        action: 'listComments',
        organization_id: organizationId,
        page_id: pageId,
        post_id: postId,
        media_id: postId,
        sort: 'newest',
      });
      return data as { comments: LinkedInContentCommentRow[] };
    },
    refetchInterval: refetchIntervalMs ?? false,
  });
}

export function useLinkedInContentCommentRepliesQuery(args: {
  organizationId: string;
  pageId: string;
  postId: string;
  commentId: string;
  enabled?: boolean;
}) {
  const { organizationId, pageId, postId, commentId, enabled = true } = args;
  return useQuery({
    queryKey: ['linkedin-content-comment-replies', organizationId, pageId, postId, commentId],
    enabled: Boolean(organizationId && pageId && postId && commentId && enabled),
    queryFn: async () => {
      const data = await invokeLinkedInComments({
        action: 'listReplies',
        organization_id: organizationId,
        page_id: pageId,
        post_id: postId,
        media_id: postId,
        comment_id: commentId,
        sort: 'newest',
      });
      return data as { comments: LinkedInContentCommentRow[] };
    },
  });
}

export function useLinkedInContentCommentMutations(args: {
  organizationId: string;
  pageId: string;
  postId: string | null;
}) {
  const queryClient = useQueryClient();
  const { organizationId, pageId, postId } = args;

  const replyMutation = useMutation({
    mutationFn: async (input: { commentId: string; text: string }) => {
      if (!postId) throw new Error('No post selected');
      return invokeLinkedInComments({
        action: 'replyComment',
        organization_id: organizationId,
        page_id: pageId,
        post_id: postId,
        media_id: postId,
        comment_id: input.commentId,
        text: input.text,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['linkedin-content-comments', organizationId, pageId, postId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['linkedin-content-comment-posts', organizationId, pageId],
      });
    },
  });

  return { replyMutation };
}
