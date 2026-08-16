import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import {
  MANAGE_COMMENTS_POSTS_POLL_MS,
  MANAGE_COMMENTS_THREAD_POLL_MS,
} from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';

export type ThreadsCommentPostRow = {
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

export type ThreadsContentCommentInboxState = {
  posts: Array<{
    media_id: string;
    last_known_comment_count: number;
    is_highlighted: boolean;
    pinned_at: string | null;
  }>;
  inbound_comments: Array<{ media_id: string; comment_id: string; detected_at: string }>;
  engaged_comment_ids: string[];
};

export function patchThreadsPostCommentCountInCache(args: {
  queryClient: ReturnType<typeof useQueryClient>;
  organizationId: string;
  accountId: string;
  mediaId: string;
  commentCount: number;
}) {
  const { queryClient, organizationId, accountId, mediaId, commentCount } = args;
  queryClient.setQueriesData<{ posts?: ThreadsCommentPostRow[]; inbox?: ThreadsContentCommentInboxState }>(
    { queryKey: ['threads-content-comment-posts', organizationId, accountId] },
    (prev) => {
      if (!prev?.posts?.length) return prev;
      return {
        ...prev,
        posts: prev.posts.map((row) => {
          const id = String(row.id ?? row.media_id ?? row.post_id ?? '').trim();
          if (id !== mediaId) return row;
          return { ...row, comment_count: commentCount };
        }),
      };
    },
  );
}

export type ThreadsContentCommentRow = {
  id: string;
  media_id: string;
  text: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_channel_owner: boolean;
  can_reply: boolean;
  can_edit?: boolean;
};

async function invokeThreadsComments(args: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('threads-content-api', { body: args });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

function threadsCommentsPollInterval(
  query: { state: { status: string } },
  intervalMs: number | false | undefined,
): number | false {
  if (!intervalMs) return false;
  if (query.state.status === 'error') return false;
  return intervalMs;
}

function toPostListItem(
  row: ThreadsCommentPostRow,
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

export function useThreadsContentCommentPostsQuery(args: {
  organizationId: string | null | undefined;
  accountId: string;
  accountAvatarUrl?: string | null;
  accountLabel?: string | null;
  enabled?: boolean;
  liveRefresh?: boolean;
}) {
  const {
    organizationId,
    accountId,
    accountAvatarUrl = null,
    accountLabel = null,
    enabled = true,
    liveRefresh = true,
  } = args;

  const query = useQuery({
    queryKey: ['threads-content-comment-posts', organizationId, accountId],
    enabled: Boolean(organizationId && accountId && enabled),
    queryFn: async () => {
      const data = await invokeThreadsComments({
        action: 'getCommentPosts',
        organization_id: organizationId,
        account_id: accountId,
        all_time: true,
      });
      return data as {
        posts: ThreadsCommentPostRow[];
        account_label?: string;
        inbox?: ThreadsContentCommentInboxState;
      };
    },
    refetchInterval: liveRefresh
      ? (query) => threadsCommentsPollInterval(query, MANAGE_COMMENTS_POSTS_POLL_MS)
      : false,
    retry: 1,
  });

  const posts = useMemo(
    () =>
      (query.data?.posts ?? []).map((row) =>
        toPostListItem(row, accountAvatarUrl, accountLabel ?? query.data?.account_label ?? accountId),
      ),
    [query.data, accountAvatarUrl, accountLabel, accountId],
  );

  const inboxState = query.data?.inbox ?? null;

  const refetchWithForce = useCallback(() => query.refetch(), [query]);

  return { ...query, posts, inboxState, refetchWithForce };
}

export function useThreadsContentCommentsQuery(args: {
  organizationId: string;
  accountId: string;
  mediaId: string | null;
  enabled?: boolean;
  refetchIntervalMs?: number;
}) {
  const { organizationId, accountId, mediaId, enabled = true, refetchIntervalMs } = args;
  return useQuery({
    queryKey: ['threads-content-comments', organizationId, accountId, mediaId],
    enabled: Boolean(organizationId && accountId && mediaId && enabled),
    queryFn: async () => {
      const data = await invokeThreadsComments({
        action: 'listComments',
        organization_id: organizationId,
        account_id: accountId,
        media_id: mediaId,
        post_id: mediaId,
        sort: 'newest',
      });
      return data as {
        comments: ThreadsContentCommentRow[];
        comment_count?: number;
        activity_count?: number;
      };
    },
    refetchInterval: (query) => threadsCommentsPollInterval(query, refetchIntervalMs),
    retry: 1,
  });
}

export function useThreadsContentCommentRepliesQuery(args: {
  organizationId: string;
  accountId: string;
  mediaId: string;
  commentId: string;
  enabled?: boolean;
  refetchIntervalMs?: number;
}) {
  const { organizationId, accountId, mediaId, commentId, enabled = true, refetchIntervalMs } = args;
  return useQuery({
    queryKey: ['threads-content-comment-replies', organizationId, accountId, mediaId, commentId],
    enabled: Boolean(organizationId && accountId && mediaId && commentId && enabled),
    queryFn: async () => {
      const data = await invokeThreadsComments({
        action: 'listReplies',
        organization_id: organizationId,
        account_id: accountId,
        media_id: mediaId,
        post_id: mediaId,
        comment_id: commentId,
        sort: 'newest',
      });
      return data as { comments: ThreadsContentCommentRow[]; comment_count?: number };
    },
    refetchInterval: (query) => threadsCommentsPollInterval(query, refetchIntervalMs),
    retry: 1,
  });
}

export function useThreadsContentCommentMutations(args: {
  organizationId: string;
  accountId: string;
  mediaId: string | null;
}) {
  const queryClient = useQueryClient();
  const { organizationId, accountId, mediaId } = args;

  const replyMutation = useMutation({
    mutationFn: async (input: { commentId: string; text: string }) => {
      if (!mediaId) throw new Error('No post selected');
      return invokeThreadsComments({
        action: 'replyComment',
        organization_id: organizationId,
        account_id: accountId,
        media_id: mediaId,
        post_id: mediaId,
        comment_id: input.commentId,
        text: input.text,
      }) as Promise<{ ok?: boolean; comment_id?: string }>;
    },
    onSuccess: () => {
      // Meta Threads reply list is eventually consistent — keep client-side rows until server catches up.
      void queryClient.invalidateQueries({
        queryKey: ['threads-content-comment-posts', organizationId, accountId],
      });
      if (mediaId) {
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comments', organizationId, accountId, mediaId],
        });
      }
    },
  });

  const hideMutation = useMutation({
    mutationFn: async (input: { commentId: string }) => {
      if (!mediaId) throw new Error('No post selected');
      return invokeThreadsComments({
        action: 'hideComment',
        organization_id: organizationId,
        account_id: accountId,
        media_id: mediaId,
        comment_id: input.commentId,
        hide: true,
      });
    },
    onSuccess: () => {
      if (mediaId) {
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comments', organizationId, accountId, mediaId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comment-replies', organizationId, accountId, mediaId],
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { commentId: string }) => {
      if (!mediaId) throw new Error('No post selected');
      return invokeThreadsComments({
        action: 'deleteComment',
        organization_id: organizationId,
        account_id: accountId,
        media_id: mediaId,
        comment_id: input.commentId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['threads-content-comment-posts', organizationId, accountId],
      });
      if (mediaId) {
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comments', organizationId, accountId, mediaId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comment-replies', organizationId, accountId, mediaId],
        });
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: async (input: {
      commentId: string;
      parentCommentId: string;
      text: string;
      publishedAt?: string | null;
      isChannelOwner?: boolean;
    }) => {
      if (!mediaId) throw new Error('No post selected');
      return invokeThreadsComments({
        action: 'editComment',
        organization_id: organizationId,
        account_id: accountId,
        media_id: mediaId,
        comment_id: input.commentId,
        parent_comment_id: input.parentCommentId,
        text: input.text,
        published_at: input.publishedAt ?? null,
        is_channel_owner: input.isChannelOwner ?? false,
      }) as Promise<{ ok?: boolean; comment_id?: string }>;
    },
    onSuccess: () => {
      if (mediaId) {
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comments', organizationId, accountId, mediaId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['threads-content-comment-replies', organizationId, accountId, mediaId],
        });
      }
    },
  });

  return { replyMutation, hideMutation, deleteMutation, editMutation };
}
